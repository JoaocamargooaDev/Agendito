import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth";
import { AppShell } from "@/components/admin";
import { CAPABILITIES } from "@/features/auth/capabilities";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthGuard requiredCapability={CAPABILITIES.establishmentConsole} loginPath="/login"><AppShell>{children}</AppShell></AuthGuard>;
}
