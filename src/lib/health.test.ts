import { describe, expect, it } from "vitest";
import { healthPayload } from "./health";

describe("healthPayload", () => {
  it("reports a configured database", () => {
    expect(healthPayload("postgresql://app:secret@db:5432/lms")).toEqual({
      status: "ok",
      database: "configured",
    });
  });

  it("reports a missing database configuration", () => {
    expect(healthPayload(undefined)).toEqual({ status: "degraded", database: "missing" });
  });
});
