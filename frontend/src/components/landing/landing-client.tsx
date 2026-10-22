"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link, usePathname } from "@/i18n/navigation";

// The small interactive parts of the landing page (SCR-MKT-01). Everything else on the page is rendered on the server.
// Behaviour follows screens/groups/01-public-marketing/group.js (Parity Gate).

const RICH = { b: (c: ReactNode) => <b>{c}</b> };
const noop = () => () => {};
/** False on the server and on the first client render, so anything that depends on the saved theme matches the server HTML. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

function ThemeButton({ className, children }: { className: string; children: ReactNode }) {
  const t = useTranslations("Landing");
  const { resolvedTheme, setTheme } = useTheme();
  return <button type="button" className={className} aria-label={t("toggleTheme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{children}</button>;
}

/** The navigation bar: full size at the top, compact after scrolling, and a drawer on narrow screens. `actions` is the sign-in / open-workspace part, rendered on the server. */
export function LandingNav({ actions, drawerActions, home }: { actions: ReactNode; drawerActions: ReactNode; home?: boolean }) {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const scrolled = useSyncExternalStore(
    (cb) => { window.addEventListener("scroll", cb, { passive: true }); return () => window.removeEventListener("scroll", cb); },
    () => window.scrollY > 24,
    () => false,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    const wide = window.matchMedia("(min-width: 1025px)");
    const onWide = (e: MediaQueryListEvent) => { if (e.matches) setDrawer(false); };
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => { document.removeEventListener("keydown", onKey); wide.removeEventListener("change", onWide); };
  }, []);

  const section = (id: string, label: string) => (home ? <Link href={`/#${id}`}>{label}</Link> : <a href={`#${id}`}>{label}</a>); // on the other public pages the sections live on the landing page
  const links = (
    <>
      {section("product", t("nav_product"))}
      <Link href="/how-it-works">{t("nav_how")}</Link>
      {section("features", t("nav_features"))}
      {section("roles", t("nav_roles"))}
      {section("ai", t("nav_ai"))}
      {section("about", t("nav_about"))}
    </>
  );
  return (
    <header className={`mk-nav${scrolled ? " is-scrolled" : ""}${drawer ? " drawer-open" : ""}`} id="mk-nav">
      <div className="mk-nav-inner">
        <Link href="/" className="mk-brand" aria-label={t("brand")}>
          <Image src="/logo.png" alt="" width={36} height={36} priority />
          <span>Veyro</span>
        </Link>
        <nav className="mk-nav-links" aria-label={t("navLabel")}>
          {links}
          <Link href="/contact" className="mk-nav-contact">{t("nav_contact")}</Link>
        </nav>
        <div className="mk-nav-actions">
          <ThemeButton className="mk-icon-btn js-theme-toggle">
            <svg className="i-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            <svg className="i-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </ThemeButton>
          <Link href={pathname} locale={locale === "ar" ? "en" : "ar"} className="mk-icon-btn mk-lang-btn js-lang-toggle" aria-label={t("switchLanguage")}><span className="js-lang-label">{locale === "ar" ? "EN" : "ع"}</span></Link>
          {actions}
          <button type="button" className="mk-menu-btn" id="mk-menu-btn" aria-label={t("menu")} aria-expanded={drawer} aria-controls="mk-drawer" onClick={() => setDrawer((o) => !o)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
          </button>
        </div>
      </div>
      <div className={`mk-drawer${drawer ? " open" : ""}`} id="mk-drawer" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setDrawer(false); }}>
        {links}
        <Link href="/contact">{t("nav_contact")}</Link>
        {drawerActions}
      </div>
    </header>
  );
}

/** The footer's theme and language buttons. The theme button names the mode it switches to. */
export function FooterToggles() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div className="mk-toggles">
      <ThemeButton className="mk-toggle js-theme-toggle"><span className="js-theme-label">{mounted && resolvedTheme === "dark" ? t("themeLight") : t("themeDark")}</span></ThemeButton>
      <Link href={pathname} locale={locale === "ar" ? "en" : "ar"} className="mk-toggle js-lang-toggle" aria-label={t("switchLanguage")}><span className="js-lang-name">{locale === "ar" ? "English" : "العربية"}</span></Link>
    </div>
  );
}

/** The "AI asks before it acts" demo: confirm or reject a drafted change, then try again. Nothing is sent anywhere. */
export function AiDemo() {
  const t = useTranslations("Landing");
  const [state, setState] = useState<"ok" | "no" | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  // "Try again" brings the card back; the focus can only move once it is visible again
  useEffect(() => { if (state === null && refocus.current) { refocus.current = false; confirmRef.current?.focus(); } }, [state]);
  return (
    <div className="mk-ai-demo" id="ai-demo" aria-live="polite" data-state={state ? "done" : undefined}>
      <div className="mk-ai-msg mk-ai-user">{t("ai_q")}</div>
      <div className="mk-ai-card" id="ai-card">
        <div className="mk-ai-card-head">{t("ai_card_head")}</div>
        <p>{t.rich("ai_card_body", RICH)}</p>
        <dl>
          <div><dt>{t("ai_before")}</dt><dd>Mohand 4 · Maya 2</dd></div>
          <div><dt>{t("ai_after")}</dt><dd>Mohand 3 · Maya 3</dd></div>
        </dl>
        <div className="mk-ai-actions">
          <button ref={confirmRef} type="button" className="mk-btn mk-btn-primary mk-btn-sm" id="ai-confirm" onClick={() => setState("ok")}>{t("confirm")}</button>
          <button type="button" className="mk-btn mk-btn-ghost-dark mk-btn-sm" id="ai-reject" onClick={() => setState("no")}>{t("reject")}</button>
        </div>
      </div>
      <div className="mk-ai-result" id="ai-result" data-state={state ?? undefined} hidden={!state}>{state === "ok" ? t("ai_done_ok") : state === "no" ? t("ai_done_no") : null}</div>
      <button type="button" className="mk-ai-reset" id="ai-reset" hidden={!state} onClick={() => { refocus.current = true; setState(null); }}>{t("try_again")}</button>
    </div>
  );
}

/** Sections slide in as they enter the screen. Content stays visible when scripts or IntersectionObserver are unavailable, and with reduced motion. */
export function LandingEffects() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = document.querySelectorAll<HTMLElement>(".mk-head, .mk-step, .mk-stage, .mk-table-wrap, .mk-ai-copy, .mk-ai-demo, .mk-principles > div, .mk-contact-card");
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }, { threshold: 0.12 });
    targets.forEach((el, i) => { el.classList.add("mk-reveal"); el.style.transitionDelay = `${(i % 3) * 70}ms`; io.observe(el); });
    return () => io.disconnect();
  }, []);
  return null;
}
