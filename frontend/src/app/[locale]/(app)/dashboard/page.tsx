import { DashboardRedirect } from "./redirect";

// Redirects as soon as the workspace list arrives, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function DashboardPage() {
  return <DashboardRedirect />;
}
