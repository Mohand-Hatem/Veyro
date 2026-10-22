import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Invitation } from "@/components/onboarding/invitation";

export default function InvitationPage() {
  return (
    <AuthShell scene="a">
      <Suspense>
        <Invitation />
      </Suspense>
    </AuthShell>
  );
}
