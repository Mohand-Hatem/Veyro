"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { ApiError } from "@/lib/api";
import { useProjectList } from "@/lib/projects";
import { useInvite, type InviteResult, type WsRole } from "@/lib/settings";
import "@/components/dashboard/illustration.css";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "@/components/projects/project-dialogs.css";
import "@/components/ui/badges.css";
import "./settings.css";
import "./invite.css";

const CAPTION_MS = 5200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// SCR-INVT-02. Markup and class names follow screens/groups/03-workspace-dashboard/settings.html (Parity Gate).
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="pm iv" id="iv-dlg" aria-labelledby="iv-title" aria-describedby="iv-sub" onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      {open && <InviteBody onClose={onClose} onBusy={setBusy} />}
    </dialog>
  );
}

function InviteBody({ onClose, onBusy }: { onClose: () => void; onBusy: (b: boolean) => void }) {
  const t = useTranslations("Settings");
  const { workspace, notify } = useShell();
  const list = useProjectList(workspace?.id).data;
  const invite = useInvite(workspace?.id);
  const emailRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WsRole>("MEMBER");
  const [picked, setPicked] = useState<string[]>([]);
  const [emailErr, setEmailErr] = useState("");
  const [alert, setAlert] = useState("");
  const [done, setDone] = useState<InviteResult | null>(null);
  const [cur, setCur] = useState(0);
  const busy = invite.isPending;
  const isAdmin = role === "ADMIN";
  const off = (p: { lifecycleStatus: string; isBillingReadOnly: boolean }) => p.lifecycleStatus !== "ACTIVE" || p.isBillingReadOnly;
  // Projects they can join first, oldest first (the API lists newest first); the ones that cannot take new people follow.
  const projects = [...(list ?? [])].reverse().sort((a, b) => Number(off(a)) - Number(off(b)));
  const usable = projects.filter((p) => !off(p));
  const chosen = isAdmin ? [] : picked.filter((id) => usable.some((p) => p.id === id));
  const allOn = usable.length > 0 && usable.every((p) => chosen.includes(p.id));
  const mail = email.trim().toLowerCase();

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]); // a click on the pager changes cur and so restarts the timer
  useEffect(() => { if (done) urlRef.current?.select(); }, [done]);

  function reset() {
    setEmail(""); setRole("MEMBER"); setPicked([]); setEmailErr(""); setAlert(""); setDone(null);
    setTimeout(() => emailRef.current?.focus(), 0);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setAlert("");
    if (!EMAIL_RE.test(mail)) { setEmailErr(t("ivEEmail")); emailRef.current?.focus(); return; }
    setEmailErr("");
    try {
      setDone(await invite.mutateAsync({ email: mail, role, ...(chosen.length ? { projectIds: chosen } : {}) }));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "USER_ALREADY_MEMBER") { setEmailErr(t("ivEMember")); emailRef.current?.focus(); }
      else if (code === "INVITATION_ALREADY_PENDING") { setEmailErr(t("ivEPending")); emailRef.current?.focus(); }
      else if (code === "INVALID_PROJECT_SELECTION") setAlert(t("ivEProj"));
      else if (code === "PERMISSION_DENIED") setAlert(t("ePerm"));
      else setAlert(t("eGeneric"));
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(done?.inviteLink ?? "");
      notify(t("copied"));
    } catch {
      urlRef.current?.select();
      notify(t("copyFail"));
    }
  }

  const pillW = isAdmin ? 62 : 74;
  const shown = chosen.map((id) => projects.find((p) => p.id === id)?.key ?? "").filter(Boolean).slice(0, 3);
  const keys = chosen.map((id) => projects.find((p) => p.id === id)?.key ?? "").filter(Boolean);
  const boxes = shown.reduce<{ k: string; x: number; w: number }[]>((acc, k) => {
    const last = acc[acc.length - 1];
    return [...acc, { k, x: last ? last.x + last.w + 6 : 92 + pillW + 8, w: Math.max(36, k.length * 9 + 16) }];
  }, []);
  const endX = boxes.length ? boxes[boxes.length - 1].x + boxes[boxes.length - 1].w + 6 : 92 + pillW + 8;
  const tags = boxes.map(({ k, x, w }) => <g key={k}><rect className="il-pill" x={x} y="194" width={w} height="26" rx="8" /><text className="il-pill-t" x={x + w / 2} y="211">{k}</text></g>);
  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const captions: ReactNode[] = [t.rich("ivCap1", bold), t.rich("ivCap2", bold), t.rich("ivCap3", bold)];
  const roleName = (r: WsRole) => t(r === "ADMIN" ? "admin" : "member");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x2) => x2 !== id) : [...p, id]));

  return (
    <form className="pm-form" id="iv-form" onSubmit={onSubmit} noValidate>
      <div className="pm-main">
        {!done ? (
          <div className="iv-view" id="iv-view-form">
            <header className="pm-head">
              <div>
                <h2 id="iv-title">{t("ivT")}</h2>
                <p id="iv-sub">{t("ivS")}</p>
              </div>
              <button type="button" className="pm-x" id="iv-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </header>

            <div className="pm-alert" id="iv-alert" role="alert" hidden={!alert}>{alert}</div>

            <div className={`pm-f${emailErr ? " is-bad" : ""}`} id="iv-f-email">
              <label htmlFor="iv-email">{t("ivEmail")}</label>
              <input ref={emailRef} id="iv-email" name="email" type="email" inputMode="email" autoComplete="off" spellCheck={false} placeholder={t("ivEmailPh")} aria-describedby="iv-email-e" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(""); setAlert(""); }} />
              <p className="pm-err" id="iv-email-e" hidden={!emailErr}>{emailErr}</p>
            </div>

            <fieldset className="pm-f iv-roles">
              <legend>{t("ivRole")}</legend>
              <div className="iv-rgrid">
                <label className="iv-role"><input type="radio" name="role" value="MEMBER" checked={role === "MEMBER"} onChange={() => { setRole("MEMBER"); setAlert(""); }} /><span><b>{t("member")}</b><small>{t("ivRoleM")}</small></span></label>
                <label className="iv-role"><input type="radio" name="role" value="ADMIN" checked={role === "ADMIN"} onChange={() => { setRole("ADMIN"); setAlert(""); }} /><span><b>{t("admin")}</b><small>{t("ivRoleA")}</small></span></label>
              </div>
            </fieldset>

            <div className="pm-f iv-projects" id="iv-projects" role="group" aria-labelledby="iv-proj-l">
              <div className="pm-lrow"><span className="iv-lbl" id="iv-proj-l"><span>{t("ivProj")}</span> <i>{t("opt")}</i></span><button type="button" className="pm-link" id="iv-all" hidden={isAdmin} onClick={() => setPicked(allOn ? [] : usable.map((p) => p.id))}>{allOn ? t("ivNone") : t("ivAll")}</button></div>
              <div className="iv-plist" id="iv-plist" hidden={isAdmin}>
                {projects.map((p) => (
                  <label className={`iv-p${off(p) ? " is-off" : ""}`} key={p.id}>
                    <input type="checkbox" value={p.id} disabled={off(p)} checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span className="ap-key">{p.key}</span><b>{p.name}</b>{off(p) && <small>{p.lifecycleStatus === "ARCHIVED" ? t("ivArchived") : t("ivReadonly")}</small>}
                  </label>
                ))}
              </div>
              <p className="pm-hint" id="iv-proj-h" hidden={isAdmin}>{t("ivProjH")}</p>
              <p className="iv-admin-note" id="iv-admin-note" hidden={!isAdmin}>{t("ivAdminN")}</p>
            </div>

            <footer className="pm-foot">
              <button type="button" className="pm-btn pm-ghost" id="iv-cancel" onClick={onClose}>{t("cancel")}</button>
              <button type="submit" className="pm-btn pm-go" id="iv-go" aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("ivGo")}</span></button>
            </footer>
          </div>
        ) : (
          <div className="iv-view" id="iv-view-done">
            <header className="pm-head">
              <div>
                <h2 id="iv-done-t">{t("ivDoneT")}</h2>
                <p id="iv-done-s">{`${t("ivDoneFor")} ${done.email}.`}</p>
              </div>
              <button type="button" className="pm-x" id="iv-x2" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
            </header>
            <div className="st-linkbox"><input ref={urlRef} id="iv-url" type="text" readOnly aria-label={t("linkLabel")} value={done.inviteLink} /><button type="button" className="pm-btn pm-go" id="iv-copy" onClick={copy}>{t("copy")}</button></div>
            <p className="pm-hint">{t("ivDoneH")}</p>
            <div className="iv-sum" id="iv-sum">
              <span className={`st-badge b-${done.role.toLowerCase()}`}>{roleName(done.role)}</span>
              {done.projectIds.length
                ? done.projectIds.map((id) => { const p = projects.find((q) => q.id === id); return p ? <span className="ap-key" key={id} title={p.name}>{p.key}</span> : null; })
                : <small className="st-note">{done.role === "ADMIN" ? t("ivAllProj") : t("ivNoProj")}</small>}
            </div>
            <footer className="pm-foot">
              <button type="button" className="pm-btn pm-ghost" id="iv-again" onClick={reset}>{t("ivAgain")}</button>
              <button type="button" className="pm-btn pm-go" id="iv-done" onClick={onClose}>{t("done")}</button>
            </footer>
          </div>
        )}
      </div>

      <aside className="pm-side il-scene" aria-label={t("ivSideLabel")}>
        <div className="il-illu">
          <svg viewBox="0 0 420 420" role="img" aria-label={t("ivSvg")}>
            <g className="il-dots" aria-hidden="true"><path d="M352 170 C384 210 384 262 346 300" /><path d="M236 252 C246 276 252 290 256 304" /></g>
            <g className="il-float"><g transform="rotate(-3 210 148)">
              <rect className="il-paper il-line" x="70" y="48" width="280" height="198" rx="18" />
              <path className="il-slot" d="M300 62 V232" style={{ opacity: ".4" }} />
              <circle className="il-brandfill" cx="326" cy="92" r="20" /><polygon className="il-emblem" points="326,80 336,86 336,98 326,104 316,98 316,86" style={{ strokeWidth: "2.4" }} />
              <text className="il-t2" x="92" y="86" style={{ fontSize: "12px" }}>{t("ivInvited")}</text>
              <text className="il-t1" id="iv-pv-ws" x="92" y="112" style={{ fontSize: "19px" }}>{workspace?.name ?? ""}</text>
              <text className="il-t2" x="92" y="154" style={{ fontSize: "11.5px" }}>{t("ivFor")}</text>
              <text className={`il-t3${mail ? "" : " is-empty"}`} id="iv-pv-email" x="92" y="174">{clip(mail, 26) || t("ivEmailPh")}</text>
              <g id="iv-pv-role"><rect className="il-pill" x="92" y="194" width={pillW} height="26" rx="13" /><text className="il-pill-t" id="iv-pv-role-t" x={92 + pillW / 2} y="211">{roleName(role)}</text></g>
              <g id="iv-pv-tags">{tags}{keys.length > shown.length && <text className="il-t2" x={endX + 2} y="212" style={{ fontSize: "12px", fontWeight: "700" }}>{`+${keys.length - shown.length}`}</text>}</g>
            </g></g>
            <path className="il-arm-o" d="M168 354 L204 332 L224 270" /><path className="il-arm-f" d="M168 354 L204 332 L224 270" /><circle className="il-fist" cx="229" cy="258" r="12" />
            <path className="il-body" d="M72 420 C72 358 98 332 125 332 C152 332 178 358 178 420 Z" />
            <polygon className="il-emblem" points="125,352 137,359 137,373 125,380 113,373 113,359" />
            <rect className="il-neck" x="117" y="318" width="16" height="20" rx="6" />
            <circle className="il-head" cx="125" cy="290" r="32" />
            <path className="il-hair" d="M93 288 C90 254 112 246 127 248 C146 250 160 266 157 290 C152 276 142 268 128 268 C112 268 100 274 93 288 Z" />
            <path className="il-hair" d="M94 288 C88 304 92 318 103 322 L106 300 Z" /><circle className="il-hair" cx="140" cy="246" r="10" />
            <path className="il-face" d="M105 296 q5 4 10 0 M127 296 q5 4 10 0 M111 309 q8 7 16 0" />
            <g className="il-float d2">
              <rect className="il-paper il-line" x="236" y="300" width="174" height="36" rx="18" />
              <circle cx="258" cy="318" r="9" fill="none" stroke="var(--il-ink)" strokeWidth="2" /><path d="M258 313 v5 l3.5 2" fill="none" stroke="var(--il-ink)" strokeWidth="2" strokeLinecap="round" />
              <text className="il-t3" x="274" y="323">{t("ivValid")}</text>
            </g>
            <g className="il-float d3">
              <rect className="il-paper il-line" x="236" y="346" width="174" height="36" rx="18" />
              <circle className="il-tick-c" cx="258" cy="364" r="9" /><path className="il-tick" d="M254 364 l3 3 l5.5 -6" />
              <text className="il-t3" x="274" y="369">{t("ivLocked")}</text>
            </g>
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
