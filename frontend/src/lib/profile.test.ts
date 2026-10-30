import { describe, expect, it } from "vitest";
import { deleteAccountError, highestRole, nameOk, ownedAccountName, ownedPlan, passwordOk, passwordScore, themeToNext, type ProfileWorkspace } from "./profile";

const ws = (role: "ADMIN" | "MEMBER", owner = false, plan: ProfileWorkspace["account"]["plan"] = null): ProfileWorkspace => ({
  id: "w", name: "W", slug: "w", lifecycleStatus: "ACTIVE", role, isAccountOwner: owner, joinedAt: "2026-01-01", projectCount: 1, account: { id: "a", name: "Acme", plan },
});

describe("profile helpers", () => {
  it("accepts names of 2 to 100 characters, ignoring surrounding spaces", () => {
    expect(nameOk("A")).toBe(false);
    expect(nameOk("  A ")).toBe(false);
    expect(nameOk("Al")).toBe(true);
    expect(nameOk("x".repeat(100))).toBe(true);
    expect(nameOk("x".repeat(101))).toBe(false);
  });
  it("scores a password from 0 to 4 like the reference meter", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBe(0);
    expect(passwordScore("abcdefgh")).toBe(1);
    expect(passwordScore("Abcdefg1")).toBe(3);
    expect(passwordScore("Abcdefg1hijk")).toBe(4);
  });
  it("applies the backend password rule", () => {
    expect(passwordOk("Passw0rd!long")).toBe(true);
    expect(passwordOk("password1")).toBe(false); // no capital
    expect(passwordOk("PASSWORD1")).toBe(false); // no lower case
    expect(passwordOk("Passwordd")).toBe(false); // no digit or symbol
    expect(passwordOk("Pa1")).toBe(false); // too short
  });
  it("shows the highest role held anywhere", () => {
    expect(highestRole({ stats: { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 1 }, workspaces: [ws("ADMIN", true)] })).toBe("owner");
    expect(highestRole({ stats: { workspaces: 2, projects: 0, openTasks: 0, ownedAccounts: 0 }, workspaces: [ws("MEMBER"), ws("ADMIN")] })).toBe("admin");
    expect(highestRole({ stats: { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 0 }, workspaces: [ws("MEMBER")] })).toBe("member");
    expect(highestRole({ stats: { workspaces: 0, projects: 0, openTasks: 0, ownedAccounts: 0 }, workspaces: [] })).toBe("member");
  });
  it("shows the account plan only to owners", () => {
    const plan = { tier: "PRO" as const, status: "ACTIVE" };
    expect(ownedPlan({ stats: { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 1 }, workspaces: [ws("ADMIN", true, plan)] })?.account.plan).toEqual(plan);
    expect(ownedPlan({ stats: { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 0 }, workspaces: [ws("ADMIN")] })).toBeNull();
  });
  it("maps the saved theme to the theme switcher", () => {
    expect(themeToNext("SYSTEM")).toBe("system");
    expect(themeToNext("DARK")).toBe("dark");
  });
});

describe("deleting my account", () => {
  it("puts a wrong password on the field and every other refusal in one alert", () => {
    expect(deleteAccountError("INVALID_CURRENT_PASSWORD")).toBe("password");
    expect(["USER_OWNS_ACCOUNT", "USER_HAS_PAID_PLAN", "UNKNOWN", ""].map(deleteAccountError)).toEqual(["alert", "alert", "alert", "alert"]);
  });
  it("names the account a person owns, and nothing for everyone else", () => {
    const owned = { ...ws("ADMIN", true), account: { id: "a", name: "Acme Corp", plan: null } };
    expect(ownedAccountName({ stats: { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 1 }, workspaces: [ws("ADMIN"), owned] })).toBe("Acme Corp");
    expect(ownedAccountName({ stats: { workspaces: 1, projects: 0, openTasks: 0, ownedAccounts: 0 }, workspaces: [ws("MEMBER")] })).toBeNull();
  });
});
