import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, CalendarDays, Clock3, Scissors, UserRound } from "lucide-react";
import { AgenditoLogo } from "@/components/brand/agendito-logo";
import { ImageReveal } from "@/components/ui/image-reveal";
import styles from "./page.module.css";

const destinations = [
  {
    href: "/booking",
    icon: CalendarDays,
    title: "Agendar atendimento",
    description: "Encontre um estabelecimento e consulte os horários disponíveis.",
    label: "Agendar",
  },
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
    <main className={`entry-page ${styles.page}`}>
      <div className="entry-orbit entry-orbit-one" aria-hidden />
      <div className="entry-orbit entry-orbit-two" aria-hidden />
      <div className={`entry-layout ${styles.layout}`}>
        <section className={styles.hero} aria-labelledby="entry-title">
          <span className={styles.heroBrand} data-content-reveal data-reveal-delay="0">
            <AgenditoLogo size="large" sizes="(max-width: 679px) 78vw, 460px" priority />
          </span>
          <div className={styles.heroCopy} data-content-reveal data-reveal-delay="20">
            <section className={`entry-intro ${styles.intro}`}>
              <span className="eyebrow">Uma plataforma, muitos espaços</span>
              <h1 id="entry-title">Agendamentos com tudo no lugar.</h1>
              <p>Escolha por onde começar. Cada pessoa encontra aqui o acesso certo para seu dia.</p>
            </section>
            <nav className={`entry-destinations ${styles.destinations}`} aria-label="Escolha seu acesso">
              {destinations.map(({ href, icon: Icon, title, description, label }) => (
                <Link href={href} className={`entry-destination ${styles.destination}`} key={href}>
                  <span className="entry-destination-icon"><Icon size={21} strokeWidth={1.8} aria-hidden /></span>
                  <span className="entry-destination-copy"><strong>{title}</strong><small>{description}</small></span>
                  <span className="entry-destination-action">{label}<ArrowRight size={16} aria-hidden /></span>
                </Link>
              ))}
            </nav>
          </div>
          <div className={styles.heroVisual}>
            <ImageReveal className={styles.heroPhoto} delayMs={40}>
              <Image
                src="/images/agendito/hero-agendamento.jpg"
                alt="Cliente e profissional de salão consultam um horário em um tablet na recepção."
                fill
                preload
                sizes="(max-width: 760px) 100vw, (max-width: 1200px) 48vw, 46vw"
                className={styles.photo}
              />
            </ImageReveal>

            <aside className={styles.floatingSchedule} aria-hidden="true">
              <span className={styles.previewLabel}><CalendarDays size={14} />Prévia de horários</span>
              <div className={styles.previewSlots}><span>09:00</span><span>10:30</span><span>14:00</span></div>
            </aside>

            <aside className={styles.floatingService} aria-hidden="true">
              <span className={styles.previewServiceIcon}><Scissors size={16} /></span>
              <span className={styles.previewServiceCopy}><strong>Serviço de barba</strong><small><Clock3 size={12} />30 min <i /> R$ 50,00</small><small><UserRound size={12} />Funcionário Agendito</small></span>
            </aside>
          </div>
        </section>

        <section className={styles.features} aria-labelledby="entry-features-title">
          <header className={styles.featuresHeading} data-content-reveal>
            <span className="eyebrow">Para clientes e equipes</span>
            <h2 id="entry-features-title">Da escolha do horário ao atendimento.</h2>
          </header>

          <div className={styles.featureList}>
            <article className={styles.feature}>
              <ImageReveal className={styles.featurePhoto} delayMs={20}>
                <Image src="/images/agendito/agendamento-com-profissional.jpg" alt="Profissional mostra opções de horário em um tablet para a cliente." fill sizes="(max-width: 760px) 100vw, 46vw" className={styles.photo} />
              </ImageReveal>
              <div className={styles.featureCopy} data-content-reveal data-reveal-delay="0">
                <span className={styles.featureIndex}>01 · Agendamento público</span>
                <h3>Uma reserva simples, passo a passo.</h3>
                <p>O cliente escolhe o estabelecimento, o serviço, o profissional, a data e o horário disponíveis antes de revisar e confirmar.</p>
              </div>
            </article>

            <article className={`${styles.feature} ${styles.featureReverse}`}>
              <ImageReveal className={styles.featurePhoto} delayMs={20}>
                <Image src="/images/agendito/agenda-equipe.jpg" alt="Profissional organiza os horários do salão usando uma agenda e um tablet." fill sizes="(max-width: 760px) 100vw, 46vw" className={styles.photo} />
              </ImageReveal>
              <div className={styles.featureCopy} data-content-reveal data-reveal-delay="0">
                <span className={styles.featureIndex}>02 · Agenda da equipe</span>
                <h3>Compromissos e disponibilidade organizados.</h3>
                <p>Acompanhe os agendamentos por profissional e mantenha os horários alinhados à disponibilidade da equipe.</p>
              </div>
            </article>

            <article className={styles.feature}>
              <ImageReveal className={styles.featurePhoto} delayMs={20}>
                <Image src="/images/agendito/atendimento-barbearia.jpg" alt="Barbeiro atende um cliente em uma barbearia moderna." fill sizes="(max-width: 760px) 100vw, 46vw" className={styles.photo} />
              </ImageReveal>
              <div className={styles.featureCopy} data-content-reveal data-reveal-delay="0">
                <span className={styles.featureIndex}>03 · Página pública</span>
                <h3>Serviços e profissionais apresentados com clareza.</h3>
                <p>Mostre o catálogo e a equipe do estabelecimento e conduza o cliente até o fluxo de agendamento.</p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
