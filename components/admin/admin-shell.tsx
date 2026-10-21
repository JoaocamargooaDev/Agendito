"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth";
import { listAllEstablishments } from "@/features/platform";
import { AdminHeader } from "./admin-header";
import { AdminHeaderActionsProvider } from "./admin-header-actions";
import { AdminMobileNavigation } from "./admin-mobile-navigation";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const pathname = usePathname(); const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;
  const establishmentName = listAllEstablishments().find((item) => item.id === user.establishmentId)?.name ?? "Estabelecimento";
  return <AdminHeaderActionsProvider><div className={`admin-shell ${collapsed ? "admin-shell-collapsed" : ""}`}><AdminSidebar pathname={pathname} user={user} collapsed={collapsed} onToggleSidebar={() => setCollapsed((value) => !value)} /><div className="admin-workspace"><AdminHeader pathname={pathname} user={user} establishmentName={establishmentName} onOpenMobile={() => setMobileOpen(true)} /><main className="admin-main">{children}</main></div><AdminMobileNavigation pathname={pathname} />{mobileOpen && <div className="mobile-sidebar-backdrop" onClick={() => setMobileOpen(false)}><aside className="mobile-sidebar-drawer" onClick={(event) => event.stopPropagation()}><AdminSidebar pathname={pathname} user={user} collapsed={false} onNavigate={() => setMobileOpen(false)} /></aside></div>}</div></AdminHeaderActionsProvider>;
}
