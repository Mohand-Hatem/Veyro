import { Assistant } from "@/components/assistant/assistant";

// Rendered once the shell has loaded the workspace and the user, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function AssistantPage() {
  return <Assistant />;
}
