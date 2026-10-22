"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { ApiError } from "@/lib/api";
import { deleteErrorKey, initialPick, selectErrorKey, useOffboard, useSelectProjects, type AccountProjects, type Tier } from "@/lib/billing";
import "@/components/dashboard/illustration.css";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "@/components/projects/project-dialogs.css";
import "@/components/settings/invite.css";
import "./billing.css";

const CAPTION_MS = 5200;
const CLOSE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const bold = { b: (c: ReactNode) => <b>{c}</b> };

// Native <dialog> kept in sync with an `open` flag; the body is mounted only while open so every opening starts clean.
function Modal({ id, titleId, subId, open, busy, onClose, children }: { id: string; titleId: string; subId: string; open: boolean; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="pm gv-dlg" id={id} aria-labelledby={titleId} aria-describedby={subId} onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      {open && children}
    </dialog>
  );
}

// The three side captions rotate on a timer; clicking the pager picks one and restarts the timer.
function useCaptions() {
  const [cur, setCur] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]);
  return [cur, setCur] as const;
}

function Side({ className, label, captions, cur, onPick, children }: { className: string; label: string; captions: ReactNode[]; cur: number; onPick: (i: number) => void; children: ReactNode }) {
  const t = useTranslations("Billing");
  return (
    <aside className={`pm-side il-scene gv-side ${className}`} aria-label={label}>
      <div className="il-illu">{children}</div>
      <div className="il-caps" aria-live="polite">
        {captions.map((c, i) => <p key={i} className={`il-cap${cur === i ? " is-on" : ""}`}>{c}</p>)}
      </div>
      <div className="il-pager" role="tablist" aria-label={t("highlights")}>
        {captions.map((_, i) => <button key={i} type="button" role="tab" className={cur === i ? "is-on" : undefined} aria-label={t("highlight", { n: i + 1 })} aria-selected={cur === i} onClick={() => onPick(i)} />)}
      </div>
    </aside>
  );
}

// SCR-SET-03. Markup and class names follow screens/groups/06-account-governance/billing.html (Parity Gate).
export function SelectProjectsDialog({ data, tier, accountId, onClose }: { data: AccountProjects | null; tier: Tier; accountId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal id="gv-sel" titleId="gvs-t" subId="gvs-s" open={!!data} busy={busy} onClose={onClose}>
      {data && <SelectBody data={data} tier={tier} accountId={accountId} onClose={onClose} onBusy={setBusy} />}
    </Modal>
  );
}

function SelectBody({ data, tier, accountId, onClose, onBusy }: { data: AccountProjects; tier: Tier; accountId: string; onClose: () => void; onBusy: (b: boolean) => void }) {
  const t = useTranslations("Billing");
  const { notify } = useShell();
  const select = useSelectProjects(accountId);
  const [picked, setPicked] = useState(() => initialPick(data));
  const [alert, setAlert] = useState("");
  const [cur, setCur] = useCaptions();
  const busy = select.isPending;
  const cap = data.selectionCap;
  const n = picked.length;
  const full = n >= cap;

  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setAlert("");
    try {
      await select.mutateAsync(picked);
      onClose();
      notify(t("selOk"));
    } catch (err) {
      setAlert(t(selectErrorKey(err instanceof ApiError ? err.code : "")));
    }
  }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <form className="pm-form" id="gvs-form" onSubmit={onSubmit} noValidate>
      <div className="pm-main">
        <header className="pm-head">
          <div>
            <h2 id="gvs-t">{t("selT")}</h2>
            <p id="gvs-s">{t("selSub", { plan: t(`tier${tier}`), n: cap })}</p>
          </div>
          <button type="button" className="pm-x" id="gvs-x" aria-label={t("close")} onClick={onClose}>{CLOSE}</button>
        </header>
        <div className="pm-alert" id="gvs-alert" role="alert" hidden={!alert}>{alert}</div>
        <div className="pm-f" role="group" aria-labelledby="gvs-l">
          <div className="pm-lrow"><span className="iv-lbl" id="gvs-l">{t("selL")}</span><span className={`gvs-count${full ? " is-full" : ""}`} id="gvs-count" aria-live="polite">{t("selCount", { a: n, b: cap })}{full ? ` · ${t("selFull")}` : ""}</span></div>
          <div className="iv-plist gv-plist" id="gvs-list">
            {data.projects.map((p) => {
              const on = picked.includes(p.id), off = !on && full;
              return (
                <label className={`iv-p gv-p${off ? " is-off" : ""}`} key={p.id} title={off ? t("selFull") : undefined}>
                  <input type="checkbox" value={p.id} checked={on} disabled={off} onChange={() => toggle(p.id)} />
                  <span className="ap-key">{p.key}</span>
                  <span className="gv-pn"><b>{p.name}</b><small>{`${p.workspace.name} · ${p.taskCount} ${t("selTasks")}${p.lifecycleStatus === "ARCHIVED" ? ` · ${t("selArch")}` : ""}`}</small></span>
                </label>
              );
            })}
          </div>
          <p className="pm-hint">{t("selH")}</p>
        </div>
        <footer className="pm-foot">
          <button type="button" className="pm-btn pm-ghost" id="gvs-cancel" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="pm-btn pm-go" id="gvs-go" aria-busy={busy} disabled={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("selGo")}</span></button>
        </footer>
      </div>

      <Side className="gv-side-sel" label={t("selSide")} cur={cur} onPick={setCur} captions={[t.rich("selCap1", bold), t.rich("selCap2", bold), t.rich("selCap3", bold)]}>
        <svg viewBox="0 0 420 420" role="img" aria-label={t("selSvg")}>
          <g className="il-dots" aria-hidden="true"><path d="M296 266 C300 284 300 296 296 310" /></g>
          <g className="il-float"><g>
            <rect className="il-paper il-line" x="176" y="40" width="232" height="226" rx="18" />
            <text className="il-t3" x="196" y="70" style={{ fontSize: "12px" }}>{t("selSvgEdit")}</text>
            <text className="il-t1" id="gvs-svg-cnt" x="388" y="72" textAnchor="end" style={{ fontSize: "15px", fill: "var(--il-brand)" }}>{`${n} / ${cap}`}</text>
            <g id="gvs-slots">
              {[0, 1, 2].map((i) => {
                const y = 92 + i * 56;
                return i < n ? (
                  <g key={i}>
                    <rect className="il-paper il-line" x="196" y={y} width="192" height="44" rx="12" style={{ stroke: "var(--il-brand)", strokeWidth: 3 }} />
                    <circle className="il-tick-c" cx="220" cy={y + 22} r="11" />
                    <path className="il-tick" d={`M215 ${y + 22} l3.6 3.6 l6.4 -7.4`} />
                    <rect className="il-bar" x="240" y={y + 14} width="86" height="7" rx="3.5" />
                    <rect className="il-bar" x="240" y={y + 26} width="56" height="6" rx="3" />
                  </g>
                ) : <rect key={i} className="il-slot" x="196" y={y} width="192" height="44" rx="12" />;
              })}
            </g>
          </g></g>
          <g className="il-float d2">
            <rect className="il-paper il-line" x="214" y="296" width="194" height="88" rx="16" style={{ opacity: 0.96 }} />
            <g transform="translate(232 316)"><rect className="il-slot" x="0" y="0" width="70" height="22" rx="7" /><rect className="il-slot" x="80" y="0" width="70" height="22" rx="7" /></g>
            <g transform="translate(366 318)"><rect x="0" y="9" width="22" height="16" rx="4" className="il-brandfill" style={{ strokeWidth: 2 }} /><path d="M4 9 V5 a7 7 0 0 1 14 0 V9" fill="none" stroke="var(--il-ink)" strokeWidth="2.4" strokeLinecap="round" /></g>
            <text className="il-t3" x="232" y="364" style={{ fontSize: "12px" }}>{t("selSvgLock")}</text>
          </g>
          <path className="il-arm-o" d="M168 372 L206 350 L190 292" /><path className="il-arm-f" d="M168 372 L206 350 L190 292" /><circle className="il-fist" cx="186" cy="281" r="12" />
          <path className="il-body" d="M62 420 C62 378 92 350 120 350 C148 350 176 378 176 420 Z" />
          <polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
          <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" />
          <circle className="il-head" cx="119" cy="308" r="32" />
          <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" />
          <path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
          <path className="il-face" d="M99 314 q5 4 10 0 M121 314 q5 4 10 0 M105 327 q8 7 16 0" />
        </svg>
      </Side>
    </form>
  );
}

// SCR-SET-04 (DEC-15). Two checks before the owner can start the deletion: the typed account slug and the password.
export function DeleteAccountDialog({ open, accountId, slug, onClose }: { open: boolean; accountId: string; slug: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal id="gv-del" titleId="gvd-t" subId="gvd-s" open={open} busy={busy} onClose={onClose}>
      {open && <DeleteBody accountId={accountId} slug={slug} onClose={onClose} onBusy={setBusy} />}
    </Modal>
  );
}

function DeleteBody({ accountId, slug, onClose, onBusy }: { accountId: string; slug: string; onClose: () => void; onBusy: (b: boolean) => void }) {
  const t = useTranslations("Billing");
  const { notify } = useShell();
  const offboard = useOffboard(accountId);
  const pwRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [alert, setAlert] = useState("");
  const [cur, setCur] = useCaptions();
  const busy = offboard.isPending;
  const ready = typed.trim() === slug && pw.length > 0;

  useEffect(() => { onBusy(busy); }, [busy, onBusy]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setAlert("");
    try {
      await offboard.mutateAsync({ passwordConfirmation: pw, slugConfirmation: typed.trim() });
      onClose();
      notify(t("delOk"));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "INVALID_PASSWORD_CONFIRMATION") { setPwErr(t("delEPw")); pwRef.current?.focus(); }
      else setAlert(t(deleteErrorKey(code)));
    }
  }

  return (
    <form className="pm-form" id="gvd-form" onSubmit={onSubmit} noValidate autoComplete="off">
      <input type="text" name="username" autoComplete="username" hidden aria-hidden="true" tabIndex={-1} />
      <div className="pm-main">
        <header className="pm-head">
          <div>
            <h2 id="gvd-t">{t("delT")}</h2>
            <p id="gvd-s">{t("delS")}</p>
          </div>
          <button type="button" className="pm-x" id="gvd-x" aria-label={t("close")} onClick={onClose}>{CLOSE}</button>
        </header>
        <ul className="gvd-list">
          <li>{t("delL1")}</li>
          <li>{t("delL2")}</li>
          <li>{t("delL3")}</li>
        </ul>
        <div className="pm-alert" id="gvd-alert" role="alert" hidden={!alert}>{alert}</div>
        <div className="pm-f" id="gvd-f-slug">
          <label htmlFor="gvd-slug"><span>{t("delSlug")}</span> <b className="gvd-slug" id="gvd-slug-hint">{slug}</b></label>
          <input id="gvd-slug" name="slug" type="text" autoComplete="off" spellCheck={false} autoCapitalize="off" value={typed} onChange={(e) => { setTyped(e.target.value); setAlert(""); }} />
        </div>
        <div className={`pm-f${pwErr ? " is-bad" : ""}`} id="gvd-f-pw">
          <label htmlFor="gvd-pw">{t("delPw")}</label>
          <input ref={pwRef} id="gvd-pw" name="password" type="password" autoComplete="current-password" aria-describedby="gvd-pw-e" value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(""); }} />
          <p className="pm-err" id="gvd-pw-e" hidden={!pwErr}>{pwErr}</p>
        </div>
        <footer className="pm-foot">
          <button type="button" className="pm-btn pm-ghost" id="gvd-cancel" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="pm-btn st-danger" id="gvd-go" aria-busy={busy} disabled={!ready || busy}><span className="pm-spin" aria-hidden="true" /><span>{t("delGo")}</span></button>
        </footer>
      </div>

      <Side className="gv-side-del" label={t("delSide")} cur={cur} onPick={setCur} captions={[t.rich("delCap1", bold), t.rich("delCap2", bold), t.rich("delCap3", bold)]}>
        <svg viewBox="0 0 420 420" role="img" aria-label={t("delSvg")}>
          <g className="il-dots" aria-hidden="true"><path d="M300 150 C310 176 310 198 296 222" /></g>
          <g className="il-float d2">
            <rect className="il-paper il-line" x="206" y="40" width="196" height="40" rx="20" />
            <circle className="il-tick-c" cx="230" cy="60" r="10" /><path className="il-tick" d="M225.5 60 l3.5 3.5 l6 -7" />
            <text className="il-t3" x="248" y="65" style={{ fontSize: "12.5px" }}>{t("delSvgAudit")}</text>
          </g>
          <g className="il-float d3">
            <rect className="il-paper il-line" x="236" y="96" width="172" height="40" rx="20" />
            <path d="M262 124 L272 106 L282 124 Z" fill="none" stroke="var(--il-brand)" strokeWidth="2.4" strokeLinejoin="round" /><path d="M272 112 v6 M272 121 v.5" stroke="var(--il-brand)" strokeWidth="2.4" strokeLinecap="round" />
            <text className="il-t3" x="292" y="121" style={{ fontSize: "12.5px" }}>{t("delSvgUndo")}</text>
          </g>
          <g className="il-float"><g transform="rotate(-2 290 270)">
            <path className="il-folder-b" d="M200 190 h54 l14 18 h110 a12 12 0 0 1 12 12 v100 a12 12 0 0 1 -12 12 h-166 a12 12 0 0 1 -12 -12 v-118 a12 12 0 0 1 12 -12 z" />
            <rect className="il-paper il-line" x="212" y="224" width="166" height="88" rx="12" />
            <rect className="il-brandfill" x="276" y="252" width="38" height="30" rx="8" /><path d="M283 252 v-8 a12 12 0 0 1 24 0 v8" fill="none" stroke="var(--il-ink)" strokeWidth="3" strokeLinecap="round" /><circle cx="295" cy="266" r="3.4" fill="#fff" />
            <text className="il-t2" x="295" y="302" textAnchor="middle" style={{ fontSize: "10.5px" }}>{t("delSvgBox")}</text>
          </g></g>
          <path className="il-arm-o" d="M168 372 L206 358 L214 304" /><path className="il-arm-f" d="M168 372 L206 358 L214 304" /><circle className="il-fist" cx="214" cy="294" r="12" />
          <path className="il-body" d="M62 420 C62 378 92 350 120 350 C148 350 176 378 176 420 Z" />
          <polygon className="il-emblem" points="119,370 131,377 131,391 119,398 107,391 107,377" />
          <rect className="il-neck" x="111" y="336" width="16" height="20" rx="6" />
          <circle className="il-head" cx="119" cy="308" r="32" />
          <path className="il-hair" d="M87 306 C84 272 106 264 121 266 C140 268 154 284 151 308 C146 294 136 286 122 286 C106 286 94 292 87 306 Z" />
          <path className="il-hair" d="M88 306 C82 322 86 336 97 340 L100 318 Z" /><circle className="il-hair" cx="134" cy="264" r="10" />
          <path className="il-face" d="M99 316 q5 -3 10 0 M121 316 q5 -3 10 0 M108 330 q11 -5 22 0" />
        </svg>
      </Side>
    </form>
  );
}
