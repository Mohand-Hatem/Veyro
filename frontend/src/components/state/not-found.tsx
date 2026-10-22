"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePageTitle, useShell } from "@/components/shell/shell-context";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/billing/billing.css";
import "./state.css";

// STATE-GLOBAL-404. A full page inside the shell for any address the app does not have. Markup and class names follow
// screens/groups/06-account-governance/404.html (Parity Gate). Inside a workspace the API answers 404 (not 403) for what a person cannot see,
// so this page never says whether something exists.
export function NotFoundState() {
  const t = useTranslations("States");
  const ts = useTranslations("Settings");
  const tb = useTranslations("Shell");
  const tw = useTranslations("Work");
  const { workspace } = useShell();
  usePageTitle(t("nfCrumb"));
  const home = workspace ? `/w/${workspace.slug}` : "/dashboard";
  return (
    <div className="st-page gv-page gv-state-page">
      <div className="ap-ovh">
        <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
          <Link href={home}>{tb("navDash")}</Link><span aria-hidden="true">/</span><b>{t("nfCrumb")}</b>
        </nav>
      </div>
      <section className="gs-card il-scene gs-404" aria-labelledby="gs-h">
        <div className="gs-text">
          <span className="gs-code" aria-hidden="true">404</span>
          <h2 id="gs-h">{t("nfT")}</h2>
          <p>{t("nfD")}</p>
          <p className="gs-hint">{t("nfH")}</p>
          <div className="gs-actions">
            <Link className="pm-btn pm-go" href={home}><span>{ts("backDash")}</span></Link>
            <Link className="pm-btn pm-ghost" href={workspace ? `/w/${workspace.slug}/projects` : "/dashboard"}><span>{t("nfProj")}</span></Link>
          </div>
        </div>
        <div className="il-illu gs-ill">
          <svg viewBox="0 0 440 380" role="img" aria-label={t("nfSvgLabel")}>
            <g className="il-dots" aria-hidden="true"><path d="M170 274 C210 300 250 300 280 266 C312 230 300 200 328 176 C346 162 360 156 372 156" /></g>
            <g className="il-float"><g transform="rotate(3 300 190)">
              <path className="il-paper il-line" d="M190 60 L262 82 L338 56 L410 80 V320 L338 296 L262 322 L190 298 Z" style={{ strokeLinejoin: "round" }} />
              <path d="M262 82 V322 M338 56 V296" fill="none" stroke="var(--il-ink)" strokeWidth="1.6" opacity=".25" />
              <path className="il-soft" d="M206 110 q22 -12 40 4 q8 24 -14 36 q-26 4 -30 -16 z" style={{ strokeWidth: 1.8 }} />
              <path className="il-soft" d="M350 224 q22 -14 42 4 q6 22 -16 34 q-24 2 -28 -16 z" style={{ strokeWidth: 1.8 }} />
              <g transform="translate(364 108)"><path d="M0 0 C-18 -22 -18 -46 0 -46 C18 -46 18 -22 0 0 Z" fill="none" stroke="var(--il-ink)" strokeWidth="2.6" strokeDasharray="4 4" strokeLinejoin="round" /><circle cx="0" cy="-32" r="6" fill="none" stroke="var(--il-ink)" strokeWidth="2.2" strokeDasharray="3 3" /></g>
              <circle cx="226" cy="262" r="9" className="il-brandfill" style={{ strokeWidth: 2.2 }} />
            </g></g>
            <g className="il-float d2">
              <rect className="il-paper il-line" x="236" y="14" width="150" height="32" rx="16" />
              <text className="il-t3" x="311" y="35" textAnchor="middle" style={{ fontSize: "12px" }}>{t("nfSvg")}</text>
            </g>
            <g className="il-float d3"><circle cx="318" cy="162" r="30" fill="var(--il-paper)" fillOpacity=".5" stroke="var(--il-ink)" strokeWidth="3.4" /><path d="M296 176 L276 200" stroke="var(--il-ink)" strokeWidth="6" strokeLinecap="round" /><path d="M308 152 a14 14 0 0 1 12 -4" fill="none" stroke="var(--il-ink)" strokeWidth="2.4" strokeLinecap="round" opacity=".5" /></g>
            <path className="il-arm-o" d="M118 330 L152 312 L190 286" /><path className="il-arm-f" d="M118 330 L152 312 L190 286" /><circle className="il-fist" cx="196" cy="282" r="11" />
            <path className="il-body" d="M26 380 C26 338 54 312 82 312 C110 312 134 338 134 380 Z" />
            <polygon className="il-emblem" points="81,332 93,339 93,353 81,360 69,353 69,339" />
            <rect className="il-neck" x="73" y="298" width="16" height="20" rx="6" />
            <circle className="il-head" cx="81" cy="270" r="32" />
            <path className="il-hair" d="M49 268 C46 234 68 226 83 228 C102 230 116 246 113 270 C108 256 98 248 84 248 C68 248 56 254 49 268 Z" />
            <path className="il-hair" d="M50 268 C44 284 48 298 59 302 L62 280 Z" /><circle className="il-hair" cx="96" cy="226" r="10" />
            <path className="il-face" d="M61 274 q5 4 10 0 M83 274 q5 4 10 0 M72 291 h14" />
          </svg>
        </div>
      </section>
    </div>
  );
}
