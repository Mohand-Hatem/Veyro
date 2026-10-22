"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useShell } from "@/components/shell/shell-context";
import { ApiError } from "@/lib/api";
import { TOPICS, contactErrors, useSendContact, type Topic } from "@/lib/contact";
import "@/components/dashboard/illustration.css";
import "./contact.css";

// SCR-HLP-02. Markup and class names follow screens/shared/contact.js as used by screens/groups/03-workspace-dashboard/contact.html (Parity Gate).
// Name and email start from the signed-in person; the message goes to POST /contact (public endpoint with a honeypot and rate limits).
// The same form is used inside the app (/help/contact) and on the public page (/contact); only the prefill and the two links differ.
type Frame = { guideHref: string; endHref: string; endKey: "backWs" | "backHome" };

export function Contact() {
  const { user, workspace } = useShell();
  const frame: Frame = { guideHref: "/help", endHref: workspace ? `/w/${workspace.slug}` : "/dashboard", endKey: "backWs" };
  return <ContactView key={user?.id ?? "anon"} name={user?.name ?? ""} email={user?.email ?? ""} frame={frame} />;
}

export function PublicContact() {
  return <ContactView name="" email="" frame={{ guideHref: "/how-it-works", endHref: "/", endKey: "backHome" }} />;
}

function ContactView({ name: name0, email: email0, frame }: { name: string; email: string; frame: Frame }) {
  const t = useTranslations("Contact");
  const send = useSendContact();
  const [name, setName] = useState(name0);
  const [email, setEmail] = useState(email0);
  const [topic, setTopic] = useState<Topic>("QUESTION");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: true; email?: true; message?: true }>({});
  const [alert, setAlert] = useState("");
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (send.isPending) return;
    const website = String(new FormData(e.currentTarget).get("website") ?? "");
    const errs = contactErrors({ name, email, message });
    setErrors(errs);
    setAlert("");
    if (errs.name || errs.email || errs.message) {
      setAlert(t("alertFix"));
      document.getElementById(errs.name ? "ct-name" : errs.email ? "ct-email" : "ct-msg")?.focus();
      return;
    }
    try {
      await send.mutateAsync({ name, email, topic, message, website });
      setSent({ name: name.trim(), email: email.trim() });
    } catch (err) {
      setAlert(err instanceof ApiError && err.code === "CONTACT_RATE_LIMITED" ? t("alertRate") : t("alertFail"));
    }
  }

  const scene = (
    <svg viewBox="0 0 420 300" role="img" aria-label={t("heroSvg")}>
      <g className="il-dots" aria-hidden="true"><path d="M34 226 C90 214 120 150 180 128 S270 96 312 74" /></g>
      <g className="il-float"><g transform="rotate(-18 330 62)"><path className="il-brandfill" d="M296 70 L376 40 L338 96 L326 76 Z" /><path d="M326 76 L376 40" fill="none" stroke="var(--il-ink)" strokeWidth="2.4" /><path d="M326 76 L322 100 L338 96" className="il-paper il-line" /></g></g>
      <g className="il-float d2"><rect className="il-paper il-line" x="206" y="26" width="150" height="32" rx="16" /><text className="il-t3" id="ct-chip" x="281" y="47" textAnchor="middle" style={{ fontSize: "12px" }}>{t(`t${topic}`)}</text></g>
      <path className="il-paper il-line" d="M70 204 h160 l22 -38 h-204 z" transform="translate(40 8)" />
      <rect className="il-paper il-line" x="58" y="212" width="210" height="62" rx="12" /><rect className="il-live" x="82" y="226" width="62" height="34" rx="6" /><path d="M82 230 l31 18 l31 -18" fill="none" stroke="var(--il-ink)" strokeWidth="2.2" strokeLinejoin="round" />
      <rect className="il-soft" x="160" y="226" width="62" height="34" rx="6" style={{ strokeWidth: 2 }} /><path d="M160 230 l31 18 l31 -18" fill="none" stroke="var(--il-ink)" strokeWidth="2" strokeLinejoin="round" />
      <g className="il-float d3"><rect className="il-paper il-line" x="236" y="236" width="150" height="40" rx="20" /><text className="il-t3" x="311" y="261" textAnchor="middle" style={{ fontSize: "12px" }}>{t("svgRead")}</text></g>
    </svg>
  );

  if (sent) {
    return (
      <div className="ct-page" id="ct-root">
        <div className="ct-grid">
          <section className="ct-hero il-scene"><div className="ct-hero-t"><h1>{t("sentT")}</h1><p>{t("sentP")}</p></div><div className="il-illu ct-ill">{scene}</div></section>
          <section className="ct-card ct-done" role="status">
            <span className="ct-ok"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
            <h2>{t("weGot")}</h2>
            <p>{t("sentAs")} <b>{sent.name}</b> · {sent.email}</p>
            <div className="ct-act">
              <button type="button" className="ct-btn" id="ct-again" onClick={() => { setSent(null); setMessage(""); setErrors({}); setAlert(""); }}>{t("again")}</button>
              <Link className="ct-btn ct-btn-ghost" href={frame.endHref}>{t(frame.endKey)}</Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-page" id="ct-root">
      <div className="ct-grid">
        <section className="ct-hero il-scene" aria-labelledby="ct-h">
          <div className="ct-hero-t">
            <h1 id="ct-h">{t("heroT")}</h1>
            <p>{t("heroP")}</p>
            <p className="ct-hint">{t("hintQ")} <Link href={frame.guideHref}>{t("hintLink")}</Link></p>
          </div>
          <div className="il-illu ct-ill">{scene}</div>
        </section>
        <form className="ct-card" id="ct-form" onSubmit={onSubmit} noValidate aria-labelledby="ct-fh">
          <h2 id="ct-fh">{t("formT")}</h2>
          <div className="ct-alert" id="ct-alert" role="alert" hidden={!alert}>{alert}</div>
          <div className="ct-two">
            <div className={`ct-f${errors.name ? " is-bad" : ""}`}>
              <label htmlFor="ct-name">{t("name")}</label>
              <input id="ct-name" name="name" type="text" maxLength={100} autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} />
              <p className="ct-err" id="ct-name-e" hidden={!errors.name}>{errors.name ? t("eName") : ""}</p>
            </div>
            <div className={`ct-f${errors.email ? " is-bad" : ""}`}>
              <label htmlFor="ct-email">{t("email")}</label>
              <input id="ct-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: undefined })); }} />
              <p className="ct-err" id="ct-email-e" hidden={!errors.email}>{errors.email ? t("eEmail") : ""}</p>
            </div>
          </div>
          <fieldset className="ct-topics">
            <legend>{t("topicLegend")}</legend>
            <div>
              {TOPICS.map((k) => (
                <label className="ct-topic" key={k}>
                  <input type="radio" name="topic" value={k} checked={topic === k} onChange={() => setTopic(k)} />
                  <span><b>{t(`t${k}`)}</b><small>{t(`d${k}`)}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={`ct-f${errors.message ? " is-bad" : ""}`}>
            <label htmlFor="ct-msg">{t("message")}</label>
            <textarea id="ct-msg" name="message" rows={6} maxLength={2000} placeholder={t("placeholder")} value={message} onChange={(e) => { setMessage(e.target.value); setErrors((x) => ({ ...x, message: undefined })); }} />
            <span className="ct-count" id="ct-count" aria-hidden="true">{message.length}/2000</span>
            <p className="ct-err" id="ct-msg-e" hidden={!errors.message}>{errors.message ? t("eMsg") : ""}</p>
          </div>
          <div className="ct-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <button type="submit" className="ct-btn ct-btn-go" id="ct-send" aria-busy={send.isPending} disabled={send.isPending}><span className="ct-spin" aria-hidden="true" /><span>{t("send")}</span></button>
          <p className="ct-note">{t("note")}</p>
        </form>
      </div>
    </div>
  );
}
