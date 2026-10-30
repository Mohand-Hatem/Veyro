"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DEMO_ACCOUNTS, DEMO_MODE, DEMO_PASSWORD } from "@/lib/demo";

/** Sign-in page, demo deployments only: a closed one-line menu; opened, it lists three ready accounts and one click fills the form (and closes it again). */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const t = useTranslations("Auth");
  const ts = useTranslations("Shell");
  const [open, setOpen] = useState(false);
  if (!DEMO_MODE) return null;
  return (
    <section className="au-demo au-demo-menu" data-open={open}>
      <button type="button" className="au-demo-head" aria-expanded={open} aria-controls="au-demo-panel" onClick={() => setOpen((o) => !o)}>
        <span>{t("demoTitle")}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {/* inert keeps the closed accounts out of the tab order and away from screen readers */}
      <div className="au-demo-body" id="au-demo-panel" inert={!open}>
        <div className="au-demo-inner">
          <div className="au-demo-content">
            <p>{DEMO_PASSWORD ? t("demoSub") : t("demoSubNoPassword")}</p>
            <ul>
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button type="button" onClick={() => { onPick(a.email, DEMO_PASSWORD); setOpen(false); }}>
                    <span>{a.name}</span>
                    <small>{ts(a.role)}</small>
                  </button>
                </li>
              ))}
            </ul>
            {DEMO_PASSWORD && <p className="au-demo-pw">{t("demoPassword")} <code>{DEMO_PASSWORD}</code></p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Register page, demo deployments only: says why a sign-up cannot finish here and where to go instead. */
export function DemoRegisterNote() {
  const t = useTranslations("Auth");
  if (!DEMO_MODE) return null;
  return (
    <section className="au-demo" role="note" aria-labelledby="au-demo-rt">
      <b id="au-demo-rt">{t("demoRegisterTitle")}</b>
      <p>{t("demoRegisterBody")}</p>
    </section>
  );
}
