"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { UseFormSetError, FieldValues, Path } from "react-hook-form";
import { toFormError } from "@/lib/api-errors";

export type Banner = { kind: "error" | "ok"; text: string } | null;

/** Shared submit-error handling: a field error when the backend names one, otherwise a banner above the form. */
export function useAuthErrors(initial: Banner = null) {
  const te = useTranslations("AuthErrors");
  const [banner, setBanner] = useState<Banner>(initial);
  function fail<T extends FieldValues>(err: unknown, setError?: UseFormSetError<T>) {
    const { key, field } = toFormError(err);
    if (field && setError) setError(field as Path<T>, { message: te(key) });
    else setBanner({ kind: "error", text: te(key) });
  }
  return { te, banner, setBanner, fail };
}

export function FormBanner({ banner }: { banner: Banner }) {
  if (!banner) return null;
  return (
    <div className="au-banner show" data-kind={banner.kind} role="alert" aria-live="assertive">
      {banner.kind === "error" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16.5v.01" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
      )}
      <span>{banner.text}</span>
    </div>
  );
}

export function SubmitButton({ busy, className = "", children }: { busy: boolean; className?: string; children: ReactNode }) {
  return (
    <button type="submit" className={`au-btn${className ? ` ${className}` : ""}${busy ? " loading" : ""}`} disabled={busy}>
      <span className="au-spin" />
      <span>{children}</span>
    </button>
  );
}

const ICONS = {
  check: <path d="M5 12l5 5L20 7" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  alert: <><path d="M12 8v5M12 17v.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3 2" /></>,
  notFound: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8.5 11h5" /></>,
};
const STROKE = { check: 2.8, mail: 2.4, alert: 2.6, clock: 2.6, notFound: 2.6 };

/** Success or invalid-link state that replaces the form (.au-done). */
export function DoneCard({ icon = "check", title, className = "", children }: { icon?: keyof typeof ICONS; title: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`au-done${icon === "check" || icon === "mail" ? "" : " au-invalid"}${className ? ` ${className}` : ""}`} role="status">
      <span className="au-done-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE[icon]} strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** m:ss, as in the reference ("Resend in 0:30"). */
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
