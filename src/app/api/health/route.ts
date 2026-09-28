import { NextResponse } from "next/server";
import { healthPayload } from "@/lib/health";

export function GET() {
  const health = healthPayload(process.env.DATABASE_URL);
  return NextResponse.json(
    { ...health, timestamp: new Date().toISOString() },
    { status: health.status === "ok" ? 200 : 503 },
  );
}
