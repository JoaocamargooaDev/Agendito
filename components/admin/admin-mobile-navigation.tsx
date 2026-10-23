"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { GlassModal } from "@/components/ui";
import { adminNavigation, isAdminPathActive } from "@/features/admin";
import type { Establishment } from "@/types";
import { getNavigationFeatureId, hasEnabledOptionalFeature, isFeatureEnabled } from "@/features/platform/policies";

export function AdminMobileNavigation({ pathname, establishment }: { pathname: string; establishment?: Establishment }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const available = adminNavigation.filter((item) => { const feature = getNavigationFeatureId(item.id); return !establishment || (item.id !== "features" || hasEnabledOptionalFeature(establishment)) && (!feature || isFeatureEnabled(establishment, feature)); });
  const priority = available.filter((item) => item.mobilePriority || item.id === "services");
  const extra = available.filter((item) => !item.mobilePriority && item.id !== "services");
  return <><nav className="admin-mobile-nav" aria-label="Navegação móvel">{priority.map((item) => { const Icon = item.icon; const active = isAdminPathActive(pathname, item.path); return <Link key={item.id} href={item.path} className={active ? "mobile-nav-active" : ""} aria-current={active ? "page" : undefined}><Icon size={19} /><span>{item.id === "overview" ? "Início" : item.title}</span></Link>; })}<button type="button" className={moreOpen ? "mobile-nav-active" : ""} aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal size={19} /><span>Mais</span></button></nav><GlassModal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais seções" size="sm"><nav className="mobile-more-sheet" aria-label="Outras seções">{extra.map((item) => { const Icon = item.icon; return <Link key={item.id} href={item.path} onClick={() => setMoreOpen(false)}><Icon size={18} />{item.title}</Link>; })}</nav></GlassModal></>;
}
