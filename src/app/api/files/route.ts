import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Upload a PDF. Either creates a new PDF lesson (sectionId + title) or replaces the file
 * on an existing draft lesson (lessonId).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return fail("Not authorised", 403);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a PDF file.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("PDFs must be 25 MB or smaller. Compress the file and try again.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return fail("That file is not a PDF. Export slides to PDF first.");

  const lessonId = String(form.get("lessonId") ?? "");
  const sectionId = String(form.get("sectionId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const required = form.get("required") !== "false";

  const section = lessonId
    ? (await prisma().lesson.findUnique({ where: { id: lessonId }, include: { section: { include: { moduleVersion: true } } } }))?.section
    : await prisma().section.findUnique({ where: { id: sectionId }, include: { moduleVersion: true } });
  if (!section) return fail("Section not found.", 404);
  if (section.moduleVersion.status !== "DRAFT") return fail("Published versions are locked. Create a new version to edit.");
  if (!lessonId && !title) return fail("Give the lesson a title.");

  const asset = await prisma().asset.create({
    data: {
      moduleVersionId: section.moduleVersionId,
      label: title || file.name,
      fileName: file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "document.pdf",
      mimeType: "application/pdf",
      sizeBytes: file.size,
      data: bytes,
    },
    select: { id: true },
  });

  if (lessonId) {
    await prisma().lesson.update({ where: { id: lessonId }, data: { assetId: asset.id } });
  } else {
    const last = await prisma().lesson.aggregate({ where: { sectionId: section.id }, _max: { position: true } });
    await prisma().lesson.create({
      data: { sectionId: section.id, title, type: "PDF", position: (last._max.position ?? 0) + 1, assetId: asset.id, required },
    });
  }
  await audit(user, "asset.uploaded", "Asset", asset.id, { fileName: file.name, sizeBytes: file.size });
  return NextResponse.json({ ok: true, assetId: asset.id });
}
