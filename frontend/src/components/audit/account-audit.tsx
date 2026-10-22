"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Forbidden } from "@/components/state/forbidden";
import { useShell } from "@/components/shell/shell-context";
import { ACCOUNT_CAT_ORDER, EMPTY_ACCOUNT_FILTER, accountCatOf, isAccountFiltered, rangeDates, useAccountAuditLogs, type AccountAuditFilter, type AccountCat, type AuditLog } from "@/lib/audit";
import { AuditRow } from "./audit";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "@/components/settings/settings.css";
import "@/components/ui/au-shared.css";
import "@/components/billing/billing.css";
import "./audit.css";
import "./account-audit.css";

const SVG = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24" } as const;
const ICON: Record<AccountCat, ReactNode> = {
  billing: <svg {...SVG}><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></svg>,
  projects: <svg {...SVG}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  workspaces: <svg {...SVG}><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></svg>,
  account: <svg {...SVG}><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" /></svg>,
};
const CAT_LABEL: Record<AccountCat, "cBilling" | "cProjects" | "cWorkspaces" | "cAccount"> = { billing: "cBilling", projects: "cProjects", workspaces: "cWorkspaces", account: "cAccount" };
const PRESETS: [number, "r24" | "r7" | "r30" | "rAll"][] = [[1, "r24"], [7, "r7"], [30, "r30"], [0, "rAll"]];
const TIERS = ["FREE", "PRO", "ENTERPRISE", "EPIC"] as const;

const bold = (c: ReactNode) => <b>{c}</b>;

// SCR-AUD-02. Markup and class names follow screens/groups/06-account-governance/account-audit.html (Parity Gate).
// Account owner only: the server answers 403 to anyone else and the page shows the "owner only" state without asking.
export function AccountAudit() {
  const t = useTranslations("AccountAudit");
  const ta = useTranslations("Audit");
  const ts = useTranslations("Shell");
  const tw = useTranslations("Work");
  const { workspace, role } = useShell();
  const owner = role === "owner";
  const [f, setF] = useState<AccountAuditFilter>(EMPTY_ACCOUNT_FILTER);
  const q = useAccountAuditLogs(workspace?.account.id, f, owner);
  const patch = (p: Partial<AccountAuditFilter>) => setF((cur) => ({ ...cur, page: 1, ...p }));

  if (workspace && !owner) return <Forbidden from="audit" />;
  const head = (
    <div className="ap-ovh">
      <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
        <Link href={`/w/${workspace?.slug ?? ""}`}>{ts("navDash")}</Link><span aria-hidden="true">/</span>
        <Link href="/account/billing">{ts("navBilling")}</Link><span aria-hidden="true">/</span>
        <b>{ts("navAccountAudit")}</b>
      </nav>
    </div>
  );
  if (q.isError && !q.data) {
    return (
      <div className="st-page au-page gv-page">
        {head}
        <section className="ap-card st-error" role="alert">
          <b>{ta("errT")}</b>
          <p>{ta("errD")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => q.refetch()}>{tw("retry")}</button>
        </section>
      </div>
    );
  }

  const d = q.data;
  const meta = d?.meta;
  const filtered = isAccountFiltered(f);
  const from = meta?.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const reset = () => setF(EMPTY_ACCOUNT_FILTER);
  const go = (page: number) => { setF((cur) => ({ ...cur, page })); document.getElementById("au-h")?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const toggleCat = (c: AccountCat) => patch({ cats: f.cats.includes(c) ? f.cats.filter((x) => x !== c) : [...f.cats, c] });

  return (
    <div className="st-page au-page gv-page">
      {head}
      <div id="au-content">
        <section className="au-hero il-scene gv-ahero" aria-label={t("heroLabel")}>
          <div className="au-hero-t">
            <h3>{t("heroT")}</h3>
            <ul><li>{t("f1")}</li><li>{t("f2")}</li><li>{t("f3")}</li></ul>
          </div>
          <div className="il-illu">
            <svg viewBox="0 0 380 220" role="img" aria-label={t("heroSvg")}>
              <g className="il-dots" aria-hidden="true"><path d="M96 38 C112 28 130 28 145 41" /><path d="M114 138 C124 130 134 126 145 122" /></g>
              <g className="ah-gear ah-a" aria-hidden="true">
                <path className="il-paper il-line" style={{ strokeLinejoin: "round" }} d="M75.9 113.9 L78.1 125.1 L69.4 128.3 L63.8 118.2 A41 41 0 0 1 55.3 119.0 L51.6 129.8 L42.5 128.2 L42.7 116.8 A41 41 0 0 1 34.9 113.1 L26.2 120.6 L19.2 114.7 L25.1 104.9 A41 41 0 0 1 20.1 97.9 L8.9 100.1 L5.7 91.4 L15.8 85.8 A41 41 0 0 1 15.0 77.3 L4.2 73.6 L5.8 64.5 L17.2 64.7 A41 41 0 0 1 20.9 56.9 L13.4 48.2 L19.3 41.2 L29.1 47.1 A41 41 0 0 1 36.1 42.1 L33.9 30.9 L42.6 27.7 L48.2 37.8 A41 41 0 0 1 56.7 37.0 L60.4 26.2 L69.5 27.8 L69.3 39.2 A41 41 0 0 1 77.1 42.9 L85.8 35.4 L92.8 41.3 L86.9 51.1 A41 41 0 0 1 91.9 58.1 L103.1 55.9 L106.3 64.6 L96.2 70.2 A41 41 0 0 1 97.0 78.7 L107.8 82.4 L106.2 91.5 L94.8 91.3 A41 41 0 0 1 91.1 99.1 L98.6 107.8 L92.7 114.8 L82.9 108.9 A41 41 0 0 1 75.9 113.9 Z" /><circle className="il-paper il-line" cx="56" cy="78" r="15" /><circle className="il-tick-c" cx="56" cy="78" r="5.5" />
              </g>
              <g className="ah-gear ah-b" aria-hidden="true">
                <path className="il-brandfill" d="M61.9 136.5 L55.1 128.6 L61.9 121.6 L70.1 128.2 A22 22 0 0 1 77.5 125.5 L79.5 115.2 L89.2 116.2 L89.1 126.6 A22 22 0 0 1 95.8 130.7 L105.1 125.9 L110.4 134.1 L102.2 140.6 A22 22 0 0 1 103.1 148.4 L112.7 152.6 L109.6 161.8 L99.4 159.5 A22 22 0 0 1 93.9 165.1 L96.6 175.2 L87.4 178.5 L82.9 169.1 A22 22 0 0 1 75.1 168.3 L68.8 176.7 L60.5 171.6 L65.1 162.2 A22 22 0 0 1 60.9 155.6 L50.4 155.9 L49.2 146.3 L59.4 144.0 A22 22 0 0 1 61.9 136.5 Z" /><circle className="il-paper il-line" cx="81.2" cy="147.2" r="7.5" />
              </g>
              <g className="il-float"><g transform="rotate(-2 190 110)">
                <path className="il-paper il-line" d="M130 8 H300 V196 l-14 -10 l-14 10 l-14 -10 l-14 10 l-14 -10 l-14 10 l-14 -10 l-14 10 l-14 -10 l-14 10 l-14 -10 l-14 10 z" style={{ strokeLinejoin: "round" }} />
                <circle className="il-av-brand" cx="156" cy="42" r="10" /><rect className="il-bar" x="174" y="34" width="96" height="6" rx="3" /><rect className="il-bar" x="174" y="46" width="60" height="5" rx="2.5" />
                <circle className="il-soft" cx="156" cy="82" r="10" /><rect className="il-bar" x="174" y="74" width="84" height="6" rx="3" /><rect className="il-bar" x="174" y="86" width="52" height="5" rx="2.5" />
                <circle className="il-soft" cx="156" cy="122" r="10" /><rect className="il-bar" x="174" y="114" width="100" height="6" rx="3" /><rect className="il-bar" x="174" y="126" width="64" height="5" rx="2.5" />
                <path className="il-dots" d="M146 150 H284" style={{ stroke: "var(--il-ink)", strokeWidth: 1.4, strokeDasharray: "2 6", opacity: 0.4 }} fill="none" />
                <rect className="il-bar" x="146" y="162" width="70" height="6" rx="3" />
              </g></g>
              <g className="il-float d2" transform="rotate(-12 292 150)">
                <circle cx="292" cy="150" r="34" fill="none" stroke="var(--il-brand)" strokeWidth="3.5" /><circle cx="292" cy="150" r="27" fill="none" stroke="var(--il-brand)" strokeWidth="1.5" strokeDasharray="3 4" />
                <text x="292" y="156" textAnchor="middle" style={{ fontSize: "15px", fontWeight: 800, letterSpacing: ".12em", fill: "var(--il-brand)" }}>{t("stamp")}</text>
              </g>
            </svg>
          </div>
        </section>

        <section className="ap-card au-filters" aria-label={ta("filters")}>
          <div className="au-frow1">
            <div className="au-presets" role="group" aria-label={ta("timeRange")}>
              {PRESETS.map(([days, key]) => <button key={days} type="button" className={`au-chip${f.range === days ? " is-on" : ""}`} onClick={() => patch({ range: days, ...rangeDates(days) })}>{ta(key)}</button>)}
            </div>
            <button type="button" className="au-reset" id="au-reset" hidden={!filtered} onClick={reset}>{ta("reset")}</button>
          </div>
          <div className="au-frow">
            <label className="au-f"><span>{ta("from")}</span><input type="date" id="au-from" value={f.from} onChange={(e) => patch({ from: e.target.value, range: -1 })} /></label>
            <label className="au-f"><span>{ta("to")}</span><input type="date" id="au-to" value={f.to} onChange={(e) => patch({ to: e.target.value, range: -1 })} /></label>
          </div>
          <div className="au-cats" role="group" aria-label={ta("typeLabel")}>
            {ACCOUNT_CAT_ORDER.map((c) => <button key={c} type="button" className="au-chip" aria-pressed={f.cats.includes(c)} onClick={() => toggleCat(c)}>{t(CAT_LABEL[c])}</button>)}
          </div>
        </section>

        <section className="ap-card au-list" aria-labelledby="au-h">
          <header className="ap-ch"><h2 id="au-h"><span>{ta("activity")}</span> <span className="st-count" id="au-total">{meta ? meta.total : ""}</span></h2><span className="st-note">{ta("times")}</span></header>
          <div className="au-tw" role="table" aria-label={ta("activity")}>
            <div className="au-tr au-th" role="row" hidden={!!meta && !meta.total}><span role="columnheader">{ta("colWhen")}</span><span role="columnheader">{ta("colWho")}</span><span role="columnheader">{t("colWhat")}</span></div>
            <div id="au-rows" aria-live="polite" aria-busy={q.isFetching}>
              {!d
                ? Array.from({ length: 5 }, (_, i) => <div className="au-tr au-row st-skel" aria-hidden="true" key={i}><span className="au-when"><b /><small /></span><span className="au-who"><span className="st-av" /><span className="au-wn"><b /></span></span><span className="au-what"><b /></span></div>)
                : d.logs.map((l) => <AuditRow key={l.id} log={l} cat={accountCatOf(l.action)} icon={ICON[accountCatOf(l.action)]}><Sentence log={l} accountName={workspace?.account.name ?? ""} /></AuditRow>)}
            </div>
          </div>
          <div className="au-empty" id="au-empty" hidden={!meta || meta.total > 0}>
            <b id="au-empty-t">{filtered ? ta("noMatchT") : ta("noneT")}</b>
            <p id="au-empty-d">{filtered ? ta("noMatchD") : t("noneD")}</p>
            <button type="button" className="pm-btn pm-ghost" id="au-empty-btn" hidden={!filtered} onClick={reset}>{ta("reset")}</button>
          </div>
          <nav className="au-pager" id="au-pager" aria-label={ta("pages")} hidden={!meta || meta.totalPages <= 1}>
            <span className="au-range" id="au-range">{meta?.total ? `${from}–${to} ${ta("of")} ${meta.total}` : ""}</span>
            <span className="au-pbtns"><button type="button" className="pm-btn pm-ghost st-sm" id="au-prev" disabled={!meta || meta.page <= 1} onClick={() => go(f.page - 1)}>{ta("prev")}</button><button type="button" className="pm-btn pm-ghost st-sm" id="au-next" disabled={!meta || meta.page >= meta.totalPages} onClick={() => go(f.page + 1)}>{ta("next")}</button></span>
          </nav>
        </section>
      </div>
    </div>
  );
}

/** One readable sentence per account event; an action without wording falls back to its name in words. */
function Sentence({ log: l, accountName }: { log: AuditLog; accountName: string }) {
  const t = useTranslations("AccountAudit");
  const ta = useTranslations("Audit");
  const m = (l.metadata ?? {}) as Record<string, unknown>;
  const actor = l.actor ? l.actor.name : ta("system");
  const a = { A: bold, a: actor };
  switch (l.action) {
    case "SUBSCRIPTION_UPDATED": {
      if (m.status === "PAST_DUE") return t("SUB_PAST_DUE");
      if (m.status === "DOWNGRADED") return t("SUB_DOWNGRADED");
      const tier = TIERS.find((k) => k === m.tier);
      return t.rich("SUBSCRIPTION_UPDATED", { V: bold, tier: tier ? t(`tier${tier}`) : String(m.tier ?? "") });
    }
    case "PROJECT_SELECTION_CONFIRMED": return t.rich(l.action, { ...a, n: Array.isArray(m.selectedProjectIds) ? m.selectedProjectIds.length : 0 });
    case "WORKSPACE_CREATED": return t.rich(l.action, { ...a, N: bold, n: typeof m.name === "string" ? m.name : "" });
    case "ACCOUNT_ONBOARDED": return t.rich(l.action, { ...a, N: bold, n: accountName });
    case "ACCOUNT_OFFBOARDING_INITIATED": return t.rich(l.action, a);
    case "ACCOUNT_PURGED": return t(l.action);
    default: return ta.rich("OTHER", { ...a, action: l.action.toLowerCase().replace(/_/g, " ") });
  }
}
