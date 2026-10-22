import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

// Every signed-in page lives inside the application shell. It reads the URL and the session, so it renders at request time.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
