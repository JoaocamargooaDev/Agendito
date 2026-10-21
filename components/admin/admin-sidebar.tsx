"use client";

import Link from "next/link";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { GlassButton, GlassTooltip } from "@/components/ui";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import { adminNavigation, isAdminPathActive } from "@/features/admin";
import type { AuthUser } from "@/features/auth";

export function AdminSidebar({ pathname, user, collapsed, onNavigate, onToggleSidebar }: { pathname: string; user: AuthUser; collapsed: boolean; onNavigate?: () => void; onToggleSidebar?: () => void }) {
  const updatePointerLight = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--glass-pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty("--glass-pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };
  return <aside className={`admin-sidebar ${collapsed ? "sidebar-collapsed" : ""}`} aria-label="Navegação administrativa" onPointerMove={updatePointerLight}>
    <div className="admin-sidebar-top"><Link href="/dashboard" className="admin-brand" aria-label="Agendito — visão geral"><AgenditoLogo size={collapsed ? "small" : "medium"} /></Link></div>
    <nav className="admin-nav" aria-label="Seções administrativas">{adminNavigation.filter((item) => item.roles.includes(user.role)).map((item) => { const Icon = item.icon; const active = isAdminPathActive(pathname, item.path); const link = <Link href={item.path} onClick={onNavigate} className={`admin-nav-item ${active ? "nav-item-active" : ""}`} aria-label={item.title} aria-current={active ? "page" : undefined} title={item.title}><Icon size={18} aria-hidden /><span>{item.title}</span></Link>; return collapsed ? <GlassTooltip key={item.id} label={item.title}>{link}</GlassTooltip> : <span key={item.id}>{link}</span>; })}</nav>
    {onToggleSidebar && <div className="admin-sidebar-toggle"><GlassButton variant="quiet" size="icon" className="sidebar-collapse-toggle" onClick={onToggleSidebar} aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</GlassButton></div>}
    <div className="admin-sidebar-bottom"><div className="sidebar-user"><span className="user-avatar">{user.name.slice(0, 1)}</span><span className="sidebar-user-copy"><strong>{user.name}</strong><small>{user.role === "ADMIN" ? "Administrador" : "Profissional"}</small></span></div></div>
  </aside>;
}
