import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "./forgot-password-form";

export default function Page() {
  return (
    <AuthShell scene="b">
      <Suspense>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  );
}
