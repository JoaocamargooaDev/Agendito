"use client";

import { LogOut } from "lucide-react";
import { GlassButton } from "@/components/ui";
import { useAuth } from "@/features/auth";

export function LogoutButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const { logout } = useAuth();
  // A full reload ensures protected-route effects cannot race the local session cleanup.
  return <GlassButton variant="ghost" onClick={() => { logout(); /* Full reload avoids the protected-route effect racing the logout navigation. */ window.location.assign(redirectTo); }}><LogOut size={16} /> Encerrar sessão</GlassButton>;
}
