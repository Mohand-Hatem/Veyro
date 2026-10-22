import { describe, expect, it } from "vitest";
import { isActive, roleOf, visibleNav } from "./nav";

describe("navigation by role", () => {
  const keys = (r: Parameters<typeof visibleNav>[0]) => visibleNav(r).map((n) => n.key);

  it("members see the four everyday items", () => {
    expect(keys("member")).toEqual(["dashboard", "projects", "tasks", "ai"]);
  });
  it("admins also see audit and members", () => {
    expect(keys("admin")).toEqual(["dashboard", "projects", "tasks", "ai", "audit", "members"]);
  });
  it("only the account owner sees billing", () => {
    expect(keys("owner")).toContain("billing");
    expect(keys("admin")).not.toContain("billing");
  });
  it("derives the role from the workspace membership", () => {
    expect(roleOf({ role: "ADMIN", isAccountOwner: true })).toBe("owner");
    expect(roleOf({ role: "ADMIN", isAccountOwner: false })).toBe("admin");
    expect(roleOf({ role: "MEMBER", isAccountOwner: false })).toBe("member");
  });
  it("marks the active item without matching siblings", () => {
    expect(isActive("/w/acme", "/w/acme", "dashboard")).toBe(true);
    expect(isActive("/w/acme/projects", "/w/acme", "dashboard")).toBe(false);
    expect(isActive("/w/acme/projects/auth", "/w/acme/projects", "projects")).toBe(true);
  });
});
