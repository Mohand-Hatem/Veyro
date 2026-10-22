import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "./reset-password-form";

export default function Page() {
  return (
    <AuthShell scene="b">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
