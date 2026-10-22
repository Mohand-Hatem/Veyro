"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "@/components/projects/project-dialogs.css";
import "./settings.css";

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

export type Ask = { title: string; body: string; cta: string; run: () => Promise<void> };

/** A yes/no question for a destructive action. The action runs inside the dialog, which stays busy until it settles. */
export function ConfirmDialog({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const t = useTranslations("Settings");
  const [busy, setBusy] = useState(false);
  const { ref, onCancel } = useModal(!!ask, busy);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ask || busy) return;
    setBusy(true);
    try {
      await ask.run();
    } finally {
      setBusy(false);
      onClose();
    }
  }
  return (
    <dialog ref={ref} className="pm st-dlg" id="st-confirm" aria-labelledby="stc-t" aria-describedby="stc-d" onClose={onClose} onCancel={onCancel} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      {ask && (
        <form className="st-dlg-in" id="stc-form" onSubmit={onSubmit}>
          <h2 id="stc-t">{ask.title}</h2>
          <p id="stc-d">{ask.body}</p>
          <div className="pm-foot">
            <button type="button" className="pm-btn pm-ghost" id="stc-no" onClick={() => { if (!busy) onClose(); }}>{t("cancel")}</button>
            <button type="submit" className="pm-btn st-danger" id="stc-yes" aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span id="stc-yes-t">{ask.cta}</span></button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/** The one-time invitation link (the raw token is shown once, BR-WS-02.3). */
export function LinkDialog({ link, onClose }: { link: { email: string; url: string } | null; onClose: () => void }) {
  const t = useTranslations("Settings");
  const { notify } = useShell();
  const { ref } = useModal(!!link, false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (link) input.current?.select(); }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link?.url ?? "");
      notify(t("copied"));
    } catch {
      input.current?.select();
      notify(t("copyFail"));
    }
  }
  return (
    <dialog ref={ref} className="pm st-dlg" id="st-link" aria-labelledby="stl-t" aria-describedby="stl-d" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {link && (
        <div className="st-dlg-in">
          <h2 id="stl-t">{t("linkT")}</h2>
          <p id="stl-d">{`${t("linkFor")} ${link.email}`}</p>
          <div className="st-linkbox"><input ref={input} id="stl-url" type="text" readOnly aria-label={t("linkLabel")} value={link.url} /><button type="button" className="pm-btn pm-go" id="stl-copy" onClick={copy}>{t("copy")}</button></div>
          <p className="pm-hint">{t("linkHint")}</p>
          <div className="pm-foot"><button type="button" className="pm-btn pm-ghost" id="stl-close" onClick={onClose}>{t("done")}</button></div>
        </div>
      )}
    </dialog>
  );
}
