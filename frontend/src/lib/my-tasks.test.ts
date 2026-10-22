import { describe, expect, it } from "vitest";
import { bucketOf, daysFromToday } from "./my-tasks";

const NOW = Date.UTC(2026, 9, 18, 15, 0, 0); // 18 Oct 2026, mid-afternoon UTC
const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 9, day, hour)).toISOString();

describe("my tasks due buckets", () => {
  it("splits by UTC day like the server", () => {
    expect(bucketOf(null, NOW)).toBe("nodate");
    expect(bucketOf(at(17, 23), NOW)).toBe("overdue");
    expect(bucketOf(at(18, 1), NOW)).toBe("today");
    expect(bucketOf(at(19, 0), NOW)).toBe("upcoming");
  });

  it("counts whole days from today", () => {
    expect(daysFromToday(at(18, 20), NOW)).toBe(0);
    expect(daysFromToday(at(16), NOW)).toBe(-2);
    expect(daysFromToday(at(21), NOW)).toBe(3);
  });
});
