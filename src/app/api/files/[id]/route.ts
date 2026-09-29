import { prisma } from "@/lib/db";
import { canAccessAdmin } from "@/lib/rbac";
import { currentUserOrNull } from "@/lib/session";
import { chunkCount, chunkRange } from "@/lib/video";

/**
 * Stream a stored file to admins, or to learners enrolled in a version that uses it.
 * Videos are chunked and answer Range requests so the player can seek.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUserOrNull();
  if (!user || user.forcePasswordChange) return new Response("Not authorised", { status: 403 });

  if (!canAccessAdmin(user.role)) {
    const allowed = await prisma().enrollment.count({
      where: {
        userId: user.id,
        assignment: { moduleVersion: { sections: { some: { lessons: { some: { assetId: id } } } } } },
      },
    });
    if (!allowed) return new Response("Not found", { status: 404 });
  }

  const asset = await prisma().asset.findUnique({
    where: { id },
    select: { fileName: true, mimeType: true, sizeBytes: true, data: true },
  });
  if (!asset) return new Response("Not found", { status: 404 });

  const headers = {
    "Content-Type": asset.mimeType,
    "Content-Disposition": `inline; filename="${asset.fileName.replace(/"/g, "")}"`,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  if (asset.data) {
    return new Response(new Uint8Array(asset.data), { headers: { ...headers, "Content-Length": String(asset.sizeBytes) } });
  }

  const chunk = (index: number) =>
    prisma().assetChunk.findUnique({ where: { assetId_index: { assetId: id, index } }, select: { data: true } });

  const range = request.headers.get("range");
  if (range) {
    const part = chunkRange(range, asset.sizeBytes);
    if (!part) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${asset.sizeBytes}` } });
    const row = await chunk(part.index);
    if (!row) return new Response("File incomplete", { status: 404 });
    const body = row.data.subarray(part.offset, part.offset + part.end - part.start + 1);
    return new Response(new Uint8Array(body), {
      status: 206,
      headers: {
        ...headers,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${part.start}-${part.end}/${asset.sizeBytes}`,
        "Content-Length": String(body.length),
      },
    });
  }

  // No Range (e.g. "open in new tab" download): stream every chunk, one row in memory at a time.
  let index = 0;
  const total = chunkCount(asset.sizeBytes);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= total) return controller.close();
      const row = await chunk(index++);
      if (!row) return controller.error(new Error("Missing video chunk"));
      controller.enqueue(new Uint8Array(row.data));
    },
  });
  return new Response(stream, { headers: { ...headers, "Accept-Ranges": "bytes", "Content-Length": String(asset.sizeBytes) } });
}
