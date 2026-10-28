import { describe, expect, it } from "vitest";
import { ago, badgeText, noticeHref } from "./notifications";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const at = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString();

describe("badgeText", () => {
  it("shows nothing for zero, the number up to 9, then 9+", () => {
    expect([0, 1, 9, 10, 250].map(badgeText)).toEqual(["", "1", "9", "9+", "9+"]);
  });
});

describe("noticeHref", () => {
  const data = { workspaceSlug: "acme", projectKey: "AUT" };
  it("opens the task for assignments and comments", () => {
    expect(noticeHref({ type: "TASK_ASSIGNED", taskId: "t1", data })).toBe("/w/acme/projects/AUT/tasks/t1");
    expect(noticeHref({ type: "TASK_COMMENTED", taskId: "t1", data })).toBe("/w/acme/projects/AUT/tasks/t1");
  });
  it("opens the board for a project, and the members page for a role change or an accepted invitation", () => {
    expect(noticeHref({ type: "ADDED_TO_PROJECT", taskId: null, data })).toBe("/w/acme/projects/AUT");
    expect(noticeHref({ type: "ROLE_CHANGED", taskId: null, data: { workspaceSlug: "acme" } })).toBe("/w/acme/settings");
    expect(noticeHref({ type: "INVITATION_ACCEPTED", taskId: null, data: { workspaceSlug: "acme" } })).toBe("/w/acme/settings");
  });
  it("gives no link when the notification lacks what it needs", () => {
    expect(noticeHref({ type: "TASK_ASSIGNED", taskId: null, data })).toBeNull();
    expect(noticeHref({ type: "ADDED_TO_PROJECT", taskId: null, data: {} })).toBeNull();
  });
});

describe("ago", () => {
  it("speaks in minutes, hours and days, and says yesterday", () => {
    expect(ago(at(10), "en-US", NOW)).toBe("now");
    expect(ago(at(120), "en-US", NOW)).toMatch(/^2 min/);
    expect(ago(at(3600), "en-US", NOW)).toMatch(/^1 hr/);
    expect(ago(at(86_400), "en-US", NOW)).toBe("yesterday");
    expect(ago(at(3 * 86_400), "en-US", NOW)).toMatch(/^3 days/);
  });
  it("falls back to a short date after a week, and works in Arabic with Latin digits", () => {
    expect(ago(at(10 * 86_400), "en-US", NOW)).toBe("Oct 18");
    expect(ago(at(300), "ar-EG-u-nu-latn", NOW)).toMatch(/5/); // Arabic says "two minutes" with a word, so five shows the digit rule
  });
});
