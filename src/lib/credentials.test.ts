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

describe("password rules", () => {
  it("generates readable temporary passwords", async () => {
    const { generateTemporaryPassword } = await import("./credentials");
    expect(generateTemporaryPassword()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
  });

  it("explains weak passwords", async () => {
    const { passwordProblem } = await import("./credentials");
    expect(passwordProblem("short1", "E1")).toBe("Use at least 8 characters.");
    expect(passwordProblem("lettersonly", "E1")).toBe("Use both letters and numbers.");
    expect(passwordProblem("xxEMP042yy1", "emp042")).toBe("Do not include your employee code.");
    expect(passwordProblem("Store2026ok", "EMP042")).toBeNull();
  });
});
