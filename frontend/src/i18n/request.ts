import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const fromUrl = await rootParams.locale();
    if (!hasLocale(routing.locales, fromUrl)) notFound();
    locale = fromUrl;
  }
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
