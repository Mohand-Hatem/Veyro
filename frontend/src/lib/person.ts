"use client";

import { useTranslations } from "next-intl";

/** The name the server keeps for a deleted person (step G2); `RESERVED` there stops anyone from taking it. The app shows it in the reader's language. */
const DELETED = new Set(["deleted user", "مستخدم محذوف"]);
export const isDeletedName = (name: string) => DELETED.has(name.trim().replace(/\s+/g, " ").toLowerCase());

/** A person's name as it should be read: the deleted-user text follows the page language, everyone else is shown as stored. */
export function usePersonName() {
  const t = useTranslations("People");
  return (name: string) => (isDeletedName(name) ? t("deleted") : name);
}
