"use client";

import Link from "next/link";
import { CalendarDays, Clock3, History, LogOut, Menu, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { GlassButton, GlassSurface } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { AccessDeniedState } from "@/components/auth/access-denied-state";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import { NotificationCenter } from "@/components/admin/notification-center";
import { MobileNavigationDrawer } from "@/components/admin/mobile-navigation-drawer";
import { PageShell } from "@/components/admin/page-layout";

const navigation = [{ href: "/customer", label: "Início", icon: CalendarDays }, { href: "/customer/appointments", label: "Agendamentos", icon: Clock3 }, { href: "/customer/history", label: "Histórico", icon: History }, { href: "/customer/profile", label: "Perfil", icon: UserRound }];

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, status, logout } = useAuth(); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (status === "ready" && !user) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); }, [status, user, router, pathname]);
  if (status === "loading" || (status === "authenticated" && !user)) return <main className="customer-loading" role="status" aria-live="polite" aria-atomic="true"><GlassSurface material="frosted"><span className="eyebrow">Área do cliente</span><p>Restaurando sua sessão…</p></GlassSurface></main>;
  if (user && user.role !== "CUSTOMER") return <AccessDeniedState role={user.role} />;
  if (!user) return <main className="customer-loading" role="status" aria-live="polite" aria-atomic="true"><GlassSurface material="frosted"><span className="eyebrow">Área do cliente</span><p>Redirecionando para entrar…</p></GlassSurface></main>;
  const isActive = (href: string) => href === "/customer" ? pathname === href : pathname.startsWith(href);
  return <div className="customer-app"><header className="customer-header"><Link href="/customer" className="customer-brand" aria-label="Agendito — início"><AgenditoLogo size="small" /></Link><nav className="customer-desktop-nav app-navigation" aria-label="Navegação do cliente">{navigation.map(({ href, label, icon: Icon }) => <Link className={`app-navigation-link ${isActive(href) ? "is-active" : ""}`} href={href} key={href} aria-current={isActive(href) ? "page" : undefined}><Icon size={18} />{label}</Link>)}</nav><div className="customer-header-actions"><NotificationCenter context="CUSTOMER" contextId={user.customer?.id ?? user.id} /><span className="customer-user-name">{user.name}</span><GlassButton variant="quiet" size="icon" className="customer-menu-toggle" aria-label={menuOpen ? "Fechar navegação" : "Abrir navegação"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</GlassButton></div></header><PageShell as="main" className="customer-main role-page-shell">{children}</PageShell><nav className="customer-mobile-nav app-navigation" aria-label="Navegação principal">{navigation.map(({ href, label, icon: Icon }) => <Link className={`app-navigation-link ${isActive(href) ? "is-active" : ""}`} href={href} key={href} aria-current={isActive(href) ? "page" : undefined}><Icon size={18} /><span>{label}</span></Link>)}</nav><MobileNavigationDrawer open={menuOpen} label="Navegação do cliente" onClose={() => setMenuOpen(false)}><div className="role-drawer"><div className="role-drawer-heading"><strong>{user.name}</strong><span>{user.email}</span></div><nav className="role-drawer-nav app-navigation" aria-label="Seções do cliente">{navigation.map(({ href, label, icon: Icon }) => <Link className={`app-navigation-link ${isActive(href) ? "is-active" : ""}`} href={href} key={href} aria-current={isActive(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon size={18} />{label}</Link>)}</nav><Link className="role-drawer-account" href="/customer/profile" onClick={() => setMenuOpen(false)}><UserRound size={18} /> Meu perfil</Link><button className="role-drawer-account" type="button" onClick={() => { setMenuOpen(false); logout(); router.replace("/login"); }}><LogOut size={18} /> Sair</button></div></MobileNavigationDrawer></div>;
}
