"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { avatarClass, initials } from "@/lib/dashboard";
import { agoParts } from "@/lib/board";
import { useProjectList } from "@/lib/projects";
import { useMembers } from "@/lib/settings";
import { CAT_ORDER, EMPTY_FILTER, catOf, isFiltered, rangeDates, useAuditLogs, type AuditFilter, type AuditLog, type Cat } from "@/lib/audit";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/settings/settings.css";
import "@/components/ui/au-shared.css";
import "./audit.css";

const ICON: Record<Cat, ReactNode> = {
  people: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
  projects: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  tasks: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>,
  workspace: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></svg>,
};
const CAT_LABEL: Record<Cat, "cPeople" | "cProjects" | "cTasks" | "cWorkspace"> = { people: "cPeople", projects: "cProjects", tasks: "cTasks", workspace: "cWorkspace" };
const PRESETS: [number, "r24" | "r7" | "r30" | "rAll"][] = [[1, "r24"], [7, "r7"], [30, "r30"], [0, "rAll"]];
const fmtMeta = (v: unknown): string => (v && typeof v === "object" ? (Array.isArray(v) ? (v.length ? v.join(", ") : "—") : Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${x && typeof x === "object" && "from" in x ? `${(x as { from: unknown }).from} → ${String((x as unknown as { to?: unknown }).to)}` : String(x)}`).join("; ")) : String(v));

const bold = (c: ReactNode) => <b>{c}</b>;
const plain = (c: ReactNode) => <>{c}</>;

// SCR-AUD-01. Markup and class names follow screens/groups/03-workspace-dashboard/audit.html (Parity Gate).
// Only workspace admins and the account owner read the trail; the server answers 403 to everyone else.
export function Audit() {
  const t = useTranslations("Audit");
  const tw = useTranslations("Work");
  const ts = useTranslations("Settings");
  const { workspace, role } = useShell();
  const manager = role !== "member";
  const [f, setF] = useState<AuditFilter>(EMPTY_FILTER);
  const q = useAuditLogs(workspace?.id, f, manager);
  const people = useMembers(workspace?.id, manager).data ?? [];
  const live = useProjectList(workspace?.id).data ?? [];
  const gone = useProjectList(manager ? workspace?.id : undefined, { show: "DELETED" }).data ?? [];
  const slug = workspace?.slug ?? "";
  const patch = (p: Partial<AuditFilter>) => setF((cur) => ({ ...cur, page: 1, ...p }));

  const head = <div className="ap-ovh"><h2>{t("sub")}</h2></div>;
  if (role === "member" && workspace) {
    return (
      <div className="st-page au-page">
        {head}
        <section className="ap-empty st-denied">
          <div className="ap-empty-ill" aria-hidden="true">
            <svg viewBox="0 0 220 150"><rect className="e-doc" x="62" y="28" width="96" height="86" rx="14" /><circle className="e-plus-c" cx="110" cy="62" r="17" /><path className="e-plus" d="M104 62h12M110 56v12" transform="rotate(45 110 62)" /><rect className="e-fold-f" x="82" y="86" width="56" height="10" rx="5" /></svg>
          </div>
          <h2>{t("deniedT")}</h2>
          <p>{t("deniedD")}</p>
          <Link className="ap-btn st-back" href={`/w/${slug}`}>{ts("backDash")}</Link>
        </section>
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <div className="st-page au-page">
        {head}
        <section className="ap-card st-error" role="alert">
          <b>{t("errT")}</b>
          <p>{t("errD")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => q.refetch()}>{tw("retry")}</button>
        </section>
      </div>
    );
  }

  const d = q.data;
  const meta = d?.meta;
  const filtered = isFiltered(f);
  const from = meta?.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const reset = () => setF(EMPTY_FILTER);
  const go = (page: number) => { setF((cur) => ({ ...cur, page })); document.getElementById("au-h")?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const toggleCat = (c: Cat) => patch({ cats: f.cats.includes(c) ? f.cats.filter((x) => x !== c) : [...f.cats, c] });
  const projects = [...live.map((p) => ({ id: p.id, name: p.name, gone: false })), ...gone.map((p) => ({ id: p.id, name: p.name, gone: true }))];

  return (
    <div className="st-page au-page">
      {head}
      <div id="au-content">
        <section className="au-hero il-scene" aria-label={t("heroLabel")}>
          <div className="au-hero-t">
            <h3>{t("heroT")}</h3>
            <ul><li>{t("f1")}</li><li>{t("f2")}</li><li>{t("f3")}</li></ul>
          </div>
          <div className="il-illu">
              <svg viewBox="0 0 380 220" role="img" aria-label={t("heroSvg")}>
                <g className="il-dots" aria-hidden="true"><path d="M258 20 V204"/></g>
                <g className="il-float">
                  <rect className="il-paper il-line" x="214" y="10" width="156" height="44" rx="12"/><circle className="il-av-brand" cx="236" cy="32" r="10"/><rect className="il-bar" x="254" y="24" width="82" height="6" rx="3"/><rect className="il-bar" x="254" y="36" width="52" height="5" rx="2.5"/>
                </g>
                <g className="il-float d2">
                  <rect className="il-paper il-line" x="214" y="62" width="156" height="44" rx="12" style={{ stroke: "var(--il-brand)", strokeWidth: "3.2" }}/><circle className="il-soft" cx="236" cy="84" r="10"/><rect className="il-bar" x="254" y="76" width="70" height="6" rx="3"/><rect className="il-bar" x="254" y="88" width="94" height="5" rx="2.5"/>
                </g>
                <g className="il-float d3">
                  <rect className="il-paper il-line" x="214" y="114" width="156" height="44" rx="12"/><circle className="il-soft" cx="236" cy="136" r="10"/><rect className="il-bar" x="254" y="128" width="90" height="6" rx="3"/><rect className="il-bar" x="254" y="140" width="46" height="5" rx="2.5"/>
                </g>
                <g className="il-float">
                  <rect className="il-paper il-line" x="214" y="166" width="156" height="44" rx="12"/><circle className="il-av-brand" cx="236" cy="188" r="10"/><rect className="il-bar" x="254" y="180" width="64" height="6" rx="3"/><rect className="il-bar" x="254" y="192" width="84" height="5" rx="2.5"/>
                </g>
                <path className="il-arm-o" d="M104 168 L150 150 L184 112"/><path className="il-arm-f" d="M104 168 L150 150 L184 112"/>
                <path className="il-body" d="M30 220 C30 176 56 150 84 150 C112 150 138 176 138 220 Z"/>
                <polygon className="il-emblem" points="84,168 95,174 95,186 84,192 73,186 73,174"/>
                <rect className="il-neck" x="76" y="134" width="16" height="20" rx="6"/>
                <circle className="il-head" cx="84" cy="106" r="30"/>
                <path className="il-hair" d="M54 104 C50 70 72 62 86 64 C106 66 118 82 114 106 C108 92 98 84 86 84 C72 84 62 90 54 104 Z"/>
                <path className="il-hair" d="M55 104 C48 122 52 138 63 142 L66 120 Z"/>
                <path className="il-face" d="M64 110 q5 4 10 0 M86 110 q5 4 10 0 M70 124 q8 7 16 0"/>
                <circle className="il-fist" cx="190" cy="104" r="11"/>
                <g><circle cx="204" cy="78" r="28" fill="var(--il-paper)" fillOpacity=".55" stroke="var(--il-ink)" strokeWidth="3.5"/><path d="M196 68 a14 14 0 0 1 12 -3" fill="none" stroke="var(--il-ink)" strokeWidth="2.4" strokeLinecap="round" opacity=".5"/><path d="M193 99 L186 112" stroke="var(--il-ink)" strokeWidth="6" strokeLinecap="round"/></g>
              </svg>
          </div>
        </section>

        <section className="ap-card au-filters" aria-label={t("filters")}>
          <div className="au-frow1">
            <div className="au-presets" role="group" aria-label={t("timeRange")}>
              {PRESETS.map(([days, key]) => <button key={days} type="button" className={`au-chip${f.range === days ? " is-on" : ""}`} onClick={() => patch({ range: days, ...rangeDates(days) })}>{t(key)}</button>)}
            </div>
            <button type="button" className="au-reset" id="au-reset" hidden={!filtered} onClick={reset}>{t("reset")}</button>
          </div>
          <div className="au-frow">
            <label className="au-f"><span>{t("from")}</span><input type="date" id="au-from" value={f.from} onChange={(e) => patch({ from: e.target.value, range: -1 })} /></label>
            <label className="au-f"><span>{t("to")}</span><input type="date" id="au-to" value={f.to} onChange={(e) => patch({ to: e.target.value, range: -1 })} /></label>
            <label className="au-f"><span>{t("actor")}</span>
              <span className="ap-select"><select id="au-actor" value={f.actor} onChange={(e) => patch({ actor: e.target.value })}>
                <option value="">{t("allPeople")}</option>
                {people.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select></span>
            </label>
            <label className="au-f"><span>{t("project")}</span>
              <span className="ap-select"><select id="au-proj" value={f.proj} onChange={(e) => patch({ proj: e.target.value })}>
                <option value="">{t("allProjects")}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.gone ? ` (${t("deleted")})` : ""}</option>)}
              </select></span>
            </label>
          </div>
          <div className="au-cats" role="group" aria-label={t("typeLabel")}>
            {CAT_ORDER.map((c) => <button key={c} type="button" className="au-chip" aria-pressed={f.cats.includes(c)} onClick={() => toggleCat(c)}>{t(CAT_LABEL[c])}</button>)}
          </div>
        </section>

        <section className="ap-card au-list" aria-labelledby="au-h">
          <header className="ap-ch"><h2 id="au-h"><span>{t("activity")}</span> <span className="st-count" id="au-total">{meta ? meta.total : ""}</span></h2><span className="st-note">{t("times")}</span></header>
          <div className="au-tw" role="table" aria-label={t("activity")}>
            <div className="au-tr au-th" role="row" hidden={!!meta && !meta.total}><span role="columnheader">{t("colWhen")}</span><span role="columnheader">{t("colWho")}</span><span role="columnheader">{t("colWhat")}</span></div>
            <div id="au-rows" aria-live="polite" aria-busy={q.isFetching}>
              {!d
                ? Array.from({ length: 6 }, (_, i) => <div className="au-tr au-row st-skel" aria-hidden="true" key={i}><span className="au-when"><b /><small /></span><span className="au-who"><span className="st-av" /><span className="au-wn"><b /></span></span><span className="au-what"><b /></span></div>)
                : d.logs.map((l) => <AuditRow key={l.id} log={l} cat={catOf(l.action)} icon={ICON[catOf(l.action)]}><Sentence log={l} /></AuditRow>)}
            </div>
          </div>
          <div className="au-empty" id="au-empty" hidden={!meta || meta.total > 0}>
            <b id="au-empty-t">{filtered ? t("noMatchT") : t("noneT")}</b>
            <p id="au-empty-d">{filtered ? t("noMatchD") : t("noneD")}</p>
            <button type="button" className="pm-btn pm-ghost" id="au-empty-btn" hidden={!filtered} onClick={reset}>{t("reset")}</button>
          </div>
          <nav className="au-pager" id="au-pager" aria-label={t("pages")} hidden={!meta || meta.totalPages <= 1}>
            <span className="au-range" id="au-range">{meta?.total ? `${from}–${to} ${t("of")} ${meta.total}` : ""}</span>
            <span className="au-pbtns"><button type="button" className="pm-btn pm-ghost st-sm" id="au-prev" disabled={!meta || meta.page <= 1} onClick={() => go(f.page - 1)}>{t("prev")}</button><button type="button" className="pm-btn pm-ghost st-sm" id="au-next" disabled={!meta || meta.page >= meta.totalPages} onClick={() => go(f.page + 1)}>{t("next")}</button></span>
          </nav>
        </section>
      </div>
    </div>
  );
}

/** One record of a trail: when, who and what happened (the sentence is passed in). Shared by the workspace and the account trail. */
export function AuditRow({ log: l, cat, icon, children }: { log: AuditLog; cat: string; icon: ReactNode; children: ReactNode }) {
  const t = useTranslations("Audit");
  const locale = useLocale();
  const { date } = useFormat();
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const tb = useTranslations("Board");
  const ago = agoParts(l.createdAt);
  const m = (l.metadata ?? {}) as Record<string, unknown>;
  const rows = Object.entries(m);
  return (
    <div className="au-tr au-row" role="row">
      <span className="au-when" role="cell"><b>{date(l.createdAt, true)}</b><small>{new Date(l.createdAt).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })} · {tb(ago.key, { n: ago.n })}</small></span>
      <span className="au-who" role="cell">
        {l.actor ? <><span className={`st-av ${avatarClass(l.actor.id)}`}>{initials(l.actor.name)}</span><span className="au-wn">{l.actor.name}</span></> : <><span className="st-av au-sys">⚙</span><span className="au-wn">{t("system")}</span></>}
      </span>
      <span className="au-what" role="cell">
        <span className={`au-ic au-ic-${cat}`} aria-hidden="true">{icon}</span>
        <span className="au-tx">
          <span>{children}{l.project && <> <span className="ap-key" title={`${l.project.name}${l.project.isDeleted ? ` (${t("deleted")})` : ""}`}>{l.project.key}</span></>}</span>
          {rows.length > 0 && (
            <details className="au-d"><summary>{t("details")}</summary><dl>
              {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{fmtMeta(v)}</dd></div>)}
              <div><dt>action</dt><dd>{l.action}</dd></div>
            </dl></details>
          )}
        </span>
      </span>
    </div>
  );
}

/** One readable sentence per action ("Sarah created project Auth Revamp"); unknown actions fall back to the raw action name. */
function Sentence({ log: l }: { log: AuditLog }) {
  const t = useTranslations("Audit");
  const ts = useTranslations("Settings");
  const tb = useTranslations("Board");
  const tw = useTranslations("Work");
  const m = (l.metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
  // Names are rich-text tags (<A>{a}</A> ...) so a sentence stays one translatable string and the names come out bold.
  const actor = l.actor ? l.actor.name : t("system");
  const a = { A: bold, a: actor };
  const sub = { S: bold, s: l.subjectUser ? l.subjectUser.name : "—" };
  const proj = { P: l.project ? bold : plain, p: l.project ? l.project.name : t("aProject") };
  const wsRole = (r: string) => (r === "ADMIN" ? ts("admin") : r === "MEMBER" ? ts("member") : r);
  const projRole = (r: string) => (r === "ADMIN" ? tb("prADMIN") : r === "MEMBER" ? tb("prMEMBER") : r);
  const status = (s: string) => (["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"].includes(s) ? tw(`s${s as "TODO"}`) : s);

  switch (l.action) {
    case "MEMBER_ROLE_CHANGED": return t.rich("MEMBER_ROLE_CHANGED", { ...a, ...sub, from: wsRole(str("from")), to: wsRole(str("to")) });
    case "PROJECT_MEMBER_ROLE_CHANGED": return t.rich("PROJECT_MEMBER_ROLE_CHANGED", { ...a, ...sub, ...proj, from: projRole(str("from")), to: projRole(str("to")) });
    case "TASK_STATUS_CHANGED": return t.rich("TASK_STATUS_CHANGED", { ...a, ...proj, from: status(str("previousStatus")), to: status(str("newStatus")) });
    case "TASK_CREATED": case "TASK_DELETED": case "TASK_RESTORED": return t.rich(l.action, { ...a, ...proj, title: str("title") });
    case "WORKSPACE_CREATED": return t.rich("WORKSPACE_CREATED", { ...a, N: bold, n: str("name") });
    case "WORKSPACE_UPDATED": {
      const c = (m.changes ?? {}) as Record<string, { to?: string }>;
      const parts: ReactNode[] = [];
      if (c.name) parts.push(t.rich("WS_RENAMED", { V: bold, v: String(c.name.to) }));
      if (c.slug) parts.push(t.rich("WS_SLUG", { V: bold, v: String(c.slug.to) }));
      if (!parts.length) return t.rich("WORKSPACE_UPDATED", a);
      return <><b>{actor}</b> {parts.flatMap((p, i) => (i ? [t("andJoin"), p] : [p]))}</>;
    }
    case "WORKSPACE_INVITATION_ISSUED": return t.rich(l.action, { ...a, E: bold, e: str("recipientEmail"), role: wsRole(str("role")) });
    case "WORKSPACE_INVITATION_ACCEPTED": return t.rich(l.action, { ...a, role: wsRole(str("role")) });
    case "WORKSPACE_INVITATION_REVOKED": case "WORKSPACE_INVITATION_RESENT": return t.rich(l.action, { ...a, E: bold, e: str("recipientEmail") });
    case "PROJECT_CREATED": case "PROJECT_UPDATED": case "PROJECT_ARCHIVED": case "PROJECT_UNARCHIVED": case "PROJECT_DELETED": case "PROJECT_RESTORED":
    case "MEMBER_ASSIGNED_TO_PROJECT": case "MEMBER_REMOVED_FROM_PROJECT": case "TASK_CREATED_VIA_AI_CONFIRMATION": case "TASK_UPDATED":
    case "TASK_REOPENED": case "TASK_REINSTATED": case "TASK_UNASSIGNED": case "COMMENT_CREATED":
      return t.rich(l.action, { ...a, ...sub, ...proj });
    case "PROJECT_SELECTION_CONFIRMED": case "MEMBER_REMOVED": return t.rich(l.action, { ...a, ...sub });
    default: return t.rich("OTHER", { ...a, action: l.action.toLowerCase().replace(/_/g, " ") });
  }
}
