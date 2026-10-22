"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { initials } from "@/lib/dashboard";
import { CATEGORIES, REOPEN_TARGET, boardErrorKey, useCreateTask, useReopenTask, type BoardProject, type BoardTask, type Priority } from "@/lib/board";
import "@/components/dashboard/illustration.css";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "@/components/projects/project-dialogs.css";
import "./board-dialogs.css";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const CAPTION_MS = 5200;
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PRIO_STROKE: Record<Priority, string> = { URGENT: "#B4381E", HIGH: "#B7791F", MEDIUM: "#2563EB", LOW: "#71717A" };

// Native <dialog> kept in sync with an `open` flag: focus trap, Escape and the backdrop come from the platform.
function useModal(open: boolean, busy: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return { ref, onCancel: (e: { preventDefault: () => void }) => { if (busy) e.preventDefault(); } };
}

// SCR-TSK-03. Markup and class names follow screens/groups/04-projects-tasks/board.html (Parity Gate).
export function CreateTaskDialog({ open, project, onClose, onCreated }: { open: boolean; project: BoardProject; onClose: () => void; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const { ref, onCancel } = useModal(open, busy);
  return (
    <dialog ref={ref} className="pm tk" id="tk-dlg" aria-labelledby="tk-title" aria-describedby="tk-sub" onClose={onClose} onCancel={onCancel}>
      {open && <CreateTaskForm project={project} onClose={onClose} onBusy={setBusy} onCreated={onCreated} />}
    </dialog>
  );
}

function CreateTaskForm({ project, onClose, onBusy, onCreated }: { project: BoardProject; onClose: () => void; onBusy: (b: boolean) => void; onCreated: () => void }) {
  const t = useTranslations("Board");
  const tw = useTranslations("Work");
  const { workspace, notify } = useShell();
  const { date } = useFormat();
  const create = useCreateTask(project.id, workspace?.id);
  const nameRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [prio, setPrio] = useState<Priority>("MEDIUM");
  const [cat, setCat] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [titleErr, setTitleErr] = useState("");
  const [alert, setAlert] = useState("");
  const [cur, setCur] = useState(0);
  const busy = create.isPending;
  const trimmed = title.trim();

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]); // a click on the pager changes cur and so restarts the timer

  const changed = (set: () => void) => { set(); setTitleErr(""); setAlert(""); };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!trimmed) { setTitleErr(t("errTitle2")); nameRef.current?.focus(); return; }
    try {
      await create.mutateAsync({
        title: trimmed,
        ...(desc.trim() ? { description: desc.trim() } : {}),
        priority: prio,
        ...(cat ? { category: cat } : {}),
        ...(assignee ? { assigneeId: assignee } : {}),
        ...(due ? { dueDate: due } : {}),
      });
      onClose();
      onCreated();
      notify(`${t("created")}: ${clip(trimmed, 40)}`);
    } catch (err) {
      setAlert(t(boardErrorKey(err)));
    }
  }

  const prioLabel = tw(`p${prio}`);
  const pillW = Math.max(60, prioLabel.length * 8 + 26);
  const who = project.members.find((m) => m.userId === assignee);
  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const captions: ReactNode[] = [t.rich("tkCap1", bold), t.rich("tkCap2", bold), t.rich("tkCap3", bold)];

  return (
    <form className="pm-form" id="tk-form" onSubmit={onSubmit} noValidate>
      <div className="pm-main">
        <header className="pm-head">
          <div>
            <h2 id="tk-title">{t("tkTitle")}</h2>
            <p id="tk-sub">{t("tkSub")}</p>
          </div>
          <button type="button" className="pm-x" id="tk-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        <div className="pm-alert" id="tk-alert" role="alert" hidden={!alert}>{alert}</div>

        <div className={`pm-f${titleErr ? " is-bad" : ""}`} id="tk-f-title">
          <div className="pm-lrow"><label htmlFor="tk-name">{t("tkName")}</label><span className="pm-count" id="tk-count" aria-hidden="true">{title.length}/200</span></div>
          <input ref={nameRef} id="tk-name" name="title" type="text" maxLength={200} autoComplete="off" placeholder={t("tkNamePh")} aria-describedby="tk-name-e" value={title} onChange={(e) => changed(() => setTitle(e.target.value))} />
          <p className="pm-err" id="tk-name-e" hidden={!titleErr}>{titleErr}</p>
        </div>

        <div className="pm-f">
          <div className="pm-lrow"><label htmlFor="tk-desc"><span>{t("desc")}</span> <i>{t("opt")}</i></label><span className="pm-count" id="tk-dcount" aria-hidden="true">{desc.length}/5000</span></div>
          <textarea id="tk-desc" name="description" rows={3} maxLength={5000} placeholder={t("tkDescPh")} value={desc} onChange={(e) => changed(() => setDesc(e.target.value))} />
        </div>

        <fieldset className="pm-f">
          <legend className="iv-lbl">{t("priority")}</legend>
          <div className="tk-prio" id="tk-prio">
            {PRIORITIES.map((p) => (
              <label key={p}><input type="radio" name="priority" value={p} checked={prio === p} onChange={() => changed(() => setPrio(p))} /><span className={`pr pr-${p}`}>{tw(`p${p}`)}</span></label>
            ))}
          </div>
        </fieldset>

        <div className="tk-two">
          <div className="pm-f"><label htmlFor="tk-cat">{t("category")}</label><span className="ap-select"><select id="tk-cat" name="category" value={cat} onChange={(e) => changed(() => setCat(e.target.value))}>
            <option value="">{t("noCategory")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`c${c}`)}</option>)}
          </select></span></div>
          <div className="pm-f"><label htmlFor="tk-assignee">{t("assignee")}</label><span className="ap-select"><select id="tk-assignee" name="assigneeId" value={assignee} onChange={(e) => changed(() => setAssignee(e.target.value))}>
            <option value="">{t("unassigned")}</option>
            {project.members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
          </select></span></div>
        </div>
        <div className="pm-f"><label htmlFor="tk-due">{t("due")}</label><input id="tk-due" name="dueDate" type="date" value={due} onChange={(e) => changed(() => setDue(e.target.value))} /></div>

        <footer className="pm-foot">
          <button type="button" className="pm-btn pm-ghost" id="tk-cancel" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="pm-btn pm-go" id="tk-go" aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("create")}</span></button>
        </footer>
      </div>

      <aside className="pm-side il-scene" aria-label={t("tkSvg")}>
        <div className="il-illu">
          <svg viewBox="0 0 420 420" role="img" aria-label={t("tkSvg")}>
            <g className="il-dots" aria-hidden="true"><path d="M300 262 C312 280 318 292 322 304" /></g>
            <rect className="il-paper il-line" x="30" y="30" width="360" height="232" rx="18" />
            <g className="il-lbl"><text x="52" y="58">{tw("sTODO")}</text><text x="258" y="58">{tw("sIN_PROGRESS")}</text></g>
            <rect className="il-slot" x="44" y="68" width="196" height="180" rx="10" />
            <rect className="il-slot" x="250" y="68" width="126" height="180" rx="10" />
            <rect className="il-soft" x="262" y="82" width="102" height="36" rx="8" style={{ strokeWidth: 1.4, opacity: 0.6 }} />
            <rect className="il-soft" x="262" y="126" width="102" height="36" rx="8" style={{ strokeWidth: 1.4, opacity: 0.6 }} />

            <g className="il-float"><g transform="rotate(-2 140 130)">
              <rect className="il-paper il-line" x="54" y="82" width="172" height="112" rx="12" style={{ stroke: "var(--il-brand)", strokeWidth: 3 }} />
              <circle className="il-brandfill" cx="140" cy="82" r="7" />
              <text className={`il-t1${trimmed ? "" : " is-empty"}`} id="tk-pv-title" x="68" y="116" style={{ fontSize: "14.5px" }}>{clip(trimmed, 20) || t("untitled")}</text>
              <rect className="il-pill" id="tk-pv-prio-r" x="68" y="128" width={pillW} height="22" rx="11" style={{ stroke: PRIO_STROKE[prio] }} /><text className="il-pill-t" id="tk-pv-prio" x={68 + pillW / 2} y="143" style={{ fill: PRIO_STROKE[prio] }}>{prioLabel}</text>
              <text className="il-t2" id="tk-pv-due" x="68" y="176" style={{ fontSize: "11.5px" }}>{due ? `${t("dueShort")} ${date(`${due}T12:00:00`)}` : t("noDue")}</text>
              <circle className="il-soft" cx="202" cy="167" r="13" /><text id="tk-pv-av" x="202" y="171" style={{ fontSize: "9.5px", fontWeight: 800, textAnchor: "middle", fill: "var(--il-ink)" } as CSSProperties}>{who ? initials(who.user.name) : "—"}</text>
            </g></g>

            <path className="il-arm-o" d="M138 376 L176 330 L170 224" /><path className="il-arm-f" d="M138 376 L176 330 L170 224" /><circle className="il-fist" cx="168" cy="210" r="12" />
            <path className="il-body" d="M60 420 C60 362 86 336 112 336 C138 336 164 362 164 420 Z" />
            <polygon className="il-emblem" points="112,356 124,363 124,377 112,384 100,377 100,363" />
            <rect className="il-neck" x="104" y="322" width="16" height="20" rx="6" />
            <circle className="il-head" cx="112" cy="294" r="32" />
            <path className="il-hair" d="M80 292 C76 258 98 250 114 252 C134 254 148 270 144 294 C139 280 129 272 115 272 C99 272 87 278 80 292 Z" />
            <path className="il-hair" d="M81 292 C74 308 78 322 89 326 L92 304 Z" /><path className="il-hair" d="M143 294 C150 310 145 324 134 328 L131 306 Z" />
            <path className="il-face" d="M92 300 q5 4 10 0 M114 300 q5 4 10 0 M98 313 q8 7 16 0" />

            <g className="il-float d2"><rect className="il-paper il-line" x="206" y="290" width="188" height="34" rx="17" /><circle className="il-tick-c" cx="227" cy="307" r="9" /><path className="il-tick" d="M223 307 l3 3 l5.5 -6" /><text className="il-t3" x="243" y="312">{t("svgStarts")}</text></g>
            <g className="il-float d3"><rect className="il-paper il-line" x="206" y="334" width="188" height="34" rx="17" /><circle className="il-tick-c" cx="227" cy="351" r="9" /><path className="il-tick" d="M223 351 l3 3 l5.5 -6" /><text className="il-t3" x="243" y="356">{t("svgMembersOnly")}</text></g>
          </svg>
        </div>
        <div className="il-caps" aria-live="polite">
          {captions.map((c, i) => <p key={i} className={`il-cap${cur === i ? " is-on" : ""}`}>{c}</p>)}
        </div>
        <div className="il-pager" role="tablist" aria-label={t("highlights")}>
          {captions.map((_, i) => <button key={i} type="button" role="tab" className={cur === i ? "is-on" : undefined} aria-label={t("highlight", { n: i + 1 })} aria-selected={cur === i} onClick={() => setCur(i)} />)}
        </div>
      </aside>
    </form>
  );
}

// SCR-TSK-02. Reopening a done or cancelled task needs a reason, so it never goes through the optimistic move.
export function ReopenDialog({ task, projectId, onClose }: { task: Pick<BoardTask, "id" | "title" | "status"> | null; projectId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const { ref, onCancel } = useModal(!!task, busy);
  return (
    <dialog ref={ref} className="pm st-dlg rp" id="rp-dlg" aria-labelledby="rp-t" aria-describedby="rp-d" onClose={onClose} onCancel={onCancel}>
      {task && <ReopenForm key={task.id} task={task} projectId={projectId} onClose={onClose} onBusy={setBusy} />}
    </dialog>
  );
}

function ReopenForm({ task, projectId, onClose, onBusy }: { task: Pick<BoardTask, "id" | "title" | "status">; projectId: string; onClose: () => void; onBusy: (b: boolean) => void }) {
  const t = useTranslations("Board");
  const tw = useTranslations("Work");
  const { workspace, notify } = useShell();
  const reopen = useReopenTask(projectId, workspace?.id);
  const ref = useRef<HTMLTextAreaElement>(null);
  const target = REOPEN_TARGET[task.status]!;
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const busy = reopen.isPending;
  const ok = reason.trim().length >= 5;

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!ok) { setErr(t("rpErr")); return; }
    try {
      await reopen.mutateAsync({ id: task.id, from: task.status, targetStatus: target, reason: reason.trim() });
      onClose();
      notify(`${t("reopened")}: ${tw(`s${target}`)}`);
    } catch (e2) {
      setErr(t(boardErrorKey(e2)));
    }
  }

  return (
    <form className="st-dlg-in" id="rp-form" onSubmit={onSubmit} noValidate>
      <span className="rp-ic" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg></span>
      <h2 id="rp-t">{t("rpTitle")}</h2>
      <p id="rp-d">{`“${task.title}”`}</p>
      <div className="rp-flow" id="rp-flow">
        <span className={`ap-st st-${task.status === "DONE" ? "done" : "todo"}`}>{tw(`s${task.status}`)}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="rp-arrow"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <span className="ap-st st-doing">{tw(`s${target}`)}</span>
      </div>
      <div className={`pm-f${err ? " is-bad" : ""}`} id="rp-f">
        <div className="pm-lrow"><label htmlFor="rp-reason">{t("rpReason")}</label><span className="pm-count" id="rp-count" aria-hidden="true">{reason.length}/1000</span></div>
        <textarea ref={ref} id="rp-reason" rows={3} maxLength={1000} placeholder={t("rpPh")} aria-describedby="rp-hint rp-e" value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} />
        <p className="pm-hint" id="rp-hint">{t("rpHint")}</p>
        <p className="pm-err" id="rp-e" hidden={!err}>{err}</p>
      </div>
      <div className="pm-foot">
        <button type="button" className="pm-btn pm-ghost" id="rp-no" onClick={onClose}>{t("cancel")}</button>
        <button type="submit" className="pm-btn pm-go" id="rp-go" disabled={!ok} aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("rpGo")}</span></button>
      </div>
    </form>
  );
}
