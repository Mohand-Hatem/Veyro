import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicGuide } from "@/components/guide/guide";

export async function generateMetadata({ params }: PageProps<"/[locale]/how-it-works">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Guide" });
  const tl = await getTranslations({ locale, namespace: "Landing" });
  return { title: `${t("heroT")} — Veyro`, description: tl("metaDesc") };
}

export default function Page() {
  return <PublicGuide />;
}
