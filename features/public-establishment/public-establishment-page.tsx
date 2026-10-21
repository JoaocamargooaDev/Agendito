"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Instagram, MapPin, Menu, Phone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GlassButton, GlassSurface } from "@/components/ui";
import { listEmployees } from "@/features/employees";
import { listServices } from "@/features/services";
import { formatCurrency } from "@/lib/utils";
import { getEstablishmentSettings } from "@/features/settings/repository";
import type { Establishment } from "@/types";

function initials(value: string) {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 2);
}
function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function PublicHeader({ establishment, compact }: { establishment: Establishment; compact: boolean }) {
  const [open, setOpen] = useState(false);
  return <header className={`public-header ${compact ? "public-header-compact" : ""}`}>
    <div className="public-glass-bar">
      <Link href={`/e/${establishment.slug}`} className="public-brand">
        <span className="public-brand-mark">{establishment.logoUrl ? <img src={establishment.logoUrl} alt="" /> : initials(establishment.name)}</span>
        <span>{establishment.name}</span>
      </Link>
      <nav className={`public-nav ${open ? "is-open" : ""}`} aria-label="Navegação pública">
        <a href="#services" onClick={() => setOpen(false)}>Serviços</a>
        <a href="#professionals" onClick={() => setOpen(false)}>Profissionais</a>
        <a href="#hours" onClick={() => setOpen(false)}>Funcionamento</a>
        <a href="#contact" onClick={() => setOpen(false)}>Localização</a>
      </nav>
      <div className="public-header-actions">
        <GlassButton asChild variant="primary" size="sm"><Link href={`/e/${establishment.slug}/booking`}>Agendar horário</Link></GlassButton>
        <GlassButton variant="quiet" size="icon" className="public-menu-button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </GlassButton>
      </div>
    </div>
  </header>;
}

function StoreProfile({ establishment }: { establishment: Establishment }) {
  const location = [establishment.address.city, establishment.address.district].filter(Boolean).join(" · ");
  return <section className="store-profile" aria-labelledby="store-title">
    <div className="store-cover" role="img" aria-label={establishment.coverUrl ? `Capa de ${establishment.name}` : `Capa ilustrativa de ${establishment.name}`} style={establishment.coverUrl ? { backgroundImage: `url("${establishment.coverUrl}")` } : undefined} />
    <div className="store-avatar" role="img" aria-label={`Foto ou logo de ${establishment.name}`}>
      {establishment.logoUrl ? <img src={establishment.logoUrl} alt="" /> : <span>{initials(establishment.name)}</span>}
    </div>
    <div className="store-profile-copy">
      <span className="eyebrow">Estabelecimento no Agendito</span>
      <h1 id="store-title">{establishment.name}</h1>
      <p>{establishment.description || "Conheça os serviços e escolha seu horário."}</p>
      {location && <span className="store-location"><MapPin size={16} aria-hidden />{location}</span>}
      <GlassButton asChild variant="primary" size="lg"><Link href={`/e/${establishment.slug}/booking`}>Agendar horário <ArrowRight size={16} /></Link></GlassButton>
    </div>
  </section>;
}

export function PublicEstablishmentPage({ establishment }: { establishment: Establishment }) {
  const [compact, setCompact] = useState(false);
  const serviceList = useMemo(() => listServices(establishment.id).filter((service) => service.active), [establishment.id]);
  const employeeList = useMemo(() => listEmployees(establishment.id).filter((employee) => employee.active), [establishment.id]);
  const instagram = safeExternalUrl(establishment.instagram);
  const businessHours = useMemo(() => getEstablishmentSettings(establishment.id).businessHours, [establishment.id]);
  const address = [
    [establishment.address.street, establishment.address.number].filter(Boolean).join(", "),
    establishment.address.district,
    [establishment.address.city, establishment.address.state].filter(Boolean).join(" - "),
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    const handler = () => setCompact(window.scrollY > 40);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return <main className="public-page">
    <PublicHeader establishment={establishment} compact={compact} />
    <StoreProfile establishment={establishment} />
    <div className="public-content">
      <section id="services" className="public-section">
        <div className="public-section-heading"><div><span className="eyebrow">Catálogo</span><h2>Serviços</h2></div><span>{serviceList.length} disponíveis</span></div>
        {serviceList.length ? <div className="public-services">{serviceList.map((service) => <article className="public-service-row" key={service.id}>
          <div><h3>{service.name}</h3><p>{service.description || "Atendimento personalizado."}</p><small><Clock3 size={14} />{service.durationMinutes} minutos</small></div>
          <strong>{formatCurrency(service.priceInCents)}</strong>
          <GlassButton asChild variant="quiet" size="sm"><Link href={`/e/${establishment.slug}/booking`}>Agendar <ArrowRight size={14} /></Link></GlassButton>
        </article>)}</div> : <GlassSurface material="frosted" className="public-empty">Nenhum serviço disponível no momento.</GlassSurface>}
      </section>
      <section id="professionals" className="public-section">
        <div className="public-section-heading"><div><span className="eyebrow">Quem atende</span><h2>Profissionais</h2></div></div>
        {employeeList.length ? <div className="public-professionals">{employeeList.map((employee) => {
          const employeeServices = serviceList.filter((service) => employee.serviceIds.includes(service.id));
          return <article className="public-professional" key={employee.id}>
            <div className="public-professional-avatar">{employee.photoUrl ? <span role="img" aria-label={`Foto de ${employee.displayName}`} style={{ backgroundImage: `url(${employee.photoUrl})` }} /> : initials(employee.displayName)}</div>
            <h3>{employee.displayName}</h3><span>{employee.title || "Profissional"}</span><p>{employee.bio}</p>
            {employeeServices.length ? <small>{employeeServices.map((service) => service.name).join(" · ")}</small> : <small>Serviços em atualização</small>}
            <GlassButton asChild variant="quiet" size="sm"><Link href={`/e/${establishment.slug}/booking`}>Agendar com {employee.displayName.split(" ")[0]}</Link></GlassButton>
          </article>;
        })}</div> : <GlassSurface material="frosted" className="public-empty">Nenhum profissional disponível no momento.</GlassSurface>}
      </section>
      <section id="hours" className="public-section public-info-section">
        <div className="public-section-heading"><div><span className="eyebrow">Visite</span><h2>Funcionamento</h2></div></div>
        <GlassSurface material="frosted" className="public-hours">{businessHours.some((day) => day.open) ? <dl>{businessHours.map((day) => <div key={day.weekday}><dt>{["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][day.weekday]}</dt><dd>{day.open && day.intervals.length ? day.intervals.map((range) => `${range.start}–${range.end}`).join(" · ") : "Fechado"}</dd></div>)}</dl> : <><p>O horário geral do estabelecimento ainda não foi configurado.</p><span>Consulte a disponibilidade ao iniciar um agendamento.</span></>}</GlassSurface>
      </section>
      <section id="contact" className="public-section public-info-section">
        <div className="public-section-heading"><div><span className="eyebrow">Encontre o espaço</span><h2>Localização e contato</h2></div></div>
        <div className="public-contact-grid">
          <GlassSurface material="frosted"><MapPin size={18} /><h3>Endereço</h3><p>{address || "Endereço ainda não informado."}</p>{address && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}>Abrir no mapa <ArrowRight size={14} /></a>}</GlassSurface>
          <GlassSurface material="frosted"><Phone size={18} /><h3>Telefone</h3><p>{establishment.phone || "Telefone não informado"}</p>{establishment.phone && <a href={`tel:${establishment.phone.replace(/\D/g, "")}`}>Ligar para o estabelecimento <ArrowRight size={14} /></a>}</GlassSurface>
          {instagram && <GlassSurface material="frosted"><Instagram size={18} /><h3>Instagram</h3><p>Acompanhe o estabelecimento.</p><a target="_blank" rel="noreferrer" href={instagram}>Abrir perfil <ArrowRight size={14} /></a></GlassSurface>}
        </div>
      </section>
      <section id="booking-intent" className="public-booking-intent">
        <GlassSurface material="thick"><div><span className="eyebrow">Agendamento</span><h2>Escolha seu próximo horário.</h2><p>Consulte serviços, profissionais e horários disponíveis.</p></div><GlassButton asChild variant="primary"><Link href={`/e/${establishment.slug}/booking`}><CalendarDays size={16} />Iniciar agendamento</Link></GlassButton></GlassSurface>
      </section>
    </div>
    <footer className="public-footer"><span>Agendito</span><span>Uma experiência centralizada para cada estabelecimento.</span></footer>
  </main>;
}
