import { todayInIst } from "@/lib/dashboard";
import { csvResponse, learnerRows, learnerRowsCsv } from "@/lib/reporting";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Not authorised", { status: 403 });
  }
  const url = new URL(request.url);
  const store = url.searchParams.get("store") ?? "";
  const moduleId = url.searchParams.get("module") ?? "";
  const rows = await learnerRows(
    {
      ...(store ? { user: { storeId: store } } : {}),
      ...(moduleId ? { assignment: { moduleVersion: { moduleId } } } : {}),
    },
    50000,
  );
  return csvResponse(learnerRowsCsv(rows), `learning-report-${todayInIst()}.csv`);
}
