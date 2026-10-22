"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { GUIDE_SCENES } from "./guide-scenes";
import "@/components/dashboard/illustration.css";
import "./guide.css";

const SECTIONS = ["picture", "cycle", "start", "tasks", "people", "ai", "plans", "trust", "help"] as const;
const ROLES = ["owner", "admin", "padmin", "member"] as const;
type Role = (typeof ROLES)[number];
type Id = (typeof SECTIONS)[number];
const TINT: Record<Id, string> = { picture: "#E8A55C", cycle: "#8E9BE0", start: "#7DBE9A", tasks: "#E0897A", people: "#8E9BE0", ai: "#E8A55C", plans: "#7DBE9A", trust: "#8E9BE0", help: "#E0897A" };

const TICK = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>;
const CROSS = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;

// SCR-HLP-01. Markup and class names follow screens/shared/guide.js as used by screens/groups/03-workspace-dashboard/how-it-works.html (Parity Gate).
// Static guide, no backend: one illustrated section per topic and a role picker that opens on the signed-in role.
// The same view is used inside the app (/help) and on the public page (/how-it-works); only the start role and the two links at the end differ.
type Frame = { contactHref: string; endHref: string; endKey: "backWs" | "startFree" };

export function Guide() {
  const { workspace, role } = useShell();
  return <GuideView initialRole={role} frame={{ contactHref: "/help/contact", endHref: workspace ? `/w/${workspace.slug}` : "/dashboard", endKey: "backWs" }} />;
}

export function PublicGuide() {
  return <GuideView initialRole="owner" frame={{ contactHref: "/contact", endHref: "/register", endKey: "startFree" }} />;
}

function GuideView({ initialRole, frame }: { initialRole: Role; frame: Frame }) {
  const t = useTranslations("Guide");
  const [role, setRole] = useState<Role>(initialRole);

  // A link such as /help#sec-ai opens at that section once the page is there.
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView(), 0);
  }, []);

  const jump = (e: MouseEvent<HTMLAnchorElement>, id: Id) => {
    e.preventDefault();
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#sec-${id}`);
  };

  return (
    <div className="gd-page" id="gd-root">
      <header className="gd-hero">
        <h1>{t("heroT")}</h1>
        <p>{t("heroP")}</p>
        <div className="gd-pick" role="radiogroup" aria-label={t("pickLabel")}>
          <span>{t("pickLabel")}</span>
          <div className="gd-seg">
            {ROLES.map((r) => <button key={r} type="button" role="radio" aria-checked={r === role} data-role={r} onClick={() => setRole(r)}>{t(`roles.${r}`)}</button>)}
          </div>
        </div>
        <nav className="gd-toc" aria-label={t("tocLabel")}>
          {SECTIONS.map((id, i) => <a key={id} href={`#sec-${id}`} onClick={(e) => jump(e, id)}><i>{i + 1}</i>{t(`nav.${id}`)}</a>)}
        </nav>
      </header>
      {SECTIONS.map((id, i) => <GuideSection key={id} id={id} n={i + 1} role={role} frame={frame} />)}
    </div>
  );
}

function GuideSection({ id, n, role, frame }: { id: Id; n: number; role: Role; frame: Frame }) {
  const t = useTranslations("Guide");
  const list = (path: string) => Object.values(t.raw(path) as Record<string, string>);
  const head = (
    <>
      <span className="gd-n">{String(n).padStart(2, "0")}</span>
      <h2 id={`gd-h-${id}`}>{t(`sections.${id}.t`)}</h2>
      <p className="gd-lead">{t(`sections.${id}.lead`)}</p>
    </>
  );
  // Only the sections that have a bullet list ask for one ("Your cycle" has steps instead).
  const bullets = () => <ul className="gd-bl">{list(`sections.${id}.b`).map((x) => <li key={x}><i>{TICK}</i><span>{x}</span></li>)}</ul>;

  let body;
  if (id === "cycle") {
    body = (
      <>
        {head}
        <ol className="gd-steps">{list(`sections.cycle.steps.${role}`).map((s, i) => <li key={s}><b>{i + 1}</b><span>{s}</span></li>)}</ol>
        <div className="gd-cc">
          <div><h3>{t("can")}</h3><ul>{list(`sections.cycle.can.${role}`).map((x) => <li className="is-yes" key={x}><i>{TICK}</i><span>{x}</span></li>)}</ul></div>
          <div><h3>{t("cannot")}</h3><ul>{list(`sections.cycle.cant.${role}`).map((x) => <li className="is-no" key={x}><i>{CROSS}</i><span>{x}</span></li>)}</ul></div>
        </div>
      </>
    );
  } else if (id === "help") {
    body = (
      <>
        {head}
        {bullets()}
        <div className="gd-cta"><Link className="gd-btn gd-btn-go" href={frame.contactHref}>{t("contact")}</Link><Link className="gd-btn" href={frame.endHref}>{t(frame.endKey)}</Link></div>
      </>
    );
  } else {
    body = (
      <>
        {head}
        {bullets()}
        {t.has(`sections.${id}.r.${role}`) && <p className="gd-role"><b>{t(`roles.${role}`)}</b><span>{t(`sections.${id}.r.${role}`)}</span></p>}
      </>
    );
  }
  return (
    <section className={`gd-sec il-scene${n % 2 === 0 ? " is-flip" : ""}`} id={`sec-${id}`} aria-labelledby={`gd-h-${id}`} style={{ "--il-sweater": TINT[id] } as React.CSSProperties}>
      <div className="gd-txt">{body}</div>
      <div className="il-illu gd-ill">{GUIDE_SCENES[id](t as (key: string) => string)}</div>
    </section>
  );
}
