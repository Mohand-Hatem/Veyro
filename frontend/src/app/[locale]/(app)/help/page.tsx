import { Guide } from "@/components/guide/guide";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function HelpPage() {
  return <Guide />;
}
