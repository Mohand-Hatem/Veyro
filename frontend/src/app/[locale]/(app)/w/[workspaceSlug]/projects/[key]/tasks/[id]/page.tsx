import { TaskPage } from "@/components/task/task-page";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default async function TaskRoute({ params }: { params: Promise<{ key: string; id: string }> }) {
  const { key, id } = await params;
  return <TaskPage projectKey={key} taskId={id} />;
}
