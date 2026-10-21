"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { GlassButton } from "@/components/ui";
import { getAdminNavItem } from "@/features/admin";
import type { AuthUser } from "@/features/auth";
import { AdminNotifications } from "./admin-notifications";
import { AdminProfileMenu } from "./admin-profile-menu";
import { useAdminHeaderActions } from "./admin-header-actions";

export function AdminHeader({ pathname, user, establishmentName, onOpenMobile }: { pathname: string; user: AuthUser; establishmentName: string; onOpenMobile: () => void }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => { const onScroll = () => setCompact(window.scrollY > 32); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  const page = getAdminNavItem(pathname);
  const pageActions = useAdminHeaderActions();
  return <header className={`admin-header ${compact ? "admin-header-compact" : ""}`}><div className="admin-header-title"><GlassButton variant="quiet" size="icon" className="mobile-menu-button" onClick={onOpenMobile} aria-label="Abrir menu"><Menu size={19} /></GlassButton><div><span className="header-context"><span title={establishmentName}>{establishmentName}</span><i /> Administração</span><h1>{page.title}</h1></div></div>{pageActions && <div className="admin-header-page-actions">{pageActions}</div>}<div className="admin-header-actions"><AdminNotifications /><AdminProfileMenu user={user} /></div></header>;
}
