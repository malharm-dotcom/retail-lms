import { describe, expect, it } from "vitest";
import { deriveEnrollmentStatus } from "./progress";

describe("deriveEnrollmentStatus", () => {
  it("keeps untouched learning not started", () => {
    expect(deriveEnrollmentStatus(3, 0, false, false, false)).toBe("NOT_STARTED");
  });

  it("marks partial required lessons in progress", () => {
    expect(deriveEnrollmentStatus(3, 2, false, false, false)).toBe("IN_PROGRESS");
  });

  it("does not complete until the quiz passes", () => {
    expect(deriveEnrollmentStatus(3, 3, false, false, false)).toBe("IN_PROGRESS");
  });

  it("does not complete until a required acknowledgement exists", () => {
    expect(deriveEnrollmentStatus(3, 3, true, true, false)).toBe("IN_PROGRESS");
  });

  it("completes when every configured requirement is met", () => {
    expect(deriveEnrollmentStatus(3, 3, true, true, true)).toBe("COMPLETED");
  });
});
