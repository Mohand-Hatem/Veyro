import { describe, expect, it } from "vitest";
import { isDeletedName } from "./person";

describe("isDeletedName", () => {
  it("recognises the stored name however it is spaced or cased, in both languages", () => {
    expect(["Deleted user", "  deleted   USER ", "مستخدم محذوف"].map(isDeletedName)).toEqual([true, true, true]);
  });
  it("leaves every other name alone", () => {
    expect(["Deleted users fan", "Sara", "", "User"].map(isDeletedName)).toEqual([false, false, false, false]);
  });
});
