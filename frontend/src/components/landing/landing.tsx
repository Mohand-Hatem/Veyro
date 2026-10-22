import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AuthActions, GuestActions } from "./landing-actions";
import { LandingEffects, LandingNav } from "./landing-client";
import { About, AiSection, Contact, Features, Footer, Hero, HowItWorks, Marquee, Roles, Showcase, Workflow } from "./sections";
import "./landing.css";

// SCR-MKT-01. Markup and class names follow screens/groups/01-public-marketing/index.html (Parity Gate).
// The page is rendered on the server; only the navigation, the AI demo, the footer toggles and the scroll reveal run in the browser.
export function Landing() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  return (
    <div className="mk" dir={locale === "ar" ? "rtl" : "ltr"}>
      <a className="mk-skip" href="#main">{t("skip")}</a>
      <LandingNav
        actions={<Suspense fallback={<GuestActions />}><AuthActions /></Suspense>}
        drawerActions={<Suspense fallback={<GuestActions drawer />}><AuthActions drawer /></Suspense>}
      />
      <main id="main">
        <Hero />
        <Marquee />
        <Workflow />
        <Showcase />
        <HowItWorks />
        <Features />
        <Roles />
        <AiSection />
        <About />
        <Contact />
      </main>
      <Footer />
      <LandingEffects />
    </div>
  );
}
