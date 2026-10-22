import { describe, expect, it } from "vitest";
import { daysUntil, settingsErrorKey, validSlug } from "./settings";

describe("workspace slug", () => {
  it("accepts 3 to 50 lowercase letters, digits and single hyphens", () => {
    expect(validSlug("acme-eng")).toBe(true);
    expect(validSlug("a1b")).toBe(true);
    expect(validSlug("ab")).toBe(false);
    expect(validSlug("acme--eng")).toBe(false);
    expect(validSlug("-acme")).toBe(false);
    expect(validSlug("Acme")).toBe(false);
    expect(validSlug("a".repeat(51))).toBe(false);
  });
});

describe("daysUntil and error keys", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  it("counts whole days, negative when past", () => {
    expect(daysUntil("2026-10-24T12:00:00Z", now)).toBe(5);
    expect(daysUntil("2026-10-17T12:00:00Z", now)).toBe(-2);
  });
  it("maps backend codes to messages", () => {
    expect(settingsErrorKey("OWNER_NOT_REMOVABLE")).toBe("eOwnerRm");
    expect(settingsErrorKey("INVITATION_NOT_PENDING")).toBe("eInvNotPending");
    expect(settingsErrorKey("SOMETHING_ELSE")).toBe("eGeneric");
  });
});
