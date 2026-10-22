"use client";

import type { AnchorHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "./shell-context";

/** A link to a screen that is not built yet: explains itself with the shell toast instead of leading to a 404. */
export function LaterLink({ children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const t = useTranslations("Shell");
  const { notify } = useShell();
  return (
    <a
      {...props}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        notify(t("later"));
      }}
    >
      {children}
    </a>
  );
}
