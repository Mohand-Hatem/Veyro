"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePageTitle, useShell } from "@/components/shell/shell-context";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/billing/billing.css";
import "./state.css";

// STATE-AUTH-403. A full page inside the shell: the server answered PERMISSION_DENIED (owner-only areas), or the address is a workspace the person does not belong to (never saying whether it exists).
export function Forbidden({ from, slug: slugProp }: { from: "billing" | "audit" | "workspace"; slug?: string }) {
  const t = useTranslations("Forbidden");
  const ts = useTranslations("Settings");
  const tb = useTranslations("Shell");
  const tw = useTranslations("Work");
  const { workspace } = useShell();
  usePageTitle(t("crumb"));
  const slug = slugProp ?? workspace?.slug ?? "";
  const home = slug ? `/w/${slug}` : "/dashboard";
  return (
    <div className="st-page gv-page gv-state-page">
      <div className="ap-ovh">
        <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
          <Link href={home}>{tb("navDash")}</Link><span aria-hidden="true">/</span><b>{t("crumb")}</b>
        </nav>
      </div>
      <section className="gs-card il-scene gs-403" aria-labelledby="gs-h">
        <div className="gs-text">
          <span className="gs-code" aria-hidden="true">{t("code")}</span>
          <h2 id="gs-h">{t(`${from}T`)}</h2>
          <p id="gs-d">{t(`${from}D`)}</p>
          <p className="gs-hint" id="gs-hint">{t(`${from}H`)}</p>
          <div className="gs-actions">
            <Link className="pm-btn pm-go" href={home} id="gs-home"><span>{ts("backDash")}</span></Link>
            {from !== "workspace" && <Link className="pm-btn pm-ghost" href={`/w/${slug}/settings`} id="gs-people"><span>{t("people")}</span></Link>}
          </div>
        </div>
        <div className="il-illu gs-ill">
            <svg viewBox="0 0 440 380" role="img" aria-label={t("svgLabel")}>
              <g className="il-dots" aria-hidden="true"><path d="M170 250 C200 262 214 262 238 250"/></g>
              <g className="il-float"><g>
                <rect className="il-paper il-line" x="236" y="36" width="170" height="290" rx="16"/>
                <rect className="il-soft" x="256" y="58" width="130" height="118" rx="10"/>
                <rect className="il-soft" x="256" y="190" width="130" height="118" rx="10"/>
                <rect className="il-brandfill" x="296" y="176" width="52" height="40" rx="10"/>
                <path d="M306 176 v-12 a16 16 0 0 1 32 0 v12" fill="none" stroke="var(--il-ink)" strokeWidth="3.4" strokeLinecap="round"/>
                <circle cx="322" cy="194" r="4.4" fill="#fff"/><path d="M322 197 v8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
              </g></g>
              <g className="il-float d2">
                <rect className="il-paper il-line" x="262" y="336" width="118" height="30" rx="15"/>
                <text className="il-t3" x="321" y="356" textAnchor="middle" style={{ fontSize: "12px" }} data-i18n="s403_svg">{t("svg")}</text>
              </g>
              <g className="il-float d3"><g transform="rotate(-8 190 236)">
                <rect className="il-paper il-line" x="150" y="206" width="98" height="62" rx="10"/>
                <circle className="il-av-ghost" cx="176" cy="228" r="9"/><rect className="il-bar" x="194" y="222" width="42" height="6" rx="3"/><rect className="il-bar" x="194" y="234" width="28" height="5" rx="2.5"/>
                <rect className="il-slot" x="162" y="250" width="74" height="8" rx="4"/>
              </g></g>
              <path className="il-arm-o" d="M118 330 L146 306 L168 262"/><path className="il-arm-f" d="M118 330 L146 306 L168 262"/><circle className="il-fist" cx="172" cy="254" r="11"/>
              <path className="il-body" d="M26 380 C26 338 54 312 82 312 C110 312 134 338 134 380 Z"/>
              <polygon className="il-emblem" points="81,332 93,339 93,353 81,360 69,353 69,339"/>
              <rect className="il-neck" x="73" y="298" width="16" height="20" rx="6"/>
              <circle className="il-head" cx="81" cy="270" r="32"/>
              <path className="il-hair" d="M49 268 C46 234 68 226 83 228 C102 230 116 246 113 270 C108 256 98 248 84 248 C68 248 56 254 49 268 Z"/>
              <path className="il-hair" d="M50 268 C44 284 48 298 59 302 L62 280 Z"/><circle className="il-hair" cx="96" cy="226" r="10"/>
              <path className="il-face" d="M61 276 q5 4 10 0 M83 276 q5 4 10 0 M70 291 q9 -4 18 0"/>
            </svg>
        </div>
      </section>
    </div>
  );
}
