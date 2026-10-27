"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth";
import { GlassButton, GlassPopover } from "@/components/ui";
import { NotificationCenter } from "@/components/admin/notification-center";
import { PlatformConsoleNavigation } from "@/components/admin/platform-console-navigation";
import { useAuth } from "@/features/auth";
import { CAPABILITIES } from "@/features/auth/capabilities";

function PlatformConsoleShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/platform/establishments?q=${encodeURIComponent(query)}#platform-establishments` : "/platform/establishments#platform-establishments");
  }

  return <div className="platform-console-layout">
    <PlatformConsoleNavigation open={navigationOpen} onClose={() => setNavigationOpen(false)} />
    <div className="platform-console-workspace">
      <header className="platform-console-topbar">
        <GlassButton variant="quiet" size="icon" className="platform-console-menu-toggle" aria-label={navigationOpen ? "Fechar navegação" : "Abrir navegação"} aria-expanded={navigationOpen} onClick={() => setNavigationOpen((value) => !value)}>{navigationOpen ? <X size={19} /> : <Menu size={19} />}</GlassButton>
        <form className="platform-console-search" role="search" onSubmit={submitSearch}>
          <Search size={19} aria-hidden="true" />
          <input ref={searchRef} aria-label="Buscar estabelecimentos" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estabelecimentos…" />
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </form>
        <div className="platform-console-topbar-actions">
          <NotificationCenter context="OWNER" contextId="platform" />
          {user && <GlassPopover label="Opções do usuário" align="end" panelClassName="platform-account-popover" trigger={<span className="platform-console-account"><span className="platform-console-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><ChevronDown size={17} aria-hidden="true" /></span>}>
            <div className="platform-account-heading"><span className="platform-console-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
            <div className="platform-account-role">Administrador da plataforma</div>
            <button className="platform-account-logout" type="button" onClick={() => { logout(); router.replace("/login"); }}><LogOut size={16} />Sair</button>
          </GlassPopover>}
        </div>
      </header>
      <div className="platform-console-content">{children}</div>
    </div>
  </div>;
}

export default function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requiredCapability={CAPABILITIES.platformConsole} loginPath="/login"><PlatformConsoleShell>{children}</PlatformConsoleShell></AuthGuard>;
}
