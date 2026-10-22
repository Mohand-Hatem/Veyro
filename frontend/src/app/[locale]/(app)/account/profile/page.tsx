import { Profile } from "@/components/profile/profile";

// Rendered once the shell has loaded the workspace, so there is nothing to prerender for instant navigation.
export const instant = false;

export default function ProfilePage() {
  return <Profile />;
}
