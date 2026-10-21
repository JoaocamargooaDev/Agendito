import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { GlassSurface } from "@/components/ui";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import type { ReactNode } from "react";

export function AuthLayout({ children, eyebrow, title, description, backHref = "/", backLabel = "Voltar ao início", compact = false }: { children: ReactNode; eyebrow: string; title: string; description: string; backHref?: string; backLabel?: string; compact?: boolean }) {
  return (
    <main className={`auth-shell${compact ? " auth-shell-compact" : ""}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="auth-grid">
        <section className="auth-intro">
          <Link href={backHref} className="auth-brand" aria-label="Agendito — início"><AgenditoLogo size="large" priority /></Link>
          <div className="auth-intro-copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
          <div className="auth-note"><Sparkles size={16} /><span>Uma experiência simples para cada horário importante.</span></div>
        </section>
        <section className="auth-form-column"><Link href={backHref} className="auth-back"><ArrowLeft size={15} /> {backLabel}</Link><GlassSurface material="thick" depth="raised" className="auth-card">{children}</GlassSurface></section>
      </div>
    </main>
  );
}
