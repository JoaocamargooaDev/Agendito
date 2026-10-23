"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { GlassButton } from "@/components/ui";
import { getAdminNavItem } from "@/features/admin";
import type { AuthUser } from "@/features/auth";
import type { Establishment } from "@/types";
import { AdminNotifications } from "./admin-notifications";
import { AdminProfileMenu } from "./admin-profile-menu";
import { useAdminHeaderActions } from "./admin-header-actions";
import { isFeatureEnabled } from "@/features/platform/policies";
import { PageHeader } from "./page-layout";

export function AdminHeader({ pathname, user, establishmentName, establishment, onOpenMobile }: { pathname: string; user: AuthUser; establishmentName: string; establishment?: Establishment; onOpenMobile: () => void }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => { const onScroll = () => setCompact(window.scrollY > 32); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  const page = getAdminNavItem(pathname);
  const pageActions = useAdminHeaderActions();
  return <PageHeader className="admin-header" compact={compact} title={page.title} eyebrow={<><span title={establishmentName}>{establishmentName}</span><i /> Administração</>} leading={<GlassButton variant="quiet" size="icon" className="mobile-menu-button" onClick={onOpenMobile} aria-label="Abrir menu"><Menu size={19} /></GlassButton>} pageActions={pageActions} actions={<>{(!establishment || isFeatureEnabled(establishment, "notifications")) && <AdminNotifications establishment={establishment} />}<AdminProfileMenu user={user} /> </>} />;
}
