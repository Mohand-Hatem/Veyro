"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MyTask, TaskStatus } from "@/lib/dashboard";
import { useFormat } from "./use-format";

type Tab = "all" | "urgent" | "high" | "review";
const PILL: Record<TaskStatus, string> = { TODO: "todo", IN_PROGRESS: "doing", IN_REVIEW: "review", DONE: "done" };

export function MyTasks({ tasks, query }: { tasks: MyTask[]; query: string }) {
  const t = useTranslations("Dashboard");
  const { due } = useFormat();
  const [tab, setTab] = useState<Tab>("all");
  const q = query.trim().toLowerCase();
  const tabs: [Tab, string, number][] = [
    ["all", t("all"), tasks.length],
    ["urgent", t("urgent"), tasks.filter((x) => x.priority === "URGENT").length],
    ["high", t("high"), tasks.filter((x) => x.priority === "HIGH").length],
    ["review", t("inReview"), tasks.filter((x) => x.status === "IN_REVIEW").length],
  ];
  const shown = tasks.filter((x) => (tab === "all" || (tab === "urgent" && x.priority === "URGENT") || (tab === "high" && x.priority === "HIGH") || (tab === "review" && x.status === "IN_REVIEW")) && (!q || x.title.toLowerCase().includes(q)));

  return (
    <section className="ap-card ap-today" aria-labelledby="h-today">
      <header className="ap-ch"><h2 id="h-today">{t("hToday")}</h2></header>
      <div className="ap-tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" role="tab" className="ap-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<i>{n}</i></button>
        ))}
      </div>
      <ul className="ap-tl">
        {shown.length ? shown.map((x) => (
          <li className="ap-ti" key={x.id}>
            <span className="ap-ck" aria-hidden="true" />
            <span className="ap-ti-t"><b>{x.title}</b><small><span className="ap-key">{x.project.key}</span> · {x.project.name} · {due(x.dueDate)}</small></span>
            <span className={`ap-st st-${PILL[x.status]}`}>{t(`s${x.status}`)}</span>
          </li>
        )) : <li className="ap-empty-l">{t("plNone")}</li>}
      </ul>
    </section>
  );
}
