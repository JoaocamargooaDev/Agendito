"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Mail, Phone, UserRound } from "lucide-react";
import { GlassButton, GlassInput } from "@/components/ui";
import { AuthFeedback, PasswordField } from "@/components/auth";
import { useAuth, getReturnPathFromLocation } from "@/features/auth";

function formatPhone(value: string) { return value.replace(/\D/g, "").slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2"); }

export function CustomerRegistrationForm() {
  const { registerCustomer } = useAuth(); const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirmPassword: "" }); const [terms, setTerms] = useState(false); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Informe um e-mail válido.";
    if (form.phone.replace(/\D/g, "").length < 10) errors.phone = "Informe um telefone válido.";
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) errors.password = "Use 8 caracteres, uma letra maiúscula e um número.";
    if (form.password !== form.confirmPassword) errors.confirmPassword = "As senhas precisam ser iguais.";
    if (!terms) errors.terms = "Aceite os termos para criar sua conta.";
    setFieldErrors(errors); if (Object.keys(errors).length) return;
    setSubmitting(true); await new Promise((resolve) => setTimeout(resolve, 450));
    const result = await registerCustomer({ name: form.name.trim(), phone: form.phone, email: form.email, password: form.password }, true); setSubmitting(false);
    if (!result.ok) { setError(result.message); return; }
    router.replace(getReturnPathFromLocation("/customer"));
  }
  return <form className="auth-form" onSubmit={handleSubmit} noValidate>
    <div className="auth-card-heading"><span className="eyebrow">Conta global</span><h2>Crie seu espaço</h2><p>Uma única conta para visitar diferentes estabelecimentos.</p></div>
    {error && <AuthFeedback tone="error">{error}</AuthFeedback>}
    <GlassInput label="Nome completo" autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} error={fieldErrors.name} placeholder="Como podemos chamar você?" leadingIcon={<UserRound size={16} />} required />
    <GlassInput label="Telefone / WhatsApp" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", formatPhone(event.target.value))} error={fieldErrors.phone} placeholder="(11) 99999-0000" leadingIcon={<Phone size={16} />} required />
    <GlassInput label="E-mail" type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} error={fieldErrors.email} placeholder="voce@exemplo.com" leadingIcon={<Mail size={16} />} required />
    <PasswordField label="Senha" autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} error={fieldErrors.password} placeholder="Crie uma senha segura" required hint="Mínimo de 8 caracteres, com uma maiúscula e um número." />
    <PasswordField label="Confirmar senha" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} error={fieldErrors.confirmPassword} placeholder="Repita sua senha" required />
    <label className="check-control terms-control"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /> <span>Li e aceito os termos de uso.</span></label>{fieldErrors.terms && <span className="field-message field-message-error">{fieldErrors.terms}</span>}
    <GlassButton type="submit" variant="primary" size="lg" loading={submitting} className="auth-submit">Criar conta <ArrowRight size={17} /></GlassButton>
    <p className="auth-switch">Já possui uma conta? <Link href="/login">Entrar</Link></p>
  </form>;
}
