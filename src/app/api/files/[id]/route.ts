import { prisma } from "@/lib/db";
import { canAccessAdmin } from "@/lib/rbac";
import { currentUserOrNull } from "@/lib/session";

/** Stream a stored file to admins, or to learners enrolled in a version that uses it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const asset = await prisma().asset.findUnique({ where: { id } });
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.sizeBytes),
      "Content-Disposition": `inline; filename="${asset.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
