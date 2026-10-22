"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { ApiError } from "@/lib/api";
import { initials, useDashboard } from "@/lib/dashboard";
import { PROJECT_KEY_REGEX, suggestProjectKey } from "@/lib/project-key";
import { useCreateProject, useProjectList } from "@/lib/projects";
import "@/components/dashboard/illustration.css";
import "./projects.css";
import "./create-project.css";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const CAPTION_MS = 5000;

// SCR-PRJ-02. Markup and class names follow screens/groups/03-workspace-dashboard/index.html (Parity Gate).
// The dialog is a native <dialog>: focus trapping, Escape and the backdrop come with the platform.
export function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [pristine, setPristine] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="pm"
      aria-labelledby="pm-title"
      aria-describedby="pm-sub"
      onClose={onClose}
      onCancel={(e) => { if (busy) e.preventDefault(); }}
      onClick={(e) => { if (e.target === e.currentTarget && pristine && !busy) onClose(); }}
    >
      {open && <CreateProjectForm onClose={onClose} onBusy={setBusy} onDirty={setPristine} />}
    </dialog>
  );
}

function CreateProjectForm({ onClose, onBusy, onDirty }: { onClose: () => void; onBusy: (b: boolean) => void; onDirty: (pristine: boolean) => void }) {
  const t = useTranslations("CreateProject");
  const tp = useTranslations("Dashboard");
  const { workspace, user, notify } = useShell();
  const uid = useId();
  const taken = new Set((useProjectList(workspace?.id).data ?? []).map((p) => p.key));
  const cap = useDashboard(workspace?.id).data?.capacity;
  const create = useCreateProject(workspace?.id);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [typedKey, setTypedKey] = useState<string | null>(null); // null = the key follows the name
  const [alert, setAlert] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [keyErr, setKeyErr] = useState("");
  const [cur, setCur] = useState(0);

  const trimmed = name.trim();
  const key = typedKey ?? suggestProjectKey(trimmed, taken);
  const busy = create.isPending;
  const left = cap ? cap.maxProjects - cap.currentProjects : null;

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => { onDirty(!trimmed && !desc.trim()); }, [trimmed, desc, onDirty]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]); // a click on the pager changes cur and so restarts the timer

  const plain = { b: (c: ReactNode) => c };
  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const plan = cap ? tp(`plan${cap.tier}`) : "";
  const capMsg = (rich: typeof bold | typeof plain) => (left === null ? null : left <= 1 ? t("capLast") : t.rich("capUses", { ...rich, left, plan }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const k = key.toUpperCase();
    const nameBad = !trimmed, keyBad = !PROJECT_KEY_REGEX.test(k);
    setAlert("");
    setNameErr(nameBad ? t("errName") : "");
    setKeyErr(keyBad ? t("errKey") : "");
    if (nameBad) return nameRef.current?.focus();
    if (keyBad) return document.getElementById(`${uid}-key`)?.focus();
    try {
      // an untouched key is omitted so the server generates it and resolves collisions itself
      const made = await create.mutateAsync({ name: trimmed, key: typedKey ? k : undefined, description: desc.trim() || undefined });
      onClose();
      notify(`${t("created")}: ${made.name ?? trimmed} (${made.key ?? k})`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "PROJECT_KEY_TAKEN") {
        setTypedKey(k);
        setKeyErr(t("errTaken", { next: suggestProjectKey(k, taken) }));
        document.getElementById(`${uid}-key`)?.focus();
      } else if (code === "PROJECT_CAPACITY_EXCEEDED") setAlert(t("errLimit"));
      else if (code === "PROJECT_BILLING_READ_ONLY" || code === "PLAN_READ_ONLY") setAlert(t("errReadOnly"));
      else setAlert(t("errGeneric"));
    }
  }

  const segs = cap ? Math.min(cap.maxProjects, 8) : 0;
  const segW = segs ? Math.min(16, Math.floor(148 / segs) - 4) : 0;
  const captions: ReactNode[] = [t.rich("cap1", bold), t.rich("cap2", bold), capMsg(bold)];

  return (
    <form className="pm-form" onSubmit={onSubmit} noValidate>
      <div className="pm-main">
        <header className="pm-head">
          <div>
            <h2 id="pm-title">{t("title")}</h2>
            <p id="pm-sub">{t("sub")}</p>
          </div>
          <button type="button" className="pm-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>

        <div className="pm-alert" role="alert" hidden={!alert}>{alert}</div>

        <div className={`pm-f${nameErr ? " is-bad" : ""}`}>
          <label htmlFor={`${uid}-name`}>{t("name")}</label>
          <input ref={nameRef} id={`${uid}-name`} name="name" type="text" maxLength={100} autoComplete="off" required placeholder={t("namePh")} aria-describedby={`${uid}-name-e`} value={name} onChange={(e) => { setName(e.target.value); setNameErr(""); setAlert(""); setKeyErr(""); }} />
          <p className="pm-err" id={`${uid}-name-e`} hidden={!nameErr}>{nameErr}</p>
        </div>

        <div className={`pm-f${keyErr ? " is-bad" : ""}`}>
          <div className="pm-lrow"><label htmlFor={`${uid}-key`}>{t("key")}</label><span className={`pm-auto${typedKey !== null ? " off" : ""}`}>{t("auto")}</span></div>
          <div className="pm-keyrow">
            <input id={`${uid}-key`} name="key" type="text" maxLength={5} autoComplete="off" spellCheck={false} autoCapitalize="characters" aria-describedby={`${uid}-key-h ${uid}-key-e`} value={key} onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); setTypedKey(v === "" ? null : v); setAlert(""); setKeyErr(""); }} />
            <button type="button" className="pm-link" hidden={typedKey === null} onClick={() => { setTypedKey(null); document.getElementById(`${uid}-key`)?.focus(); }}>{t("reset")}</button>
          </div>
          <p className="pm-hint" id={`${uid}-key-h`}>{t("keyHint")}</p>
          <p className="pm-err" id={`${uid}-key-e`} hidden={!keyErr}>{keyErr}</p>
        </div>

        <div className="pm-f">
          <div className="pm-lrow"><label htmlFor={`${uid}-desc`}><span>{t("desc")}</span> <i>{t("opt")}</i></label><span className={`pm-count${desc.length >= 900 ? " warn" : ""}`} aria-hidden="true">{desc.length}/1000</span></div>
          <textarea id={`${uid}-desc`} name="description" rows={3} maxLength={1000} placeholder={t("descPh")} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <p className="pm-note">{capMsg(plain)}</p>

        <footer className="pm-foot">
          <button type="button" className="pm-btn pm-ghost" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="pm-btn pm-go" aria-busy={busy}><span className="pm-spin" aria-hidden="true" /><span>{t("go")}</span></button>
        </footer>
      </div>

      <aside className="pm-side il-scene" aria-label={t("svgLabel")}>
        <div className="il-illu">
          <svg viewBox="0 0 420 470" role="img" aria-label={t("svgLabel")}>
            <g className="il-dots" aria-hidden="true"><path d="M92 94 C96 150 96 200 100 244" /><path d="M232 54 C214 62 206 78 204 98" /><path d="M336 446 C374 440 384 418 368 380 C362 360 356 340 352 330" /></g>
            <line x1="300" y1="98" x2="300" y2="268" stroke="var(--il-ink)" strokeWidth="3.5" strokeLinecap="round" />
            <g className="il-flag"><path className="il-brandfill" d="M300 100 H374 L362 117 L374 134 H300 Z" /><text className="il-tw" x="332" y="122">{key || "—"}</text></g>
            <g className="il-wave"><path className="il-arm-o" d="M244 234 L284 216 L298 178" /><path className="il-arm-f" d="M244 234 L284 216 L298 178" /><circle className="il-fist" cx="300" cy="168" r="12" /></g>
            <path className="il-arm-o" d="M136 236 L116 262" /><path className="il-arm-f" d="M136 236 L116 262" />
            <path className="il-body" d="M130 304 C130 234 156 200 190 200 C224 200 250 234 250 304 Z" />
            <polygon className="il-emblem" points="190,216 205,225 205,243 190,252 175,243 175,225" />
            <rect className="il-neck" x="182" y="182" width="16" height="22" rx="6" />
            <circle className="il-head" cx="190" cy="148" r="36" />
            <circle className="il-hair" cx="168" cy="102" r="14" /><circle className="il-hair" cx="194" cy="94" r="16" /><circle className="il-hair" cx="219" cy="104" r="13" />
            <path className="il-hair" d="M152 146 C148 108 174 98 192 100 C216 102 232 122 228 148 C222 132 210 120 194 120 C178 120 162 128 152 146 Z" />
            <path className="il-hair" d="M153 146 C145 166 150 184 163 190 L167 166 Z" />
            <path className="il-hair" d="M227 148 C234 168 229 186 217 192 L213 168 Z" />
            <path className="il-face" d="M164 152 q6 5 12 0 M186 152 q6 5 12 0 M172 168 q10 8 20 0" />
            <path className="il-folder-b" d="M70 268 V258 a14 14 0 0 1 14 -14 H136 a10 10 0 0 1 8 4 L156 264 H336 a14 14 0 0 1 14 14 V396 a16 16 0 0 1 -16 16 H86 a16 16 0 0 1 -16 -16 Z" />
            <rect className="il-paper il-line" x="70" y="282" width="280" height="130" rx="16" />
            <text className={`il-t1${trimmed ? "" : " is-empty"}`} x="90" y="314">{clip(trimmed, 18) || t("untitled")}</text>
            <text className="il-t2" x="90" y="334">{t("meta")}</text>
            <rect className="il-pill" x="268" y="298" width="66" height="24" rx="12" /><text className="il-pill-t" x="301" y="314">{t("svgActive")}</text>
            <g className="il-lbl"><text x="98" y="360">{t("svgTodo")}</text><text x="182" y="360">{t("svgDoing")}</text><text x="266" y="360">{t("svgDone")}</text></g>
            <rect className="il-live" x="90" y="366" width="72" height="30" rx="8" /><path className="il-plus" d="M126 374 v14 M119 381 h14" />
            <rect className="il-slot" x="174" y="366" width="72" height="30" rx="8" />
            <rect className="il-slot" x="258" y="366" width="72" height="30" rx="8" />
            <g className="il-float">
              <rect className="il-paper il-line" x="14" y="20" width="158" height="72" rx="16" />
              <text className="il-t3" x="30" y="44">{t("svgMembers")}</text>
              <circle className="il-av-brand" cx="42" cy="68" r="13" /><text x="42" y="71.5" style={{ fontSize: 9, fontWeight: 800, fill: "#fff", textAnchor: "middle" } as CSSProperties}>{user ? initials(user.name) : ""}</text>
              <circle className="il-av-ghost" cx="72" cy="68" r="13" /><path className="il-plus" style={{ strokeWidth: 1.8, opacity: 0.7 }} d="M72 62 v12 M66 68 h12" />
              <circle className="il-av-ghost" cx="102" cy="68" r="13" /><path className="il-plus" style={{ strokeWidth: 1.8, opacity: 0.7 }} d="M102 62 v12 M96 68 h12" />
            </g>
            <g className="il-float d2">
              <rect className="il-paper il-line" x="232" y="16" width="176" height="70" rx="16" />
              <text className="il-t3" x="248" y="40">{t("svgPlan")}</text>
              <text className="il-t3" x="392" y="40" textAnchor="end">{cap ? `${cap.currentProjects} / ${cap.maxProjects}` : ""}</text>
              <g transform="translate(248 54)">
                {Array.from({ length: segs }, (_, i) => <rect key={i} className={`il-seg${cap && i < cap.currentProjects ? " used" : cap && i === cap.currentProjects ? " next" : ""}`} x={i * (segW + 4)} y="0" width={segW} height="8" rx="4" />)}
              </g>
            </g>
            <g className="il-float d3">
              <rect className="il-paper il-line" x="96" y="428" width="240" height="38" rx="19" />
              <circle className="il-tick-c" cx="120" cy="447" r="9" /><path className="il-tick" d="M116 447 l3 3 l5.5 -6" />
              <text className="il-t3" x="138" y="452">{t("svgAudit")}</text>
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
