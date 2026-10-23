import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import type { UserRole } from "@/types";
import { GlassButton, GlassSurface } from "@/components/ui";
import { PROFILE_LABEL, profileHomePath } from "@/features/auth/capabilities";

export function AccessDeniedState({ role, message }: { role: UserRole; message?: string }) {
  return (
    <main className="auth-guard-state">
      <GlassSurface material="frosted" className="auth-guard-card" role="region" aria-labelledby="access-denied-title">
        <span className="eyebrow">Acesso não permitido</span>
        <h1 id="access-denied-title">Esta área não pertence ao seu perfil.</h1>
        <p>{message ?? `Você está acessando como ${PROFILE_LABEL[role]}. Entre no ambiente correspondente ao seu perfil para continuar.`}</p>
        <div className="auth-guard-actions">
          <GlassButton asChild variant="primary"><Link href={profileHomePath(role)}><ArrowLeft size={16} /> Ir para meu ambiente</Link></GlassButton>
          <GlassButton asChild variant="quiet"><Link href="/login"><UserRound size={16} /> Trocar de perfil</Link></GlassButton>
        </div>
      </GlassSurface>
    </main>
  );
}
