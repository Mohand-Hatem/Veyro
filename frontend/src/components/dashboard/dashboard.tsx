"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShell } from "@/components/shell/shell-context";
import { useAiQuota, useDashboard, type Dashboard as Data } from "@/lib/dashboard";
import { Loader } from "@/components/loader/loader";
import { DashIcons, UpIcon, WarnIcon } from "./icons";
import { MyTasks } from "./my-tasks";
import { ProgressGauge } from "./progress-gauge";
import { ProjectSummary } from "./project-summary";
import { TeamWorkload } from "./team-workload";
import { useFormat } from "./use-format";
import { YourWorkload } from "./your-workload";
import "./illustration.css";
import "./dashboard.css";

// SCR-WKSP-01. Markup and class names follow screens/groups/03-workspace-dashboard/index.html (Parity Gate).
export function Dashboard() {
  const t = useTranslations("Dashboard");
  const ts = useTranslations("Shell");
  const { workspace, role, notify, search, openCreateProject } = useShell();
  const dash = useDashboard(workspace?.id);
  const quota = useAiQuota();

  if (dash.isError) {
    return (
      <section className="grid max-w-md justify-items-start gap-2 py-8" role="alert">
        <h2 className="text-xl font-bold">{t("loadErrorTitle")}</h2>
        <p className="text-muted-foreground">{t("loadErrorText")}</p>
        <button type="button" className="font-bold underline" onClick={() => dash.refetch()}>{ts("retry")}</button>
      </section>
    );
  }
  if (!dash.data) return <Loader />;

  const d = dash.data, empty = d.projects.length === 0, member = role === "member";

  return (
    <>
      <Notices d={d} owner={role === "owner"} onLater={() => notify(ts("later"))} />
      <div className="ap-ovh"><h2>{t("overview")}</h2></div>
      <Kpis d={d} empty={empty} quota={quota.data} />
      {empty ? (
        <section className="ap-empty">
          <div className="ap-empty-ill" aria-hidden="true">
            <svg viewBox="0 0 220 150"><path className="e-fold-b" d="M30 46h56l12 14h92a8 8 0 0 1 8 8v62a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10z" /><rect className="e-doc e-d1" x="52" y="30" width="86" height="64" rx="10" /><rect className="e-doc e-d2" x="78" y="20" width="86" height="64" rx="10" /><path className="e-fold-f" d="M30 68h160v54a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10z" /><circle className="e-plus-c" cx="176" cy="40" r="17" /><path className="e-plus" d="M176 32v16M168 40h16" /></svg>
          </div>
          <h2>{member ? t("eTM") : t("eT")}</h2>
          <p>{member ? t("eDM") : t("eD")}</p>
          {!member && <button type="button" className="ap-btn" aria-haspopup="dialog" onClick={openCreateProject}>{t("eBtn")}</button>}
        </section>
      ) : (
        <div className="ap-grid">
          <ProjectSummary projects={d.projects} query={search} />
          <ProgressGauge projects={d.projects} />
          <MyTasks tasks={d.myTasks} query={search} />
          {d.workload ? <TeamWorkload workload={d.workload} /> : <YourWorkload tasks={d.myTasks} dueToday={d.counts.myDueToday} doneThisWeek={d.counts.completedThisWeek} />}
        </div>
      )}
    </>
  );
}

function Notices({ d, owner, onLater }: { d: Data; owner: boolean; onLater: () => void }) {
  const t = useTranslations("Dashboard");
  const { date } = useFormat();
  let banner: { kind: "warn" | "danger" | "info"; title: string; text: string; cta: string } | null = null;
  if (d.notices && d.capacity) {
    const until = d.notices.gracePeriodEndsAt ? date(d.notices.gracePeriodEndsAt, true) : "";
    switch (d.notices.billingState) {
      case "GRACE":
        banner = { kind: "warn", title: t("nGraceT"), text: t(owner ? "nGraceO" : "nGraceA", { date: until }), cta: owner ? t("nPay") : "" };
        break;
      case "PAST_DUE":
        banner = { kind: "danger", title: t("nPastT"), text: t(owner ? "nPastO" : "nPastA"), cta: owner ? t("nPay") : "" };
        break;
      case "READ_ONLY":
        banner = { kind: "warn", title: t("nDownT"), text: t(owner ? "nDownO" : "nDownA"), cta: owner ? t("nPick") : "" };
        break;
      default:
        if (d.capacity.currentProjects >= d.capacity.maxProjects) banner = { kind: "info", title: t("nLimitT"), text: t(owner ? "nLimitO" : "nLimitA"), cta: owner ? t("nUpgrade") : "" };
    }
  }
  return (
    <section className="ap-notice" role="status" hidden={!banner}>
      {banner && (
        <div className={`ap-nb ap-nb-${banner.kind}`}>
          <span className="ap-nb-ic">{WarnIcon}</span>
          <div><b>{banner.title}</b><p>{banner.text}</p></div>
          {banner.cta && <button type="button" className="ap-nb-btn" onClick={onLater}>{banner.cta}</button>}
        </div>
      )}
    </section>
  );
}

type Card = { cls: string; icon: ReactNode; label: string; value: string; unit: string; sub: string; tone: "" | "up" | "warn" };

function Kpis({ d, empty, quota }: { d: Data; empty: boolean; quota?: { dailyQuota: number; messagesUsed: number; remaining: number } }) {
  const t = useTranslations("Dashboard");
  const c = d.counts;
  const ai: Card = quota
    ? { cls: "c4", icon: DashIcons.spark, label: t("kAi"), value: String(quota.messagesUsed), unit: `/${quota.dailyQuota}`, sub: quota.remaining === 0 ? t("kAiLimit") : t("kAiLeft", { n: quota.remaining }), tone: quota.remaining === 0 ? "warn" : "" }
    : { cls: "c4", icon: DashIcons.spark, label: t("kAi"), value: "–", unit: "", sub: "", tone: "" };

  let cards: Card[];
  if (d.capacity) {
    const cap = d.capacity, full = cap.currentProjects >= cap.maxProjects, plan = t(`plan${cap.tier}`);
    cards = [
      { cls: "c1", icon: DashIcons.folder, label: t("kProjects"), value: String(cap.currentProjects), unit: `/${cap.maxProjects}`, sub: full ? t("kPlanFull", { plan }) : t("kPlanLeft", { plan, n: cap.maxProjects - cap.currentProjects }), tone: full ? "warn" : "" },
      { cls: "c2", icon: DashIcons.check, label: t("kOpen"), value: String(c.openTasks), unit: "", sub: empty ? t("kOpenEmpty") : t("kOpenDone", { n: c.completedThisWeek }), tone: empty ? "" : "up" },
      { cls: "c3", icon: DashIcons.users, label: t("kMembers"), value: String(c.members ?? 0), unit: "", sub: empty ? t("kMembersEmpty") : t("kMembersAcross", { n: c.projects }), tone: "" },
      ai,
    ];
  } else {
    cards = [
      { cls: "c1", icon: DashIcons.folder, label: t("kMine"), value: String(c.projects), unit: "", sub: empty ? t("kMineEmpty") : t("kMineSub"), tone: "" },
      { cls: "c2", icon: DashIcons.check, label: t("kMyOpen"), value: String(c.myOpenTasks), unit: "", sub: empty ? t("kMyOpenEmpty") : t("kOpenDone", { n: c.completedThisWeek }), tone: empty ? "" : "up" },
      { cls: "c3", icon: DashIcons.clock, label: t("kDue"), value: String(c.myDueToday), unit: "", sub: c.myDueToday ? t("kDueSome") : t("kDueNone"), tone: c.myDueToday ? "warn" : "" },
      ai,
    ];
  }

  return (
    <section className="ap-kpis" aria-label={t("kPanel")}>
      {cards.map((k) => (
        <article className="ap-kpi" key={k.cls}>
          <span className={`ap-kic ${k.cls}`} aria-hidden="true">{k.icon}</span>
          <span className="ap-kl">{k.label}</span>
          <span className="ap-kv">{k.value}{k.unit && <small>{k.unit}</small>}</span>
          <span className={`ap-kt ${k.tone}`.trim()}>{k.tone === "up" && UpIcon}{k.sub}</span>
        </article>
      ))}
    </section>
  );
}
