import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicContact } from "@/components/contact/contact";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: `${t("heroT")} — Veyro`, description: t("heroP") };
}

export default function Page() {
  return <PublicContact />;
}
