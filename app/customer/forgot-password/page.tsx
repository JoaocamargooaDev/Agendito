import { AuthLayout } from "@/components/auth";
import { PasswordResetForm } from "@/features/auth/components";

export default function CustomerForgotPasswordPage() {
  return <AuthLayout eyebrow="Área do cliente" title="Recupere seu acesso." description="A confirmação não revela se o e-mail existe e nenhum e-mail real será enviado."><PasswordResetForm context="CUSTOMER" /></AuthLayout>;
}
