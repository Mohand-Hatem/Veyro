import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export default function Page() {
  return (
    <AuthShell scene="a">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
