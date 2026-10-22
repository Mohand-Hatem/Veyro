"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { ApiError } from "@/lib/api";
import { PLANS, useSubscription } from "@/lib/billing";
import { okSlug } from "@/lib/slug";
import { useWorkspaces } from "@/lib/queries";
import { initialsOf, nextFreeSlug, suggestWorkspaceSlug, useCreateWorkspace } from "@/lib/workspaces";
import "@/components/dashboard/illustration.css";
import "@/components/projects/projects.css";
import "@/components/projects/create-project.css";
import "./create-workspace.css";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const CAPTION_MS = 5000;

// SCR-WKSP-02. Markup and class names follow screens/groups/03-workspace-dashboard/index.html (Parity Gate).
// Same native <dialog> frame as the Create project dialog. Only the account owner reaches it (the switcher button).
export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      className="pm wm"
      aria-labelledby="wm-title"
      aria-describedby="wm-sub"
      onClose={onClose}
      onCancel={(e) => { if (busy) e.preventDefault(); }}
      onClick={(e) => { if (e.target === e.currentTarget && pristine && !busy) onClose(); }}
    >
      {open && <CreateWorkspaceForm onClose={onClose} onBusy={setBusy} onDirty={setPristine} />}
    </dialog>
  );
}

type Problem = "" | "limit" | "locked" | "generic";

function CreateWorkspaceForm({ onClose, onBusy, onDirty }: { onClose: () => void; onBusy: (b: boolean) => void; onDirty: (pristine: boolean) => void }) {
  const t = useTranslations("CreateWorkspace");
  const tp = useTranslations("Dashboard");
  const router = useRouter();
  const { workspace, notify } = useShell();
  const uid = useId();
  const account = workspace?.account;
  const all = useWorkspaces().data ?? [];
  const sub = useSubscription(account?.id, true).data;
  const create = useCreateWorkspace(account);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [typedSlug, setTypedSlug] = useState<string | null>(null); // null = the address follows the name
  const [problem, setProblem] = useState<Problem>("");
  const [nameErr, setNameErr] = useState("");
  const [slugErr, setSlugErr] = useState("");
  const [cur, setCur] = useState(0);

  const trimmed = name.trim();
  const slug = typedSlug ?? suggestWorkspaceSlug(account?.slug ?? "", trimmed);
  const busy = create.isPending;

  // The plan numbers come from the owner's subscription (the same limits the server enforces).
  const mine = all.filter((w) => w.account.id === account?.id);
  const used = sub?.limits.currentWorkspaces ?? mine.length;
  const max = sub ? sub.limits.maxWorkspaces : undefined; // null = unlimited, undefined = not loaded yet
  const left = typeof max === "number" ? max - used : null;
  const full = left !== null && left <= 0;
  const shownProblem: Problem = problem || (full ? "limit" : "");

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => { onDirty(!trimmed); }, [trimmed, onDirty]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setCur((c) => (c + 1) % 3), CAPTION_MS);
    return () => clearInterval(id);
  }, [cur]); // a click on the pager changes cur and so restarts the timer

  const plain = { b: (c: ReactNode) => c };
  const bold = { b: (c: ReactNode) => <b>{c}</b> };
  const plan = sub ? tp(`plan${sub.subscription.tier}`) : "";
  const capMsg = (rich: typeof bold | typeof plain) =>
    max === undefined ? null : max === null ? t("capUnlimited") : max - used <= 0 ? t("capNone") : max - used === 1 ? t("capLast") : t.rich("capUses", { ...rich, left: max - used, plan });
  const limitMsg = t("errLimit", { max: max ?? PLANS[sub?.subscription.tier ?? "FREE"].ws ?? 0 });
  const messages: Record<Exclude<Problem, "">, string> = { limit: limitMsg, locked: t("errLocked"), generic: t("errGeneric") };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || full) return;
    const nameBad = trimmed.length < 2, slugBad = !okSlug(slug);
    setProblem("");
    setNameErr(nameBad ? t("errName") : "");
    setSlugErr(slugBad ? t("errSlug") : "");
    if (nameBad) return nameRef.current?.focus();
    if (slugBad) return document.getElementById(`${uid}-slug`)?.focus();
    try {
      const made = await create.mutateAsync({ name: trimmed, slug });
      onClose();
      notify(`${t("created")}: ${made.name ?? trimmed}`);
      router.push(`/w/${made.slug ?? slug}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "WORKSPACE_SLUG_TAKEN") {
        setTypedSlug(slug);
        setSlugErr(t("errTaken", { next: nextFreeSlug(slug, new Set(all.map((w) => w.slug))) }));
        document.getElementById(`${uid}-slug`)?.focus();
      } else if (code === "WORKSPACE_CAPACITY_EXCEEDED") setProblem("limit");
      else if (code === "ACCOUNT_OFFBOARDING_LOCKED") setProblem("locked");
      else setProblem("generic");
    }
  }

  // Three rooms: the account's latest workspaces, then the one being made (lit), then empty slots. A full plan has no room left to light.
  const shown = mine.slice(full ? -3 : -2);
  const segs = typeof max === "number" ? Math.min(max, 8) : 0;
  const segW = segs ? Math.min(36, Math.floor(166 / segs) - 6) : 0;
  const captions: ReactNode[] = [t.rich("cap1", bold), t.rich("cap2", bold), capMsg(bold)];

  return (
    <form className="pm-form" onSubmit={onSubmit} noValidate>
      <div className="pm-main">
        <header className="pm-head">
          <div>
            <h2 id="wm-title">{t("title")}</h2>
            <p id="wm-sub">{t("sub")}</p>
          </div>
          <button type="button" className="pm-x" aria-label={t("close")} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>

        <div className="pm-alert" role="alert" hidden={!shownProblem}>
          {shownProblem && messages[shownProblem]}
          {shownProblem === "limit" && <> <Link className="wm-up" href="/account/billing" onClick={onClose}>{t("upgrade")}</Link></>}
        </div>

        <div className={`pm-f${nameErr ? " is-bad" : ""}`}>
          <label htmlFor={`${uid}-name`}>{t("name")}</label>
          <input ref={nameRef} id={`${uid}-name`} name="name" type="text" maxLength={100} autoComplete="off" required placeholder={t("namePh")} aria-describedby={`${uid}-name-e`} value={name} onChange={(e) => { setName(e.target.value); setNameErr(""); setProblem(""); setSlugErr(""); }} />
          <p className="pm-err" id={`${uid}-name-e`} hidden={!nameErr}>{nameErr}</p>
        </div>

        <div className={`pm-f${slugErr ? " is-bad" : ""}`}>
          <div className="pm-lrow"><label htmlFor={`${uid}-slug`}>{t("slug")}</label><span className={`pm-auto${typedSlug !== null ? " off" : ""}`}>{t("auto")}</span></div>
          <div className="wm-addr">
            <span className="wm-pre" dir="ltr" aria-hidden="true">/w/</span>
            <input id={`${uid}-slug`} name="slug" type="text" maxLength={40} autoComplete="off" spellCheck={false} dir="ltr" aria-describedby={`${uid}-slug-h ${uid}-slug-e`} value={slug} onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setTypedSlug(v === "" ? null : v); setProblem(""); setSlugErr(""); }} />
            <button type="button" className="pm-link" hidden={typedSlug === null} onClick={() => { setTypedSlug(null); setSlugErr(""); document.getElementById(`${uid}-slug`)?.focus(); }}>{t("reset")}</button>
          </div>
          <p className="pm-hint" id={`${uid}-slug-h`}>{t("slugHint")}</p>
          <p className="pm-err" id={`${uid}-slug-e`} hidden={!slugErr}>{slugErr}</p>
        </div>

        <p className="pm-note">{capMsg(plain)}</p>

        <footer className="pm-foot">
          <button type="button" className="pm-btn pm-ghost" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="pm-btn pm-go" aria-busy={busy} disabled={full}><span className="pm-spin" aria-hidden="true" /><span>{t("go")}</span></button>
        </footer>
      </div>

      <aside className="pm-side il-scene" aria-label={t("svgLabel")}>
        <div className="il-illu">
          <svg viewBox="0 0 420 470" role="img" aria-label={t("svgLabel")}>
            <g className="il-dots" aria-hidden="true"><path d="M98 96 C100 140 104 180 108 214" /><path d="M262 78 C262 112 264 138 268 160" /><path d="M332 440 C372 434 388 414 380 388" /></g>

            <rect className="il-paper il-line" x="150" y="206" width="250" height="196" rx="18" />
            <path className="il-brandfill" d="M150 224 a18 18 0 0 1 18 -18 H382 a18 18 0 0 1 18 18 V250 H150 Z" />
            <text className="il-tw" x="168" y="234" style={{ textAnchor: "start" }}>{account?.name ?? ""}</text>
            <g>
              {[0, 1, 2].map((i) => {
                const x = 166 + i * 78;
                if (i < shown.length) return <g key={i}><rect className="il-soft" x={x} y="266" width="64" height="64" rx="12" style={{ strokeWidth: 2 }} /><text className="il-t3" x={x + 32} y="304" textAnchor="middle">{initialsOf(shown[i].name)}</text></g>;
                if (i === shown.length && !full) return (
                  <g key={i}>
                    <rect className="il-brandfill" x={x} y="266" width="64" height="64" rx="12" />
                    {trimmed ? <text className="il-tw" x={x + 32} y="305" textAnchor="middle" style={{ fontSize: 20 }}>{initialsOf(trimmed)}</text> : <path className="il-plus" d={`M${x + 32} 284 v28 M${x + 18} 298 h28`} />}
                  </g>
                );
                return <rect key={i} className="il-slot" x={x} y="266" width="64" height="64" rx="12" />;
              })}
            </g>
            <text className="il-t2" x="168" y="382">{slug ? `/w/${clip(slug, 26)}` : "/w/…"}</text>

            <g className="il-wave"><path className="il-arm-o" d="M138 334 L160 312 L146 274" /><path className="il-arm-f" d="M138 334 L160 312 L146 274" /><circle className="il-fist" cx="144" cy="262" r="12" /></g>
            <path className="il-arm-o" d="M30 332 L10 358" /><path className="il-arm-f" d="M30 332 L10 358" />
            <path className="il-body" d="M24 400 C24 330 50 296 84 296 C118 296 144 330 144 400 Z" />
            <polygon className="il-emblem" points="84,312 99,321 99,339 84,348 69,339 69,321" />
            <rect className="il-neck" x="76" y="278" width="16" height="22" rx="6" />
            <circle className="il-head" cx="84" cy="244" r="36" />
            <circle className="il-hair" cx="62" cy="198" r="14" /><circle className="il-hair" cx="88" cy="190" r="16" /><circle className="il-hair" cx="113" cy="200" r="13" />
            <path className="il-hair" d="M46 242 C42 204 68 194 86 196 C110 198 126 218 122 244 C116 228 104 216 88 216 C72 216 56 224 46 242 Z" />
            <path className="il-hair" d="M47 242 C39 262 44 280 57 286 L61 262 Z" />
            <path className="il-hair" d="M121 244 C128 264 123 282 111 288 L107 264 Z" />
            <path className="il-face" d="M58 248 q6 5 12 0 M80 248 q6 5 12 0 M66 264 q10 8 20 0" />

            <g className="il-float">
              <rect className="il-paper il-line" x="14" y="20" width="176" height="64" rx="16" />
              <circle className="il-av-brand" cx="44" cy="52" r="15" /><text x="44" y="56" style={{ fontSize: 10, fontWeight: 800, fill: "#fff", textAnchor: "middle" }}>{t("svgYou")}</text>
              <text className="il-t3" x="68" y="57">{t("svgAdmin")}</text>
            </g>

            <g className="il-float d2">
              <rect className="il-paper il-line" x="214" y="16" width="194" height="70" rx="16" />
              <text className="il-t3" x="230" y="40">{t("svgPlan")}</text>
              <text className="il-t3" x="392" y="40" textAnchor="end">{max === undefined ? "" : max === null ? `${used}` : `${used} / ${max}`}</text>
              <g transform="translate(230 54)">
                {Array.from({ length: segs }, (_, i) => <rect key={i} className={`il-seg${i < used ? " used" : i === used ? " next" : ""}`} x={i * (segW + 6)} y="0" width={segW} height="8" rx="4" />)}
              </g>
            </g>

            <g className="il-float d3">
              <rect className="il-paper il-line" x="150" y="424" width="256" height="38" rx="19" />
              <circle className="il-tick-c" cx="174" cy="443" r="9" /><path className="il-tick" d="M170 443 l3 3 l5.5 -6" />
              <text className="il-t3" x="192" y="448">{t("svgChip")}</text>
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
