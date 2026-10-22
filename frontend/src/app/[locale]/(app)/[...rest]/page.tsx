import { notFound } from "next/navigation";

// Every address the app does not have lands here, so it gets the shell's 404 page (and a real 404 status) instead of Next's plain default.
export const instant = false;

export default function CatchAll() {
  notFound();
}
