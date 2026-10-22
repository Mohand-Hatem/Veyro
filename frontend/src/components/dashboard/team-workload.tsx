"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { Person } from "@/lib/dashboard";

export function TeamWorkload({ workload }: { workload: (Person & { openTasks: number })[] }) {
  const t = useTranslations("Dashboard");
  const max = Math.max(1, ...workload.map((x) => x.openTasks));

  return (
    <section className="ap-card ap-wl" aria-labelledby="h-wl">
      <header className="ap-ch"><h2 id="h-wl">{t("hWl")}</h2><span className="ap-chip">{t("wlChip")}</span></header>
      <div className="ap-bars">
        {workload.map((m) => {
          const shown = Math.min(m.openTasks, 10); // ten beads is the tallest stack; the label on top keeps the true count
          return (
            <div className="ap-col" key={m.userId} title={`${m.name}: ${m.openTasks}`}>
              <div className="ap-beads">
                {m.openTasks === 0
                  ? <span className="ap-bead idle" style={{ "--i": 1 } as CSSProperties} />
                  : Array.from({ length: shown }, (_, k) => {
                      const i = k + 1, top = i === shown;
                      return <span key={i} className={`ap-bead${top ? (m.openTasks === max ? " peak" : " top") : ""}`} style={{ "--i": i } as CSSProperties}>{top ? String(m.openTasks).padStart(2, "0") : ""}</span>;
                    })}
              </div>
              <small>{m.name.split(" ")[0]}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
