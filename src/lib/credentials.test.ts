import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { normalizeEmployeeCode, verifyCredentials } from "./credentials";

describe("employee credentials", () => {
  it("normalizes codes before lookup", () => {
    expect(normalizeEmployeeCode("  emp001 ")).toBe("EMP001");
  });

  it("accepts the correct password for an active user", async () => {
    const passwordHash = await hash("Correct@123", 4);
    await expect(verifyCredentials({ active: true, passwordHash }, "Correct@123")).resolves.toBe(true);
  });

  it("rejects an inactive user even with the correct password", async () => {
    const passwordHash = await hash("Correct@123", 4);
    await expect(verifyCredentials({ active: false, passwordHash }, "Correct@123")).resolves.toBe(false);
  });

  it("rejects an unknown user with the same public result", async () => {
    await expect(verifyCredentials(null, "anything")).resolves.toBe(false);
  });
});
