import { describe, expect, it } from "vitest";
import { validatePeople } from "./people";

describe("validatePeople", () => {
  it("accepts well-formed rows", () => {
    expect(validatePeople([{ employee_code: "emp-001", name: "Asha", email: "asha@snitch.com", role: "" }], "HR_ADMIN")).toEqual([]);
  });

  it("reports problems with CSV line numbers", () => {
    expect(
      validatePeople(
        [
          { employee_code: "E1", name: "", email: "bad" },
          { employee_code: "e1", name: "Dup", role: "SUPER_ADMIN" },
          { employee_code: "", name: "No code", role: "MANAGER" },
        ],
        "HR_ADMIN",
      ),
    ).toEqual([
      "Line 2: name is missing.",
      "Line 2: email “bad” is not valid.",
      "Line 3: only a super admin can grant SUPER_ADMIN.",
      "Line 3: employee code E1 repeats line 2.",
      "Line 4: employee code “” is missing or invalid.",
      "Line 4: role must be EMPLOYEE or HR_ADMIN.",
    ]);
  });
});
