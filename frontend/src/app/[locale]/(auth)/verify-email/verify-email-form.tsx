"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { AuthHeading } from "@/components/auth/auth-shell";
import { DoneCard, FormBanner, SubmitButton, mmss, useAuthErrors } from "@/components/auth/form-parts";
import { OtpInput } from "@/components/auth/otp-input";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { otpSchema } from "@/lib/auth-schemas";
import { safeNext } from "@/lib/safe-next";

const RESEND_SECONDS = 60; // matches the backend resend cooldown (the reference page demos 30s)

export function VerifyForm() {
  const t = useTranslations("Auth");
  const { te, banner, setBanner, fail } = useAuthErrors();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = safeNext(params.get("next"), "/onboarding");
  const [done, setDone] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<{ code: string }>({ resolver: zodResolver(otpSchema(te)), defaultValues: { code: "" } });

  useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const onSubmit = handleSubmit(async ({ code }) => {
    setBanner(null);
    try {
      await api("/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, code }) });
      setDone(true);
    } catch (err) {
      fail(err, setError);
    }
  });

  async function resend() {
    setBanner(null);
    try {
      await api("/auth/otp/resend", { method: "POST", body: JSON.stringify({ email }) });
      setWait(RESEND_SECONDS);
      setBanner({ kind: "ok", text: t("resent") });
    } catch (err) {
      fail(err);
    }
  }

  if (done) {
    return (
      <DoneCard title={t("verifiedTitle")}>
        <p>{t("verifiedText")}</p>
        <Link href={next} className="au-btn au-btn-link">{t("continue")}</Link>
      </DoneCard>
    );
  }

  return (
    <>
      <AuthHeading badge="mail" title={t("verifyTitle")} sub={<><span>{t("verifySub")}</span> <b className="au-email">{email}</b></>} />
      <FormBanner banner={banner} />
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <div className={`au-field${errors.code ? " invalid" : ""}`}>
          <span className="au-fake-label" id="otp-label">{t("verifyLabel")}</span>
          <Controller control={control} name="code" render={({ field }) => <OtpInput labelledBy="otp-label" digitLabel={(n) => t("digit", { n })} value={field.value} onChange={field.onChange} invalid={!!errors.code} />} />
          {errors.code && <p id="code-err" role="alert" className="au-error">{errors.code.message}</p>}
        </div>
        <SubmitButton busy={isSubmitting}>{t("verifyBtn")}</SubmitButton>
      </form>
      <p className="au-resend">
        <span>{t("noCode")}</span>{" "}
        <button type="button" onClick={resend} disabled={wait > 0}>{wait > 0 ? t("resendIn", { time: mmss(wait) }) : t("resend")}</button>
      </p>
      <p className="au-switch"><span>{t("wrongEmail")}</span> <Link href="/register">{t("changeEmail")}</Link></p>
    </>
  );
}
