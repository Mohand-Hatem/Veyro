"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Loader } from "@/components/loader/loader";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { ReopenDialog } from "@/components/board/task-dialogs";
import { ApiError } from "@/lib/api";
import { avatarClass, initials } from "@/lib/dashboard";
import { Avatar } from "@/components/ui/avatar";
import { CATEGORIES, agoParts, boardErrorKey, daysLeft, isTerminal, useBoardProject, useRestoreTask, type Priority, type Status } from "@/lib/board";
import { useAddComment, useDeleteTask, usePatchTask, useTask, type TaskDetail, type TaskPatch } from "@/lib/task";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/projects/project-dialogs.css";
import "@/components/board/board.css";
import "@/components/board/board-dialogs.css";
import "./task.css";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const CAPTION_MS = 6000;
const ORDER: Status[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const STOP_X = [90, 170, 250, 330];
const PRIO_STROKE: Record<Priority, string> = { URGENT: "#B4381E", HIGH: "#B7791F", MEDIUM: "#2563EB", LOW: "#71717A" };
const PILL: Record<Status, string> = { TODO: "todo", IN_PROGRESS: "doing", IN_REVIEW: "review", DONE: "done", CANCELLED: "archived" };
const UNDO = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;

function Crumbs({ projectKey, label }: { projectKey: string; label: string }) {
  const tw = useTranslations("Work");
  const ts = useTranslations("Shell");
  const { workspace } = useShell();
  const slug = workspace?.slug ?? "";
  return (
    <div className="ap-ovh">
      <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
        <Link href={`/w/${slug}`}>{ts("navDash")}</Link><span aria-hidden="true">/</span><Link href={`/w/${slug}/projects`}>{ts("navProj")}</Link><span aria-hidden="true">/</span><Link href={`/w/${slug}/projects/${projectKey}`} id="tp-crumb-p">{projectKey}</Link><span aria-hidden="true">/</span><b id="tp-crumb">{label}</b>
      </nav>
    </div>
  );
}

/** Resolves the task, then renders the page. The URL carries the project key for the breadcrumbs; the task itself knows its project. */
export function TaskPage({ projectKey, taskId }: { projectKey: string; taskId: string }) {
  const t = useTranslations("Task");
  const tw = useTranslations("Work");
  const task = useTask(taskId);
  const { workspace } = useShell();
  const slug = workspace?.slug ?? "";

  const card = (title: string, text: string, action: ReactNode) => (
    <div className="st-page bd-page tp-page">
      <Crumbs projectKey={projectKey} label={t("crumb")} />
      <section className="ap-card st-error" role="alert"><b>{title}</b><p>{text}</p>{action}</section>
    </div>
  );
  if (task.isError && !task.data) {
    const gone = task.error instanceof ApiError && task.error.status === 404;
    return gone
      ? (
        <div className="st-page bd-page tp-page">
          <Crumbs projectKey={projectKey} label={t("crumb")} />
          <section className="ap-empty st-denied">
            <div className="ap-empty-ill" aria-hidden="true">
              <svg viewBox="0 0 220 150"><rect className="e-doc" x="62" y="28" width="96" height="86" rx="14" /><circle className="e-plus-c" cx="110" cy="62" r="17" /><path className="e-plus" d="M104 62h12M110 56v12" transform="rotate(45 110 62)" /><rect className="e-fold-f" x="82" y="86" width="56" height="10" rx="5" /></svg>
            </div>
            <h2>{t("notFoundT")}</h2>
            <p>{t("notFoundD")}</p>
            <Link className="ap-btn st-back" href={`/w/${slug}/projects/${projectKey}`}>{t("back")}</Link>
          </section>
        </div>
      )
      : card(t("errT"), tw("errorText"), <button type="button" className="pm-btn pm-ghost" onClick={() => task.refetch()}>{tw("retry")}</button>);
  }
  if (!task.data) return <Loader />;
  return <TaskView task={task.data} projectKey={projectKey} />;
}

type Draft = Partial<Pick<TaskPatch, "title" | "description" | "priority" | "category" | "assigneeId" | "dueDate" | "status">>;

// SCR-TSK-01. Markup and class names follow screens/groups/04-projects-tasks/task.html (Parity Gate).
// Every field saves on its own as soon as it is committed; the server is the authority, a refusal puts the field back.
function TaskView({ task, projectKey }: { task: TaskDetail; projectKey: string }) {
  const t = useTranslations("Task");
  const tb = useTranslations("Board");
  const tw = useTranslations("Work");
  const { workspace, notify } = useShell();
  const { date } = useFormat();
  const router = useRouter();
  const slug = workspace?.slug ?? "";
  const project = useBoardProject(task.project.id).data;
  const patch = usePatchTask(task.id, task.project.id, workspace?.id);
  const addComment = useAddComment(task.id, task.project.id, workspace?.id);
  const restore = useRestoreTask(task.project.id, workspace?.id);

  const [draft, setDraft] = useState<Draft>({});
  const [savedNote, setSavedNote] = useState(false);
  const [comment, setComment] = useState("");
  const [reopening, setReopening] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cur, setCur] = useState(0);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const v = task.viewer;
  const deleted = !!task.deletedAt;
  const blocked = task.project.lifecycleStatus === "ARCHIVED" || task.project.isBillingReadOnly;
  const lock = deleted || blocked;
  const edit = v.canEdit && !blocked;
  const shown = { ...task, ...draft };

  useEffect(() => () => clearTimeout(noteTimer.current), []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]);

  /** Saves one field. While the request runs the field keeps what was typed; afterwards it shows what the server says. */
  async function save(body: TaskPatch) {
    setDraft((d) => ({ ...d, ...body }));
    try {
      await patch.mutateAsync(body);
      setSavedNote(true);
      clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setSavedNote(false), 1800);
    } catch (err) {
      notify(tb(boardErrorKey(err)));
    } finally {
      setDraft((d) => {
        const next = { ...d };
        for (const k of Object.keys(body)) delete next[k as keyof Draft];
        return next;
      });
    }
  }
  const commitText = (key: "title" | "description", value: string) => {
    const current = key === "title" ? task.title : (task.description ?? "");
    if (key === "title" && !value.trim()) { setDraft((d) => ({ ...d, title: undefined })); return; }
    if (value === current) { setDraft((d) => ({ ...d, [key]: undefined })); return; }
    void save({ [key]: key === "title" ? value.trim() : value });
  };

  async function onComment(e: FormEvent) {
    e.preventDefault();
    const text = comment.trim();
    if (!text || addComment.isPending) return;
    try {
      await addComment.mutateAsync(text);
      setComment("");
    } catch (err) {
      notify(tb(boardErrorKey(err)));
    }
  }
  async function onRestore() {
    try {
      await restore.mutateAsync(task.id);
      notify(tb("restored"));
    } catch (err) {
      notify(tb(boardErrorKey(err)));
    }
  }

  const members = project?.members.map((m) => m.user) ?? [];
  const assignees = task.assignee && !members.some((m) => m.id === task.assignee!.id) ? [task.assignee, ...members] : members;
  const statusOptions: Status[] = [task.status, ...v.allowedStatuses];
  const left = deleted && task.purgeAt ? daysLeft(task.purgeAt) : 0;
  const idx = ORDER.indexOf(task.status);
  const cx = task.status === "CANCELLED";
  const prio = shown.priority;
  const pillW = Math.max(60, tw(`p${prio}`).length * 8 + 26);
  const capKey = !v.isProjectAdmin && !isTerminal(task.status) ? (v.allowedStatuses.length ? `m${task.status}` : "mNONE") : `n${task.status}`;
  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const captions: ReactNode[] = [t.rich(capKey as "nTODO", bold), t.rich("cap2", bold), t.rich("cap3", bold)];
  const dateStr = (s: string) => date(s, true);

  return (
    <div className="st-page bd-page tp-page">
      <Crumbs projectKey={projectKey} label={clip(task.title, 32)} />

      <div id="tp-content">
        <div className="tp-grid">
          <div className="tp-main">
            <section className="ap-card tp-head" aria-labelledby="tp-title">
              <div className="tp-top">
                <Link className="tp-back" href={`/w/${slug}/projects/${projectKey}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg><span>{t("back")}</span></Link>
                <span className="td-saved" id="tp-saved" aria-live="polite">{savedNote ? t("saved") : ""}</span>
                <span className="tp-sp" />
                <button type="button" className="pm-btn pm-ghost st-sm" id="tp-reopen" hidden={!(v.canReopen && !blocked)} onClick={() => setReopening(true)}>{UNDO}<span>{t("reopen")}</span></button>
                <button type="button" className="pm-btn st-sm st-link-danger" id="tp-del" hidden={!v.canDelete || blocked} onClick={() => setDeleting(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg><span>{t("delete")}</span></button>
              </div>
              <div className="tp-tags"><span className="ap-key" id="tp-key">{projectKey}</span><span className={`ap-st st-${PILL[task.status]}`} id="tp-pill">{tw(`s${task.status}`)}</span></div>
              <label className="ap-sr" htmlFor="tp-title">{tb("tkName")}</label>
              <input id="tp-title" className="td-title" maxLength={200} autoComplete="off" disabled={!edit} value={draft.title ?? task.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={(e) => commitText("title", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
              <div className="td-deleted" id="tp-deleted" hidden={!deleted}>
                <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="3" opacity=".25" /><circle id="tp-ring" cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.round((left / 30) * 100)} 100`} transform="rotate(-90 24 24)" /><text id="tp-days" x="24" y="29" textAnchor="middle" fontSize="14" fontWeight="800" fill="currentColor">{left}</text></svg>
                <div><b id="tp-del-t">{t("deletedBanner")} · {tb("removedIn", { n: left })}</b><p id="tp-del-d">{task.purgeAt ? `${t("deletedOn")} ${dateStr(task.purgeAt)}.` : ""}</p></div>
                <button type="button" className="pm-btn pm-go td-restore" id="tp-restore" hidden={!v.canRestore} disabled={blocked || restore.isPending} aria-busy={restore.isPending} onClick={onRestore}><span className="pm-spin" aria-hidden="true" /><span>{tb("restore")}</span></button>
              </div>
            </section>

            <section className="ap-card tp-fields" aria-label={t("details")}>
              <p className="bd-note" id="tp-note" hidden={v.isProjectAdmin || deleted}>{tb("memberNote")}</p>
              <div className="td-grid">
                <div className="pm-f"><label htmlFor="tp-status">{tb("status")}</label><span className="ap-select"><select id="tp-status" disabled={lock || !v.allowedStatuses.length} value={shown.status} onChange={(e) => void save({ status: e.target.value as Status })}>
                  {statusOptions.map((s) => <option key={s} value={s}>{tw(`s${s}`)}</option>)}
                </select></span></div>
                <div className="pm-f"><label htmlFor="tp-prio">{tb("priority")}</label><span className="ap-select"><select id="tp-prio" disabled={!edit} value={shown.priority} onChange={(e) => void save({ priority: e.target.value as Priority })}>
                  {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => <option key={p} value={p}>{tw(`p${p}`)}</option>)}
                </select></span></div>
                <div className="pm-f"><label htmlFor="tp-cat">{tb("category")}</label><span className="ap-select"><select id="tp-cat" disabled={!edit} value={shown.category ?? ""} onChange={(e) => void save({ category: e.target.value || null })}>
                  <option value="">{tb("noCategory")}</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{tb(`c${c}`)}</option>)}
                </select></span></div>
                <div className="pm-f"><label htmlFor="tp-assignee">{tb("assignee")}</label><span className="ap-select"><select id="tp-assignee" disabled={!edit} value={shown.assigneeId ?? ""} onChange={(e) => void save({ assigneeId: e.target.value || null })}>
                  <option value="">{tb("unassigned")}</option>
                  {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></span></div>
                <div className="pm-f"><label htmlFor="tp-due">{tb("due")}</label><input id="tp-due" type="date" disabled={!edit} value={shown.dueDate ? new Date(shown.dueDate).toISOString().slice(0, 10) : ""} onChange={(e) => void save({ dueDate: e.target.value || null })} /></div>
              </div>
              <div className="pm-f">
                <div className="pm-lrow"><label htmlFor="tp-desc">{tb("desc")}</label><span className="pm-count" id="tp-dcount" aria-hidden="true">{(draft.description ?? task.description ?? "").length}/5000</span></div>
                <textarea id="tp-desc" rows={6} maxLength={5000} disabled={!edit} placeholder={tb("tkDescPh")} value={draft.description ?? task.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} onBlur={(e) => commitText("description", e.target.value)} />
              </div>
              <dl className="td-meta" id="tp-meta">
                <div><dt>{t("author")}</dt><dd>{task.author.name}</dd></div>
                <div><dt>{t("created")}</dt><dd>{dateStr(task.createdAt)}</dd></div>
                {task.completedAt && <div><dt>{t("completedAt")}</dt><dd>{dateStr(task.completedAt)}</dd></div>}
              </dl>
            </section>

            <section className="ap-card td-comments" aria-labelledby="tp-ch">
              <h3 id="tp-ch"><span>{t("comments")}</span> <span className="st-count" id="tp-cn">{task.comments.length}</span></h3>
              <ul className="td-cl" id="tp-cl">
                {task.comments.length ? task.comments.map((c) => {
                  const sys = /^\[TASK_(REOPENED|REINSTATED):/.test(c.content);
                  const ago = agoParts(c.createdAt);
                  return (
                    <li className={`td-c${sys ? " is-sys" : ""}`} key={c.id}>
                      {sys ? <span className="td-sysic">{UNDO}</span> : <Avatar className={`bd-av ${avatarClass(c.author.id)}`} title={c.author.name} name={c.author.name} url={c.author.avatarUrl} />}
                      <div><b>{c.author.name}</b><small>{tb(ago.key, { n: ago.n })}</small><p>{c.content}</p></div>
                    </li>
                  );
                }) : <li className="td-c-none">{t("noComments")}</li>}
              </ul>
              <form className="td-cform" id="tp-cform" onSubmit={onComment} hidden={deleted || task.project.isBillingReadOnly}>
                <label className="ap-sr" htmlFor="tp-cin">{t("write")}</label>
                <textarea id="tp-cin" rows={2} maxLength={5000} placeholder={t("writePh")} value={comment} onChange={(e) => setComment(e.target.value)} />
                <button type="submit" className="pm-btn pm-go st-sm" id="tp-csend" aria-busy={addComment.isPending}><span className="pm-spin" aria-hidden="true" /><span>{t("send")}</span></button>
              </form>
            </section>
          </div>

          <aside className="tp-side il-scene" aria-label={t("sceneLabel")}>
            <div className="il-illu">
              <svg viewBox="0 0 420 440" role="img" aria-label={t("svgLabel")}>
                <g className="il-dots" aria-hidden="true"><path d="M206 360 C230 350 250 320 262 262" /></g>
                <line className="tp-track" x1="90" y1="196" x2="330" y2="196" />
                <line className="tp-prog" id="tp-prog" x1="90" y1="196" x2={idx >= 0 ? STOP_X[idx] : STOP_X[0]} y2="196" />
                <g id="tp-stops">
                  {ORDER.map((s, i) => (
                    <g key={s} className={`tp-stop${i < idx ? " is-past" : ""}${i === idx ? " is-cur" : ""}`} data-i={i}><circle cx={STOP_X[i]} cy="196" r="15" /><path d={`M${STOP_X[i] - 6} 196 l4.5 4.5 l8 -9`} /><text x={STOP_X[i]} y="234">{tw(`s${s}`)}</text></g>
                  ))}
                </g>
                <g id="tp-cx" className={`tp-cx${cx ? " is-on" : ""}`}><rect x="236" y="268" width="130" height="34" rx="17" className="il-paper il-line" /><circle cx="257" cy="285" r="9" className="tp-cxdot" /><path d="M253 281 l8 8 M261 281 l-8 8" className="tp-cxx" /><text className="il-t3" id="tp-cxl" x="275" y="290">{tw("sCANCELLED")}</text></g>
                <g id="tp-card" className={`tp-cardg${cx ? " is-cx" : ""}`} style={{ transform: `translate(${(cx ? 210 : STOP_X[idx]) - 80}px, ${cx ? 96 : 52}px)` } as CSSProperties}>
                  <rect className="il-paper il-line" id="tp-cardr" x="0" y="0" width="160" height="92" rx="12" style={{ stroke: "var(--il-brand)", strokeWidth: 3 }} />
                  <path className="il-paper il-line" id="tp-ptr" d="M70 92 l10 12 l10 -12" style={{ stroke: "var(--il-brand)", strokeWidth: 3, opacity: cx ? 0 : 1 }} />
                  <text className="il-t1" id="tp-ct" x="14" y="30" style={{ fontSize: "13.5px" }}>{clip(shown.title, 17)}</text>
                  <rect className="il-pill" id="tp-cpr" x="14" y="44" width={pillW} height="22" rx="11" style={{ stroke: PRIO_STROKE[prio] }} /><text className="il-pill-t" id="tp-cp" x={14 + pillW / 2} y="59" style={{ fill: PRIO_STROKE[prio] }}>{tw(`p${prio}`)}</text>
                  <circle className="il-soft" cx="132" cy="62" r="13" /><text id="tp-ca" x="132" y="66" style={{ fontSize: "9.5px", fontWeight: 800, textAnchor: "middle", fill: "var(--il-ink)" } as CSSProperties}>{task.assignee ? initials(task.assignee.name) : "—"}</text>
                </g>
                <path className="il-arm-o" d="M138 404 L176 386 L206 356" /><path className="il-arm-f" d="M138 404 L176 386 L206 356" /><circle className="il-fist" cx="212" cy="348" r="12" />
                <path className="il-body" d="M50 440 C50 388 76 364 102 364 C128 364 154 388 154 440 Z" />
                <polygon className="il-emblem" points="102,384 114,391 114,405 102,412 90,405 90,391" />
                <rect className="il-neck" x="94" y="350" width="16" height="20" rx="6" />
                <circle className="il-head" cx="102" cy="322" r="32" />
                <path className="il-hair" d="M70 320 C66 286 88 278 104 280 C124 282 138 298 134 322 C129 308 119 300 105 300 C89 300 77 306 70 320 Z" />
                <path className="il-hair" d="M71 320 C64 336 68 350 79 354 L82 332 Z" /><path className="il-hair" d="M133 322 C140 338 135 352 124 356 L121 334 Z" />
                <path className="il-face" d="M82 328 q5 4 10 0 M104 328 q5 4 10 0 M88 341 q8 7 16 0" />
              </svg>
            </div>
            <div className="il-caps" aria-live="polite">
              {captions.map((c, i) => <p key={i} className={`il-cap${cur === i ? " is-on" : ""}`}>{c}</p>)}
            </div>
            <div className="il-pager" role="tablist" aria-label={tb("highlights")}>
              {captions.map((_, i) => <button key={i} type="button" role="tab" className={cur === i ? "is-on" : undefined} aria-label={tb("highlight", { n: i + 1 })} aria-selected={cur === i} onClick={() => setCur(i)} />)}
            </div>
          </aside>
        </div>
      </div>

      <ReopenDialog task={reopening ? { id: task.id, title: task.title, status: task.status } : null} projectId={task.project.id} onClose={() => setReopening(false)} />
      <DeleteDialog open={deleting} task={task} onClose={() => setDeleting(false)} onDeleted={() => { notify(t("deletedToast")); router.push(`/w/${slug}/projects/${projectKey}`); }} />
    </div>
  );
}

function DeleteDialog({ open, task, onClose, onDeleted }: { open: boolean; task: TaskDetail; onClose: () => void; onDeleted: () => void }) {
  const t = useTranslations("Task");
  const tb = useTranslations("Board");
  const { workspace, notify } = useShell();
  const remove = useDeleteTask(task.id, task.project.id, workspace?.id);
  const ref = useRef<HTMLDialogElement>(null);
  const busy = remove.isPending;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    try {
      await remove.mutateAsync();
      onClose();
      onDeleted();
    } catch (err) {
      onClose();
      notify(tb(boardErrorKey(err)));
    }
  }
  return (
    <dialog ref={ref} className="pm st-dlg" id="st-confirm" aria-labelledby="stc-t" aria-describedby="stc-d" onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      {open && (
        <form className="st-dlg-in" id="stc-form" onSubmit={onSubmit}>
          <h2 id="stc-t">{t("delT")}</h2>
          <p id="stc-d">{`“${task.title}”. ${t("delD")}`}</p>
          <div className="pm-foot">
            <button type="button" className="pm-btn pm-ghost" id="stc-no" onClick={onClose}>{tb("cancel")}</button>
            <button type="submit" className="pm-btn st-danger" id="stc-yes" aria-busy={busy} disabled={busy}><span className="pm-spin" aria-hidden="true" /><span id="stc-yes-t">{t("delYes")}</span></button>
          </div>
        </form>
      )}
    </dialog>
  );
}
