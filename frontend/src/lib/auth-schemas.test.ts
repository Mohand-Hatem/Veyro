import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { toFormError } from "./api-errors";
import { forgotSchema, loginSchema, otpSchema, passwordLevel, registerSchema, resetSchema } from "./auth-schemas";

const t = (key: string) => key; // messages are keys in tests
const issues = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? [];

describe("auth schemas (mirror the backend DTOs)", () => {
  it("login needs a valid email and a password", () => {
    expect(loginSchema(t).safeParse({ email: "a@b.io", password: "x" }).success).toBe(true);
    expect(issues(loginSchema(t).safeParse({ email: "nope", password: "" }))).toEqual(["email", "passwordRequired"]);
  });

  it("register enforces the password policy", () => {
    const ok = { name: "Sara", email: "sara@acme.io", password: "Passw0rd!" };
    expect(registerSchema(t).safeParse(ok).success).toBe(true);
    for (const bad of ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoDigitsOrSymbols"]) {
      expect(registerSchema(t).safeParse({ ...ok, password: bad }).success, bad).toBe(false);
    }
    expect(issues(registerSchema(t).safeParse({ ...ok, name: "S" }))).toEqual(["name"]);
  });

  it("otp is exactly six digits", () => {
    expect(otpSchema(t).safeParse({ code: "123456" }).success).toBe(true);
    for (const bad of ["12345", "1234567", "12a456", ""]) expect(otpSchema(t).safeParse({ code: bad }).success, bad).toBe(false);
  });

  it("reset requires matching passwords", () => {
    expect(resetSchema(t).safeParse({ newPassword: "Passw0rd!", confirm: "Passw0rd!" }).success).toBe(true);
    const r = resetSchema(t).safeParse({ newPassword: "Passw0rd!", confirm: "different" });
    expect(r.error?.issues[0]).toMatchObject({ path: ["confirm"], message: "confirm" });
  });

  it("forgot validates the email", () => {
    expect(forgotSchema(t).safeParse({ email: " sara@acme.io " }).success).toBe(true);
    expect(forgotSchema(t).safeParse({ email: "sara" }).success).toBe(false);
  });

  it("password level grows with the rules met", () => {
    expect([passwordLevel(""), passwordLevel("abcdefgh"), passwordLevel("Abcdefgh"), passwordLevel("Abcdefg1"), passwordLevel("Abcdefghijk1")]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("toFormError()", () => {
  const api = (code: string) => new ApiError(400, code, code);
  it("maps backend codes to message keys and fields", () => {
    expect(toFormError(api("INVALID_CREDENTIALS"))).toEqual({ key: "invalidCredentials" });
    expect(toFormError(api("EMAIL_ALREADY_EXISTS"))).toEqual({ key: "emailExists", field: "email" });
    expect(toFormError(api("EXPIRED_OR_INVALID_OTP"))).toEqual({ key: "codeBad", field: "code" });
  });
  it("falls back for unknown codes and network failures", () => {
    expect(toFormError(api("SOMETHING_NEW"))).toEqual({ key: "generic" });
    expect(toFormError(new TypeError("fetch failed"))).toEqual({ key: "network" });
  });
});
