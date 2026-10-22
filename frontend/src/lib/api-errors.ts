import { ApiError } from "./api";

export type FormError = { key: string; field?: string };

// Backend error code -> message key (messages live in messages/*.json under "AuthErrors") and, when it belongs to one input, the field.
const MAP: Record<string, FormError> = {
  INVALID_CREDENTIALS: { key: "invalidCredentials" },
  EMAIL_ALREADY_EXISTS: { key: "emailExists", field: "email" },
  VALIDATION_FAILED: { key: "fixFields" },
  RESEND_COOLDOWN_ACTIVE: { key: "cooldown" },
  EXPIRED_OR_INVALID_OTP: { key: "codeBad", field: "code" },
  INVALID_OTP_CODE: { key: "codeBad", field: "code" },
  INVALID_OTP_REQUEST: { key: "codeBad", field: "code" },
  OTP_MAX_ATTEMPTS_EXCEEDED: { key: "codeMax", field: "code" },
  INVALID_OR_EXPIRED_RESET_TOKEN: { key: "resetInvalid" },
};

export function toFormError(err: unknown): FormError {
  if (err instanceof ApiError) return MAP[err.code] ?? { key: "generic" };
  return { key: "network" };
}
