"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Instagram, MapPin, Menu, Phone, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { GlassButton, GlassSurface } from "@/components/ui";
import type { EstablishmentOperationalData, PageDesignConfig } from "@/types";
import { formatCurrency } from "@/lib/utils";
import type { Establishment } from "@/types";
import { getPublicThemeTokens, isPublicThemeDark } from "./theme";

type EstablishmentPublicProfile = Pick<Establishment, "id" | "name" | "slug" | "description" | "logoUrl" | "coverUrl" | "phone" | "instagram" | "address">;

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

const fallbackSections = ["hero", "about", "services", "professionals", "gallery", "hours", "location", "contact", "faq", "policies", "booking", "footer"] as const;

function PublicHeader({ establishment, config, compact, bookingAllowed }: { establishment: EstablishmentPublicProfile; config: PageDesignConfig | null; compact: boolean; bookingAllowed: boolean }) {
  const [open, setOpen] = useState(false);
  const sections = config?.sections?.filter((section) => section.visible).map((section) => section.id) ?? [...fallbackSections];
  const sectionLabels: Record<string, string> = { services: "Serviços", professionals: "Profissionais", hours: "Funcionamento", location: "Localização", gallery: "Galeria", faq: "Dúvidas", policies: "Políticas" };
  const links = ["services", "professionals", "hours", "location", "gallery", "faq", "policies"].filter((id) => sections.includes(id as typeof fallbackSections[number]));
  return <header className={`public-header ${compact ? "public-header-compact" : ""}`}>
    <div className="public-glass-bar">
      <Link href={`/e/${establishment.slug}`} className="public-brand">
        <span className="public-brand-mark">{(config?.logoUrl ?? establishment.logoUrl) ? <img src={config?.logoUrl ?? establishment.logoUrl} alt="" /> : initials(config?.publicName || establishment.name)}</span>
        <span>{config?.publicName || establishment.name}</span>
      </Link>
      <nav className={`public-nav ${open ? "is-open" : ""}`} aria-label="Navegação pública">
        {links.map((id) => <a href={`#${id}`} onClick={() => setOpen(false)} key={id}>{sectionLabels[id]}</a>)}
      </nav>
      <div className="public-header-actions">
        {bookingAllowed && <GlassButton asChild variant="primary" size="sm"><Link href={`/e/${establishment.slug}/booking`}>{config?.bookingButtonLabel || "Agendar horário"}</Link></GlassButton>}
        <GlassButton variant="quiet" size="icon" className="public-menu-button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </GlassButton>
      </div>
    </div>
  </header>;
}

function StoreProfile({ establishment, config, bookingAllowed, hasServices, style }: { establishment: EstablishmentPublicProfile; config: PageDesignConfig | null; bookingAllowed: boolean; hasServices: boolean; style?: CSSProperties }) {
  const location = [establishment.address.city, establishment.address.district].filter(Boolean).join(" · ");
  const title = config?.heroTitle || establishment.name;
  const subtitle = config?.heroSubtitle || establishment.description;
  const coverUrl = config?.coverUrl ?? establishment.coverUrl;
  const logoUrl = config?.logoUrl ?? establishment.logoUrl;
  return <section className="store-profile" aria-labelledby="store-title" style={style}>
    <div className="store-cover" role="img" aria-label={coverUrl ? `Capa de ${establishment.name}` : `Capa ilustrativa de ${establishment.name}`} style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined} />
    <div className="store-avatar" role="img" aria-label={`Foto ou logo de ${establishment.name}`}>
      {logoUrl ? <img src={logoUrl} alt="" /> : <span>{initials(establishment.name)}</span>}
    </div>
    <div className="store-profile-copy">
      <span className="eyebrow">{config?.publicName || "Estabelecimento no Agendito"}</span>
      <h1 id="store-title">{title}</h1>
      <p>{subtitle || "Conheça os serviços e escolha seu horário."}</p>
      {location && <span className="store-location"><MapPin size={16} aria-hidden />{location}</span>}
      {bookingAllowed && hasServices ? <GlassButton asChild variant="primary" size="lg"><Link href={`/e/${establishment.slug}/booking`}>{config?.bookingButtonLabel || "Agendar horário"} <ArrowRight size={16} /></Link></GlassButton> : bookingAllowed ? <a className="public-contact-cta" href={establishment.phone ? `tel:${establishment.phone.replace(/\D/g, "")}` : "#contact"}>{establishment.phone ? "Fale com a barbearia" : "Ver contato do estabelecimento"} <ArrowRight size={16} /></a> : <p className="public-booking-unavailable">Agendamentos temporariamente indisponíveis.</p>}
    </div>
  </section>;
}

export function PublicPageRenderer({ establishment, config = null, operationalData, bookingAllowed = true, preview = false }: { establishment: EstablishmentPublicProfile; config?: PageDesignConfig | null; operationalData?: EstablishmentOperationalData; bookingAllowed?: boolean; preview?: boolean }) {
  const [compact, setCompact] = useState(false);
  const activeConfig = config;
  const serviceList = operationalData?.services.slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)) ?? [];
  const hasPublicServices = serviceList.length > 0;
  const canBook = bookingAllowed && !preview && hasPublicServices;
  const employeeList = operationalData?.professionals ?? [];
  const businessHours = operationalData?.businessHours ?? [];
  const instagram = safeExternalUrl(establishment.instagram);
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

  const visibleSections = activeConfig?.sections?.filter((section) => section.visible) ?? fallbackSections.map((id) => ({ id, visible: true, title: "", description: "", layout: "default" as const }));
  const section = (id: string) => visibleSections.find((item) => item.id === id);
  const sectionOrder = (id: string) => Math.max(0, visibleSections.findIndex((item) => item.id === id));
  const sectionDescription = (id: string) => section(id)?.description;
  const sectionTitle = (id: string, fallback: string) => section(id)?.title || fallback;
  const pageStyle = getPublicThemeTokens(activeConfig) as CSSProperties;

  return <main className={`public-page${preview ? " public-page-preview" : ""}`} data-public-tone={isPublicThemeDark(activeConfig) ? "dark" : "light"} data-public-template={activeConfig?.template ?? "editorial"} data-public-palette={activeConfig?.palette ?? "moss"} data-public-cards={activeConfig?.cardStyle ?? "glass"} data-public-font={activeConfig?.typography ?? "modern"} data-public-spacing={activeConfig?.sectionSpacing ?? "comfortable"} style={pageStyle}>
    <PublicHeader establishment={establishment} config={activeConfig} compact={compact} bookingAllowed={canBook} />
    {section("hero") && <StoreProfile establishment={establishment} config={activeConfig} bookingAllowed={bookingAllowed && !preview} hasServices={hasPublicServices} style={{ order: sectionOrder("hero") }} />}
    <div className="public-content" style={{ display: "contents" }}>
      {section("about") && <section className="public-section public-about-section" data-layout={section("about")?.layout} style={{ order: sectionOrder("about") }}><div className="public-section-heading"><div><span className="eyebrow">Sobre o espaço</span><h2>{sectionTitle("about", "Conheça o estabelecimento")}</h2><p>{sectionDescription("about")}</p></div></div><GlassSurface material="frosted" className="public-about-copy"><p>{activeConfig?.aboutText || establishment.description}</p></GlassSurface></section>}
      {section("services") && <section id="services" className="public-section" data-layout={section("services")?.layout} style={{ order: sectionOrder("services") }}>
        <div className="public-section-heading"><div><span className="eyebrow">Catálogo</span><h2>{sectionTitle("services", "Serviços")}</h2><p>{sectionDescription("services")}</p></div>{!preview && <span>{serviceList.length} disponíveis</span>}</div>
        {serviceList.length ? <div className="public-services">{serviceList.map((service) => <article className="public-service-row" key={service.id}>
          {service.imageUrl && <img className="public-service-image" src={service.imageUrl} alt="" loading="lazy" />}
          <div className="public-service-copy"><h3>{service.name}</h3><p>{service.description || "Atendimento personalizado."}</p>{activeConfig?.showDurations !== false && <small><Clock3 size={14} />{service.durationMinutes} minutos</small>}</div>
          {activeConfig?.showPrices !== false && <strong>{formatCurrency(service.priceInCents)}</strong>}
          {canBook && <GlassButton asChild variant="quiet" size="sm"><Link href={`/e/${establishment.slug}/booking?service=${encodeURIComponent(service.id)}`}>{activeConfig?.bookingButtonLabel || "Agendar"} <ArrowRight size={14} /></Link></GlassButton>}
        </article>)}</div> : <GlassSurface material="frosted" className="public-empty"><strong>A agenda online está sendo preparada.</strong><span>Enquanto isso, fale diretamente com o estabelecimento para consultar os serviços e horários.</span>{establishment.phone && <a href={`tel:${establishment.phone.replace(/\D/g, "")}`}>Ligar para {establishment.phone}</a>}</GlassSurface>}
      </section>}
      {section("professionals") && <section id="professionals" className="public-section" data-layout={section("professionals")?.layout} style={{ order: sectionOrder("professionals") }}>
        <div className="public-section-heading"><div><span className="eyebrow">Quem atende</span><h2>{sectionTitle("professionals", "Profissionais")}</h2><p>{sectionDescription("professionals")}</p></div></div>
        {employeeList.length ? <div className="public-professionals">{employeeList.map((employee) => {
          const employeeServices = serviceList.filter((service) => employee.serviceIds.includes(service.id));
          return <article className="public-professional" key={employee.id}>
            <div className="public-professional-avatar">{employee.photoUrl ? <span role="img" aria-label={`Foto de ${employee.displayName}`} style={{ backgroundImage: `url(${employee.photoUrl})` }} /> : initials(employee.displayName)}</div>
            <h3>{employee.displayName}</h3><span>{employee.title || "Profissional"}</span><p>{employee.bio}</p>
            {employeeServices.length ? <small>{employeeServices.map((service) => service.name).join(" · ")}</small> : <small>Serviços em atualização</small>}
            {canBook && <GlassButton asChild variant="quiet" size="sm"><Link href={`/e/${establishment.slug}/booking`}>Agendar com {employee.displayName.split(" ")[0]}</Link></GlassButton>}
          </article>;
        })}</div> : <GlassSurface material="frosted" className="public-empty"><strong>Estamos atualizando a apresentação da equipe.</strong><span>Você poderá conhecer os profissionais e escolher com quem agendar em breve.</span></GlassSurface>}
      </section>}
      {section("gallery") && (activeConfig?.galleryImages?.length ?? 0) > 0 && <section id="gallery" className="public-section" data-layout={section("gallery")?.layout} style={{ order: sectionOrder("gallery") }}><div className="public-section-heading"><div><span className="eyebrow">Imagens</span><h2>{sectionTitle("gallery", "Galeria")}</h2><p>{sectionDescription("gallery")}</p></div></div><div className="public-gallery">{activeConfig?.galleryImages?.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${establishment.name} — imagem ${index + 1}`} />)}</div></section>}
      {section("hours") && <section id="hours" className="public-section public-info-section" data-layout={section("hours")?.layout} style={{ order: sectionOrder("hours") }}>
        <div className="public-section-heading"><div><span className="eyebrow">Visite</span><h2>{sectionTitle("hours", "Funcionamento")}</h2><p>{sectionDescription("hours")}</p></div></div>
        <GlassSurface material="frosted" className="public-hours">{businessHours.some((day) => day.open) ? <dl>{businessHours.map((day) => <div key={day.weekday}><dt>{["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][day.weekday]}</dt><dd>{day.open && day.intervals.length ? day.intervals.map((range) => `${range.start}–${range.end}`).join(" · ") : "Fechado"}</dd></div>)}</dl> : <><p>Informações de funcionamento demonstrativas.</p><span>A disponibilidade real é apresentada no fluxo de agendamento.</span></>}</GlassSurface>
      </section>}
      {section("location") && <section id="location" className="public-section public-info-section" data-layout={section("location")?.layout} style={{ order: sectionOrder("location") }}>
        <div className="public-section-heading"><div><span className="eyebrow">Encontre o espaço</span><h2>{sectionTitle("location", "Endereço e localização")}</h2><p>{sectionDescription("location")}</p></div></div>
        <div className="public-contact-grid"><GlassSurface material="frosted"><MapPin size={18} /><h3>Endereço</h3><p>{address || "Endereço ainda não informado."}</p>{address && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}>Abrir no mapa <ArrowRight size={14} /></a>}</GlassSurface></div>
      </section>}
      {section("contact") && <section id="contact" className="public-section public-info-section" data-layout={section("contact")?.layout} style={{ order: sectionOrder("contact") }}>
        <div className="public-section-heading"><div><span className="eyebrow">Fale com o estabelecimento</span><h2>{sectionTitle("contact", "Informações de contato")}</h2><p>{sectionDescription("contact")}</p></div></div>
        <div className="public-contact-grid">{establishment.phone && <GlassSurface material="frosted"><Phone size={18} /><h3>Telefone</h3><p>{establishment.phone}</p><a href={`tel:${establishment.phone.replace(/\D/g, "")}`}>Ligar para o estabelecimento <ArrowRight size={14} /></a></GlassSurface>}{instagram && <GlassSurface material="frosted"><Instagram size={18} /><h3>Instagram</h3><p>Acompanhe o estabelecimento.</p><a target="_blank" rel="noreferrer" href={instagram}>Abrir perfil <ArrowRight size={14} /></a></GlassSurface>}</div>
      </section>}
      {section("faq") && (activeConfig?.faq?.length ?? 0) > 0 && <section id="faq" className="public-section" data-layout={section("faq")?.layout} style={{ order: sectionOrder("faq") }}><div className="public-section-heading"><div><span className="eyebrow">Dúvidas comuns</span><h2>{sectionTitle("faq", "Perguntas frequentes")}</h2><p>{sectionDescription("faq")}</p></div></div><div className="public-faq">{activeConfig?.faq?.map((item, index) => <details key={`${item.question}-${index}`}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>}
      {section("policies") && operationalData?.policies?.trim() && <section id="policies" className="public-section" data-layout={section("policies")?.layout} style={{ order: sectionOrder("policies") }}><div className="public-section-heading"><div><span className="eyebrow">Informações importantes</span><h2>{sectionTitle("policies", "Políticas de atendimento")}</h2><p>{sectionDescription("policies")}</p></div></div><GlassSurface material="frosted" className="public-about-copy"><p>{operationalData.policies}</p></GlassSurface></section>}
      {section("booking") && <section id="booking-intent" className="public-booking-intent" data-layout={section("booking")?.layout} style={{ order: sectionOrder("booking") }}>
        <GlassSurface material="thick"><div><span className="eyebrow">Agendamento</span><h2>{sectionTitle("booking", "Escolha seu próximo horário.")}</h2><p>{sectionDescription("booking") || (canBook ? "Consulte serviços, profissionais e horários disponíveis." : preview ? "A apresentação visual está pronta; a operação é configurada pelo gestor." : bookingAllowed ? "A agenda online está sendo preparada. Entre em contato para consultar disponibilidade." : "Os agendamentos estão temporariamente indisponíveis.")}</p></div>{canBook && hasPublicServices ? <GlassButton asChild variant="primary"><Link href={`/e/${establishment.slug}/booking`}><CalendarDays size={16} />{activeConfig?.bookingButtonLabel || "Iniciar agendamento"}</Link></GlassButton> : !preview && bookingAllowed && establishment.phone ? <a className="public-contact-cta" href={`tel:${establishment.phone.replace(/\D/g, "")}`}><Phone size={16} /> Falar com o estabelecimento</a> : null}</GlassSurface>
      </section>}
    </div>
    {section("footer") && <footer className="public-footer" style={{ order: sectionOrder("footer") }}><span>{activeConfig?.publicName || establishment.name}</span><span>{sectionDescription("footer") || establishment.phone || "Uma experiência centralizada para cada estabelecimento."}</span></footer>}
  </main>;
}

/** Backward-compatible name for the shared visual renderer. */
export const PublicEstablishmentPage = PublicPageRenderer;
