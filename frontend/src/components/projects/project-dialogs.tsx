"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";
import { useDeleteProject, useUpdateProject, type ProjectRow } from "@/lib/projects";
import { useShell } from "@/components/shell/shell-context";
import "@/components/dashboard/illustration.css";
import "./projects.css";
import "./create-project.css";
import "./project-dialogs.css";

const CAPTION_MS = 5000;
export type Confirm = { kind: "archive" | "unarchive" | "delete"; project: ProjectRow };

/** The message for a refused request, in the user's language. */
export function useProjectErrors() {
  const t = useTranslations("ProjectDialogs");
  return (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "";
    if (code === "PROJECT_CAPACITY_EXCEEDED") return t("errCap");
    if (code === "PERMISSION_DENIED") return t("errPerm");
    if (code === "PROJECT_BILLING_READ_ONLY") return t("errRo");
    if (code === "VALIDATION_ERROR" || code === "VALIDATION_FAILED") return t("errName");
    if (code === "RESOURCE_NOT_FOUND") return t("errGone");
    return t("errGeneric");
  };
}

// Native <dialog> kept in sync with an `open` flag: focus trap, Escape and the backdrop come from the platform.
function useModal(open: boolean, busy: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const onCancel = (e: { preventDefault: () => void }) => { if (busy) e.preventDefault(); };
  return { ref, onClose, onCancel };
}

// SCR-PRJ-05. Markup and class names follow screens/groups/04-projects-tasks/projects.html (Parity Gate).
export function ProjectSettingsDialog({ project, onClose, onConfirm }: { project: ProjectRow | null; onClose: () => void; onConfirm: (c: Confirm) => void }) {
  const [busy, setBusy] = useState(false);
  const { ref, onCancel } = useModal(!!project, busy, onClose);
  return (
    <dialog ref={ref} className="pm pj-dlg" aria-labelledby="pjd-t" aria-describedby="pjd-s" onClose={onClose} onCancel={onCancel}>
      {project && <SettingsForm key={project.id} project={project} onClose={onClose} onBusy={setBusy} onConfirm={onConfirm} />}
    </dialog>
  );
}

function SettingsForm({ project, onClose, onBusy, onConfirm }: { project: ProjectRow; onClose: () => void; onBusy: (b: boolean) => void; onConfirm: (c: Confirm) => void }) {
  const t = useTranslations("ProjectDialogs");
  const { workspace, notify } = useShell();
  const errMsg = useProjectErrors();
  const update = useUpdateProject(workspace?.id);
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [nameErr, setNameErr] = useState("");
  const [alert, setAlert] = useState("");
  const [cur, setCur] = useState(0);
  const archived = project.lifecycleStatus === "ARCHIVED";
  const { canArchive, canDelete } = project.viewer;

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { onBusy(update.isPending); }, [update.isPending, onBusy]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (update.isPending) return;
    const trimmed = name.trim();
    setAlert("");
    if (trimmed.length < 2) {
      setNameErr(t("errName"));
      nameRef.current?.focus();
      return;
    }
    setNameErr("");
    try {
      await update.mutateAsync({ id: project.id, name: trimmed, description: desc.trim() });
      onClose();
      notify(t("okSaved"));
    } catch (err) {
      setAlert(errMsg(err));
    }
  }

  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const captions = [t.rich("cap1", bold), t.rich("cap2", bold), t.rich("cap3", bold)];

  return (
    <form className="pm-form" onSubmit={onSubmit} noValidate>
      <div className="pm-main">
        <header className="pm-head">
          <div>
            <h2 id="pjd-t">{t("title")}</h2>
            <p id="pjd-s">{t("sub")}</p>
          </div>
          <button type="button" className="pm-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        <div className="pm-alert" role="alert" hidden={!alert}>{alert}</div>

        <div className={`pm-f${nameErr ? " is-bad" : ""}`}>
          <div className="pm-lrow"><label htmlFor={`${uid}-name`}>{t("name")}</label><span className="pm-count" aria-hidden="true">{name.length}/100</span></div>
          <input ref={nameRef} id={`${uid}-name`} name="name" type="text" maxLength={100} autoComplete="off" aria-describedby={`${uid}-name-e`} value={name} onChange={(e) => { setName(e.target.value); setNameErr(""); }} />
          <p className="pm-err" id={`${uid}-name-e`} hidden={!nameErr}>{nameErr}</p>
        </div>
        <div className="pm-f">
          <div className="pm-lrow"><label htmlFor={`${uid}-key`}>{t("key")}</label><span className="pm-count">{t("keyHint")}</span></div>
          <input id={`${uid}-key`} type="text" readOnly tabIndex={0} className="pj-key-in" value={project.key} />
        </div>
        <div className="pm-f">
          <div className="pm-lrow"><label htmlFor={`${uid}-desc`}><span>{t("desc")}</span> <i>{t("opt")}</i></label><span className="pm-count" aria-hidden="true">{desc.length}/1000</span></div>
          <textarea id={`${uid}-desc`} name="description" maxLength={1000} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="pj-danger" hidden={!canArchive && !canDelete}>
          <h3>{t("lifecycle")}</h3>
          <div className="pj-dz-row" hidden={!canArchive}>
            <div><b>{archived ? t("unarchiveT") : t("archiveT")}</b><p>{archived ? t("unarchiveD") : t("archiveD")}</p></div>
            <button type="button" className="pm-btn pm-ghost st-sm" onClick={() => onConfirm({ kind: archived ? "unarchive" : "archive", project })}>{archived ? t("unarchiveB") : t("archiveB")}</button>
          </div>
          <div className="pj-dz-row" hidden={!canDelete}>
            <div><b>{t("deleteT")}</b><p>{t("deleteD")}</p></div>
            <button type="button" className="pm-btn st-danger st-sm" onClick={() => onConfirm({ kind: "delete", project })}>{t("deleteB")}</button>
          </div>
        </div>

        <footer className="pm-foot">
          <button type="button" className="pm-btn pm-ghost" onClick={onClose}>{t("close")}</button>
          <button type="submit" className="pm-btn pm-go" aria-busy={update.isPending}><span className="pm-spin" aria-hidden="true" /><span>{t("save")}</span></button>
        </footer>
      </div>

      <aside className="pm-side il-scene pj-side" aria-label={t("svgLabel")}>
        <div className="il-illu">
          <svg viewBox="0 0 420 420" role="img" aria-label={t("svgLabel")}>
            <g className="il-dots" aria-hidden="true"><path d="M104 120 C150 90 190 90 214 120" /><path d="M262 140 C282 170 282 188 262 214" /><path d="M262 244 C280 262 280 282 258 300" /></g>
            <g className="il-float">
              <rect className="il-paper il-line" x="214" y="56" width="176" height="78" rx="16" />
              <circle className="il-tick-c" cx="244" cy="95" r="12" /><path className="il-tick" d="M238.5 95 l4 4 l7 -8" />
              <text className="il-t1" x="266" y="92" style={{ fontSize: 15 }}>{t("svgActive")}</text><text className="il-t2" x="266" y="112" style={{ fontSize: 11.5 }}>{t("svgActiveD")}</text>
            </g>
            <g className="il-float d2">
              <rect className="il-paper il-line" x="236" y="170" width="166" height="70" rx="16" />
              <rect className="il-brandfill" x="256" y="190" width="30" height="30" rx="8" style={{ strokeWidth: 2 }} /><path d="M262 202 h18 M262 208 h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              <text className="il-t1" x="298" y="200" style={{ fontSize: 15 }}>{t("svgArchived")}</text><text className="il-t2" x="298" y="219" style={{ fontSize: 11 }}>{t("svgArchivedD")}</text>
            </g>
            <g className="il-float d3">
              <rect className="il-paper il-line" x="214" y="276" width="176" height="70" rx="16" style={{ strokeDasharray: "6 5" }} />
              <path d="M246 300 h20 m-16 0 v18 h12 v-18 M254 296 h4" fill="none" stroke="var(--il-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <text className="il-t1" x="280" y="306" style={{ fontSize: 15 }}>{t("svgDeleted")}</text><text className="il-t2" x="280" y="325" style={{ fontSize: 11 }}>{t("svgDeletedD")}</text>
            </g>
            <path className="il-arm-o" d="M168 372 L204 350 L190 300" /><path className="il-arm-f" d="M168 372 L204 350 L190 300" /><circle className="il-fist" cx="186" cy="289" r="12" />
            <path className="il-body" d="M62 420 C62 378 92 350 120 350 C148 350 176 378 176 420 Z" />
            <polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
            <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" />
            <circle className="il-head" cx="119" cy="308" r="32" />
            <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" />
            <path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
            <path className="il-face" d="M99 314 q5 4 10 0 M121 314 q5 4 10 0 M105 327 q8 7 16 0" />
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

/** Archive, unarchive and delete all ask first. `onDone` runs after the server accepted, so the settings dialog can close too. */
export function ConfirmDialog({ confirm, onClose, onDone }: { confirm: Confirm | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("ProjectDialogs");
  const { workspace, notify } = useShell();
  const errMsg = useProjectErrors();
  const update = useUpdateProject(workspace?.id);
  const remove = useDeleteProject(workspace?.id);
  const busy = update.isPending || remove.isPending;
  const { ref, onCancel } = useModal(!!confirm, busy, onClose);
  const c = confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!c || busy) return;
    try {
      if (c.kind === "delete") await remove.mutateAsync(c.project.id);
      else await update.mutateAsync({ id: c.project.id, lifecycleStatus: c.kind === "archive" ? "ARCHIVED" : "ACTIVE" });
      onClose();
      onDone();
      notify(t(c.kind === "delete" ? "okDeleted" : c.kind === "archive" ? "okArchived" : "okUnarchived"));
    } catch (err) {
      onClose();
      notify(errMsg(err)); // the lists were refetched by the mutation, so the screen shows what is true now
    }
  }

  const k = c?.kind === "delete" ? "cfDelete" : c?.kind === "archive" ? "cfArchive" : "cfUnarchive";
  return (
    <dialog ref={ref} className="pm st-dlg" aria-labelledby="pjc-t" aria-describedby="pjc-d" onClose={onClose} onCancel={onCancel}>
      {c && (
        <form className="st-dlg-in" onSubmit={onSubmit}>
          <h2 id="pjc-t">{`${t(`${k}T`)} (${c.project.key})`}</h2>
          <p id="pjc-d">{t(`${k}D`)}</p>
          <div className="pm-foot">
            <button type="button" className="pm-btn pm-ghost" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" className={`pm-btn ${c.kind === "delete" ? "st-danger" : "pm-go"}`} aria-busy={busy} disabled={busy}><span className="pm-spin" aria-hidden="true" /><span>{t(`${k}Yes`)}</span></button>
          </div>
        </form>
      )}
    </dialog>
  );
}
