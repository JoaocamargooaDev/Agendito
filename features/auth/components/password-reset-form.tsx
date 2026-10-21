"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { GlassButton, GlassInput } from "@/components/ui";
import { AuthFeedback } from "@/components/auth";
import { useAuth, type AuthContext } from "@/features/auth";

export function PasswordResetForm({ context }: { context: AuthContext }) {
  const { requestPasswordReset } = useAuth(); const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setSuccess(""); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Informe um e-mail válido."); return; } setLoading(true); const result = await requestPasswordReset(email, context); setLoading(false); if (result.ok) setSuccess(result.message); else setError(result.message); }
  const loginPath = "/login";
  return <form className="auth-form" onSubmit={submit} noValidate><div className="auth-card-heading"><span className="eyebrow">Recuperação de acesso</span><h2>Vamos ajudar você</h2><p>Informe seu e-mail para verificar as opções de recuperação.</p></div>{error && <AuthFeedback tone="error">{error}</AuthFeedback>}{success && <AuthFeedback tone="success">{success}</AuthFeedback>}<GlassInput label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" leadingIcon={<Mail size={16} />} required /><GlassButton type="submit" variant="primary" size="lg" loading={loading} className="auth-submit">Solicitar instruções <ArrowRight size={17} /></GlassButton><Link className="auth-inline-link" href={loginPath}><ArrowLeft size={15} /> Voltar para o login</Link></form>;
}
