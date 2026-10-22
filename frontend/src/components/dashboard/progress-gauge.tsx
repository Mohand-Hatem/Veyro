"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { gaugeShares, type DashProject } from "@/lib/dashboard";

const ARC = "M40 150 A110 110 0 0 1 260 150";

export function ProgressGauge({ projects }: { projects: DashProject[] }) {
  const t = useTranslations("Dashboard");
  const [picked, setPicked] = useState("all");
  const key = projects.some((p) => p.key === picked) ? picked : "all"; // the project may disappear after a refetch
  const g = gaugeShares(projects.filter((p) => key === "all" || p.key === key));
  const seg = (start: number, len: number) => ({ strokeDasharray: `${len} ${100 - len}`, strokeDashoffset: `${-start}` });

  return (
    <section className="ap-card ap-gauge" aria-labelledby="h-gauge">
      <header className="ap-ch">
        <h2 id="h-gauge">{t("hProg")}</h2>
        <label className="ap-select"><span className="ap-sr">{t("fProject")}</span>
          <select value={key} onChange={(e) => setPicked(e.target.value)}>
            <option value="all">{t("allProjects")}</option>
            {projects.map((p) => <option key={p.id} value={p.key}>{p.name}</option>)}
          </select>
        </label>
      </header>
      <div className="ap-gwrap">
        <svg viewBox="0 0 300 175" role="img" aria-label={t("gaugeLabel")}>
          <path className="g-track" d={ARC} pathLength={100} />
          <path className="g-seg g-done" d={ARC} pathLength={100} style={seg(0, g.pctDone)} />
          <path className="g-seg g-rev" d={ARC} pathLength={100} style={seg(g.pctDone, g.pctReview)} />
          <path className="g-seg g-doing" d={ARC} pathLength={100} style={seg(g.pctDone + g.pctReview, g.pctDoing)} />
          <g className="g-ticks"><text x="60" y="168">0</text><text x="86" y="92">25</text><text x="150" y="66">50</text><text x="214" y="92">75</text><text x="240" y="168">100</text></g>
        </svg>
        <div className="ap-gc" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.percent} aria-label={t("completed")}><b>{g.percent}%</b><span>{t("completed")}</span></div>
      </div>
      <dl className="ap-gstats">
        <div><dd>{g.all}</dd><dt>{t("totalTasks")}</dt></div>
        <div className="gs-done"><dd>{g.done}</dd><dt>{t("done")}</dt></div>
        <div className="gs-rev"><dd>{g.review}</dd><dt>{t("inReview")}</dt></div>
        <div className="gs-doing"><dd>{g.doing}</dd><dt>{t("inProgress")}</dt></div>
      </dl>
      <p className="ap-gnote">{t("gNote")}</p>
    </section>
  );
}
