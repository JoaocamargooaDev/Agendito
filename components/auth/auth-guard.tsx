"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth";
import type { UserRole } from "@/types";
import { getSafeReturnPath } from "@/features/auth";
import { AuthLoadingState } from "./auth-feedback";

const destinations: Record<UserRole, string> = { PLATFORM_ADMIN: "/platform/establishments", ADMIN: "/dashboard", EMPLOYEE: "/employee", CUSTOMER: "/customer" };

export function AuthGuard({ allowedRole, loginPath, children }: { allowedRole: UserRole; loginPath: string; children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status !== "ready" && status !== "authenticated") return;
    if (!user) { const returnTo = getSafeReturnPath(pathname, destinations[allowedRole]); router.replace(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`); return; }
    if (user.role !== allowedRole) router.replace(destinations[user.role]);
  }, [allowedRole, loginPath, pathname, router, status, user]);
  if (status === "loading" || !user || user.role !== allowedRole) return <main className="auth-guard-loading"><AuthLoadingState /></main>;
  return <>{children}</>;
}
