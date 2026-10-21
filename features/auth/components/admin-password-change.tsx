"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin";
import { PasswordField } from "@/components/auth";
import { GlassButton, GlassSurface } from "@/components/ui";
import { useAuth } from "@/features/auth";

export function AdminPasswordChange() {
  const { user, changeAdminPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setError("");
    if (newPassword !== confirmation) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    setSaving(true);
    const result = await changeAdminPassword(currentPassword, newPassword);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setFeedback("Senha alterada neste navegador. Use a nova senha no próximo acesso.");
  }

  return <AdminPageContainer>
    <AdminPageHeader eyebrow="Conta do gestor" title="Acesso" description="Seu e-mail de acesso é definido pelo proprietário do Agendito. Você pode trocar sua senha após entrar." />
    <GlassSurface material="frosted" className="access-panel">
      <div className="access-panel-heading"><KeyRound size={20} /><div><h2>Alterar senha</h2><p>Conta: <strong>{user?.email}</strong></p></div></div>
      <form className="access-form" onSubmit={submit}>
        <PasswordField label="Senha atual" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        <PasswordField label="Nova senha" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" hint="Pelo menos 10 caracteres, uma letra maiúscula e um número." required />
        <PasswordField label="Confirmar nova senha" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
        {error && <p className="form-error" role="alert">{error}</p>}
        {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
        <div className="access-actions"><GlassButton asChild variant="quiet"><Link href="/settings">Voltar</Link></GlassButton><GlassButton type="submit" variant="primary" loading={saving}>Salvar nova senha</GlassButton></div>
      </form>
    </GlassSurface>
  </AdminPageContainer>;
}
