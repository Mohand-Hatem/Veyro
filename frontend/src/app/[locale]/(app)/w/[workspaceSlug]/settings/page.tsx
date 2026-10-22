import { Settings } from "@/components/settings/settings";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function SettingsPage() {
  return <Settings />;
}
