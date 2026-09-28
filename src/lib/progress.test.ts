import { describe, expect, it } from "vitest";
import {
  coveredSeconds,
  evaluateEnrollment,
  mergeRanges,
  progressPercent,
  scoreQuiz,
  unlockedLessonIds,
  videoPercent,
  type EnrollmentEvidence,
} from "./progress";

const base: EnrollmentEvidence = {
  requiredLessonIds: ["a", "b", "c"],
  completedLessonIds: [],
  hasQuiz: true,
  quizPassed: false,
  needsAcknowledgement: true,
  acknowledged: false,
  anyActivity: false,
};

describe("evaluateEnrollment", () => {
  it("keeps untouched learning not started", () => {
    expect(evaluateEnrollment(base)).toBe("NOT_STARTED");
  });

  it("counts any activity as in progress", () => {
    expect(evaluateEnrollment({ ...base, anyActivity: true })).toBe("IN_PROGRESS");
  });

  it("does not complete until the quiz passes and the policy is acknowledged", () => {
    const lessonsDone = { ...base, completedLessonIds: ["a", "b", "c"] };
    expect(evaluateEnrollment(lessonsDone)).toBe("IN_PROGRESS");
    expect(evaluateEnrollment({ ...lessonsDone, quizPassed: true })).toBe("IN_PROGRESS");
    expect(evaluateEnrollment({ ...lessonsDone, quizPassed: true, acknowledged: true })).toBe("COMPLETED");
  });

  it("completes without quiz or acknowledgement when none are configured", () => {
    expect(
      evaluateEnrollment({ ...base, hasQuiz: false, needsAcknowledgement: false, completedLessonIds: ["c", "b", "a"] }),
    ).toBe("COMPLETED");
  });

  it("never completes an empty module", () => {
    expect(evaluateEnrollment({ ...base, requiredLessonIds: [], hasQuiz: false, needsAcknowledgement: false })).toBe(
      "NOT_STARTED",
    );
  });
});

describe("progressPercent", () => {
  it("weights quiz and acknowledgement as one step each", () => {
    expect(progressPercent({ ...base, completedLessonIds: ["a", "b", "c"], quizPassed: true })).toBe(80);
  });
});

describe("unlockedLessonIds", () => {
  const lessons = [
    { id: "a", required: true },
    { id: "b", required: false },
    { id: "c", required: true },
    { id: "d", required: true },
  ];

  it("unlocks only up to the first incomplete required lesson", () => {
    expect([...unlockedLessonIds(lessons, [], true)]).toEqual(["a"]);
    expect([...unlockedLessonIds(lessons, ["a"], true)]).toEqual(["a", "b", "c"]);
  });

  it("unlocks everything when sequence is off", () => {
    expect(unlockedLessonIds(lessons, [], false).size).toBe(4);
  });
});

describe("video coverage", () => {
  it("merges overlapping ranges and ignores invalid ones", () => {
    expect(mergeRanges([[10, 20], [0, 5], [4, 12], [30, 30], [-3, 1]])).toEqual([[0, 20]]);
  });

  it("does not double count rewatched seconds and caps at duration", () => {
    expect(coveredSeconds([[0, 60], [30, 90], [0, 60]])).toBe(90);
    expect(coveredSeconds([[0, 500]], 120)).toBe(120);
  });

  it("does not credit skipped seconds", () => {
    expect(coveredSeconds([[0, 10], [100, 110]])).toBe(20);
  });

  it("reports percent against duration", () => {
    expect(videoPercent(95, 100)).toBe(95);
    expect(videoPercent(50, null)).toBe(0);
  });
});

describe("scoreQuiz", () => {
  const questions = [
    { id: "q1", options: [{ id: "o1", isCorrect: true }, { id: "o2", isCorrect: false }] },
    { id: "q2", options: [{ id: "o3", isCorrect: false }, { id: "o4", isCorrect: true }] },
  ];

  it("scores answers and reports wrong questions", () => {
    expect(scoreQuiz(questions, { q1: "o1", q2: "o3" }, 80)).toEqual({
      score: 50,
      correct: 1,
      total: 2,
      passed: false,
      wrongQuestionIds: ["q2"],
    });
  });

  it("rejects options that belong to another question", () => {
    expect(scoreQuiz(questions, { q1: "o4", q2: "o4" }, 50).correct).toBe(1);
  });
});
