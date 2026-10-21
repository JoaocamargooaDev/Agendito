"use client";

import Link from "next/link";
import { KeyRound, UserRound } from "lucide-react";
import { GlassPopover } from "@/components/ui";
import { LogoutButton } from "@/components/auth";
import type { AuthUser } from "@/features/auth";

export function AdminProfileMenu({ user }: { user: AuthUser }) {
  return <GlassPopover label="Menu do perfil" align="end" trigger={<span className="profile-trigger"><UserRound size={18} aria-hidden /><span className="sr-only">Abrir menu do usuário</span></span>}><div className="profile-menu-heading"><span className="user-avatar user-avatar-large">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div><div className="profile-menu-role"><UserRound size={14} /> Administrador do estabelecimento</div><Link className="profile-menu-link" href="/settings"><UserRound size={15} /> Preferências</Link><Link className="profile-menu-link" href="/settings/access"><KeyRound size={15} /> Alterar senha</Link><LogoutButton redirectTo="/login" /></GlassPopover>;
}
