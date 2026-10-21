import { AuthLayout } from "@/components/auth";
import { LoginForm } from "@/features/auth/components";

export default function LoginPage() {
  return <AuthLayout eyebrow="Um único acesso" title="Cada perfil no lugar certo." description="Administrador geral, gestor do estabelecimento e cliente entram pela mesma tela."><LoginForm context="UNIFIED" /></AuthLayout>;
}
