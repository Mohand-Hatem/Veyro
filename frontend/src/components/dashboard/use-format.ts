"use client";

import { useLocale, useTranslations } from "next-intl";

const DAY = 86400000;

/** Date helpers shared by the dashboard cards (Latin digits in Arabic, like the reference). */
export function useFormat() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const date = (s: string, withYear = false) => new Date(s).toLocaleDateString(tag, { month: "short", day: "2-digit", ...(withYear ? { year: "numeric" } : {}) });
  const due = (s: string | null) => {
    if (!s) return t("dNone");
    const d = new Date(s), n = new Date();
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / DAY);
    return diff === 0 ? t("dToday") : diff === 1 ? t("dTomorrow") : date(s);
  };
  return { date, due };
}
