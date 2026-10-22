import { describe, expect, it } from "vitest";
import { expiresIn, inviteToken, okSlug, slugify, workspaceSlugFrom } from "./slug";
import { inviteSchema, onboardingSchema } from "./auth-schemas";

const t = (key: string) => key;

describe("slugs", () => {
  it("turns names into addresses", () => {
    expect(slugify("  Acme Global! ")).toBe("acme-global");
    expect(slugify("Acme & Sons 2")).toBe("acme-sons-2");
    expect(slugify("---")).toBe("");
  });
  it("accepts 3 to 40 lowercase letters, numbers and single hyphens", () => {
    for (const ok of ["abc", "acme-global-eng", "a1-b2"]) expect(okSlug(ok), ok).toBe(true);
    for (const bad of ["ab", "-abc", "abc-", "a--b", "Abc", "a b c", "x".repeat(41)]) expect(okSlug(bad), bad).toBe(false);
  });
  it("suggests the workspace address from the account address and the name", () => {
    expect(workspaceSlugFrom("acme-global", "Engineering")).toBe("acme-global-engineering");
    expect(workspaceSlugFrom("", "Engineering")).toBe("engineering");
    expect(workspaceSlugFrom("acme", "")).toBe("acme");
  });
});

describe("invitation input", () => {
  const token = "a".repeat(64);
  it("extracts the token from a link or a bare code", () => {
    expect(inviteToken(`http://localhost:3000/invitations/accept?token=${token}`)).toBe(token);
    expect(inviteToken(`  ${token}  `)).toBe(token);
    expect(inviteToken("abc")).toBe("abc");
  });
  it("formats the expiry in the user's language", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(expiresIn("2026-10-23T12:00:00Z", "en", now)).toBe("in 5 days");
    expect(expiresIn("2026-10-18T18:00:00Z", "en", now)).toBe("in 6 hours");
  });
});

describe("onboarding schemas", () => {
  const ok = { accountName: "Acme", accountSlug: "acme", workspaceName: "Eng", workspaceSlug: "acme-eng" };
  it("accepts valid input and rejects bad addresses and short names", () => {
    expect(onboardingSchema(t).safeParse(ok).success).toBe(true);
    const r = onboardingSchema(t).safeParse({ ...ok, accountName: "A", workspaceSlug: "No Spaces" });
    expect(r.error?.issues.map((i) => i.message)).toEqual(["len2", "slug"]);
  });
  it("needs something in the invitation box", () => {
    expect(inviteSchema(t).safeParse({ invite: "  " }).error?.issues[0].message).toBe("invite");
    expect(inviteSchema(t).safeParse({ invite: "abc" }).success).toBe(true);
  });
});
