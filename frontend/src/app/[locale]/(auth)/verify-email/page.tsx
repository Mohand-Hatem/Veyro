import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "./verify-email-form";

export default function Page() {
  return (
    <AuthShell scene="b">
      <Suspense>
        <VerifyForm />
      </Suspense>
    </AuthShell>
  );
}
