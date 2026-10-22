"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader } from "@/components/loader/loader";
import { Forbidden } from "@/components/state/forbidden";
import { useShell } from "@/components/shell/shell-context";
import { useFormat } from "@/components/dashboard/use-format";
import { PLANS, TIERS, eventKey, fetchAccountProjects, meterOf, useBillingEvents, useSubscription, type AccountProjects, type BillingEvent, type Subscription, type Tier } from "@/lib/billing";
import { DeleteAccountDialog, SelectProjectsDialog } from "./billing-dialogs";
import "@/components/dashboard/illustration.css";
import "@/components/dashboard/dashboard.css";
import "@/components/projects/projects.css";
import "./billing.css";

const WARN = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20z" /><path d="M12 10v5M12 18v.01" /></svg>;
const CLOCK = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3 2" /></svg>;

// SCR-SET-02. Markup and class names follow screens/groups/06-account-governance/billing.html (Parity Gate).
// Account owner only. There is no payment provider yet, so plan changes and payments say so instead of doing anything.
export function Billing() {
  const t = useTranslations("Billing");
  const tw = useTranslations("Work");
  const ts = useTranslations("Shell");
  const { workspace, role, notify } = useShell();
  const owner = role === "owner";
  const slug = workspace?.slug ?? "";
  const accountId = workspace?.account.id;
  const sub = useSubscription(accountId, owner);
  const events = useBillingEvents(accountId, owner);

  if (workspace && !owner) return <Forbidden from="billing" />;
  const head = (
    <div className="ap-ovh">
      <nav className="bd-crumbs" aria-label={tw("breadcrumb")}>
        <Link href={`/w/${slug}`}>{ts("navDash")}</Link><span aria-hidden="true">/</span><b>{t("crumb")}</b>
      </nav>
    </div>
  );
  if (sub.isError && !sub.data) {
    return (
      <div className="st-page gv-page">
        {head}
        <section className="ap-card st-error" role="alert">
          <b>{t("errT")}</b>
          <p>{tw("errorText")}</p>
          <button type="button" className="pm-btn pm-ghost" onClick={() => { void sub.refetch(); void events.refetch(); }}>{tw("retry")}</button>
        </section>
      </div>
    );
  }
  if (!sub.data) return <Loader />;
  return <BillingView data={sub.data} events={events.data ?? []} head={head} soon={() => notify(t("soonToast"))} />;
}

function BillingView({ data, events, head, soon }: { data: Subscription; events: BillingEvent[]; head: React.ReactNode; soon: () => void }) {
  const t = useTranslations("Billing");
  const qc = useQueryClient();
  const { notify } = useShell();
  const [dlg, setDlg] = useState<"sel" | "del" | null>(null);
  const [picks, setPicks] = useState<AccountProjects | null>(null);
  const { date } = useFormat();
  const { subscription: sub, limits, grace, account, readOnlyProjects } = data;
  const locked = account.offboardingState === "PENDING";
  const fmt = (s: string) => date(s, true);
  const tier = (k: Tier) => t(`tier${k}`);

  const [statusClass, statusText] = locked ? ["gv-st-locked", t("stLOCKED")] : [sub.status === "ACTIVE" ? "st-active" : sub.status === "PAST_DUE" ? "st-readonly" : "gv-st-warn", t(`st${sub.status}`)];
  const meta = sub.billingCycleEndsAt ? `${sub.status === "PAST_DUE" ? t("cycleEnd") : t("renews")} ${fmt(sub.billingCycleEndsAt)}` : t("noCycle");

  type Banner = { kind: "bad" | "warn"; title: string; text: string; cta?: { id: string; label: string; run: () => void } };
  let banner: Banner | null = null;
  if (locked) banner = { kind: "bad", title: t("bOffT"), text: t("bOffD") };
  else if (sub.requiresProjectSelection) banner = { kind: "warn", title: t("bSelT"), text: t("bSelD", { n: limits.maxProjects }), cta: { id: "gv-open-sel", label: t("bSelCta"), run: openSelect } };
  else if (grace?.expired) banner = { kind: "bad", title: t("bGoT"), text: t("bGoD") };
  else if (grace) banner = { kind: "warn", title: t("bPdT"), text: t("bPdD", { date: fmt(grace.endsAt), days: grace.daysLeft }), cta: { id: "gv-banner-cta", label: t("bPdCta"), run: soon } };

  // The picker always starts from the flags as they are on the server right now.
  async function openSelect() {
    try {
      setPicks(await fetchAccountProjects(qc, account.id));
      setDlg("sel");
    } catch {
      notify(t("errGeneric"));
    }
  }
  const closeDialog = () => { setDlg(null); setPicks(null); };

  const meter = (label: string, used: number, max: number | null) => {
    const m = meterOf(used, max);
    return (
      <div className={`gv-meter${m.full ? " is-full" : ""}`}>
        <div className="gv-ml"><b>{label}</b><span>{used} {m.unlimited ? `· ${t("unlimited")}` : `${t("of")} ${max}`}</span></div>
        <div className="gv-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={m.unlimited ? used || 1 : (max as number)} aria-valuenow={used}><i style={{ width: `${m.pct}%` }} /></div>
      </div>
    );
  };
  const any = events.some((e) => e.amount !== null);
  const money = (e: BillingEvent) => (e.amount === null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: e.currency || "USD" }).format(e.amount / 100));

  return (
    <div className="st-page gv-page">
      {head}
      <div id="gv-content" className="gv-content">
        {banner && (
          <div className={`gv-banner is-${banner.kind}`} id="gv-banner" role="status">
            {banner.kind === "bad" ? WARN : CLOCK}
            <div><b>{banner.title}</b><p>{banner.text}</p></div>
            {banner.cta && <button type="button" className="pm-btn pm-go st-sm" id={banner.cta.id} onClick={banner.cta.run}>{banner.cta.label}</button>}
          </div>
        )}

        <section className="ap-card gv-plan" aria-labelledby="gv-plan-name" id="gv-plan">
          <div className="gv-plan-l">
            <p className="gv-eyebrow">{t("current")}</p>
            <div className="gv-plan-name"><h2 id="gv-plan-name">{tier(sub.tier)}</h2><span className={`ap-st ${statusClass}`} id="gv-status">{statusText}</span></div>
            <p className="gv-meta" id="gv-meta">{meta}</p>
            <div className="gv-actions">
              <button type="button" className="pm-btn pm-go" id="gv-change" disabled={locked} onClick={soon}><span>{t("change")}</span></button>
              <Link className="pm-btn pm-ghost" href="/account/audit" id="gv-audit-link"><span>{t("audit")}</span></Link>
            </div>
            <p className="pm-hint">{t("soonH")}</p>
          </div>
          <div className="gv-meters" id="gv-meters" aria-label={t("usage")}>
            {meter(t("pProjects"), limits.currentProjects, limits.maxProjects)}
            {meter(t("pWorkspaces"), limits.currentWorkspaces, limits.maxWorkspaces)}
            {readOnlyProjects > 0 && <p className="gv-ro"><span className="ap-st st-readonly">{t("readOnly")}</span> {readOnlyProjects} {t("roN", { n: readOnlyProjects })}</p>}
          </div>
        </section>

        <section className="gv-plans" aria-labelledby="gv-plans-h">
          <header className="gv-sh"><h3 id="gv-plans-h">{t("plans")}</h3><p>{t("plansD")}</p></header>
          <div className="gv-pgrid" id="gv-pgrid">
            {TIERS.map((k) => {
              const p = PLANS[k], on = k === sub.tier;
              const ws = p.ws === null ? t("cWsUnl") : `${p.ws} ${p.ws === 1 ? t("cWs") : t("cWsMany")}`;
              const [first, ...rest] = ws.split(" ");
              return (
                <article className={`gv-pc${on ? " is-cur" : ""}`} key={k}>
                  <header><h4>{tier(k)}</h4>{on && <span className="gv-curtag">{t("cur")}</span>}</header>
                  <p className="gv-price">{t("price")}</p>
                  <ul><li><b>{p.projects}</b> {t("cProjects")}</li><li><b>{first}</b> {rest.join(" ")}</li></ul>
                  <button type="button" className="pm-btn pm-ghost st-sm" disabled={on} onClick={on ? undefined : soon}>{on ? t("cur") : t("soon")}</button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="ap-card gv-hist" aria-labelledby="gv-hist-h">
          <header className="ap-ch"><h2 id="gv-hist-h">{t("hist")}</h2></header>
          <div className="gv-hrows" id="gv-hrows" role="table" aria-label={t("hist")} hidden={events.length === 0}>
            {events.length > 0 && (
              <>
                <div className={`gv-hr gv-hh${any ? " has-amt" : ""}`} role="row"><span role="columnheader">{t("colDate")}</span><span role="columnheader">{t("colEvent")}</span>{any && <span role="columnheader" className="gv-amt">{t("colAmount")}</span>}</div>
                {events.map((e) => {
                  const k = eventKey(e.eventType);
                  return (
                    <div className={`gv-hr${any ? " has-amt" : ""}`} role="row" key={e.id}>
                      <span role="cell">{fmt(e.occurredAt)}</span>
                      <span role="cell"><i className={`gv-dot${e.eventType.includes("failed") ? " is-bad" : ""}`} />{k ? t(k) : e.eventType}</span>
                      {any && <span role="cell" className="gv-amt">{money(e)}</span>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="ap-empty gv-hempty" id="gv-hempty" hidden={events.length > 0}>
            <div className="ap-empty-ill" aria-hidden="true">
              <svg viewBox="0 0 220 150"><rect className="e-doc" x="62" y="22" width="96" height="100" rx="14" /><rect className="e-line" x="80" y="46" width="60" height="6" rx="3" /><rect className="e-line" x="80" y="62" width="44" height="6" rx="3" /><rect className="e-line" x="80" y="78" width="52" height="6" rx="3" /><circle className="e-plus-c" cx="136" cy="102" r="14" /></svg>
            </div>
            <h2>{t("histT")}</h2>
            <p>{t("histD")}</p>
          </div>
        </section>

        <section className="ap-card gv-danger" aria-labelledby="gv-dz-h">
          <div>
            <h2 id="gv-dz-h">{t("dzT")}</h2>
            <p>{t("dzD")}</p>
          </div>
          <button type="button" className="pm-btn st-danger" id="gv-del-open" disabled={locked} onClick={() => setDlg("del")}><span>{t("dzBtn")}</span></button>
        </section>
      </div>
      <SelectProjectsDialog data={dlg === "sel" ? picks : null} tier={sub.tier} accountId={account.id} onClose={closeDialog} />
      <DeleteAccountDialog open={dlg === "del"} accountId={account.id} slug={account.slug} onClose={closeDialog} />
    </div>
  );
}
