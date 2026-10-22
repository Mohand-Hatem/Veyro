import { Projects } from "@/components/projects/projects";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function ProjectsPage() {
  return <Projects />;
}
