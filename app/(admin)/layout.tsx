import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth";
import { AdminShell } from "@/components/admin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AuthGuard allowedRole="ADMIN" loginPath="/login"><AdminShell>{children}</AdminShell></AuthGuard>;
}
