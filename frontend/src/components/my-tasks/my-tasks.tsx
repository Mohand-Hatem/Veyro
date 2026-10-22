"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { bucketOf, daysFromToday, useMyTasks, type Bucket, type MyTaskRow, type MyTasksFilter } from "@/lib/my-tasks";
import { useProjectList } from "@/lib/projects";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/ui/au-shared.css";
import "./my-tasks.css";

const SCENES: Record<"clear" | "none" | "match", ReactNode> = {
  clear: <svg viewBox="0 0 220 150"><rect className="e-doc" x="64" y="22" width="92" height="104" rx="14" /><g className="e-tick"><circle cx="86" cy="52" r="9" /><path d="M81.5 52 l3.5 3.5 l6 -7" /></g><rect className="e-line" x="104" y="47" width="38" height="6" rx="3" /><g className="e-tick"><circle cx="86" cy="80" r="9" /><path d="M81.5 80 l3.5 3.5 l6 -7" /></g><rect className="e-line" x="104" y="75" width="30" height="6" rx="3" /><g className="e-tick"><circle cx="86" cy="108" r="9" /><path d="M81.5 108 l3.5 3.5 l6 -7" /></g><rect className="e-line" x="104" y="103" width="34" height="6" rx="3" /><path d="M40 40 l8 8 M48 40 l-8 8 M176 70 l6 6 M182 70 l-6 6 M170 28 a5 5 0 1 0 0.1 0" fill="none" stroke="var(--il-brand)" strokeWidth="3" strokeLinecap="round" /></svg>,
  none: <svg viewBox="0 0 220 150"><path className="e-doc" d="M50 78 l22 -40 h76 l22 40 v40 a8 8 0 0 1 -8 8 H58 a8 8 0 0 1 -8 -8 z" /><path d="M50 78 h46 a14 14 0 0 0 28 0 h46" fill="none" stroke="var(--il-ink)" strokeWidth="3.4" strokeLinejoin="round" /><circle className="e-plus-c" cx="110" cy="58" r="0" /></svg>,
  match: <svg viewBox="0 0 220 150"><rect className="e-doc" x="56" y="26" width="96" height="86" rx="14" /><rect className="e-line" x="76" y="50" width="56" height="6" rx="3" /><rect className="e-line" x="76" y="66" width="40" height="6" rx="3" /><circle cx="140" cy="88" r="20" fill="var(--il-paper)" fillOpacity=".6" stroke="var(--il-ink)" strokeWidth="3.4" /><path d="M154 102 L170 118" stroke="var(--il-ink)" strokeWidth="6" strokeLinecap="round" /></svg>,
};

// SCR-TSK-04. Markup and class names follow screens/groups/04-projects-tasks/my-tasks.html (Parity Gate).
// Rows open the task page, which does not exist yet, so they explain themselves for now.
export function MyTasks() {
  const t = useTranslations("MyTasks");
  const tw = useTranslations("Work");
  const ts = useTranslations("Shell");
  const { workspace } = useShell();
  const { date } = useFormat();
  const [f, setF] = useState<MyTasksFilter>({ view: "open", bucket: "", projectId: "", page: 1 });
  const data = useMyTasks(workspace?.id, f);
  const projects = useProjectList(workspace?.id);
  const top = useRef<HTMLHeadingElement>(null);

  const patch = (p: Partial<MyTasksFilter>) => setF((cur) => ({ ...cur, page: 1, ...p }));
  const go = (page: number) => { setF((cur) => ({ ...cur, page })); top.current?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  const d = data.data;
  const failed = data.isError && !d;
  const loading = data.isPending;

  const due = (x: MyTaskRow): [string, string] => {
    if (x.status === "DONE") return ["", `${t("doneOn")} ${x.completedAt ? date(x.completedAt) : ""}`];
    if (x.dueDate === null) return ["", t("noDate")];
    const n = daysFromToday(x.dueDate);
    if (n < 0) return ["is-over", t("dueOver", { n: -n })];
    if (n === 0) return ["is-today", t("dueToday")];
    if (n === 1) return ["", t("dueTomorrow")];
    return ["", n < 7 ? t("dueIn", { n }) : date(x.dueDate)];
  };

  const row = (x: MyTaskRow) => {
    const [cls, text] = due(x);
    return (
      <Link className="mt-row" key={x.id} href={`/w/${workspace?.slug ?? ""}/projects/${x.project.key}/tasks/${x.id}`}>
        <span className={`pr pr-${x.priority}`}>{tw(`p${x.priority}`)}</span>
        <span className="mt-tt"><span className="ap-key" title={x.project.name}>{x.project.key}</span><b>{x.title}</b>{x.project.isBillingReadOnly && <span className="ap-st st-readonly mt-ro">{tw("readOnly")}</span>}</span>
        <span className={`ap-st st-${x.status === "DONE" ? "done" : x.status === "IN_PROGRESS" ? "review-w" : "todo"}`}>{tw(`s${x.status}`)}</span>
        <span className={`mt-due ${cls}`.trim()}>{text}</span>
      </Link>
    );
  };

  const crumbs = (
    <div className="ap-ovh">
      <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
        <Link href={`/w/${workspace?.slug ?? ""}`}>{ts("navDash")}</Link><span aria-hidden="true">/</span><b>{ts("navTasks")}</b>
      </nav>
    </div>
  );
  const names: Record<Bucket, string> = { overdue: t("overdue"), today: t("today"), upcoming: t("upcoming"), nodate: t("noDate") };

  let emptyKind: "clear" | "none" | "match" | "done" | null = null;
  if (d && d.tasks.length === 0) {
    const filtered = !!(f.bucket || f.projectId);
    emptyKind = f.view === "done" ? (filtered ? "match" : "done") : filtered ? "match" : d.counts.done === 0 ? "none" : "clear";
  }
  const scene = emptyKind === "done" ? "clear" : emptyKind;

  if (failed) {
    return (
      <div className="st-page mt-page">
        {crumbs}
        <section className="ap-card st-error" role="alert">
          <b>{t("errTitle")}</b>
          <p>{tw("errorText")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => data.refetch()}>{tw("retry")}</button>
        </section>
      </div>
    );
  }

  const c = d?.counts;
  const chips: [("" | Bucket), string, number][] = c
    ? [["", t("allOpen"), c.open], ["overdue", t("overdue"), c.overdue], ["today", t("today"), c.today], ["upcoming", t("upcoming"), c.upcoming], ["nodate", t("noDate"), c.noDate]]
    : [];

  return (
    <div className="st-page mt-page">
      {crumbs}
      <div className="mt-content">
        <section className="ap-card mt-head" aria-labelledby="mt-sum">
          <div>
            <h2 id="mt-sum" ref={top}>{c ? (c.open ? t("sum", { n: c.open, m: c.projects }) : t("sum0")) : " "}</h2>
            <p>{c ? (c.overdue ? t("subOver", { n: c.overdue }) : c.open ? t("subOk") : t("subDone", { n: c.done })) : ""}</p>
          </div>
          <div className="mt-ctl">
            <div className="ap-seg" role="radiogroup" aria-label={t("show")}>
              <button type="button" role="radio" aria-checked={f.view === "open"} onClick={() => patch({ view: "open", bucket: "" })}>{t("open")}</button>
              <button type="button" role="radio" aria-checked={f.view === "done"} onClick={() => patch({ view: "done", bucket: "" })}>{t("done")}{c && <> <span className="mt-n">{c.done}</span></>}</button>
            </div>
            <label className="ap-select"><span className="ap-sr">{t("project")}</span>
              <select value={f.projectId} onChange={(e) => patch({ projectId: e.target.value })}>
                <option value="">{t("allProjects")}</option>
                {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
        </section>

        <div className="mt-chips" role="group" aria-label={t("dueDate")} hidden={f.view === "done"}>
          {chips.map(([k, label, n]) => (
            <button key={k || "all"} type="button" className={`mt-chip${k === "overdue" && n ? " is-over" : ""}`} aria-pressed={f.bucket === k} onClick={() => patch({ bucket: k })}><b>{n}</b><span>{label}</span></button>
          ))}
        </div>

        <section className="ap-card mt-list" aria-label={t("tasks")} hidden={!loading && !!emptyKind}>
          <div aria-live="polite" aria-busy={data.isFetching && !loading}>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <div className="mt-row st-skel" aria-hidden="true" key={i}><span className="pr">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span className="mt-tt"><b /></span><span /><span /></div>
                ))
              : d && (f.view === "open" && !f.bucket
                  ? d.tasks.map((x, i) => {
                      const b = bucketOf(x.dueDate), prev = i ? bucketOf(d.tasks[i - 1].dueDate) : null;
                      return <Fragment key={x.id}>{b !== prev && <h3 className={`mt-gh${b === "overdue" ? " is-over" : ""}`}>{names[b]}</h3>}{row(x)}</Fragment>;
                    })
                  : d.tasks.map(row))}
          </div>
          {d && (
            <nav className="au-pager" aria-label={t("pages")} hidden={d.meta.totalPages <= 1}>
              <span className="au-range">{`${(d.meta.page - 1) * d.meta.limit + 1}–${Math.min(d.meta.page * d.meta.limit, d.meta.total)} ${t("of")} ${d.meta.total}`}</span>
              <span className="au-pbtns">
                <button type="button" className="pm-btn pm-ghost st-sm" disabled={d.meta.page <= 1} onClick={() => go(d.meta.page - 1)}>{t("previous")}</button>
                <button type="button" className="pm-btn pm-ghost st-sm" disabled={d.meta.page >= d.meta.totalPages} onClick={() => go(d.meta.page + 1)}>{t("next")}</button>
              </span>
            </nav>
          )}
        </section>

        {emptyKind && scene && (
          <section className="ap-empty mt-empty il-scene">
            <div className="il-illu mt-empty-ill" aria-hidden="true">{SCENES[scene]}</div>
            <h2>{t(`${emptyKind}T`)}</h2>
            <p>{t(`${emptyKind}D`)}</p>
            <div className="mt-empty-act">
              {emptyKind === "none" && <Link className="pm-btn pm-go" href={`/w/${workspace?.slug ?? ""}/projects`}>{t("browse")}</Link>}
              {emptyKind === "match" && <button type="button" className="pm-btn pm-ghost" onClick={() => patch({ bucket: "", projectId: "" })}>{tw("clearFilters")}</button>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
