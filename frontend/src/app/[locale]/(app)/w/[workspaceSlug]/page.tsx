import { Dashboard } from "@/components/dashboard/dashboard";

// The page renders once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function WorkspaceDashboard() {
  return <Dashboard />;
}
