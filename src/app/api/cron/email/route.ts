import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverOutbox, emailEnabled, queueDueReminders } from "@/lib/email";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/** Called by a Coolify scheduled task: queue due-date reminders, then send pending mail. */
export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  if (!emailEnabled()) return NextResponse.json({ skipped: "EMAIL_ENABLED is not true" });
  const reminders = await queueDueReminders();
  const delivery = await deliverOutbox();
  return NextResponse.json({ reminders, ...delivery });
}
