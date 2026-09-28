export function healthPayload(databaseUrl?: string) {
  return databaseUrl
    ? { status: "ok" as const, database: "configured" as const }
    : { status: "degraded" as const, database: "missing" as const };
}
