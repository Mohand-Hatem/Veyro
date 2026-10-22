import { describe, expect, it } from "vitest";
import { PROJECT_KEY_REGEX, suggestProjectKey } from "./project-key";

// The same cases as backend/test/cs01-project-key.spec.ts, so the two implementations cannot drift apart unnoticed.
describe("suggestProjectKey", () => {
  const none = new Set<string>();

  it("uses the initials of several words", () => {
    expect(suggestProjectKey("Auth Revamp", none)).toBe("AR");
    expect(suggestProjectKey("Mobile Onboarding App", none)).toBe("MOA");
  });
  it("uses the first three letters of one word", () => {
    expect(suggestProjectKey("Billing", none)).toBe("BIL");
  });
  it("caps the key at five characters", () => {
    expect(suggestProjectKey("a b c d e f g", none)).toBe("ABCDE");
  });
  it("makes the key start with a letter and have two characters", () => {
    expect(suggestProjectKey("3D Engine", none)).toBe("P3E");
    expect(suggestProjectKey("!!!", none)).toBe("PRJ");
    expect(suggestProjectKey("X", none)).toBe("XX");
  });
  it("adds a numeric suffix while the key is taken", () => {
    expect(suggestProjectKey("Auth Revamp", new Set(["AR"]))).toBe("AR2");
    expect(suggestProjectKey("a b c d e", new Set(["ABCDE"]))).toBe("ABCD2");
  });
  it("always produces a valid key", () => {
    for (const n of ["Auth Revamp", "x", "9 lives", "  ", "مشروع", "A very long project name indeed"]) expect(PROJECT_KEY_REGEX.test(suggestProjectKey(n, none))).toBe(true);
  });
});
