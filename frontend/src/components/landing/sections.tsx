import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AiDemo, FooterToggles } from "./landing-client";
import { MagicBento } from "./magic-bento";

// Converted once from screens/groups/01-public-marketing/index.html (the approved reference) and maintained by hand from here.
// Text lives in the Landing messages; the drawings keep the reference's English labels, as the reference does.
const RICH = { b: (c: ReactNode) => <b>{c}</b>, scribble: (c: ReactNode) => <span className="mk-scribble">{c}</span> };

export function Hero() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  return (
  <section className="mk-hero" aria-labelledby="hero-title">
    <div className="mk-grid" aria-hidden="true" />
    <div className="mk-wrap mk-hero-grid">
      <div className="mk-hero-copy">
        <h1 id="hero-title">{t.rich("hero_title", RICH)}</h1>
        <p className="mk-hero-sub">{t("hero_desc")}</p>
        <form className="mk-capsule" action={`/${locale}/register`} method="get">
          <label className="mk-sr" htmlFor="hero-email">{t("f_email")}</label>
          <input id="hero-email" name="email" type="email" required autoComplete="email" placeholder={t("hero_ph")} />
          <button type="submit" className="mk-capsule-btn">{t("hero_cta")}</button>
        </form>
        <div className="mk-stats">
          <div className="mk-stat">
            <b>4</b>
            <span>{t("stat1")}</span>
          </div>
          <div className="mk-stat">
            <b>4</b>
            <span>{t("stat2")}</span>
          </div>
        </div>
        <p className="mk-stat-foot">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span>{t("stat_foot")}</span>
        </p>
      </div>
      <div className="mk-hero-visual">
        <svg className="mk-iso" viewBox="0 0 560 590" role="img" aria-label="Illustration of a Kanban board, a task list and an AI proposal stacked in layers">
          <defs>
            <linearGradient id="isoFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--iso-paper)" stopOpacity="1" />
              <stop offset="1" stopColor="var(--iso-paper)" stopOpacity="0.96" />
            </linearGradient>
          </defs>
          <g className="iso-leader">
            <path d="M120 75 V435 M458 120 V480" />
          </g>
          <circle r="3.5" className="iso-dot">
            <animateMotion dur="3.6s" repeatCount="indefinite" path="M120 75 V435" />
          </circle>
          <circle r="3.5" className="iso-dot">
            <animateMotion dur="4.4s" begin="-1.5s" repeatCount="indefinite" path="M458 480 V120" />
          </circle>
          <g className="iso-spread s3">
            <g className="iso-float f3">
              <g transform="matrix(.866 .5 -.866 .5 250 360)" className="iso-plane">
                <rect width={240} height={150} rx="12" />
                <text x="14" y="24" className="iso-title">Auth Revamp · Board</text>
                <g className="iso-small">
                  <text x="14" y="48">To do</text>
                  <text x="90" y="48">In progress</text>
                  <text x="170" y="48">Done</text>
                </g>
                <rect x="12" y="56" width={68} height={30} rx="5" className="iso-card" />
                <rect x="20" y="66" width={44} height={3} rx="1.5" className="iso-bar" />
                <rect x="20" y="74" width={28} height={3} rx="1.5" className="iso-bar" />
                <rect x="12" y="92" width={68} height={30} rx="5" className="iso-card" />
                <rect x="20" y="102" width={40} height={3} rx="1.5" className="iso-bar" />
                <rect x="20" y="110" width={30} height={3} rx="1.5" className="iso-bar" />
                <rect x="88" y="56" width={68} height={30} rx="5" className="iso-card iso-live" />
                <rect x="96" y="66" width={46} height={3} rx="1.5" className="iso-bar" />
                <rect x="96" y="74" width={26} height={3} rx="1.5" className="iso-bar" />
                <rect x="164" y="56" width={64} height={30} rx="5" className="iso-card" />
                <rect x="172" y="66" width={38} height={3} rx="1.5" className="iso-bar" />
                <rect x="172" y="74" width={22} height={3} rx="1.5" className="iso-bar" />
              </g>
            </g>
          </g>
          <g className="iso-spread s2">
            <g className="iso-float f2">
              <g transform="matrix(.866 .5 -.866 .5 250 180)" className="iso-plane">
                <rect width={240} height={150} rx="12" />
                <text x="14" y="24" className="iso-title">My tasks</text>
                <g className="iso-row">
                  <circle cx="22" cy="52" r="7" className="iso-check" />
                  <path d="M18.5 52l2.6 2.6 4.4-5" className="iso-tick" />
                  <text x="38" y="56">OAuth sign-in gateway</text>
                </g>
                <g className="iso-row">
                  <circle cx="22" cy="84" r="7" className="iso-ring" />
                  <text x="38" y="88">Invite email copy</text>
                </g>
                <g className="iso-row">
                  <circle cx="22" cy="116" r="7" className="iso-ring" />
                  <text x="38" y="120">Session token rotation</text>
                </g>
                <rect x="176" y="42" width={48} height={16} rx="8" className="iso-pill" />
                <text x="186" y="53" className="iso-pill-t">Due today</text>
              </g>
            </g>
          </g>
          <g className="iso-spread s1">
            <g className="iso-float f1">
              <g transform="matrix(.866 .5 -.866 .5 250 0)" className="iso-plane iso-top">
                <rect width={240} height={150} rx="12" />
                <text x="14" y="24" className="iso-title">Veyro AI · proposal</text>
                <text x="14" y="52" className="iso-body">Reassign “Rate-limit login</text>
                <text x="14" y="68" className="iso-body">endpoint” to Maya?</text>
                <rect x="14" y="88" width={190} height={24} rx="6" className="iso-well" />
                <text x="24" y="104" className="iso-small-t">Maya’s open tasks: 4 → 3</text>
                <rect x="14" y="120" width={62} height={20} rx="10" className="iso-btn" />
                <text x="29" y="134" className="iso-btn-t">Confirm</text>
                <rect x="84" y="120" width={54} height={20} rx="10" className="iso-btn-o" />
                <text x="97" y="134" className="iso-small-t">Reject</text>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  </section>
  );
}

export function Marquee() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-marquee" aria-label="What Veyro covers">
    <p className="mk-mq-label">{t("mq_label")}</p>
    <div className="mk-mq-row mk-mq-left">
      <div className="mk-mq-track">
        <ul className="mk-mq-set">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width={7} height={18} rx="1.5" />
              <rect x="14" y="3" width={7} height={11} rx="1.5" />
            </svg>
            <span>Kanban boards</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>Role-based access</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
            </svg>
            <span>AI proposals</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M8 13h8M8 17h6" />
            </svg>
            <span>Audit trail</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width={18} height={14} rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <span>Member invitations</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
            <span>Reopen with a reason</span>
          </li>
        </ul>
        <ul className="mk-mq-set" aria-hidden="true">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width={7} height={18} rx="1.5" />
              <rect x="14" y="3" width={7} height={11} rx="1.5" />
            </svg>
            <span>Kanban boards</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>Role-based access</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
            </svg>
            <span>AI proposals</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M8 13h8M8 17h6" />
            </svg>
            <span>Audit trail</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width={18} height={14} rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <span>Member invitations</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
            <span>Reopen with a reason</span>
          </li>
        </ul>
      </div>
    </div>
    <div className="mk-mq-row mk-mq-right">
      <div className="mk-mq-track">
        <ul className="mk-mq-set">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            <span>English and Arabic</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            <span>Light and dark theme</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Project plans</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
            <span>30-day task restore</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Comments & assignees</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width={16} height={11} rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Private workspaces</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
            </svg>
            <span>Team invitations</span>
          </li>
        </ul>
        <ul className="mk-mq-set" aria-hidden="true">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
            </svg>
            <span>English and Arabic</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            <span>Light and dark theme</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Project plans</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
            <span>30-day task restore</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Comments & assignees</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width={16} height={11} rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Private workspaces</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
            </svg>
            <span>Team invitations</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
  );
}

export function Workflow() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section mk-wf" id="workflow" aria-labelledby="wf-title">
    <div className="mk-wrap mk-wf-grid">
      <div className="mk-wf-panel">
        <div className="mk-wf-gridbg" aria-hidden="true" />
        <svg className="sc" viewBox="0 0 560 460" role="img" aria-label="A team member points at a sprint timeline while a comment, a due-today task and a reopen reason card float around it">
          <g className="sc-dots">
            <path d="M150 112 C190 126 232 150 330 150" />
            <path d="M200 340 C240 300 300 270 360 258" />
            <path d="M420 322 C432 300 440 280 446 262" />
          </g>
          <g className="sc-board">
            <rect className="sc-paper sc-line" x="250" y="70" width={294} height={254} rx="16" />
            <text className="sc-t1" x="268" y="98">Sprint 14</text>
            <g className="sc-days">
              <text x="334" y="118">Mon</text>
              <text x="372" y="118">Tue</text>
              <text x="410" y="118">Wed</text>
              <text x="448" y="118">Thu</text>
              <text x="486" y="118">Fri</text>
            </g>
            <g className="sc-rows">
              <text x="268" y="154">Auth</text>
              <text x="268" y="190">Billing</text>
              <text x="268" y="226">Mobile</text>
              <text x="268" y="262">Invites</text>
            </g>
            <rect className="sc-bar sc-b1" x="330" y="138" width={130} height={22} rx="11" />
            <rect className="sc-bar sc-b2" x="368" y="174" width={112} height={22} rx="11" />
            <rect className="sc-bar sc-b3" x="330" y="210" width={74} height={22} rx="11" />
            <rect className="sc-bar sc-b4" x="410" y="246" width={102} height={22} rx="11" />
            <circle className="sc-avc" cx="460" cy="149" r="12" />
            <text className="sc-avt" x="460" y="153">MH</text>
            <circle className="sc-avc sc-avb" cx="480" cy="185" r="12" />
            <text className="sc-avt" x="480" y="189">SA</text>
            <path className="sc-today" d="M432 126 V300" />
            <rect className="sc-today-pill" x="410" y="298" width={44} height={18} rx="9" />
            <text className="sc-today-t" x="432" y="311">Today</text>
          </g>
          <path className="sc-arm-l" d="M92 258 C84 280 82 300 84 322" />
          <g className="sc-point">
            <path className="sc-arm-o" d="M168 252 L204 242 L238 228" />
            <path className="sc-arm-f" d="M168 252 L204 242 L238 228" />
            <circle className="sc-fist" cx="244" cy="226" r="11" />
          </g>
          <path className="sc-body" d="M72 334 C72 264 98 226 130 226 C162 226 188 264 188 334 Z" />
          <rect className="sc-neck" x="122" y="206" width={16} height={22} rx="6" />
          <circle className="sc-head" cx="130" cy="170" r="34" />
          <path className="sc-hair" d="M96 168 C92 124 122 112 134 114 C160 116 168 134 164 170 C160 150 150 138 130 138 C112 138 102 148 96 168 Z" />
          <path className="sc-hair" d="M96 168 C90 188 94 206 108 210 L112 184 Z" />
          <path className="sc-hair" d="M164 170 C170 190 164 208 152 212 L148 186 Z" />
          <circle className="sc-eye" cx="122" cy="172" r="2.4" />
          <circle className="sc-eye" cx="144" cy="172" r="2.4" />
          <path className="sc-face" d="M123 187 q9 7 18 0" />
          <g className="sc-card sc-c1">
            <path className="sc-paper sc-line" d="M20 36 h210 a14 14 0 0 1 14 14 v50 a14 14 0 0 1 -14 14 h-150 l-22 18 v-18 h-38 a14 14 0 0 1 -14 -14 v-50 a14 14 0 0 1 14 -14 z" />
            <circle className="sc-avc sc-avb" cx="48" cy="70" r="15" />
            <text className="sc-avt" x="48" y="74">MY</text>
            <text className="sc-t1" x="72" y="64">Maya</text>
            <text className="sc-t2" x="72" y="84">Looks good, moving to review</text>
          </g>
          <g className="sc-card sc-c2">
            <rect className="sc-paper sc-line" x="24" y="352" width={206} height={64} rx="14" />
            <text className="sc-t1" x="42" y="378">OAuth sign-in gateway</text>
            <text className="sc-t2" x="42" y="398">Due today · Mohand</text>
            <circle className="sc-ok" cx="207" cy="384" r="12" />
            <path className="sc-tick" d="M201 384 l4 4 l8 -9" />
          </g>
          <g className="sc-card sc-c3">
            <rect className="sc-paper sc-line" x="300" y="356" width={238} height={70} rx="14" />
            <text className="sc-t1" x="318" y="382">Reopen task</text>
            <rect className="sc-pill" x="414" y="368" width={104} height={20} rx="10" />
            <text className="sc-pill-t" x="466" y="382">Reason required</text>
            <text className="sc-t2" x="318" y="406">“Failed review on mobile”</text>
          </g>
        </svg>
      </div>
      <div className="mk-wf-copy">
        <h2 id="wf-title">{t("wf_title")}</h2>
        <p className="mk-lead">{t("wf_desc")}</p>
        <ul className="mk-wf-list">
          <li>
            <span className="mk-wf-ic" aria-hidden="true">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
              </svg>
            </span>
            <div>
              <h3>{t("wf_1t")}</h3>
              <p>{t("wf_1d")}</p>
            </div>
          </li>
          <li>
            <span className="mk-wf-ic" aria-hidden="true">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
              </svg>
            </span>
            <div>
              <h3>{t("wf_2t")}</h3>
              <p>{t("wf_2d")}</p>
            </div>
          </li>
          <li>
            <span className="mk-wf-ic" aria-hidden="true">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <div>
              <h3>{t("wf_3t")}</h3>
              <p>{t("wf_3d")}</p>
            </div>
          </li>
        </ul>
        <a href="#how-it-works" className="mk-btn mk-btn-ghost mk-btn-lg">{t("wf_btn")}</a>
      </div>
    </div>
  </section>
  );
}

export function Showcase() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section mk-show" id="product" aria-labelledby="show-title">
    <div className="mk-wrap">
      <div className="mk-head">
        <h2 id="show-title">{t("show_title")}</h2>
        <p className="mk-lead">{t("show_desc")}</p>
      </div>
    </div>
    <div className="mk-wrap">
      <div className="mk-stage" aria-label="Veyro workspace dashboard and mobile view">
        <div className="mk-dash">
          <aside className="mk-rail" aria-hidden="true">
            <Image src="/logo.png" alt="" width={26} height={26} />
            <span className="rail-i on">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
              </svg>
            </span>
            <span className="rail-i">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width={7} height={18} rx="1.5" />
                <rect x="14" y="3" width={7} height={11} rx="1.5" />
              </svg>
            </span>
            <span className="rail-i">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </span>
            <span className="rail-i">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
              </svg>
            </span>
          </aside>
          <div className="mk-dash-main">
            <p className="mk-dash-kicker">Good afternoon, Sarah</p>
            <h3 className="mk-dash-title">Welcome back to Acme Engineering</h3>
            <div className="mk-kpis">
              <div className="mk-kpi">
                <span>Open tasks</span>
                <b>42</b>
                <small className="up">+8 completed this week</small>
              </div>
              <div className="mk-kpi">
                <span>Active projects</span>
                <b>3</b>
                <small>of 3 on the Free plan</small>
              </div>
              <div className="mk-kpi">
                <span>AI messages today</span>
                <b>2</b>
                <small>of 3 used</small>
              </div>
              <div className="mk-kpi">
                <span>Members</span>
                <b>14</b>
                <small>across 3 projects</small>
              </div>
            </div>
            <div className="mk-dash-cols">
              <div className="mk-panel">
                <div className="mk-panel-head">
                  <b>Tasks completed</b>
                  <span>Last 6 weeks</span>
                </div>
                <div className="mk-bars" aria-hidden="true">
                  <div>
                    <i style={{ "--h": "46%" } as CSSProperties} />
                    <i className="b" style={{ "--h": "22%" } as CSSProperties} />
                    <em>W1</em>
                  </div>
                  <div>
                    <i style={{ "--h": "58%" } as CSSProperties} />
                    <i className="b" style={{ "--h": "30%" } as CSSProperties} />
                    <em>W2</em>
                  </div>
                  <div>
                    <i style={{ "--h": "52%" } as CSSProperties} />
                    <i className="b" style={{ "--h": "36%" } as CSSProperties} />
                    <em>W3</em>
                  </div>
                  <div>
                    <i style={{ "--h": "74%" } as CSSProperties} />
                    <i className="b" style={{ "--h": "28%" } as CSSProperties} />
                    <em>W4</em>
                  </div>
                  <div>
                    <i style={{ "--h": "68%" } as CSSProperties} />
                    <i className="b" style={{ "--h": "40%" } as CSSProperties} />
                    <em>W5</em>
                  </div>
                  <div>
                    <i style={{ "--h": "92%" } as CSSProperties} />
                    <i className="b" style={{ "--h": "34%" } as CSSProperties} />
                    <em>W6</em>
                  </div>
                </div>
                <div className="mk-legend">
                  <span>
                    <i />
                    Completed
                  </span>
                  <span>
                    <i className="b" />
                    Created
                  </span>
                </div>
              </div>
              <div className="mk-panel">
                <div className="mk-panel-head">
                  <b>Needs attention</b>
                </div>
                <p className="mk-sub">Due today</p>
                <div className="mk-person">
                  <span className="mk-av mk-av-c">MH</span>
                  <div>
                    <b>OAuth sign-in gateway</b>
                    <small>Mohand · In progress</small>
                  </div>
                </div>
                <div className="mk-person">
                  <span className="mk-av">SA</span>
                  <div>
                    <b>Rate-limit login endpoint</b>
                    <small>Sarah · In review</small>
                  </div>
                </div>
                <p className="mk-sub">Due tomorrow</p>
                <div className="mk-person">
                  <span className="mk-av mk-av-b">LK</span>
                  <div>
                    <b>Invite email copy</b>
                    <small>Leo · To do</small>
                  </div>
                </div>
              </div>
              <div className="mk-panel mk-panel-wide">
                <div className="mk-panel-head">
                  <b>Projects</b>
                  <span>3 active</span>
                </div>
                <div className="mk-prow">
                  <b>Auth Revamp</b>
                  <div className="mk-meter">
                    <i style={{ width: "68%" }} />
                  </div>
                  <span>68%</span>
                </div>
                <div className="mk-prow">
                  <b>Billing Console</b>
                  <div className="mk-meter">
                    <i style={{ width: "41%" }} />
                  </div>
                  <span>41%</span>
                </div>
                <div className="mk-prow">
                  <b>Mobile Onboarding</b>
                  <div className="mk-meter">
                    <i style={{ width: "22%" }} />
                  </div>
                  <span>22%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mk-phone" aria-hidden="true">
          <div className="mk-phone-top">
            <span>9:41</span>
            <span className="mk-av mk-av-c">MH</span>
          </div>
          <div className="mk-phone-body">
            <p className="mk-phone-h">My tasks</p>
            <div className="mk-phone-card">
              <small>Due today · Auth Revamp</small>
              <b>OAuth sign-in gateway</b>
              <span className="mk-phone-btn">Move to In review</span>
            </div>
            <p className="mk-phone-h">My projects</p>
            <div className="mk-phone-grid">
              <span>Auth Revamp</span>
              <span>Billing</span>
              <span>Mobile</span>
            </div>
            <p className="mk-phone-note">Only projects you are assigned to appear here.</p>
          </div>
          <div className="mk-phone-tabs">
            <span className="on">Home</span>
            <span>Projects</span>
            <span>AI</span>
          </div>
        </div>
      </div>
    </div>
  </section>
  );
}

export function HowItWorks() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section" id="how-it-works" aria-labelledby="how-title">
    <div className="mk-wrap">
      <div className="mk-head">
        <h2 id="how-title">{t("how_title")}</h2>
        <p className="mk-lead">{t("how_desc")}</p>
      </div>
      <ol className="mk-steps">
        <li className="mk-step">
          <div className="mk-step-visual" aria-hidden="true">
            <div className="mk-invite">
              <span className="mk-av">AO</span>
              <div>
                <b>Account Owner</b>
                <small>Billing & workspaces</small>
              </div>
            </div>
            <div className="mk-invite">
              <span className="mk-av mk-av-b">WA</span>
              <div>
                <b>Workspace Admin</b>
                <small>Projects & invites</small>
              </div>
            </div>
            <div className="mk-invite">
              <span className="mk-av mk-av-c">WM</span>
              <div>
                <b>Workspace Member</b>
                <small>Assigned projects only</small>
              </div>
            </div>
          </div>
          <h3>{t("s1_t")}</h3>
          <p>{t("s1_d")}</p>
        </li>
        <li className="mk-step">
          <div className="mk-step-visual" aria-hidden="true">
            <div className="mk-flow">
              <span>To do</span>
              <i />
              <span>In progress</span>
              <i />
              <span>In review</span>
              <i />
              <span className="mk-flow-end">Done</span>
            </div>
            <div className="mk-reopen">
              <b>Reopen task</b>
              <small>A reason is required (min. 5 characters) and logged.</small>
            </div>
          </div>
          <h3>{t("s2_t")}</h3>
          <p>{t("s2_d")}</p>
        </li>
        <li className="mk-step">
          <div className="mk-step-visual" aria-hidden="true">
            <div className="mk-mini-proposal">
              <small>Proposed change</small>
              <b>Move due date to Friday</b>
              <div>
                <span className="mk-btn mk-btn-primary mk-btn-xs">Confirm</span>
                <span className="mk-btn mk-btn-ghost mk-btn-xs">Reject</span>
              </div>
            </div>
          </div>
          <h3>{t("s3_t")}</h3>
          <p>{t("s3_d")}</p>
        </li>
      </ol>
    </div>
  </section>
  );
}

export function Features() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section mk-section-tint" id="features" aria-labelledby="feat-title">
    <div className="mk-links mk-links-b" aria-hidden="true" />
    <div className="mk-wrap">
      <div className="mk-head mk-head-center">
        <span className="mk-pill">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
          </svg>
          <span>{t("feat_pill")}</span>
        </span>
        <h2 id="feat-title">{t("feat_title")}</h2>
      </div>
      <MagicBento />
    </div>
  </section>
  );
}

export function Roles() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section" id="roles" aria-labelledby="roles-title">
    <div className="mk-wrap">
      <div className="mk-head">
        <h2 id="roles-title">{t("roles_title")}</h2>
        <p className="mk-lead">{t("roles_desc")}</p>
      </div>
      <div className="mk-table-wrap">
        <table className="mk-matrix">
          <thead>
            <tr>
              <th scope="col">{t("m_cap")}</th>
              <th scope="col">{t("m_owner")}</th>
              <th scope="col">{t("m_admin")}</th>
              <th scope="col">{t("m_member")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t("r1")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="n" aria-label="No">—</span>
              </td>
              <td>
                <span className="n" aria-label="No">—</span>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("r2")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="n" aria-label="No">—</span>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("r3")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="n" aria-label="No">—</span>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("r4")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="n" aria-label="No">—</span>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("r5")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="p">{t("r_pa")}</span>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("r6")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="p">{t("r_pa")}</span>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("r7")}</th>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
              <td>
                <span className="y" aria-label="Yes">✓</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mk-note">{t("roles_note")}</p>
    </div>
  </section>
  );
}

export function AiSection() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section mk-section-dark" id="ai" aria-labelledby="ai-title">
    <div className="mk-wrap mk-ai-grid">
      <div className="mk-ai-copy">
        <h2 id="ai-title">{t("ai_title")}</h2>
        <p className="mk-lead">{t("ai_desc")}</p>
        <ul className="mk-checks">
          <li>{t("ai_p1")}</li>
          <li>{t("ai_p2")}</li>
          <li>{t("ai_p3")}</li>
        </ul>
      </div>
      <AiDemo />
    </div>
  </section>
  );
}

export function About() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section" id="about" aria-labelledby="about-title">
    <div className="mk-links mk-links-c" aria-hidden="true" />
    <div className="mk-wrap">
      <div className="mk-head mk-head-center">
        <span className="mk-pill mk-pill-sq">{t("about_pill")}</span>
        <h2 id="about-title">{t("about_title")}</h2>
      </div>
      <div className="mk-cases">
        <article className="mk-case">
          <div className="mk-case-visual tint-a" aria-hidden="true">
            <div className="mk-qbar">
              <Image src="/logo.png" alt="" width={20} height={20} />
              <span>Open “Billing Console”</span>
            </div>
            <div className="mk-link-v" />
            <div className="mk-folder">
              <div className="mk-prj">
                <i className="ok" />
                Auth Revamp
                <small>Assigned</small>
              </div>
              <div className="mk-prj">
                <i className="ok" />
                Mobile Onboarding
                <small>Assigned</small>
              </div>
              <div className="mk-prj off">
                <i />
                Billing Console
                <small>Not visible to you</small>
              </div>
            </div>
            <span className="mk-corner c1" />
            <span className="mk-corner c2" />
            <span className="mk-corner c3" />
            <span className="mk-corner c4" />
          </div>
          <h3>{t("p1_t")}</h3>
          <p>{t("p1_d")}</p>
        </article>
        <article className="mk-case">
          <div className="mk-case-visual tint-b" aria-hidden="true">
            <div className="mk-sheet">
              <div className="mk-sheet-head">
                <span>Task</span>
                <span>Status</span>
              </div>
              <div className="mk-sheet-row">
                <i />
                <i />
              </div>
              <div className="mk-sheet-row">
                <i />
                <i />
              </div>
              <div className="mk-sheet-row">
                <i />
                <i />
              </div>
              <div className="mk-sheet-row">
                <i />
                <i />
              </div>
            </div>
            <div className="mk-tile-k">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width={7} height={18} rx="1.5" />
                <rect x="14" y="3" width={7} height={11} rx="1.5" />
              </svg>
            </div>
            <div className="mk-link-l" />
            <div className="mk-pop">
              <b>Reopen · reason required</b>
              <span>Failed review on mobile</span>
              <i />
              <i />
            </div>
            <span className="mk-corner c1" />
            <span className="mk-corner c2" />
            <span className="mk-corner c3" />
            <span className="mk-corner c4" />
          </div>
          <h3>{t("p2_t")}</h3>
          <p>{t("p2_d")}</p>
        </article>
        <article className="mk-case">
          <div className="mk-case-visual tint-c" aria-hidden="true">
            <div className="mk-stat-card">
              <b>
                2{" "}
                <em>↑</em>
              </b>
              <div className="mk-confirm">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Confirmed by you
              </div>
            </div>
            <div className="mk-tl">
              <div className="mk-tl-i">
                <i />
                <b>AI proposed</b>
                <small>Reassign to Maya</small>
              </div>
              <div className="mk-tl-i">
                <i />
                <b>You confirmed</b>
                <small>One click</small>
              </div>
              <div className="mk-tl-i last">
                <i />
                <b>Audit logged</b>
                <small>Who, what, when</small>
              </div>
            </div>
            <span className="mk-corner c1" />
            <span className="mk-corner c2" />
            <span className="mk-corner c3" />
            <span className="mk-corner c4" />
          </div>
          <h3>{t("p3_t")}</h3>
          <p>{t("p3_d")}</p>
        </article>
      </div>
    </div>
  </section>
  );
}

export function Contact() {
  const t = useTranslations("Landing");
  return (
  <section className="mk-section mk-section-tint" id="contact" aria-labelledby="contact-title">
    <div className="mk-wrap">
      <div className="mk-contact-card" id="contact-card">
        <div className="mk-contact-left">
          <h2 id="contact-title">{t("contact_title")}</h2>
          <p className="mk-lead">{t("contact_desc")}</p>
          <Link href="/contact" className="mk-btn mk-btn-primary mk-btn-lg">{t("contact_cta")}</Link>
        </div>
        <div className="mk-contact-form">
          <ul className="mk-topics">
            <li className="mk-topic">
              <i className="mk-topic-dot" aria-hidden="true" />
              <span><b>{t("ct1_t")}</b><small>{t("ct1_d")}</small></span>
            </li>
            <li className="mk-topic">
              <i className="mk-topic-dot" aria-hidden="true" />
              <span><b>{t("ct2_t")}</b><small>{t("ct2_d")}</small></span>
            </li>
            <li className="mk-topic">
              <i className="mk-topic-dot" aria-hidden="true" />
              <span><b>{t("ct3_t")}</b><small>{t("ct3_d")}</small></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  );
}

export function Footer({ home }: { home?: boolean }) {
  const t = useTranslations("Landing");
  return (
  <footer className="mk-footer">
    <div className="mk-wrap">
      <div className="mk-footer-cta">
        <h2>{t("foot_title")}</h2>
        <Link href="/register" className="mk-btn mk-btn-primary mk-btn-lg">{t("hero_cta2")}</Link>
      </div>
      <div className="mk-footer-bar">
        <Link href="/" className="mk-brand">
          <Image src="/logo.png" alt="" width={28} height={28} />
          <span>Veyro</span>
        </Link>
        <nav aria-label="Footer">
          <Link href="/how-it-works">{t("nav_how")}</Link>
          {home ? <Link href="/#roles">{t("nav_roles")}</Link> : <a href="#roles">{t("nav_roles")}</a>}
          {home ? <Link href="/#ai">{t("nav_ai")}</Link> : <a href="#ai">{t("nav_ai")}</a>}
          <Link href="/contact">{t("nav_contact")}</Link>
          <Link href="/login">{t("signin")}</Link>
          <Link href="/register">{t("register")}</Link>
        </nav>
        <FooterToggles />
      </div>
      <p className="mk-copy">{t("copy")}</p>
    </div>
  </footer>
  );
}
