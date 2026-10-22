import { Billing } from "@/components/billing/billing";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function BillingPage() {
  return <Billing />;
}
