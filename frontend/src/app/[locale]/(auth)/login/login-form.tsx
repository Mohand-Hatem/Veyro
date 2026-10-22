"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Field, PasswordInput, TextInput } from "@/components/auth/fields";
import { FormBanner, SubmitButton, useAuthErrors } from "@/components/auth/form-parts";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { loginSchema } from "@/lib/auth-schemas";
import { safeNext } from "@/lib/safe-next";

type Values = { email: string; password: string };

export function LoginForm() {
  const t = useTranslations("Auth");
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const carry = params.get("next") ? { next } : undefined;
  const { te, banner, setBanner, fail } = useAuthErrors(params.get("signedout") === "1" ? { kind: "ok", text: t("signedOut") } : null);
  const router = useRouter();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema(te)) });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify(values) });
      router.replace(next);
    } catch (err) {
      fail(err, setError);
    }
  });

  return (
    <>
      <AuthHeading title={t("loginTitle")} sub={t("loginSub")} />
      <FormBanner banner={banner} />
      <OAuthButtons />
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <Field id="email" label={t("fEmail")} error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register("email")} />
        </Field>
        <Field id="password" label={t("fPassword")} error={errors.password?.message} extra={<Link className="au-link" href="/forgot-password">{t("forgot")}</Link>}>
          <PasswordInput id="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        </Field>
        <SubmitButton busy={isSubmitting}>{t("loginBtn")}</SubmitButton>
      </form>
      <p className="au-switch"><span>{t("noAccount")}</span> <Link href={{ pathname: "/register", query: carry }}>{t("create")}</Link></p>
    </>
  );
}
