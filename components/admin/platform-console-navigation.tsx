"use client";

import Link from "next/link";
import { LayoutDashboard, LayoutTemplate, Layers3, Store, UserRoundPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";

const ownerLinks = [
  { id: "dashboard", href: "/platform/establishments#platform-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "establishments", href: "/platform/establishments#platform-establishments", label: "Estabelecimentos", icon: Store },
  { id: "registrations", href: "/platform/establishments#platform-new-establishment", label: "Cadastros", icon: UserRoundPlus },
  { id: "pages", href: "/platform/pages", label: "Páginas públicas", icon: LayoutTemplate },
  { id: "resources", href: "/platform/establishments#platform-features", label: "Recursos", icon: Layers3 },
];

type PlatformConsoleNavigationProps = {
  open: boolean;
  onClose: () => void;
};

export function PlatformConsoleNavigation({ open, onClose }: PlatformConsoleNavigationProps) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState(pathname === "/platform/pages" ? "pages" : "dashboard");

  useEffect(() => {
    const syncActiveLink = () => {
      if (pathname === "/platform/pages") setActiveId("pages");
      else if (pathname.startsWith("/platform/establishments/")) setActiveId("establishments");
      else if (pathname === "/platform/establishments") setActiveId(({ "#platform-establishments": "establishments", "#platform-new-establishment": "registrations", "#platform-features": "resources" } as Record<string, string>)[window.location.hash] ?? "dashboard");
    };
    syncActiveLink();
    window.addEventListener("hashchange", syncActiveLink);
    return () => window.removeEventListener("hashchange", syncActiveLink);
  }, [pathname]);

  function renderLinks(mobile = false) {
    return ownerLinks.map(({ id, href, label, icon: Icon }) => <Link
      key={id}
      href={href}
      className={`app-navigation-link ${activeId === id ? "is-active" : ""}`}
      aria-current={activeId === id ? "page" : undefined}
      onClick={() => { setActiveId(id); if (mobile) onClose(); }}
    ><Icon size={18} />{label}</Link>);
  }

  return <>
    <aside className="platform-console-sidebar" aria-label="Navegação da plataforma">
      <Link href="/platform/establishments" className="platform-console-brand" aria-label="Agendito — painel da plataforma">
        <AgenditoLogo size="small" /><span>Administrador da plataforma</span>
      </Link>
      <nav className="app-navigation platform-console-links" aria-label="Seções da plataforma">{renderLinks()}</nav>
      <div className="platform-console-sidebar-footer"><span>Agendito</span><small>Administração da plataforma</small></div>
    </aside>
    <MobileNavigationDrawer open={open} label="Navegação da plataforma" onClose={onClose}>
      <div className="role-drawer">
        <div className="role-drawer-heading"><strong>Agendito</strong><span>Administrador da plataforma</span></div>
        <nav className="role-drawer-nav app-navigation" aria-label="Seções da plataforma">{renderLinks(true)}</nav>
      </div>
    </MobileNavigationDrawer>
  </>;
}
