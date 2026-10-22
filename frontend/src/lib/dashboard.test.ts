import { describe, expect, it } from "vitest";
import { avatarClass, gaugeShares, initials, projectStatus, taskTotal } from "./dashboard";

const tasks = (todo: number, inProgress: number, inReview: number, done: number, cancelled = 0) => ({ todo, inProgress, inReview, done, cancelled });

describe("dashboard helpers", () => {
  it("does not count cancelled tasks", () => {
    expect(taskTotal(tasks(1, 2, 3, 4, 9))).toBe(10);
  });

  it("maps lifecycle and billing flags to one status", () => {
    expect(projectStatus({ lifecycleStatus: "ACTIVE", isBillingReadOnly: false })).toBe("active");
    expect(projectStatus({ lifecycleStatus: "ACTIVE", isBillingReadOnly: true })).toBe("readonly");
    expect(projectStatus({ lifecycleStatus: "ARCHIVED", isBillingReadOnly: true })).toBe("archived");
  });

  it("shares the gauge across projects and survives an empty list", () => {
    const g = gaugeShares([{ tasks: tasks(2, 1, 1, 4) }, { tasks: tasks(0, 0, 0, 0, 5) }]);
    expect(g).toMatchObject({ all: 8, done: 4, percent: 50, pctReview: 12.5 });
    expect(gaugeShares([])).toMatchObject({ all: 0, percent: 0, pctDone: 0 });
  });

  it("builds stable initials and avatar colours", () => {
    expect(initials("Sara Ahmed Ali")).toBe("SA");
    expect(avatarClass("u1")).toBe(avatarClass("u1"));
    expect(avatarClass("u1")).toMatch(/^av[0-5]$/);
  });
});
