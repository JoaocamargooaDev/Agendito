import { AuthLayout } from "@/components/auth";
import { LoginForm } from "@/features/auth/components";

export default function LoginPage() {
  return <AuthLayout compact eyebrow="Um único acesso" title="Cada perfil no lugar certo." description="Login único | Tudo em só lugar | Seus dados seguros"><LoginForm context="UNIFIED" showTestProfiles={process.env.NODE_ENV !== "production"} /></AuthLayout>;
}
