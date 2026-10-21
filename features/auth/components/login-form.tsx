"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { GlassButton, GlassInput } from "@/components/ui";
import { getReturnPathFromLocation, useAuth, type AuthContext } from "@/features/auth";
import { PasswordField } from "@/components/auth";
import { AuthFeedback } from "@/components/auth";

export function LoginForm({ context }: { context: AuthContext }) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [remember, setRemember] = useState(true);
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [submitting, setSubmitting] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!email.trim() || !password) { setError("Preencha e-mail e senha para continuar."); return; }
    setSubmitting(true); await new Promise((resolve) => setTimeout(resolve, 420));
    const result = await login(email, password, context, remember); setSubmitting(false);
    if (!result.ok) { setError(result.message); return; }
    setSuccess("Acesso realizado. Redirecionando…");
    const fallback = result.user.role === "PLATFORM_ADMIN" ? "/platform/establishments" : result.user.role === "ADMIN" ? "/dashboard" : result.user.role === "EMPLOYEE" ? "/employee" : "/customer";
    const requested = getReturnPathFromLocation(fallback);
    const allowedReturn = result.user.role === "PLATFORM_ADMIN" ? requested.startsWith("/platform/") : result.user.role === "ADMIN" ? ["/dashboard", "/agenda", "/customers", "/employees", "/services", "/settings"].some((path) => requested === path || requested.startsWith(`${path}/`)) : result.user.role === "EMPLOYEE" ? requested.startsWith("/employee") : requested.startsWith("/customer") || requested.startsWith("/e/");
    router.replace(allowedReturn ? requested : fallback);
  }

  return <form className="auth-form" onSubmit={handleSubmit} noValidate>
    <div className="auth-card-heading"><span className="eyebrow">{context === "UNIFIED" ? "Acesso único" : context === "CUSTOMER" ? "Área do cliente" : "Acesso profissional"}</span><h2>Entrar no Agendito</h2><p>{context === "CUSTOMER" ? "Acesse sua conta para continuar." : "Informe seus dados para continuar."}</p></div>
    {error && <AuthFeedback tone="error">{error}</AuthFeedback>}{success && <AuthFeedback tone="success">{success}</AuthFeedback>}
    <GlassInput label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" leadingIcon={<Mail size={16} />} required />
    <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" required />
    <div className="auth-form-row"><label className="check-control"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> <span>Lembrar acesso</span></label><Link href="/forgot-password">Esqueci minha senha</Link></div>
    <GlassButton type="submit" variant="primary" size="lg" loading={submitting} className="auth-submit">Entrar <ArrowRight size={17} /></GlassButton>
    {(context === "CUSTOMER" || context === "UNIFIED") && <p className="auth-switch">Ainda não possui conta? <Link href="/customer/register">Criar conta de cliente</Link></p>}
  </form>;
}
