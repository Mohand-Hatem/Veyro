"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link, usePathname } from "@/i18n/navigation";

export function ThemeToggle() {
  const t = useTranslations("Auth");
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button type="button" className="au-icon-btn" aria-label={t("toggleTheme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <svg className="i-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg className="i-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  );
}

/** Switches the language and keeps the page and its query (?email=, ?token=). */
export function LangToggle() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const pathname = usePathname();
  const query = Object.fromEntries(useSearchParams());
  return (
    <Link href={{ pathname, query }} locale={locale === "ar" ? "en" : "ar"} className="au-icon-btn" aria-label={t("switchLanguage")}>
      <span>{locale === "ar" ? "EN" : "ع"}</span>
    </Link>
  );
}

export function AuthTopbar() {
  const t = useTranslations("Auth");
  return (
    <div className="au-top">
      <Link href="/" className="au-brand" aria-label={t("brand")}>
        <Image src="/logo.png" alt="" width={34} height={34} priority />
        <span>Veyro</span>
      </Link>
      <div className="au-tools">
        <Link href="/" className="au-back">{t("back")}</Link>
        <ThemeToggle />
        <LangToggle />
      </div>
    </div>
  );
}
