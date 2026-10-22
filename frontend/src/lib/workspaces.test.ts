import { describe, expect, it } from "vitest";
import { initialsOf, nextFreeSlug, suggestWorkspaceSlug } from "./workspaces";

describe("workspace addresses", () => {
  it("suggests the account address and the name", () => {
    expect(suggestWorkspaceSlug("acme-global", "Brand Studio")).toBe("acme-global-brand-studio");
  });
  it("suggests nothing when the name has no Latin letters or digits", () => {
    expect(suggestWorkspaceSlug("acme-global", "التسويق")).toBe("");
    expect(suggestWorkspaceSlug("acme-global", "  ")).toBe("");
  });
  it("stays within 40 characters and never ends with a hyphen", () => {
    const s = suggestWorkspaceSlug("acme-global", "a very long workspace name that keeps going on");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("finds the next free address", () => {
    expect(nextFreeSlug("acme-eng", new Set(["acme-eng"]))).toBe("acme-eng-2");
    expect(nextFreeSlug("acme-eng", new Set(["acme-eng-2", "acme-eng-3"]))).toBe("acme-eng-4");
    const long = "x".repeat(40);
    expect(nextFreeSlug(long, new Set([long])).length).toBe(40); // the suffix replaces the end, it is not cut off
  });
  it("takes up to two initials", () => {
    expect(initialsOf("Brand Studio")).toBe("BS");
    expect(initialsOf("marketing")).toBe("M");
    expect(initialsOf("one two three")).toBe("OT");
  });
});
