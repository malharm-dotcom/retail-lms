import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { chunkCount, expectedChunkBytes, MAX_VIDEO_BYTES, sniffVideoType } from "@/lib/video";

/*
 * Video upload in three calls, so no single request is bigger than one chunk:
 *   POST  { sectionId | lessonId, fileName, sizeBytes }          → { assetId }
 *   PUT   ?assetId=…&index=n  (raw bytes of chunk n)
 *   PATCH { assetId, sectionId | lessonId, title, required, requiredWatchPercentage }
 * The PATCH checks every chunk arrived, then adds the lesson (or swaps the file on a draft lesson).
 * ponytail: an abandoned upload leaves an unattached Asset + chunks; add a sweep if that ever matters.
 */

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Body = Record<string, unknown>;

/** The draft module version a new/replaced video lesson belongs to. */
async function draftTarget(body: Body) {
  const lessonId = String(body.lessonId ?? "");
  const sectionId = String(body.sectionId ?? "");
  const section = lessonId
    ? (await prisma().lesson.findUnique({ where: { id: lessonId }, include: { section: { include: { moduleVersion: true } } } }))
        ?.section
    : await prisma().section.findUnique({ where: { id: sectionId }, include: { moduleVersion: true } });
  if (!section) throw new Error("Section not found.");
  if (section.moduleVersion.status !== "DRAFT") throw new Error("Published versions are locked. Create a new version to edit.");
  return { section, lessonId };
}

async function admin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!(await admin())) return fail("Not authorised", 403);
  const body = (await request.json().catch(() => ({}))) as Body;
  const sizeBytes = Number(body.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) return fail("Choose a video file.");
  if (sizeBytes > MAX_VIDEO_BYTES) return fail("Videos must be 500 MB or smaller. Compress the file (720p MP4 is plenty) and try again.");
  try {
    const { section } = await draftTarget(body);
    const asset = await prisma().asset.create({
      data: {
        moduleVersionId: section.moduleVersionId,
        label: String(body.fileName ?? "video").slice(0, 140),
        fileName: String(body.fileName ?? "").replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "video.mp4",
        mimeType: "", // set from the first chunk's header
        sizeBytes,
      },
      select: { id: true },
    });
    return NextResponse.json({ assetId: asset.id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed.");
  }
}

export async function PUT(request: Request) {
  if (!(await admin())) return fail("Not authorised", 403);
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId") ?? "";
  const index = Number(url.searchParams.get("index"));

  const asset = await prisma().asset.findUnique({
    where: { id: assetId },
    select: { sizeBytes: true, data: true, _count: { select: { lessons: true } } },
  });
  // Only unattached chunked uploads accept bytes, so live lessons can never be altered.
  if (!asset || asset.data || asset._count.lessons > 0) return fail("Upload not found.", 404);
  if (!Number.isInteger(index) || index < 0 || index >= chunkCount(asset.sizeBytes)) return fail("Bad chunk index.");

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length !== expectedChunkBytes(asset.sizeBytes, index)) return fail("Chunk size mismatch. Try the upload again.");
  if (index === 0) {
    const mimeType = sniffVideoType(bytes.subarray(0, 16));
    if (!mimeType) return fail("That file is not an MP4, MOV or WebM video.");
    await prisma().asset.update({ where: { id: assetId }, data: { mimeType } });
  }
  await prisma().assetChunk.upsert({
    where: { assetId_index: { assetId, index } },
    create: { assetId, index, data: bytes },
    update: { data: bytes },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await admin();
  if (!user) return fail("Not authorised", 403);
  const body = (await request.json().catch(() => ({}))) as Body;
  const assetId = String(body.assetId ?? "");
  const title = String(body.title ?? "").trim().slice(0, 140);
  const required = body.required !== false;
  const percent = Math.round(Number(body.requiredWatchPercentage ?? 95));
  const requiredWatchPercentage = Number.isFinite(percent) ? Math.min(100, Math.max(50, percent)) : 95;

  try {
    const { section, lessonId } = await draftTarget(body);
    if (!lessonId && !title) return fail("Give the lesson a title.");
    const asset = await prisma().asset.findUnique({
      where: { id: assetId },
      select: { moduleVersionId: true, mimeType: true, sizeBytes: true, fileName: true, _count: { select: { chunks: true } } },
    });
    if (!asset || asset.moduleVersionId !== section.moduleVersionId) return fail("Upload not found.", 404);
    if (!asset.mimeType || asset._count.chunks !== chunkCount(asset.sizeBytes)) return fail("The upload is incomplete. Try again.");

    if (lessonId) {
      await prisma().lesson.update({
        where: { id: lessonId },
        data: { assetId, youtubeVideoId: null, videoDurationSeconds: null },
      });
    } else {
      const last = await prisma().lesson.aggregate({ where: { sectionId: section.id }, _max: { position: true } });
      await prisma().lesson.create({
        data: {
          sectionId: section.id,
          title,
          type: "VIDEO",
          position: (last._max.position ?? 0) + 1,
          assetId,
          required,
          requiredWatchPercentage,
        },
      });
    }
    await audit(user, "asset.uploaded", "Asset", assetId, { fileName: asset.fileName, sizeBytes: asset.sizeBytes });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed.");
  }
}
