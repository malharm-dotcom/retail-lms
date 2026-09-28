import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords, slugify, toCsv, youtubeVideoId } from "./text";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", ""],
    ]);
  });

  it("maps records by normalised header", () => {
    expect(parseCsvRecords("Employee Code,Store Name\nE1, Indiranagar \n")).toEqual([
      { employee_code: "E1", store_name: "Indiranagar" },
    ]);
  });
});

describe("toCsv", () => {
  it("quotes special characters and neutralises formulas", () => {
    expect(toCsv([["a,b", 'q"', "=SUM(A1)", null, 5]])).toBe('"a,b","q""",\'=SUM(A1),,5');
  });
});

describe("youtubeVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abcdefghijk&t=10", "abcdefghijk"],
    ["https://youtu.be/abcdefghijk?si=x", "abcdefghijk"],
    ["https://www.youtube.com/embed/abcdefghijk", "abcdefghijk"],
    ["https://youtube.com/shorts/abcdefghijk", "abcdefghijk"],
    ["abcdefghijk", "abcdefghijk"],
    ["https://vimeo.com/123", null],
    ["not a url", null],
  ])("%s", (input, expected) => {
    expect(youtubeVideoId(input)).toBe(expected);
  });
});

describe("slugify", () => {
  it("creates url-safe slugs", () => {
    expect(slugify("  Store Opening: Standards & Safety ")).toBe("store-opening-standards-safety");
  });
});
