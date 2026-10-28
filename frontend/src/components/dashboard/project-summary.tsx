"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { avatarClass, projectStatus, taskTotal, type DashProject, type ProjectStatus } from "@/lib/dashboard";
import { Avatar } from "@/components/ui/avatar";
import { useFormat } from "./use-format";

const CIRC = 2 * Math.PI * 13;

// The ring starts empty and fills after mount, so the stroke animates in like the reference.
function Ring({ pct }: { pct: number }) {
  const arc = useRef<SVGCircleElement>(null);
  useEffect(() => {
    arc.current?.style.setProperty("stroke-dashoffset", (CIRC * (1 - pct / 100)).toFixed(1));
  }, [pct]);
  return (
    <svg className="ap-ring" viewBox="0 0 34 34" role="img" aria-label={`${pct}%`}>
      <circle className="r-t" cx="17" cy="17" r="13" />
      <circle ref={arc} className={`r-v${pct >= 100 ? " full" : ""}`} cx="17" cy="17" r="13" strokeDasharray={CIRC.toFixed(1)} strokeDashoffset={CIRC.toFixed(1)} />
      <text x="17" y="20">{pct}</text>
    </svg>
  );
}

export function ProjectSummary({ projects, query }: { projects: DashProject[]; query: string }) {
  const t = useTranslations("Dashboard");
  const { date } = useFormat();
  const [status, setStatus] = useState<"all" | ProjectStatus>("all");
  const q = query.trim().toLowerCase();
  const rows = projects.filter((p) => (status === "all" || projectStatus(p) === status) && (!q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)));
  const label: Record<ProjectStatus, string> = { active: t("stActive"), readonly: t("stRo"), archived: t("stArch") };

  return (
    <section className="ap-card ap-proj" aria-labelledby="h-proj">
      <header className="ap-ch">
        <h2 id="h-proj">{t("hProj")}</h2>
        <label className="ap-select"><span className="ap-sr">{t("fStatus")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">{t("fAllStatus")}</option>
            <option value="active">{t("stActive")}</option>
            <option value="readonly">{t("stRo")}</option>
            <option value="archived">{t("stArch")}</option>
          </select>
        </label>
      </header>
      <div className="ap-tw" role="table" aria-label={t("tableLabel")}>
        <div className="ap-tr ap-th" role="row">
          <span role="columnheader">{t("cName")}</span><span role="columnheader">{t("cMembers")}</span><span role="columnheader">{t("cTasks")}</span><span role="columnheader">{t("cCreated")}</span><span role="columnheader">{t("cStatus")}</span><span role="columnheader">{t("cProg")}</span>
        </div>
        <div>
          {rows.map((p) => {
            const total = taskTotal(p.tasks), pct = total ? Math.round((p.tasks.done / total) * 100) : 0, s = projectStatus(p), extra = p.memberCount - p.members.length;
            return (
              <div className="ap-tr ap-row" role="row" key={p.id}>
                <span className="ap-pn" role="cell"><b>{p.name}</b><small className="ap-key">{p.key}</small></span>
                <span className="ap-stack" role="cell" aria-label={t("membersAria", { n: p.memberCount })}>
                  {p.members.map((m) => <Avatar key={m.userId} className={avatarClass(m.userId)} title={m.name} name={m.name} url={m.avatarUrl} />)}
                  {extra > 0 && <span style={{ background: "var(--gray-soft)", color: "var(--gray-ink)" }}>+{extra}</span>}
                </span>
                <span role="cell">{p.tasks.done}/{total}</span>
                <span role="cell">{date(p.createdAt, true)}</span>
                <span role="cell"><span className={`ap-st st-${s}`}>{label[s]}</span></span>
                <span role="cell"><Ring pct={pct} /></span>
              </div>
            );
          })}
        </div>
        <p className="ap-none" hidden={rows.length > 0}>{t("noneFound")}</p>
      </div>
    </section>
  );
}
