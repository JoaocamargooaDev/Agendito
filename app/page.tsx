import Link from "next/link";
import { ArrowRight, Building2, CalendarDays } from "lucide-react";
import { AgenditoLogo } from "@/components/brand/agendito-logo";

const destinations = [
  {
    href: "/login",
    icon: Building2,
    title: "Entrar no Agendito",
    description: "Acesse sua área administrativa ou sua conta de cliente.",
    label: "Entrar",
  },
  {
    href: "/customer/register",
    icon: CalendarDays,
    title: "Criar conta de cliente",
    description: "Cadastre-se para acompanhar seus agendamentos.",
    label: "Criar conta",
  },
];

export default function Home() {
  return (
    <main className="entry-page">
      <div className="entry-orbit entry-orbit-one" aria-hidden />
      <div className="entry-orbit entry-orbit-two" aria-hidden />
      <div className="entry-layout">
        <header className="entry-header">
          <span className="entry-brand"><AgenditoLogo size="medium" priority /></span>
        </header>
        <section className="entry-intro" aria-labelledby="entry-title">
          <span className="eyebrow">Uma plataforma, muitos espaços</span>
          <h1 id="entry-title">Agendamentos com tudo no lugar.</h1>
          <p>Escolha por onde começar. Cada pessoa encontra aqui o acesso certo para seu dia.</p>
        </section>
        <nav className="entry-destinations" aria-label="Escolha seu acesso">
          {destinations.map(({ href, icon: Icon, title, description, label }) => (
            <Link href={href} className="entry-destination" key={href}>
              <span className="entry-destination-icon"><Icon size={21} strokeWidth={1.8} aria-hidden /></span>
              <span className="entry-destination-copy"><strong>{title}</strong><small>{description}</small></span>
              <span className="entry-destination-action">{label}<ArrowRight size={16} aria-hidden /></span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
