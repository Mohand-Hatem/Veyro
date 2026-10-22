import { Board } from "@/components/board/board";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default async function BoardPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <Board projectKey={key} />;
}
