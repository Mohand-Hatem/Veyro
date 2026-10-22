/** Builds the features grid inside `root` and returns a function that removes everything it added. */
export function initBento(root: HTMLElement, options: { theme: "light" | "dark"; texts: Record<string, string> }): () => void;
