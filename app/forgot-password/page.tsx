import { AuthLayout } from "@/components/auth";
import { PasswordResetForm } from "@/features/auth/components";

export default function ForgotPasswordPage() {
  return <AuthLayout eyebrow="Acesso profissional" title="Recupere seu acesso." description="Consulte as opções disponíveis para recuperar seu acesso."><PasswordResetForm context="ADMIN" /></AuthLayout>;
}
