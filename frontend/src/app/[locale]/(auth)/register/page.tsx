import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./register-form";

export default function Page() {
  return (
    <AuthShell scene="a">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
