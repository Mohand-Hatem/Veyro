import { describe, expect, it } from "vitest";
import { TOPICS, contactErrors } from "./contact";

const ok = { name: "Leo Karam", email: "leo@acme.io", message: "Something is not working for me." };

describe("contact form checks", () => {
  it("accepts a complete message", () => {
    expect(contactErrors(ok)).toEqual({});
  });
  it("needs a name of 2 to 100 characters", () => {
    expect(contactErrors({ ...ok, name: " A " }).name).toBe(true);
    expect(contactErrors({ ...ok, name: "x".repeat(101) }).name).toBe(true);
    expect(contactErrors({ ...ok, name: "Al" }).name).toBeUndefined();
  });
  it("needs an email address", () => {
    expect(contactErrors({ ...ok, email: "leo@acme" }).email).toBe(true);
    expect(contactErrors({ ...ok, email: "leo acme.io" }).email).toBe(true);
    expect(contactErrors({ ...ok, email: " leo@acme.io " }).email).toBeUndefined();
  });
  it("needs a message of 10 to 2000 characters", () => {
    expect(contactErrors({ ...ok, message: "too short" }).message).toBe(true);
    expect(contactErrors({ ...ok, message: "          x" }).message).toBe(true); // spaces do not count
    expect(contactErrors({ ...ok, message: "x".repeat(2001) }).message).toBe(true);
    expect(contactErrors({ ...ok, message: "x".repeat(2000) }).message).toBeUndefined();
  });
  it("lists the five topics the backend accepts", () => {
    expect([...TOPICS]).toEqual(["QUESTION", "PROBLEM", "BILLING", "FEEDBACK", "OTHER"]);
  });
});
