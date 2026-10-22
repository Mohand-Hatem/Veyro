"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Field, TextInput } from "@/components/auth/fields";
import { DoneCard, FormBanner, SubmitButton, mmss, useAuthErrors } from "@/components/auth/form-parts";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { forgotSchema } from "@/lib/auth-schemas";

const RESEND_SECONDS = 60; // matches the backend reset cooldown

export function ForgotForm() {
  const t = useTranslations("Auth");
  const { te, banner, setBanner, fail } = useAuthErrors();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [wait, setWait] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema(te)) });

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(email: string, resend = false) {
    setBanner(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSentTo(email);
      setWait(RESEND_SECONDS);
      setNote(resend ? t("resentLink") : "");
    } catch (err) {
      fail(err);
    }
  }

  if (sentTo) {
    return (
      <DoneCard icon="mail" title={t("sentTitle")}>
        <p><span>{t("sentA")}</span> <b className="au-email">{sentTo}</b><span>{t("sentB")}</span></p>
        <FormBanner banner={banner} />
        <p className="au-resend">
          <span>{t("noLink")}</span>{" "}
          <button type="button" disabled={wait > 0} onClick={() => send(sentTo, true)}>{wait > 0 ? t("resendIn", { time: mmss(wait) }) : t("resendLink")}</button>
        </p>
        <p className="au-note-ok" role="status">{note}</p>
        <p className="au-switch"><Link className="au-backlink" href="/login">{t("backToSignIn")}</Link></p>
      </DoneCard>
    );
  }

  return (
    <>
      <AuthHeading badge="key" title={t("forgotTitle")} sub={t("forgotSub")} />
      <FormBanner banner={banner} />
      <form className="au-form" onSubmit={handleSubmit(({ email }) => send(email.trim().toLowerCase()))} noValidate>
        <Field id="email" label={t("fEmail")} error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register("email")} />
        </Field>
        <SubmitButton busy={isSubmitting}>{t("forgotBtn")}</SubmitButton>
      </form>
      <p className="au-switch"><Link className="au-backlink" href="/login">{t("backToSignIn")}</Link></p>
    </>
  );
}
