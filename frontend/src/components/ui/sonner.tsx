"use client"

import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { ErrorFace, InfoFace, OkFace } from "./toast-faces"
import "./toast.css"

/** App-wide toasts: Veyro's bottom-centre pill, a Veyro face for the kind (toast-faces.tsx), right to left in Arabic. Styles in toast.css. */
const Toaster = (props: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const locale = useLocale()
  const t = useTranslations("Common")

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      dir={locale === "ar" ? "rtl" : "ltr"}
      position="bottom-center"
      containerAriaLabel={t("toasts")}
      expand
      visibleToasts={3}
      duration={3500}
      gap={8}
      offset={{ bottom: 28 }}
      mobileOffset={{ bottom: 24, left: 16, right: 16 }}
      icons={{ success: <OkFace />, error: <ErrorFace />, info: <InfoFace /> }}
      toastOptions={{ unstyled: true, classNames: { toast: "vt" } }}
      {...props}
    />
  )
}

export { Toaster }
