import { describe, expect, it } from "vitest";
import { canAccessAdmin, homeForRole } from "./rbac";

describe("role policy", () => {
  it("keeps employees out of HR administration", () => {
    expect(canAccessAdmin("EMPLOYEE")).toBe(false);
    expect(homeForRole("EMPLOYEE")).toBe("/learn");
  });

  it("routes HR admins to the administration overview", () => {
    expect(canAccessAdmin("HR_ADMIN")).toBe(true);
    expect(homeForRole("HR_ADMIN")).toBe("/admin");
  });

  it("gives super admins the same administration entry point", () => {
    expect(canAccessAdmin("SUPER_ADMIN")).toBe(true);
    expect(homeForRole("SUPER_ADMIN")).toBe("/admin");
  });
});
