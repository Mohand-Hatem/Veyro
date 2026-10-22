import { Suspense } from "react";
import { SessionGate } from "./session-gate";

export default function SessionPage() {
  return (
    <Suspense>
      <SessionGate />
    </Suspense>
  );
}
