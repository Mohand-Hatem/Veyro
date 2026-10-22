"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { ChatComposer, ChatThread, useChat } from "./chat";
import "@/components/settings/settings.css";
import "./assistant.css";

const CAPTION_MS = 5200;

// SCR-AI-03 (Mode A: global knowledge) with STATE-AI-QUOTA-MAX. Markup and class names follow screens/groups/05-ai-assistant/assistant.html (Parity Gate).
// One conversation, restored on load (GET /ai/conversations) and created on the first send; the chat itself is shared with the quick-ask drawer (chat.tsx).
// The reply is scripted on the server today (no model provider yet); citation pills are left out until there is a knowledge source.
export function Assistant() {
  const t = useTranslations("Assistant");
  const ts = useTranslations("Shell");
  const tw = useTranslations("Work");
  const { workspace } = useShell();
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const chat = useChat({ contextScope: "GLOBAL" }, { input, scroll });
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]); // a click on the pager changes cur and so restarts the timer

  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const shown: ReactNode[] = [t.rich("cap1", bold), t.rich("cap2", bold), t.rich("cap3", { ...bold, n: String(chat.q?.dailyQuota ?? 3) })];

  return (
    <div className="st-page as-page">
      <div className="ap-ovh">
        <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
          <Link href={workspace ? `/w/${workspace.slug}` : "/dashboard"}>{ts("navDash")}</Link><span aria-hidden="true">/</span><b>{ts("navAi")}</b>
        </nav>
      </div>

      <div className="as-grid">
        <section className="ap-card as-chat" aria-labelledby="as-ct">
          <header className="as-head">
            <div className="as-title">
              <span className="as-spark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg></span>
              <div>
                <h3 id="as-ct">{t("title")}</h3>
                <p className="as-ctx"><span className="as-chip">{t("ctx")}</span></p>
              </div>
            </div>
            <div className="as-quota" aria-live="polite">
              <span className={chat.quotaClass}>{chat.quotaText}</span>
              <small><span>{t("resets")}</span> <b className="ai-cd">{chat.clock}</b> · <span>{t("resetsAt")}</span></small>
            </div>
            <p className="as-hint">{t("hint")}</p>
          </header>

          <div className="as-scroll" ref={scroll} tabIndex={-1}>
            <ChatThread chat={chat} suggestions={[t("sg")]} />
          </div>

          <div className="as-foot">
            <ChatComposer chat={chat} inputRef={input} inputId="as-in" label={t("ph")} icon={22} />
          </div>
        </section>

        <aside className="as-side il-scene" aria-label={t("panel")}>
          <div className="il-illu">
            <svg viewBox="0 0 420 420" role="img" aria-label={t("svgLabel")}>
              <g className="il-dots" aria-hidden="true"><path d="M262 118 C300 100 330 100 356 126" /><path d="M200 262 C232 286 252 296 276 300" /></g>
              <g className="il-float d2">
                <rect className="il-paper il-line" x="46" y="34" width="190" height="50" rx="18" />
                <path className="il-paper il-line" d="M92 84 L84 104 L112 84 Z" style={{ strokeLinejoin: "round" }} />
                <circle className="il-brandfill" cx="74" cy="59" r="12" /><path className="il-emblem" d="M74 52 l2.2 5 l5 2 l-5 2.2 l-2.2 5 l-2.2 -5 l-5 -2.2 l5 -2 z" style={{ strokeWidth: 1.6 }} />
                <text className="il-t3" x="96" y="63" style={{ fontSize: 12 }}>Create task: runbook</text>
              </g>
              <g className="il-float"><g transform="rotate(2.5 290 190)">
                <rect className="il-paper il-line" x="170" y="104" width="214" height="176" rx="18" />
                <rect className="il-live" x="188" y="120" width="90" height="22" rx="11" />
                <text className="il-t3" x="233" y="135" textAnchor="middle" style={{ fontSize: 10.5, fill: "var(--il-brand)" }}>PROPOSAL</text>
                <text className="il-t1" x="188" y="170" style={{ fontSize: 15 }}>Update the runbook</text>
                <rect className="il-pill" x="188" y="184" width="46" height="22" rx="11" /><text className="il-pill-t" x="211" y="199" style={{ fontSize: 10.5 }}>AUT</text>
                <rect className="il-pill" x="240" y="184" width="68" height="22" rx="11" /><text className="il-pill-t" x="274" y="199" style={{ fontSize: 10.5 }}>Medium</text>
                <rect className="il-brandfill" x="188" y="226" width="92" height="36" rx="18" /><text className="il-tw" x="234" y="249">Confirm</text>
                <rect className="il-chip-bg" x="288" y="226" width="80" height="36" rx="18" /><text className="il-pill-t" x="328" y="249" style={{ fontWeight: 800 }}>Reject</text>
              </g></g>
              <path className="il-arm-o" d="M168 372 L206 350 L190 292" /><path className="il-arm-f" d="M168 372 L206 350 L190 292" /><circle className="il-fist" cx="186" cy="281" r="12" />
              <path className="il-body" d="M62 440 C62 378 92 350 120 350 C148 350 176 378 176 440 Z" />
              <polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
              <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" />
              <circle className="il-head" cx="119" cy="308" r="32" />
              <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" />
              <path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
              <path className="il-face" d="M99 314 q5 4 10 0 M121 314 q5 4 10 0 M105 327 q8 7 16 0" />
              <g className="il-float d3">
                <rect className="il-paper il-line" x="214" y="316" width="196" height="76" rx="18" />
                <text className="il-t3" x="232" y="342" style={{ fontSize: 12 }}>Messages today</text>
                <rect className="il-seg used" x="232" y="356" width="48" height="12" rx="6" /><rect className="il-seg used" x="286" y="356" width="48" height="12" rx="6" /><rect className="il-seg next" x="340" y="356" width="48" height="12" rx="6" />
                <text className="il-t2" x="232" y="382" style={{ fontSize: 10.5 }}>Confirm and reject are free</text>
              </g>
            </svg>
          </div>
          <div className="il-caps" aria-live="polite">
            {shown.map((c, i) => <p key={i} className={`il-cap${cur === i ? " is-on" : ""}`}>{c}</p>)}
          </div>
          <div className="il-pager" role="tablist" aria-label={t("highlights")}>
            {shown.map((_, i) => <button key={i} type="button" role="tab" className={cur === i ? "is-on" : undefined} aria-label={t("highlight", { n: i + 1 })} aria-selected={cur === i} onClick={() => setCur(i)} />)}
          </div>
        </aside>
      </div>
    </div>
  );
}
