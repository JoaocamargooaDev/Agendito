"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AgenditoLogo } from "@/components/brand/agendito-logo";

export interface NavigationItem { label: string; href: string; active?: boolean }
export interface GlassNavigationProps { items: NavigationItem[]; className?: string; compact?: boolean }
export function GlassNavigation({ items, className, compact: compactProp }: GlassNavigationProps) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={cn("glass-navigation", "liquid-glass__navigation", (compactProp ?? compact) && "nav-compact", className)} aria-label="Navegação principal">
      <Link className="nav-brand" href="/" aria-label="Agendito — início"><AgenditoLogo size="small" /></Link>
      <div className="nav-links">
        {items.map((item) => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}>{item.label}</Link>)}
      </div>
    </nav>
  );
}
