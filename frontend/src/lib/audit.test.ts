import { describe, expect, it } from "vitest";
import { ACCOUNT_CATS, ACCOUNT_CAT_ORDER, CATS, CAT_ORDER, EMPTY_ACCOUNT_FILTER, EMPTY_FILTER, accountCatOf, catOf, isAccountFiltered, isFiltered, rangeDates } from "./audit";

describe("audit helpers", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  it("turns the time chips into date ranges", () => {
    expect(rangeDates(0, now)).toEqual({ from: "", to: "" });
    expect(rangeDates(1, now)).toEqual({ from: "2026-10-18", to: "2026-10-19" });
    expect(rangeDates(7, now)).toEqual({ from: "2026-10-13", to: "2026-10-19" });
    expect(rangeDates(30, now)).toEqual({ from: "2026-09-20", to: "2026-10-19" });
  });
  it("puts every action in exactly one category and defaults to workspace", () => {
    const all = CAT_ORDER.flatMap((c) => CATS[c]);
    expect(new Set(all).size).toBe(all.length);
    expect(catOf("TASK_REOPENED")).toBe("tasks");
    expect(catOf("PROJECT_MEMBER_ROLE_CHANGED")).toBe("people");
    expect(catOf("SOMETHING_NEW")).toBe("workspace");
  });
  it("keeps all categories under the backend's 40 action limit", () => {
    expect(CAT_ORDER.flatMap((c) => CATS[c]).length).toBeLessThanOrEqual(40);
  });
  it("knows when a filter is active", () => {
    expect(isFiltered(EMPTY_FILTER)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTER, cats: ["tasks"] })).toBe(true);
    expect(isFiltered({ ...EMPTY_FILTER, range: 7, page: 2 })).toBe(false);
  });
});

describe("account audit helpers", () => {
  it("puts every account-level action under one chip", () => {
    expect(accountCatOf("SUBSCRIPTION_UPDATED")).toBe("billing");
    expect(accountCatOf("PROJECT_SELECTION_CONFIRMED")).toBe("projects");
    expect(accountCatOf("WORKSPACE_CREATED")).toBe("workspaces");
    expect(accountCatOf("ACCOUNT_OFFBOARDING_INITIATED")).toBe("account");
    expect(accountCatOf("SOMETHING_NEW")).toBe("account");
  });
  it("lists each action once, so a chip never double-counts", () => {
    const all = ACCOUNT_CAT_ORDER.flatMap((c) => ACCOUNT_CATS[c]);
    expect(new Set(all).size).toBe(all.length);
  });
  it("tells a filtered view from the default one", () => {
    expect(isAccountFiltered(EMPTY_ACCOUNT_FILTER)).toBe(false);
    expect(isAccountFiltered({ ...EMPTY_ACCOUNT_FILTER, cats: ["billing"] })).toBe(true);
    expect(isAccountFiltered({ ...EMPTY_ACCOUNT_FILTER, from: "2026-10-01" })).toBe(true);
    expect(isAccountFiltered({ ...EMPTY_ACCOUNT_FILTER, page: 3 })).toBe(false); // the page is not a filter
  });
});
