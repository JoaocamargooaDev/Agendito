"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import { listAllEstablishments } from "@/features/platform";
import { AdminHeader } from "./admin-header";
import { AdminHeaderActionsProvider } from "./admin-header-actions";
import { AdminMobileNavigation } from "./admin-mobile-navigation";
import { AdminSidebar } from "./admin-sidebar";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { getNavigationFeatureId, getOperationalBlockReason, isFeatureEnabled } from "@/features/platform/policies";
import { getEstablishmentStatus } from "@/features/platform/domain";
import { adminNavigation } from "@/features/admin";
import { GlassSurface } from "@/components/ui";
import { capabilityForRoute, canCurrentSession } from "@/features/auth/capabilities";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const pathname = usePathname(); const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const establishment = user?.establishmentId ? listAllEstablishments().find((item) => item.id === user.establishmentId) : undefined;
  const establishmentName = establishment?.name ?? "Estabelecimento";
  const routeId = adminNavigation.find((item) => item.path !== "/dashboard" && (pathname === item.path || pathname.startsWith(`${item.path}/`)))?.id;
  const requiredFeature = routeId ? getNavigationFeatureId(routeId) : undefined;
  const requiredCapability = capabilityForRoute(pathname);
  const accessBlocked = Boolean(requiredCapability && !canCurrentSession(requiredCapability, user?.establishmentId));
  const featureBlocked = Boolean(establishment && requiredFeature && !isFeatureEnabled(establishment, requiredFeature));
  const suspensionReason = establishment ? getOperationalBlockReason(establishment) : null;
  const hardBlocked = Boolean(establishment && ["SUSPENDED", "ARCHIVED"].includes(getEstablishmentStatus(establishment)));
  useEffect(() => { if (accessBlocked || featureBlocked || hardBlocked) router.replace("/dashboard"); }, [accessBlocked, featureBlocked, hardBlocked, router]);
  if (!user) return null;
  return <AdminHeaderActionsProvider><div className={`admin-shell ${collapsed ? "admin-shell-collapsed" : ""}`}><AdminSidebar pathname={pathname} user={user} collapsed={collapsed} establishment={establishment} onToggleSidebar={() => setCollapsed((value) => !value)} /><div className="admin-workspace"><AdminHeader pathname={pathname} user={user} establishmentName={establishmentName} establishment={establishment} onOpenMobile={() => setMobileOpen(true)} /><main className="admin-main">{accessBlocked ? <GlassSurface material="frosted" className="dashboard-empty"><span className="eyebrow">Acesso indisponível</span><h1>Esta área não está disponível para este perfil</h1><p>Abra uma seção permitida para a sua conta.</p></GlassSurface> : hardBlocked ? <GlassSurface material="frosted" className="dashboard-empty"><span className="eyebrow">Operação indisponível</span><h1>{getEstablishmentStatus(establishment!) === "SUSPENDED" ? "Estabelecimento suspenso" : "Estabelecimento arquivado"}</h1><p>{suspensionReason}</p></GlassSurface> : featureBlocked ? <GlassSurface material="frosted" className="dashboard-empty"><span className="eyebrow">Recurso desabilitado</span><h1>Esta funcionalidade não está habilitada</h1><p>O proprietário da plataforma pode alterar os recursos disponíveis para este estabelecimento.</p></GlassSurface> : children}</main></div><AdminMobileNavigation pathname={pathname} establishment={establishment} /><MobileNavigationDrawer open={mobileOpen} label="Navegação administrativa" onClose={() => setMobileOpen(false)}><AdminSidebar pathname={pathname} user={user} collapsed={false} establishment={establishment} onNavigate={() => setMobileOpen(false)} /></MobileNavigationDrawer></div></AdminHeaderActionsProvider>;
}

export const AppShell = AdminShell;
