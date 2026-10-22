"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Loader } from "@/components/loader/loader";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { avatarClass, gaugeShares, initials } from "@/lib/dashboard";
import { daysFromToday } from "@/lib/my-tasks";
import { useProjectList } from "@/lib/projects";
import {
  ALLOWED, CATEGORIES, REOPEN_TARGET, STATUSES, boardErrorKey, countKey, dropTargets, isTerminal, useBoardProject, useBoardTasks, useMoveTask,
  type BoardProject, type BoardTask, type Status,
} from "@/lib/board";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import { CreateTaskDialog, ReopenDialog } from "./task-dialogs";
import { MembersDialog } from "./members-dialog";
import { DeletedTasks } from "./deleted-tasks";
import "@/components/ui/au-shared.css";
import "./board.css";

const ARC = "M40 150 A110 110 0 0 1 260 150";
const MORE = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>;
const CAL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
const MSG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const UNDO = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
const PLUS = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const TRASH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>;
const GEAR = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
const SEARCH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;

function Crumbs({ projectKey }: { projectKey: string }) {
  const tw = useTranslations("Work");
  const ts = useTranslations("Shell");
  const { workspace } = useShell();
  const slug = workspace?.slug ?? "";
  return (
    <div className="ap-ovh">
      <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
        <Link href={`/w/${slug}`}>{ts("navDash")}</Link><span aria-hidden="true">/</span><Link href={`/w/${slug}/projects`}>{ts("navProj")}</Link><span aria-hidden="true">/</span><b id="bd-crumb">{projectKey}</b>
      </nav>
    </div>
  );
}

/** Resolves the key in the URL to a project, then hands over to the board. */
export function Board({ projectKey }: { projectKey: string }) {
  const t = useTranslations("Board");
  const tw = useTranslations("Work");
  const { workspace } = useShell();
  const list = useProjectList(workspace?.id); // the URL carries the key, the API wants the id; this list is cached from the Projects page
  const found = list.data?.find((p) => p.key.toLowerCase() === projectKey.toLowerCase());
  const project = useBoardProject(found?.id);

  const card = (title: string, text: string, action: React.ReactNode) => (
    <div className="st-page bd-page">
      <Crumbs projectKey={projectKey} />
      <section className="ap-card st-error" role="alert"><b>{title}</b><p>{text}</p>{action}</section>
    </div>
  );
  if (list.isError && !list.data) return card(t("errT"), tw("errorText"), <button type="button" className="pm-btn pm-ghost" onClick={() => list.refetch()}>{tw("retry")}</button>);
  if (list.data && !found) return card(t("notFoundT"), t("notFoundD"), <Link className="pm-btn pm-ghost" href={`/w/${workspace?.slug ?? ""}/projects`}>{t("backToProjects")}</Link>);
  if (project.isError) return card(t("errT"), tw("errorText"), <button type="button" className="pm-btn pm-ghost" onClick={() => project.refetch()}>{tw("retry")}</button>);
  if (!project.data) return <Loader />;
  return <BoardView project={project.data} />;
}

const ICON_EMPTY = (
  <svg viewBox="0 0 220 150" aria-hidden="true">
    <g className="il-dots"><path d="M150 40 C168 56 174 70 172 86" /></g>
    <g className="il-float"><rect className="il-paper il-line" x="28" y="26" width="104" height="62" rx="10" transform="rotate(-4 80 57)" /><rect className="il-bar" x="42" y="46" width="62" height="6" rx="3" transform="rotate(-4 80 57)" /><rect className="il-bar" x="42" y="60" width="40" height="5" rx="2.5" transform="rotate(-4 80 57)" /><circle className="il-brandfill" cx="82" cy="28" r="6" /></g>
    <g className="il-float d2"><rect className="il-paper il-line" x="96" y="70" width="104" height="62" rx="10" transform="rotate(3 148 101)" /><rect className="il-bar" x="110" y="90" width="64" height="6" rx="3" transform="rotate(3 148 101)" /><rect className="il-bar" x="110" y="104" width="38" height="5" rx="2.5" transform="rotate(3 148 101)" /></g>
  </svg>
);

type Menu = { task: BoardTask; rect: DOMRect };

// SCR-PRJ-01. Markup and class names follow screens/groups/04-projects-tasks/board.html (Parity Gate).
function BoardView({ project }: { project: BoardProject }) {
  const t = useTranslations("Board");
  const tw = useTranslations("Work");
  const td = useTranslations("Dashboard");
  const tp = useTranslations("Projects");
  const rtl = useLocale() === "ar";
  const { due } = useFormat();
  const { workspace, notify } = useShell();
  const router = useRouter();
  const openTask = (id: string) => router.push(`/w/${workspace?.slug ?? ""}/projects/${project.key}/tasks/${id}`);
  const openCreate = () => {
    if (blocked) { notify(t(archived ? "eArchived" : "eReadonly")); return; }
    setCreating(true);
  };

  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("");
  const [prio, setPrio] = useState("");
  const [cat, setCat] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [tab, setTab] = useState<Status>("TODO");
  const [drag, setDrag] = useState<BoardTask | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState(false);
  const [inTrash, setInTrash] = useState(false);
  const [reopening, setReopening] = useState<BoardTask | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const inflight = useRef(new Set<string>()); // a card is moved once at a time: a second drop waits for the first answer

  const tasks = useBoardTasks(project.id, { assigneeId: assignee, priority: prio, category: cat });
  const move = useMoveTask(project.id, workspace?.id);

  const { viewer, taskCounts: c } = project;
  const archived = project.lifecycleStatus === "ARCHIVED";
  const blocked = archived || project.isBillingReadOnly;
  const rules = { blocked, isAdmin: viewer.isAdmin, userId: viewer.userId };
  const rows = tasks.data ?? [];
  const filtered = !!(q.trim() || assignee || prio || cat);
  const total = c.todo + c.inProgress + c.inReview + c.done;
  const g = gaugeShares([{ tasks: c }]);
  const seg = (start: number, len: number) => ({ strokeDasharray: `${len} ${100 - len}`, strokeDashoffset: `${-start}` });
  const statusPill = archived ? ["st-archived", tp("archived")] : project.isBillingReadOnly ? ["st-readonly", tw("readOnly")] : ["st-active", tp("active")];
  const empty = !tasks.isPending && rows.length === 0 && total === 0 && c.cancelled === 0;
  const needle = q.trim().toLowerCase();
  const slug = workspace?.slug ?? "";

  async function doMove(task: BoardTask, to: Status) {
    if (to === task.status) return;
    if (blocked) { notify(t(archived ? "eArchived" : "eReadonly")); return; }
    if (isTerminal(task.status)) {
      if (!viewer.isAdmin) { notify(t("onlyAdminReopen")); return; }
      if (to !== REOPEN_TARGET[task.status]) { notify(t("reopenRule")); return; }
      setReopening(task); // reopening needs a reason, so it goes through the dialog and not the optimistic move
      return;
    }
    if (!viewer.isAdmin && task.assigneeId !== viewer.userId) { notify(t("notAssigned")); return; }
    if (!viewer.isAdmin && to === "CANCELLED") { notify(t("adminCancel")); return; }
    if (!ALLOWED[task.status].includes(to)) { notify(t("invalidMove")); return; }
    if (inflight.current.has(task.id)) return;
    inflight.current.add(task.id);
    try {
      await move.mutateAsync({ id: task.id, from: task.status, to });
      notify(`${t("movedToast")} ${tw(`s${to}`)}`);
    } catch (err) {
      notify(t(boardErrorKey(err)));
    } finally {
      inflight.current.delete(task.id);
    }
  }

  const closeMenu = (refocus: boolean) => {
    setMenu(null);
    if (refocus) opener.current?.focus();
  };
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (!(e.target as Element).closest?.(".bd-pop")) setMenu(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);
  // Places the menu under its button once it is measurable, and focuses the first item.
  const popRef = useCallback((el: HTMLDivElement | null) => {
    if (!el || !menu) return;
    const w = el.offsetWidth;
    el.style.top = `${Math.min(window.innerHeight - el.offsetHeight - 8, menu.rect.bottom + 6)}px`;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, rtl ? menu.rect.left : menu.rect.right - w))}px`;
    el.querySelector("button")?.focus();
  }, [menu, rtl]);

  const onDragStart = (e: DragEvent, task: BoardTask) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    setTimeout(() => setDrag(task), 0); // after the browser took its drag image
  };
  const endDrag = () => { setDrag(null); setOver(null); };
  const okTargets = drag ? dropTargets(drag, rules) : [];
  const colClass = (s: Status) => {
    const cls = ["bd-col", `bd-col-${s.toLowerCase()}`];
    if (tab === s) cls.push("is-tab");
    if (empty) cls.push("is-empty");
    if (drag) { if (okTargets.includes(s)) cls.push("is-ok"); else if (s !== drag.status) cls.push("is-no"); }
    if (over === s) cls.push("is-over");
    return cls.join(" ");
  };

  const openMenu = (e: MouseEvent<HTMLButtonElement>, task: BoardTask) => {
    e.stopPropagation();
    opener.current = e.currentTarget;
    setMenu({ task, rect: e.currentTarget.getBoundingClientRect() });
  };
  const onCardKey = (e: KeyboardEvent<HTMLElement>, id: string) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openTask(id); }
  };

  const avatar = (u: BoardTask["assignee"], extra = "") =>
    u ? <span className={`bd-av ${avatarClass(u.id)} ${extra}`.trim()} title={u.name}>{initials(u.name)}</span> : <span className={`bd-av bd-av-none ${extra}`.trim()} title={t("unassigned")} />;

  const card = (task: BoardTask) => {
    const late = !!task.dueDate && !isTerminal(task.status) && daysFromToday(task.dueDate) < 0;
    return (
      <article
        key={task.id}
        className={`bd-card${task.status === "CANCELLED" ? " is-cancelled" : ""}${drag?.id === task.id ? " is-dragging" : ""}`}
        tabIndex={0}
        draggable={dropTargets(task, rules).length > 0}
        aria-label={`${task.title}, ${tw(`p${task.priority}`)}, ${tw(`s${task.status}`)}`}
        onDragStart={(e) => onDragStart(e, task)}
        onDragEnd={endDrag}
        onClick={() => openTask(task.id)}
        onKeyDown={(e) => onCardKey(e, task.id)}
      >
        <div className="bd-ct">
          <span className="bd-tags"><span className={`pr pr-${task.priority}`}>{tw(`p${task.priority}`)}</span>{task.category && <span className="bd-cat">{t(`c${task.category}`)}</span>}</span>
          <button type="button" className="bd-more" aria-haspopup="menu" aria-expanded={menu?.task.id === task.id} aria-label={`${t("menu")}: ${task.title}`} onClick={(e) => openMenu(e, task)}>{MORE}</button>
        </div>
        <b className="bd-cn">{task.title}</b>
        <div className="bd-cf">
          {task.dueDate && <span className={`bd-due${late ? " is-late" : ""}`} title={late ? t("overdue") : ""}>{CAL}{due(task.dueDate)}</span>}
          {task._count.comments > 0 && <span className="bd-cm">{MSG}{task._count.comments}</span>}
          <span className="bd-sp" />
          {avatar(task.assignee)}
        </div>
      </article>
    );
  };

  const menuItems = menu
    ? (isTerminal(menu.task.status)
        ? (viewer.isAdmin && !blocked ? [REOPEN_TARGET[menu.task.status]!] : [])
        : dropTargets(menu.task, rules)).map((s) => ({ s, reopen: isTerminal(menu.task.status) }))
    : [];

  return (
    <div className="st-page bd-page">
      <Crumbs projectKey={project.key} />

      <div className="bd-content">
        <section className="ap-card bd-head" aria-labelledby="bd-name">
          <div className="bd-head-l">
            <div className="bd-title"><span className="ap-key" id="bd-key">{project.key}</span><h2 id="bd-name">{project.name}</h2><span className={`ap-st ${statusPill[0]}`} id="bd-status">{statusPill[1]}</span></div>
            <p className="bd-desc" id="bd-desc">{project.description ?? ""}</p>
            <button type="button" className="bd-meta" id="bd-mbtn" aria-haspopup="dialog" onClick={() => setMembers(true)}>
              <span className="bd-stack" id="bd-members" aria-hidden="true">{project.members.slice(0, 5).map((m) => <span key={m.userId} className={`bd-av ${avatarClass(m.user.id)} in-stack`} title={m.user.name}>{initials(m.user.name)}</span>)}</span>
              <span className="bd-mcount" id="bd-mcount">{tp("members", { n: project.members.length })}</span>
              <span className="bd-mlink">{t("manage")}</span>
            </button>
            {!viewer.isAdmin && <p className="bd-note" id="bd-note">{t("memberNote")}</p>}
            <div className="bd-actions">
              {viewer.canCreateTask && <button type="button" className="pm-btn pm-go" id="bd-add" disabled={blocked} onClick={openCreate}>{PLUS}<span>{t("add")}</span></button>}
              {viewer.isAdmin && <button type="button" className="pm-btn pm-ghost" id="bd-trash" aria-pressed={inTrash} onClick={() => setInTrash((v) => !v)}>{TRASH}<span id="bd-trash-t">{inTrash ? t("backBoard") : t("trash")}</span></button>}
              {viewer.isAdmin && <Link className="pm-btn pm-ghost" id="bd-settings" href={`/w/${slug}/projects?settings=${project.id}`}>{GEAR}<span>{t("settings")}</span></Link>}
            </div>
          </div>
          <div className="bd-gauge" aria-labelledby="bd-g-h">
            <h3 id="bd-g-h" className="ap-sr">{t("progress")}</h3>
            <div className="ap-gwrap">
              <svg viewBox="0 0 300 175" role="img" aria-label={td("gaugeLabel")}>
                <path className="g-track" d={ARC} pathLength={100} />
                <path className="g-seg g-done" id="bg-done" d={ARC} pathLength={100} style={seg(0, g.pctDone)} />
                <path className="g-seg g-rev" id="bg-rev" d={ARC} pathLength={100} style={seg(g.pctDone, g.pctReview)} />
                <path className="g-seg g-doing" id="bg-doing" d={ARC} pathLength={100} style={seg(g.pctDone + g.pctReview, g.pctDoing)} />
                <g className="g-ticks"><text x="60" y="168">0</text><text x="150" y="66">50</text><text x="240" y="168">100</text></g>
              </svg>
              <div className="ap-gc" id="bg-c" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.percent} aria-label={td("completed")}><b id="bg-pct">{g.percent}%</b><span>{td("completed")}</span></div>
            </div>
            <dl className="ap-gstats" id="bg-stats">
              <div><dd>{g.all}</dd><dt>{td("totalTasks")}</dt></div>
              <div className="gs-done"><dd>{c.done}</dd><dt>{tw("sDONE")}</dt></div>
              <div className="gs-rev"><dd>{c.inReview}</dd><dt>{tw("sIN_REVIEW")}</dt></div>
              <div className="gs-doing"><dd>{c.inProgress}</dd><dt>{tw("sIN_PROGRESS")}</dt></div>
            </dl>
            <p className="ap-gnote">{td("gNote")}</p>
          </div>
        </section>

        {blocked && (
          <section className={`bd-banner ${archived ? "is-info" : "is-warn"}`} id="bd-banner" role="status">
            <b>{t(archived ? "archT" : "roT")}</b><span>{t(archived ? "archD" : "roD")}</span>
          </section>
        )}

        <section className="ap-card bd-tools" aria-label={t("filters")} hidden={inTrash}>
          <label className="ap-search bd-search">{SEARCH}<span className="ap-sr">{t("searchLabel")}</span><input id="bd-q" type="search" placeholder={t("searchPh")} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="ap-select"><span className="ap-sr">{t("assignee")}</span>
            <select id="bd-f-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">{t("allAssignees")}</option>
              {project.members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
            </select>
          </label>
          <label className="ap-select"><span className="ap-sr">{t("priority")}</span>
            <select id="bd-f-prio" value={prio} onChange={(e) => setPrio(e.target.value)}>
              <option value="">{t("allPrio")}</option>
              {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => <option key={p} value={p}>{tw(`p${p}`)}</option>)}
            </select>
          </label>
          <label className="ap-select"><span className="ap-sr">{t("category")}</span>
            <select id="bd-f-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">{t("allCat")}</option>
              {CATEGORIES.map((x) => <option key={x} value={x}>{t(`c${x}`)}</option>)}
            </select>
          </label>
          <button type="button" className="au-chip" id="bd-cancelled-toggle" aria-pressed={showCancelled} onClick={() => { setShowCancelled((v) => !v); if (showCancelled && tab === "CANCELLED") setTab("TODO"); }}><span>{t("showCancelled")}</span> <i id="bd-cancelled-n">{c.cancelled}</i></button>
        </section>

        {/* Mobile column switcher (RESP-PRJ-MOBILE) */}
        <div className="bd-tabs" id="bd-tabs" role="tablist" aria-label={t("status")} hidden={inTrash}>
          {STATUSES.map((s) => (
            <button key={s} type="button" role="tab" className="bd-tab" aria-selected={tab === s} onClick={() => { setTab(s); if (s === "CANCELLED") setShowCancelled(true); }}>{tw(`s${s}`)}<i>{c[countKey(s)]}</i></button>
          ))}
        </div>

        {inTrash ? (
          <DeletedTasks projectId={project.id} blocked={blocked} onOpen={openTask} />
        ) : tasks.isError && !tasks.data ? (
          <section className="ap-card st-error" role="alert">
            <b>{t("errT")}</b>
            <p>{tw("errorText")}</p>
            <button type="button" className="pm-btn pm-ghost" onClick={() => tasks.refetch()}>{tw("retry")}</button>
          </section>
        ) : tasks.isPending ? (
          <section className="bd-board" id="bd-board" aria-label={t("board")} aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <section className="bd-col" key={i}><header><b className="st-skel-b" /></header><div className="bd-cards">{Array.from({ length: 2 }, (_, j) => <div className="bd-card st-skel" aria-hidden="true" key={j}><b /><small /></div>)}</div></section>
            ))}
          </section>
        ) : (
          <section className={`bd-board${showCancelled ? " has-cancelled" : ""}`} id="bd-board" aria-label={t("board")}>
            {STATUSES.filter((s) => s !== "CANCELLED" || showCancelled).map((s) => {
              const items = rows.filter((x) => x.status === s && (!needle || x.title.toLowerCase().includes(needle)));
              const count = c[countKey(s)];
              return (
                <section
                  key={s}
                  className={colClass(s)}
                  data-col={s}
                  aria-label={tw(`s${s}`)}
                  onDragOver={(e) => { if (drag && okTargets.includes(s)) { e.preventDefault(); setOver(s); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === s ? null : o)); }}
                  onDrop={(e) => { e.preventDefault(); const d = drag; endDrag(); if (d) void doMove(d, s); }}
                >
                  <header><b>{tw(`s${s}`)}</b><span className="st-count">{filtered ? `${items.length}/${count}` : count}</span>{s === "TODO" && !blocked && viewer.canCreateTask && <button type="button" className="bd-colplus" aria-label={t("add")} onClick={openCreate}>+</button>}</header>
                  <div className="bd-cards" data-drop={s}>
                    {empty && s === "TODO" ? (
                      <div className="bd-empty-card il-scene" style={{ "--il-sweater": "#7DBE9A" } as React.CSSProperties}>
                        {ICON_EMPTY}
                        <b>{t("emptyT")}</b><p>{t("emptyD")}</p>
                        {viewer.canCreateTask && !blocked && <button type="button" className="pm-btn pm-go" onClick={openCreate}>{t("add")}</button>}
                      </div>
                    ) : items.length ? items.map(card) : <p className="bd-colempty">{filtered && !empty ? t("noneFilter") : t("emptyCol")}</p>}
                  </div>
                </section>
              );
            })}
          </section>
        )}
      </div>

      <CreateTaskDialog open={creating} project={project} onClose={() => setCreating(false)} onCreated={() => setTab("TODO")} />
      <MembersDialog open={members} project={project} blocked={blocked} onClose={() => setMembers(false)} />
      <ReopenDialog task={reopening} projectId={project.id} onClose={() => setReopening(null)} />

      {menu && (
        <div className="bd-pop" role="menu" ref={popRef} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); closeMenu(true); } }}>
          <button role="menuitem" type="button" onClick={() => { closeMenu(false); openTask(menu.task.id); }}>{t("open")}</button>
          {menuItems.map(({ s, reopen }) => (
            <button key={s} role="menuitem" type="button" onClick={() => { closeMenu(false); void doMove(menu.task, s); }}>{reopen && <>{UNDO} </>}{t(reopen ? "reopenTo" : "move")} {tw(`s${s}`)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
