"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { passwordLevel, passwordRules } from "@/lib/auth-schemas";

/** Label + control + inline error, using the reference classes (.au-field / .au-error). */
export function Field({ id, label, error, extra, children }: { id: string; label: string; error?: string; extra?: ReactNode; children: ReactNode }) {
  const labelEl = <label htmlFor={id}>{label}</label>;
  return (
    <div className={`au-field${error ? " invalid" : ""}`}>
      {extra ? <div className="au-label-row">{labelEl}{extra}</div> : labelEl}
      {children}
      {error && <p id={`${id}-err`} role="alert" className="au-error">{error}</p>}
    </div>
  );
}

type InputProps = ComponentProps<"input"> & { id: string; error?: string };

export function TextInput({ id, error, ...props }: InputProps) {
  return (
    <div className="au-input">
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
    </div>
  );
}

export function PasswordInput({ id, error, describedBy, ...props }: Omit<InputProps, "type"> & { describedBy?: string }) {
  const t = useTranslations("Auth");
  const [shown, setShown] = useState(false);
  return (
    <div className="au-input has-eye">
      <input id={id} type={shown ? "text" : "password"} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : describedBy} {...props} />
      <button type="button" className="au-eye" onClick={() => setShown((s) => !s)} aria-label={shown ? t("hidePassword") : t("showPassword")}>
        {shown ? t("hide") : t("show")}
      </button>
    </div>
  );
}

/** Strength meter and the three rules from the backend password policy. */
export function PasswordRules({ value, id }: { value: string; id: string }) {
  const t = useTranslations("Auth");
  const rules = [["len", "rLen"], ["case", "rCase"], ["sym", "rSym"]] as const;
  return (
    <>
      <div className="au-meter" data-level={passwordLevel(value)} aria-hidden="true"><i /><i /><i /><i /></div>
      <ul className="au-rules" id={id}>
        {rules.map(([rule, key]) => (
          <li key={rule} className={passwordRules[rule](value) ? "ok" : undefined}>{t(key)}</li>
        ))}
      </ul>
    </>
  );
}
