"use client";

import Link from "next/link";
import { CalendarDays, Clock3, History, LogOut, Menu, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { GlassButton, GlassSurface } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { AgenditoLogo } from "@/components/brand/agendito-logo";

const navigation = [{ href: "/customer", label: "Início", icon: CalendarDays }, { href: "/customer/appointments", label: "Agendamentos", icon: Clock3 }, { href: "/customer/history", label: "Histórico", icon: History }, { href: "/customer/profile", label: "Perfil", icon: UserRound }];

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, status, logout } = useAuth(); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (status === "ready" || (status === "authenticated" && user?.role !== "CUSTOMER")) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); }, [status, user, router, pathname]);
  if (status === "loading" || !user || user.role !== "CUSTOMER") return <main className="customer-loading"><GlassSurface material="frosted"><span className="eyebrow">Área do cliente</span><p>Restaurando sua sessão…</p></GlassSurface></main>;
  const isActive = (href: string) => href === "/customer" ? pathname === href : pathname.startsWith(href);
  return <div className="customer-app"><header className="customer-header"><Link href="/customer" className="customer-brand" aria-label="Agendito — início"><AgenditoLogo size="small" /></Link><nav className="customer-desktop-nav" aria-label="Navegação do cliente">{navigation.map(({ href, label, icon: Icon }) => <Link className={isActive(href) ? "is-active" : ""} href={href} key={href}><Icon size={17} />{label}</Link>)}</nav><div className="customer-header-actions"><span className="customer-user-name">{user.name}</span><GlassButton variant="quiet" size="icon" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</GlassButton>{menuOpen && <GlassSurface material="floating" className="customer-profile-menu"><strong>{user.name}</strong><span>{user.email}</span><Link href="/customer/profile" onClick={() => setMenuOpen(false)}>Meu perfil</Link><button type="button" onClick={() => { logout(); router.replace("/login"); }}><LogOut size={15} />Sair</button></GlassSurface>}</div></header><main className="customer-main">{children}</main><nav className="customer-mobile-nav" aria-label="Navegação principal">{navigation.map(({ href, label, icon: Icon }) => <Link className={isActive(href) ? "is-active" : ""} href={href} key={href}><Icon size={18} /><span>{label}</span></Link>)}</nav></div>;
}
