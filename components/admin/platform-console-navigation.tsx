"use client";

import Link from "next/link";
import { LayoutTemplate, Menu, Store, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { GlassButton } from "@/components/ui";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { LogoutButton } from "@/components/auth/logout-button";

const ownerLinks = [
  { href: "/platform/establishments", label: "Estabelecimentos", icon: Store },
  { href: "/platform/pages", label: "Páginas públicas", icon: LayoutTemplate },
];

export function PlatformConsoleNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const active = (href: string) => href === "/platform/establishments"
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href;

  return <>
    <div className="platform-console-navigation">
      <Link href="/platform/establishments" className="platform-console-brand" aria-label="Agendito — painel do proprietário"><AgenditoLogo size="small" /><span>Proprietário</span></Link>
      <nav className="app-navigation platform-console-links" aria-label="Navegação do proprietário">
        {ownerLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`app-navigation-link ${active(href) ? "is-active" : ""}`} aria-current={active(href) ? "page" : undefined}><Icon size={18} />{label}</Link>)}
      </nav>
      <div className="platform-console-session"><LogoutButton redirectTo="/login" /></div>
      <GlassButton variant="quiet" size="icon" className="platform-menu-toggle" aria-label={open ? "Fechar navegação" : "Abrir navegação"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={18} /> : <Menu size={18} />}</GlassButton>
    </div>
    <MobileNavigationDrawer open={open} label="Navegação do proprietário" onClose={close}>
      <div className="role-drawer">
        <div className="role-drawer-heading"><strong>Agendito</strong><span>Painel do proprietário</span></div>
        <nav className="role-drawer-nav app-navigation" aria-label="Seções do proprietário">
          {ownerLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`app-navigation-link ${active(href) ? "is-active" : ""}`} aria-current={active(href) ? "page" : undefined} onClick={close}><Icon size={18} />{label}</Link>)}
        </nav>
        <LogoutButton redirectTo="/login" />
      </div>
    </MobileNavigationDrawer>
  </>;
}
