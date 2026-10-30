"use client";

import { useTranslations } from "next-intl";
import { DEMO_ACCOUNTS, DEMO_MODE, DEMO_PASSWORD } from "@/lib/demo";

/** Sign-in page, demo deployments only: three ready accounts, one click fills the form. */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const t = useTranslations("Auth");
  const ts = useTranslations("Shell");
  if (!DEMO_MODE) return null;
  return (
    <section className="au-demo" aria-labelledby="au-demo-t">
      <b id="au-demo-t">{t("demoTitle")}</b>
      <p>{DEMO_PASSWORD ? t("demoSub") : t("demoSubNoPassword")}</p>
      <ul>
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button type="button" onClick={() => onPick(a.email, DEMO_PASSWORD)}>
              <span>{a.name}</span>
              <small>{ts(a.role)}</small>
            </button>
          </li>
        ))}
      </ul>
      {DEMO_PASSWORD && <p className="au-demo-pw">{t("demoPassword")} <code>{DEMO_PASSWORD}</code></p>}
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
