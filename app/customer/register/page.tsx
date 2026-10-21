import { AuthLayout } from "@/components/auth";
import { CustomerRegistrationForm } from "@/features/auth/components";

export default function CustomerRegisterPage() {
  return <AuthLayout eyebrow="Cadastro de cliente" title="Um só acesso, vários lugares." description="Crie sua conta para acompanhar e preparar seus próximos horários."><CustomerRegistrationForm /></AuthLayout>;
}
