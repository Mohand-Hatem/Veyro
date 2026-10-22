import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Landing } from "@/components/landing/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    openGraph: { title: t("metaTitle"), description: t("metaDesc"), type: "website", locale },
    alternates: { languages: { en: "/en", ar: "/ar" } },
  };
}

export default function Home() {
  return <Landing />;
}
