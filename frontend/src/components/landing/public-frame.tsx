import type { ReactNode } from "react";
import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AuthActions, GuestActions } from "./landing-actions";
import { LandingNav } from "./landing-client";
import { Footer } from "./sections";
import "./landing.css";

// The frame of the public information pages (How it works, Contact): the landing page's navigation and footer around the page.
// Markup and class names follow screens/groups/01-public-marketing/how-it-works.html and contact.html (Parity Gate).
export function PublicFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("Landing");
  const locale = useLocale();
  return (
    <div className="mk" dir={locale === "ar" ? "rtl" : "ltr"}>
      <a className="mk-skip" href="#main">{t("skip")}</a>
      <LandingNav
        home
        actions={<Suspense fallback={<GuestActions />}><AuthActions /></Suspense>}
        drawerActions={<Suspense fallback={<GuestActions drawer />}><AuthActions drawer /></Suspense>}
      />
      <main id="main" className="mk-sub">
        <div className="mk-wrap">{children}</div>
      </main>
      <Footer home />
    </div>
  );
}
