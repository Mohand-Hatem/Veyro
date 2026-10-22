import { Suspense } from "react";
import { Onboarding } from "@/components/onboarding/onboarding";

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
