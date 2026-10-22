"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Field, PasswordInput, PasswordRules } from "@/components/auth/fields";
import { DoneCard, FormBanner, SubmitButton, useAuthErrors } from "@/components/auth/form-parts";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { resetSchema } from "@/lib/auth-schemas";

type Values = { newPassword: string; confirm: string };

export function ResetForm() {
  const t = useTranslations("Auth");
  const { te, banner, setBanner, fail } = useAuthErrors();
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(resetSchema(te)), defaultValues: { newPassword: "" } });
  const newPassword = useWatch({ control, name: "newPassword" });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setBanner(null);
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_OR_EXPIRED_RESET_TOKEN") setExpired(true);
      else fail(err);
    }
  });

  if (done) {
    return (
      <DoneCard title={t("resetDoneTitle")}>
        <p>{t("resetDoneText")}</p>
        <Link href="/login" className="au-btn au-btn-link">{t("loginBtn")}</Link>
      </DoneCard>
    );
  }

  if (!token || expired) {
    return (
      <DoneCard icon="alert" title={t("badTitle")}>
        <p>{t("badText")}</p>
        <Link href="/forgot-password" className="au-btn au-btn-link">{t("badBtn")}</Link>
      </DoneCard>
    );
  }

  return (
    <>
      <AuthHeading badge="lock" title={t("resetTitle")} sub={t("resetSub")} />
      <FormBanner banner={banner} />
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <input type="text" name="username" autoComplete="username" hidden aria-hidden="true" tabIndex={-1} />
        <Field id="newPassword" label={t("fNewPassword")} error={errors.newPassword?.message}>
          <PasswordInput id="newPassword" autoComplete="new-password" describedBy="password-rules" error={errors.newPassword?.message} {...register("newPassword")} />
          <PasswordRules id="password-rules" value={newPassword} />
        </Field>
        <Field id="confirm" label={t("fConfirm")} error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
        </Field>
        <SubmitButton busy={isSubmitting}>{t("resetBtn")}</SubmitButton>
      </form>
    </>
  );
}
