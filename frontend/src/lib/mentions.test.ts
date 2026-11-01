import { describe, expect, it } from "vitest";
import { mentionQuery, nameMatches, splitMentions, toTokens } from "./mentions";

describe("splitMentions", () => {
  it("cuts stored text into plain pieces and mentions", () => {
    expect(splitMentions("Hi <@abc1>, see <@x9>.")).toEqual(["Hi ", { id: "abc1" }, ", see ", { id: "x9" }, "."]);
    expect(splitMentions("no mentions <@> <@A>")).toEqual(["no mentions <@> <@A>"]);
  });
});

describe("toTokens", () => {
  const mona = { id: "m1", name: "Mona Adel" };
  const mo = { id: "m2", name: "Mona" };
  it("turns each picked name into its token, longest name first", () => {
    expect(toTokens("@Mona Adel and @Mona, please", [mo, mona])).toBe("<@m1> and <@m2>, please");
  });
  it("leaves names that were not picked, and names that run into another letter", () => {
    expect(toTokens("@Omar and @Monaco", [mo])).toBe("@Omar and @Monaco");
  });
  it("works with Arabic names and characters that mean something in a pattern", () => {
    expect(toTokens("شكرًا @ليلى حسن!", [{ id: "l1", name: "ليلى حسن" }])).toBe("شكرًا <@l1>!");
    expect(toTokens("@A.B (x)", [{ id: "a1", name: "A.B (x)" }])).toBe("<@a1>");
  });
});

describe("mentionQuery", () => {
  it("finds the @word being typed before the caret", () => {
    expect(mentionQuery("Hi @mo", 6)).toEqual({ start: 3, query: "mo" });
    expect(mentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });
  it("ignores an @ inside a word, and stops at a space", () => {
    expect(mentionQuery("mail@x", 6)).toBeNull();
    expect(mentionQuery("@mona adel", 10)).toBeNull();
  });
});

describe("nameMatches", () => {
  it("matches the start of any word, ignoring case", () => {
    expect(nameMatches("Mona Adel", "ad")).toBe(true);
    expect(nameMatches("Mona Adel", "del")).toBe(false);
    expect(nameMatches("Mona Adel", "")).toBe(true);
  });
});
