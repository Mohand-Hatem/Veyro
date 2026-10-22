import type { ReactNode } from "react";
import { PublicFrame } from "@/components/landing/public-frame";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>;
}
