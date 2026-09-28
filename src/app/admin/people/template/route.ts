import { PEOPLE_CSV_HEADER } from "@/lib/people";
import { csvResponse } from "@/lib/reporting";
import { requireAdmin } from "@/lib/session";
import { toCsv } from "@/lib/text";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return new Response("Not authorised", { status: 403 });
  }
  return csvResponse(
    toCsv([
      PEOPLE_CSV_HEADER,
      ["EMP1001", "Asha Rao", "asha.rao@snitch.com", "BLR-IND", "Bengaluru Indiranagar", "RETAIL", "Retail Operations", "EMPLOYEE"],
      ["EMP1002", "Vikram Shah", "", "BLR-IND", "", "RETAIL", "", ""],
    ]),
    "people-template.csv",
  );
}
