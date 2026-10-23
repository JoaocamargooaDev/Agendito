"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth";
import type { UserRole } from "@/types";
import { getSafeReturnPath } from "@/features/auth";
import { canCurrentSession, profileHomePath, type Capability } from "@/features/auth/capabilities";
import { AuthLoadingState } from "./auth-feedback";
import { AccessDeniedState } from "./access-denied-state";

export function AuthGuard({ allowedRole, requiredCapability, loginPath, children }: { allowedRole?: UserRole; requiredCapability?: Capability; loginPath: string; children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (status !== "ready" && status !== "authenticated") return;
    if (!user) { const returnTo = getSafeReturnPath(pathname, profileHomePath(allowedRole ?? "ADMIN")); router.replace(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`); }
  }, [allowedRole, requiredCapability, loginPath, pathname, router, status, user]);
  const allowed = Boolean(user && (requiredCapability ? canCurrentSession(requiredCapability, user.establishmentId) : user.role === allowedRole));
  if (status === "loading" || (!user && status === "ready")) return <main className="auth-guard-loading"><AuthLoadingState /></main>;
  if (user && !allowed) return <AccessDeniedState role={user.role} />;
  if (!user) return <main className="auth-guard-loading"><AuthLoadingState /></main>;
  return <>{children}</>;
}
