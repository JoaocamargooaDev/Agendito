import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { GlassButton, GlassSurface } from "@/components/ui";
import { AdminHeaderActionSlot } from "./admin-header-actions";
import { PageShell } from "./page-layout";

export function AdminPageContainer({ children }: { children: ReactNode }) { return <PageShell className="admin-page-container">{children}</PageShell>; }

export function AdminPageHeader({ action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  if (!action) return null;
  return <AdminHeaderActionSlot>{action}</AdminHeaderActionSlot>;
}

export function AdminRoutePlaceholder({ title, description }: { title: string; description: string }) {
  return <GlassSurface material="frosted" className="admin-placeholder"><div className="placeholder-mark"><Construction size={19} /></div><div><span className="token-label">{title} · em preparação</span><h2>Esta seção está sendo preparada.</h2><p>{description}</p></div><GlassButton asChild variant="ghost"><Link href="/dashboard"><ArrowLeft size={15} /> Voltar à visão geral</Link></GlassButton></GlassSurface>;
}
