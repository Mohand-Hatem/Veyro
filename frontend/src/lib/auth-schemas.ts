import { z } from "zod";
import { okSlug } from "./slug";

// Client-side rules mirror the backend DTOs (RegisterDto, LoginDto, VerifyOtpDto...). They give instant feedback;
// the server stays the source of truth. `t` turns a message key into the current language.
type T = (key: string) => string;

export const passwordRules = {
  len: (p: string) => p.length >= 8,
  case: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  sym: (p: string) => /\d/.test(p) || /\W/.test(p),
};

export const passwordLevel = (p: string) => {
  const passed = Object.values(passwordRules).filter((rule) => rule(p)).length;
  return passed === 3 && p.length >= 12 ? 4 : passed;
};

const email = (t: T) => z.string().trim().pipe(z.email(t("email")));
const password = (t: T) =>
  z.string().refine((p) => Object.values(passwordRules).every((rule) => rule(p)), t("passwordRules"));

export const loginSchema = (t: T) => z.object({ email: email(t), password: z.string().min(1, t("passwordRequired")) });
export const registerSchema = (t: T) =>
  z.object({ name: z.string().trim().min(2, t("name")), email: email(t), password: password(t) });
export const forgotSchema = (t: T) => z.object({ email: email(t) });
export const otpSchema = (t: T) => z.object({ code: z.string().regex(/^\d{6}$/, t("code")) });
export const resetSchema = (t: T) =>
  z
    .object({ newPassword: password(t), confirm: z.string() })
    .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: t("confirm") });

const slug = (t: T) => z.string().refine(okSlug, t("slug"));
export const onboardingSchema = (t: T) =>
  z.object({ accountName: z.string().trim().min(2, t("len2")), accountSlug: slug(t), workspaceName: z.string().trim().min(2, t("len2")), workspaceSlug: slug(t) });
export const inviteSchema = (t: T) => z.object({ invite: z.string().trim().min(1, t("invite")) });
