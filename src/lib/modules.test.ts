import { describe, expect, it } from "vitest";
import { publishProblems } from "./modules";

type Version = Parameters<typeof publishProblems>[0];

function lesson(overrides: Record<string, unknown>) {
  return {
    id: "l",
    title: "Lesson",
    type: "RICH_TEXT",
    required: true,
    body: "text",
    youtubeVideoId: null,
    assetId: null,
    ...overrides,
  };
}

function version(lessons: unknown[], questions: unknown[] = []): Version {
  return { title: "Module", sections: [{ lessons }], quiz: { questions } } as unknown as Version;
}

describe("publishProblems", () => {
  it("accepts complete content", () => {
    expect(
      publishProblems(
        version(
          [lesson({}), lesson({ type: "VIDEO", youtubeVideoId: "abcdefghijk" }), lesson({ type: "VIDEO", assetId: "v1" }), lesson({ type: "PDF", assetId: "a1" })],
          [{ options: [{ isCorrect: true }, { isCorrect: false }] }],
        ),
      ),
    ).toEqual([]);
  });

  it("rejects empty modules", () => {
    expect(publishProblems(version([]))).toEqual(["Add at least one lesson."]);
  });

  it("names lessons missing their content", () => {
    expect(
      publishProblems(version([lesson({ title: "Intro", type: "VIDEO" }), lesson({ title: "Policy", type: "PDF" })])),
    ).toEqual(["“Intro” has no video.", "“Policy” has no PDF uploaded."]);
  });

  it("requires exactly one correct option per question", () => {
    expect(publishProblems(version([lesson({})], [{ options: [{ isCorrect: true }, { isCorrect: true }] }]))).toEqual([
      "Quiz question 1 needs exactly one correct answer.",
    ]);
  });
});
