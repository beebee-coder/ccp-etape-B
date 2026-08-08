import { describe, it, expect } from "vitest";
import { parseQrFileContent, sanitizeFileName } from "@/lib/q-r/file-store";

describe("parseQrFileContent", () => {
  it("parses array format with valid pairs", () => {
    const content = JSON.stringify([
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2" },
    ]);
    const result = parseQrFileContent(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ question: "Q1", answer: "A1" });
  });

  it("parses object with pairs array", () => {
    const content = JSON.stringify({
      pairs: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ],
    });
    const result = parseQrFileContent(content);
    expect(result).toHaveLength(2);
  });

  it("filters out invalid items", () => {
    const content = JSON.stringify([
      { question: "Q1", answer: "A1" },
      { question: "", answer: "A2" },
      { answer: "A3" },
      "not an object",
    ]);
    const result = parseQrFileContent(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ question: "Q1", answer: "A1" });
    expect(result[1]).toEqual({ question: "", answer: "A2" });
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseQrFileContent("not json")).toEqual([]);
  });

  it("returns empty array for empty object without pairs", () => {
    expect(parseQrFileContent("{}")).toEqual([]);
  });
});

describe("sanitizeFileName", () => {
  it("removes special characters", () => {
    expect(sanitizeFileName("file<name>.txt")).toBe("filenametxt");
  });

  it("preserves unicode accents", () => {
    expect(sanitizeFileName("fichier_français")).toBe("fichier_français");
  });

  it("trims whitespace", () => {
    expect(sanitizeFileName("  hello  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeFileName("")).toBe("");
  });
});
