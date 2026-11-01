"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Status } from "@/lib/board";
import { NOTE_MAX } from "@/lib/task";
import { useMentionPicker, type MentionPerson } from "./mention-picker";
import "./status-move.css";

const ORDER: Status[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const CHECK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

/**
 * The workflow as four steps. The current step is filled, the steps this viewer may move to are buttons, the rest are shown
 * but disabled with `lockedHint` as their reason. Picking a step only selects it: nothing is saved until the note form says so.
 */
export function StatusStepper({ status, allowed, picked, lockedHint, onPick }: { status: Status; allowed: Status[]; picked: Status | null; lockedHint: string; onPick: (s: Status) => void }) {
  const tw = useTranslations("Work");
  const t = useTranslations("Task");
  const idx = ORDER.indexOf(status);
  return (
    <div className="tp-stepper">
      <ol className="tp-steps" aria-label={t("steps")}>
        {ORDER.map((s, i) => {
          const cur = s === status;
          const can = allowed.includes(s);
          return (
            <li key={s}>
              <button
                type="button"
                className={`tp-step${cur ? " is-cur" : ""}${i < idx ? " is-past" : ""}${picked === s ? " is-picked" : ""}`}
                aria-current={cur ? "step" : undefined}
                aria-pressed={can ? picked === s : undefined}
                disabled={!can}
                title={!can && !cur ? lockedHint : undefined}
                onClick={() => onPick(s)}
              >
                <span className="tp-dot">{i <= idx && !cur ? CHECK : null}</span>
                <span className="tp-step-t">{tw(`s${s}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {allowed.includes("CANCELLED") && (
        <button type="button" className={`tp-cancel-step${picked === "CANCELLED" ? " is-picked" : ""}`} aria-pressed={picked === "CANCELLED"} onClick={() => onPick("CANCELLED")}>{t("cancelTask")}</button>
      )}
    </div>
  );
}

/** "What did you do, what is next?" for a status change. Members must write it; for admins it is optional. */
export function StatusNoteForm({ id, to, required, busy, people = [], onSave, onCancel }: { id: string; to: Status; required: boolean; busy: boolean; people?: MentionPerson[]; onSave: (note: string) => void; onCancel: () => void }) {
  const t = useTranslations("Task");
  const tw = useTranslations("Work");
  const tb = useTranslations("Board");
  const [note, setNote] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const mentions = useMentionPicker(ref, people, note, setNote);
  useEffect(() => ref.current?.focus(), [to]);
  const ok = !required || note.trim().length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ok && !busy) onSave(mentions.encode(note.trim()));
  }
  return (
    <form className="tp-move" onSubmit={onSubmit} aria-labelledby={`${id}-h`}>
      <div className="tp-move-h">
        <b id={`${id}-h`}>{t("moveTo", { status: tw(`s${to}`) })}</b>
        <span>{required ? t("noteRequired") : t("noteOptional")}</span>
      </div>
      <label className="ap-sr" htmlFor={id}>{t("noteLabel")}</label>
      <div className="mn-wrap">
        <textarea id={id} dir="auto" rows={3} maxLength={NOTE_MAX} placeholder={t("notePh")} value={note} onChange={(e) => setNote(e.target.value)} aria-required={required} ref={ref} {...mentions.bind} />
        {mentions.menu}
      </div>
      <div className="tp-move-foot">
        <span className="pm-count" aria-hidden="true">{note.length}/{NOTE_MAX}</span>
        <button type="button" className="pm-btn pm-ghost st-sm" onClick={onCancel} disabled={busy}>{tb("cancel")}</button>
        <button type="submit" className="pm-btn pm-go st-sm" disabled={!ok || busy} aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("saveMove")}</span></button>
      </div>
    </form>
  );
}

/** The same note, asked from the board when a member moves one of their cards (menu or drag and drop). */
export function StatusNoteDialog({ move, busy, people, onSave, onClose }: { move: { title: string; to: Status } | null; busy: boolean; people?: MentionPerson[]; onSave: (note: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (move && !el.open) el.showModal();
    if (!move && el.open) el.close();
  }, [move]);
  return (
    <dialog ref={ref} className="pm st-dlg tp-move-dlg" aria-labelledby="bd-move-task" onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      {move && (
        <div className="st-dlg-in">
          <p className="tp-move-task" id="bd-move-task">{move.title}</p>
          <StatusNoteForm id="bd-move-note" to={move.to} required busy={busy} people={people} onSave={onSave} onCancel={onClose} />
        </div>
      )}
    </dialog>
  );
}
