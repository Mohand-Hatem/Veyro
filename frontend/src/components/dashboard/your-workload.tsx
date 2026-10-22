"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { MyTask } from "@/lib/dashboard";

const COLS = [
  { status: "TODO", cx: 196, cls: "ms-c0", label: "msTodo" },
  { status: "IN_PROGRESS", cx: 276, cls: "ms-c1", label: "msDoing" },
  { status: "IN_REVIEW", cx: 356, cls: "ms-c2", label: "msReview" },
] as const;
const CAPS = ["msCap1", "msCap2", "msCap3"] as const;

// Member-only card in the place of the team workload. Scene and captions follow index.html (SVG ms-svg).
export function YourWorkload({ tasks, dueToday, doneThisWeek }: { tasks: MyTask[]; dueToday: number; doneThisWeek: number }) {
  const t = useTranslations("Dashboard");
  const [cap, setCap] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCap((c) => (c + 1) % CAPS.length), 5200);
    return () => clearInterval(id);
  }, [cap]); // a click changes cap and so restarts the timer

  const bold = { b: (chunks: React.ReactNode) => <b>{chunks}</b> };

  return (
    <section className="ap-card ap-mine il-scene" aria-labelledby="h-mine">
      <header className="ap-ch"><h2 id="h-mine">{t("hMine")}</h2><span className="ap-chip">{t("mineChip")}</span></header>
      <div className="il-illu">
        <svg viewBox="0 0 420 300" role="img" aria-label={t("msLabel")}>
          <g className="il-dots" aria-hidden="true"><path d="M262 28 C300 4 340 4 372 24" /></g>
          <g className="il-float d2">
            <rect className="il-paper il-line" x="150" y="12" width="112" height="30" rx="15" /><circle className="il-brandfill" cx="167" cy="27" r="6" style={{ strokeWidth: 1.8 }} />
            <text className="il-t3" x="180" y="31" style={{ fontSize: "10.5px" }}>{dueToday} {t("msDue")}</text>
          </g>
          <g className="il-float d3">
            <rect className="il-paper il-line" x="270" y="12" width="142" height="30" rx="15" /><circle className="il-tick-c" cx="287" cy="27" r="7" /><path className="il-tick" d="M283.5 27 l2.6 2.6 l4.6 -5.2" />
            <text className="il-t3" x="300" y="31" style={{ fontSize: "10.5px" }}>{doneThisWeek} {t("msDone")}</text>
          </g>
          <rect className="il-paper il-line" x="150" y="58" width="252" height="204" rx="16" />
          <path d="M150 238 H402" stroke="var(--il-ink)" strokeWidth="2.5" />
          <g>
            {COLS.map(({ status, cx, cls, label }) => {
              const count = tasks.filter((x) => x.status === status).length, shown = Math.min(count, 6);
              return (
                <g key={status}>
                  {count === 0
                    ? <rect className="il-slot" x={cx - 28} y="218" width="56" height="14" rx="5" />
                    : Array.from({ length: shown }, (_, i) => <rect key={i} className={cls} x={cx - 28} y={218 - i * 18} width="56" height="14" rx="5" />)}
                  <text className="il-t1" x={cx} y={Math.max(96, 212 - shown * 18)} textAnchor="middle" style={{ fontSize: "18px" }}>{count}</text>
                  <text className="il-t2" x={cx} y="254" textAnchor="middle" style={{ fontSize: "10.5px", opacity: 1 }}>{t(label)}</text>
                </g>
              );
            })}
          </g>
          <g transform="translate(-45 -118)">
            <path className="il-arm-o" d="M168 372 L206 350 L190 290" /><path className="il-arm-f" d="M168 372 L206 350 L190 290" /><circle className="il-fist" cx="186" cy="279" r="12" />
            <path className="il-body" d="M62 420 C62 378 92 350 120 350 C148 350 176 378 176 420 Z" />
            <polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
            <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" />
            <circle className="il-head" cx="119" cy="308" r="32" />
            <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" />
            <path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
            <path className="il-face" d="M99 314 q5 4 10 0 M121 314 q5 4 10 0 M105 327 q8 7 16 0" />
          </g>
        </svg>
      </div>
      <div className="il-caps" aria-live="polite">
        {CAPS.map((k, i) => <p key={k} className={`il-cap${cap === i ? " is-on" : ""}`}>{t.rich(k, bold)}</p>)}
      </div>
      <div className="il-pager" role="tablist" aria-label={t("highlights")}>
        {CAPS.map((k, i) => (
          <button key={k} type="button" role="tab" className={cap === i ? "is-on" : undefined} aria-label={t("highlight", { n: i + 1 })} aria-selected={cap === i} onClick={() => setCap(i)} />
        ))}
      </div>
    </section>
  );
}
