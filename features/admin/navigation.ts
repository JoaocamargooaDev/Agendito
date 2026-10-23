import { BarChart3, CalendarDays, Cog, Globe2, Scissors, Sparkles, Users, UsersRound, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/types";

export interface AdminNavItem {
  id: string;
  title: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
  mobilePriority?: boolean;
}

export const adminNavigation: AdminNavItem[] = [
  { id: "overview", title: "Visão geral", path: "/dashboard", icon: BarChart3, roles: ["ADMIN"], mobilePriority: true },
  { id: "agenda", title: "Agenda", path: "/agenda", icon: CalendarDays, roles: ["ADMIN"], mobilePriority: true },
  { id: "customers", title: "Clientes", path: "/customers", icon: Users, roles: ["ADMIN"] },
  { id: "employees", title: "Equipe", path: "/employees", icon: UsersRound, roles: ["ADMIN"] },
  { id: "services", title: "Serviços", path: "/services", icon: Scissors, roles: ["ADMIN"] },
  { id: "my-page", title: "Minha página", path: "/my-page", icon: Globe2, roles: ["ADMIN"] },
  { id: "features", title: "Recursos", path: "/features", icon: Sparkles, roles: ["ADMIN"] },
  { id: "settings", title: "Configurações", path: "/settings", icon: Cog, roles: ["ADMIN"] },
];

export function isAdminPathActive(pathname: string, itemPath: string) {
  return itemPath === "/dashboard" ? pathname === itemPath : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function getAdminNavItem(pathname: string) {
  return adminNavigation.find((item) => isAdminPathActive(pathname, item.path)) ?? adminNavigation[0];
}
