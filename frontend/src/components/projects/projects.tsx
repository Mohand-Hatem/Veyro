"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { useDashboard, avatarClass } from "@/lib/dashboard";
import { Avatar } from "@/components/ui/avatar";
import { daysSince, progressPercent, projectState, useProjectList, useRestoreProject, type ProjectRow, type ProjectState } from "@/lib/projects";
import { ConfirmDialog, ProjectSettingsDialog, useProjectErrors, type Confirm } from "./project-dialogs";
import { useFormat } from "@/components/dashboard/use-format";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "./projects.css";

type Show = "ACTIVE" | "ARCHIVED" | "DELETED";
type EmptyKind = "none" | "match" | "arch" | "trash";

// Empty-state scenes copied from screens/groups/04-projects-tasks/projects.js (ICON).
const SCENES: Record<EmptyKind, ReactNode> = {
  none: <svg viewBox="0 0 220 150"><rect className="e-doc" x="62" y="26" width="96" height="86" rx="14" /><circle className="e-plus-c" cx="110" cy="64" r="18" /><path className="e-plus" d="M110 55v18M101 64h18" /><rect className="e-line" x="84" y="94" width="52" height="6" rx="3" /></svg>,
  match: <svg viewBox="0 0 220 150"><rect className="e-doc" x="56" y="26" width="96" height="86" rx="14" /><rect className="e-line" x="76" y="50" width="56" height="6" rx="3" /><rect className="e-line" x="76" y="66" width="40" height="6" rx="3" /><circle cx="140" cy="88" r="20" fill="var(--il-paper)" fillOpacity=".6" stroke="var(--il-ink)" strokeWidth="3.4" /><path d="M154 102 L170 118" stroke="var(--il-ink)" strokeWidth="6" strokeLinecap="round" /></svg>,
  arch: <svg viewBox="0 0 220 150"><rect className="e-doc" x="52" y="40" width="116" height="74" rx="12" /><rect className="e-doc" x="46" y="28" width="128" height="26" rx="10" /><path d="M96 72 h28" stroke="var(--il-ink)" strokeWidth="4" strokeLinecap="round" /></svg>,
  trash: <svg viewBox="0 0 220 150"><path className="e-doc" d="M70 48 h80 l-6 66 a8 8 0 0 1 -8 7 h-52 a8 8 0 0 1 -8 -7 z" /><path d="M62 48 h96 M92 48 v-8 a6 6 0 0 1 6 -6 h24 a6 6 0 0 1 6 6 v8" fill="none" stroke="var(--il-ink)" strokeWidth="3.4" strokeLinecap="round" /><path d="M96 66 v36 M110 66 v36 M124 66 v36" stroke="var(--il-ink)" strokeWidth="3" strokeLinecap="round" opacity=".4" /></svg>,
};

const STATE_CLASS: Record<ProjectState, string> = { active: "st-active", readonly: "st-readonly", archived: "st-archived", deleted: "gv-st-locked" };

// SCR-PRJ-04. Markup and class names follow screens/groups/04-projects-tasks/projects.html (Parity Gate).
// Row actions that need a dialog (settings, archive, delete, restore) arrive with those dialogs; until then they explain themselves.
export function Projects() {
  const t = useTranslations("Projects");
  const tw = useTranslations("Work");
  const ts = useTranslations("Shell");
  const { workspace, role, openCreateProject } = useShell();
  const privileged = role !== "member";
  const [q, setQ] = useState("");
  const [term, setTerm] = useState(""); // debounced, so typing does not fire a request per key
  const [picked, setPicked] = useState<Show>("ACTIVE");
  const show: Show = privileged ? picked : picked === "DELETED" ? "ACTIVE" : picked;
  const list = useProjectList(workspace?.id, { q: term, show });
  const dash = useDashboard(privileged ? workspace?.id : undefined);

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 220);
    return () => clearTimeout(id);
  }, [q]);

  const rows = list.data ?? [];
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // The board links here with ?settings=<id>: that project's dialog is open until it is closed, if the viewer may edit it.
  const wanted = useSearchParams().get("settings");
  const linked = !dismissed && rows.some((x) => x.id === wanted && x.viewer.canEdit) ? wanted : null;
  const settings = rows.find((p) => p.id === (settingsId ?? linked)) ?? null;
  const closeSettings = () => { setSettingsId(null); setDismissed(true); };
  const deleted = show === "DELETED";
  const cap = dash.data?.capacity;
  const empty: EmptyKind | null = rows.length ? null : term ? "match" : deleted ? "trash" : show === "ARCHIVED" ? "arch" : "none";
  const showSkeleton = list.isPending;

  const tabs: [Show, string][] = [["ACTIVE", t("active")], ["ARCHIVED", t("archived")], ...(privileged ? ([["DELETED", t("deleted")]] as [Show, string][]) : [])];

  return (
    <div className="st-page pj-page">
      <div className="ap-ovh">
        <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
          <Link href={`/w/${workspace?.slug ?? ""}`}>{ts("navDash")}</Link><span aria-hidden="true">/</span><b>{ts("navProj")}</b>
        </nav>
      </div>

      <section className="ap-card pj-tools" aria-label={t("filters")}>
        <div className="pj-trow">
          <label className="pj-search"><span className="ap-sr">{t("searchLabel")}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder={t("searchPh")} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="ap-seg pj-seg" role="radiogroup" aria-label={t("show")}>
            {tabs.map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={show === v} onClick={() => setPicked(v)}>{label}</button>)}
          </div>
          {/* always rendered: the sibling rule `.pj-cap[hidden] + .pj-new` keeps the button on the right while the chip is absent */}
          <span className={`pj-cap${cap && cap.currentProjects >= cap.maxProjects ? " is-full" : ""}`} hidden={!cap || list.isError}>{cap ? t("cap", { used: cap.currentProjects, max: cap.maxProjects }) : ""}</span>
          {privileged && (
            <a className="pm-btn pm-go pj-new" href="#create" onClick={(e) => { e.preventDefault(); openCreateProject(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg><span>{ts("create")}</span>
            </a>
          )}
        </div>
      </section>

      {list.isError && !list.data ? (
        <section className="ap-card st-error" role="alert">
          <b>{t("errTitle")}</b>
          <p>{tw("errorText")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => list.refetch()}>{tw("retry")}</button>
        </section>
      ) : (
        <>
          <section className="ap-card pj-list" aria-labelledby="pj-h" hidden={!showSkeleton && rows.length === 0}>
            <header className="ap-ch"><h2 id="pj-h"><span>{deleted ? t("deletedTitle") : t("title")}</span> <span className="st-count">{showSkeleton ? "" : rows.length}</span></h2><span className="st-note">{deleted ? t("noteDeleted") : t("noteActive")}</span></header>
            <div className="pj-tw" role="table" aria-label={t("title")}>
              <div className="pj-tr pj-th" role="row">
                <span role="columnheader">{t("colName")}</span><span role="columnheader">{t("colMembers")}</span><span role="columnheader">{t("colProgress")}</span><span role="columnheader">{deleted ? t("colDeleted") : t("colCreated")}</span><span role="columnheader">{t("colStatus")}</span><span role="columnheader" className="ap-sr">{t("colActions")}</span>
              </div>
              <div aria-live="polite" aria-busy={list.isFetching && !showSkeleton}>
                {showSkeleton ? <Skeleton /> : rows.map((p) => <Row key={p.id} p={p} onSettings={() => setSettingsId(p.id)} onConfirm={setConfirm} />)}
              </div>
            </div>
          </section>

          {empty && !showSkeleton && (
            <section className="ap-empty pj-empty il-scene">
              <div className="pj-empty-ill il-illu" aria-hidden="true">{SCENES[empty]}</div>
              <h2>{empty === "none" ? (privileged ? t("noneT") : t("memberT")) : t(`${empty}T`)}</h2>
              <p>{empty === "none" ? (privileged ? t("noneD") : t("memberD")) : t(`${empty}D`)}</p>
              <div className="pj-empty-act">
                {empty === "none" && privileged && <a className="pm-btn pm-go" href="#create" onClick={(e) => { e.preventDefault(); openCreateProject(); }}>{t("first")}</a>}
                {empty === "match" && <button type="button" className="pm-btn pm-ghost" onClick={() => { setQ(""); setTerm(""); }}>{tw("clearFilters")}</button>}
              </div>
            </section>
          )}
        </>
      )}
      <ProjectSettingsDialog project={settings} onClose={closeSettings} onConfirm={setConfirm} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} onDone={closeSettings} />
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <div className="pj-tr pj-row st-skel" aria-hidden="true" key={i}>
          <span className="pj-name"><span className="ap-key">&nbsp;&nbsp;&nbsp;</span><span className="pj-nm"><b /><small /></span></span>
          <span className="pj-mem"><small /></span><span className="pj-prog"><small /></span><span className="pj-cr"><b /></span><span /><span />
        </div>
      ))}
    </>
  );
}

function Row({ p, onSettings, onConfirm }: { p: ProjectRow; onSettings: () => void; onConfirm: (c: Confirm) => void }) {
  const t = useTranslations("Projects");
  const { date } = useFormat();
  const { workspace, notify } = useShell();
  const tw = useTranslations("Work");
  const [menu, setMenu] = useState(false);
  const state = projectState(p);
  const del = !!p.deletedAt;
  const { total, pct } = progressPercent(p.taskCounts);
  const days = del ? daysSince(p.deletedAt!) : 0;
  const label: Record<ProjectState, string> = { active: t("active"), readonly: tw("readOnly"), archived: t("archived"), deleted: t("statusDeleted") };
  const pd = useTranslations("ProjectDialogs");
  const errMsg = useProjectErrors();
  const restore = useRestoreProject(workspace?.id);
  const run = (fn: () => void) => () => { setMenu(false); fn(); };
  const onRestore = async () => {
    try {
      await restore.mutateAsync(p.id);
      notify(pd("okRestored"));
    } catch (err) {
      notify(errMsg(err));
    }
  };

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (!(e.target as Element).closest?.(".pj-act")) setMenu(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const items: [string, string, boolean?][] = [];
  if (!del) items.push(["open", t("menuOpen")]);
  if (p.viewer.canEdit) items.push(["settings", t("menuSettings")]);
  if (p.viewer.canArchive) items.push(["archive", p.lifecycleStatus === "ARCHIVED" ? t("menuUnarchive") : t("menuArchive")]);
  if (p.viewer.canDelete) items.push(["delete", t("menuDelete"), true]);

  return (
    <div className={`pj-tr pj-row${del ? " is-del" : ""}`} role="row">
      <span className="pj-name" role="cell"><span className="ap-key">{p.key}</span><span className="pj-nm"><b>{del ? p.name : <Link href={`/w/${workspace?.slug ?? ""}/projects/${p.key}`}>{p.name}</Link>}</b><small>{p.description || ""}</small></span></span>
      <span className="pj-mem" role="cell"><span className="bd-stack">{p.members.map((m) => <Avatar key={m.userId} className={`bd-av in-stack ${avatarClass(m.userId)}`} title={m.name} name={m.name} url={m.avatarUrl} />)}</span><small>{t("members", { n: p._count.members })}</small></span>
      <span className="pj-prog" role="cell"><span className="pj-bar" role="progressbar" aria-label={p.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span><small>{total ? t("doneOf", { done: p.taskCounts.done, total }) : t("noTasks")}</small></span>
      <span className="pj-cr" role="cell">{del ? <b>{days === 0 ? t("today") : t("deletedAgo", { n: days })}</b> : <b>{date(p.createdAt, true)}</b>}<small>{t("by")} {p.createdBy?.name}</small></span>
      <span role="cell"><span className={`ap-st ${STATE_CLASS[state]}`}>{label[state]}</span></span>
      <span className="pj-act" role="cell">
        {p.viewer.canRestore ? (
          <button type="button" className="pm-btn pm-ghost st-sm" aria-busy={restore.isPending} disabled={restore.isPending} onClick={onRestore}><span className="pm-spin" aria-hidden="true" /><span>{t("restore")}</span></button>
        ) : (
          <>
            <button type="button" className="pj-more" aria-haspopup="menu" aria-expanded={menu} aria-label={`${t("more")}: ${p.name}`} onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
            </button>
            <div className="pj-menu" role="menu" hidden={!menu}>
              {items.map(([k, text, danger]) => k === "open"
                ? <Link key={k} role="menuitem" href={`/w/${workspace?.slug ?? ""}/projects/${p.key}`} onClick={() => setMenu(false)}>{text}</Link>
                : <button key={k} role="menuitem" type="button" className={danger ? "is-danger" : undefined} onClick={run(() => (k === "settings" ? onSettings() : onConfirm({ kind: k === "delete" ? "delete" : p.lifecycleStatus === "ARCHIVED" ? "unarchive" : "archive", project: p })))}>{text}</button>)}
            </div>
          </>
        )}
      </span>
    </div>
  );
}
