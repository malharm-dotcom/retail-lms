import { describe, expect, it } from "vitest";
import { summarizeEnrollments, todayInIst } from "./dashboard";

describe("summarizeEnrollments", () => {
  it("counts statuses and overdue mandatory learning", () => {
    const summary = summarizeEnrollments(
      [
        { status: "NOT_STARTED", mandatory: true, dueDate: "2026-09-20" },
        { status: "IN_PROGRESS", mandatory: true, dueDate: "2026-09-30" },
        { status: "COMPLETED", mandatory: true, dueDate: "2026-09-10" },
        { status: "COMPLETED", mandatory: false, dueDate: null },
      ],
      "2026-09-25",
    );

    expect(summary).toEqual({
      total: 4,
      notStarted: 1,
      inProgress: 1,
      completed: 2,
      mandatory: 3,
      overdue: 1,
      completionRate: 50,
    });
  });

  it("returns a stable zero state", () => {
    expect(summarizeEnrollments([], "2026-09-25")).toEqual({
      total: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      mandatory: 0,
      overdue: 0,
      completionRate: 0,
    });
  });

  it("uses the India calendar date for due-date checks", () => {
    expect(todayInIst(new Date("2026-09-24T20:00:00.000Z"))).toBe("2026-09-25");
  });
});
