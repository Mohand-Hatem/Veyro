"use client";

import { useRef } from "react";

const LENGTH = 6;

/** Six single-digit boxes (.au-otp). The value is a 6-character string; an empty box is a space, so it never passes the digits-only schema. */
export function OtpInput({ value, onChange, invalid, labelledBy, digitLabel }: { value: string; onChange: (v: string) => void; invalid?: boolean; labelledBy: string; digitLabel: (n: number) => string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => (value[i] ?? " ").trim());
  const commit = (next: string[]) => onChange(next.map((d) => d || " ").join(""));

  return (
    <div className="au-otp" role="group" aria-labelledby={labelledBy}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          autoFocus={i === 0}
          className={invalid ? "err" : digit ? "filled" : undefined}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          pattern="[0-9]"
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            const next = [...digits];
            next[i] = d;
            commit(next);
            if (d) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digit) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
            if (!pasted) return;
            e.preventDefault();
            commit(Array.from({ length: LENGTH }, (_, n) => pasted[n] ?? ""));
            refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
