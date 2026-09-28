import { prisma } from "@/lib/db";
import { csvResponse, learnerRows, learnerRowsCsv } from "@/lib/reporting";
import { requireAdmin } from "@/lib/session";
import { slugify } from "@/lib/text";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Not authorised", { status: 403 });
  }
  const { id } = await params;
  const assignment = await prisma().assignment.findUnique({ where: { id }, include: { moduleVersion: true } });
  if (!assignment) return new Response("Not found", { status: 404 });
  const rows = await learnerRows({ assignmentId: id });
  return csvResponse(learnerRowsCsv(rows), `${slugify(assignment.moduleVersion.title)}-v${assignment.moduleVersion.version}.csv`);
}
