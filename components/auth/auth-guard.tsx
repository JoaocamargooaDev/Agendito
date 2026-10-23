"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth";
import type { UserRole } from "@/types";
import { getSafeReturnPath } from "@/features/auth";
import { canCurrentSession, type Capability } from "@/features/auth/capabilities";
import { AuthLoadingState } from "./auth-feedback";

const destinations: Record<UserRole, string> = { PLATFORM_ADMIN: "/platform/establishments", ADMIN: "/dashboard", EMPLOYEE: "/employee", CUSTOMER: "/customer" };

export function AuthGuard({ allowedRole, requiredCapability, loginPath, children }: { allowedRole?: UserRole; requiredCapability?: Capability; loginPath: string; children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status !== "ready" && status !== "authenticated") return;
    if (!user) { const returnTo = getSafeReturnPath(pathname, destinations[allowedRole ?? "ADMIN"]); router.replace(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`); return; }
    const allowed = requiredCapability ? canCurrentSession(requiredCapability, user.establishmentId) : user.role === allowedRole;
    if (!allowed) router.replace(destinations[user.role]);
  }, [allowedRole, requiredCapability, loginPath, pathname, router, status, user]);
  const allowed = Boolean(user && (requiredCapability ? canCurrentSession(requiredCapability, user.establishmentId) : user.role === allowedRole));
  if (status === "loading" || !user || !allowed) return <main className="auth-guard-loading"><AuthLoadingState /></main>;
  return <>{children}</>;
}
