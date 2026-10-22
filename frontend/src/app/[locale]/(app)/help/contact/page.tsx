import { Contact } from "@/components/contact/contact";

// Rendered once the shell has loaded the workspace and the user, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function ContactPage() {
  return <Contact />;
}
