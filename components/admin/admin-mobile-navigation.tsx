"use client";

import Link from "next/link";
import { MoreHorizontal, X } from "lucide-react";
import { useState } from "react";
import { GlassButton, GlassSurface } from "@/components/ui";
import { adminNavigation, isAdminPathActive } from "@/features/admin";

export function AdminMobileNavigation({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const priority = adminNavigation.filter((item) => item.mobilePriority || item.id === "services");
  const extra = adminNavigation.filter((item) => !item.mobilePriority && item.id !== "services");
  return <><nav className="admin-mobile-nav" aria-label="Navegação móvel">{priority.map((item) => { const Icon = item.icon; const active = isAdminPathActive(pathname, item.path); return <Link key={item.id} href={item.path} className={active ? "mobile-nav-active" : ""} aria-current={active ? "page" : undefined}><Icon size={19} /><span>{item.id === "overview" ? "Início" : item.title}</span></Link>; })}<button type="button" className={moreOpen ? "mobile-nav-active" : ""} aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal size={19} /><span>Mais</span></button></nav>{moreOpen && <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}><GlassSurface material="floating" className="mobile-more-sheet" role="dialog" aria-label="Mais seções" onClick={(event) => event.stopPropagation()}><div className="mobile-more-heading"><strong>Mais seções</strong><GlassButton variant="quiet" size="icon" aria-label="Fechar menu" onClick={() => setMoreOpen(false)}><X size={18} /></GlassButton></div>{extra.map((item) => { const Icon = item.icon; return <Link key={item.id} href={item.path} onClick={() => setMoreOpen(false)}><Icon size={18} />{item.title}</Link>; })}</GlassSurface></div>}</>;
}
