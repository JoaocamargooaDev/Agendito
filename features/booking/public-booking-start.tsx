"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, MapPin, Search } from "lucide-react";
import { GlassInput, GlassSurface } from "@/components/ui";
import { listPublicBookingEstablishments } from "@/features/platform";

export function PublicBookingStart() {
  const [query, setQuery] = useState("");
  const establishments = useMemo(() => listPublicBookingEstablishments(), []);
  const filtered = establishments.filter((item) => `${item.name} ${item.address.city} ${item.address.state}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));

  return (
    <main className="booking-page public-tenant-page booking-start" data-public-tone="light" data-public-template="essential" data-public-palette="moss">
      <div className="booking-shell">
        <Link className="booking-back" href="/">Agendito</Link>
        <header className="booking-heading">
          <span className="eyebrow">Agendamento público</span>
          <h1>Encontre seu próximo horário.</h1>
          <p>Escolha um estabelecimento para consultar serviços e horários disponíveis.</p>
        </header>
        <GlassSurface material="frosted" className="booking-start-panel">
          <div className="booking-start-search">
            <GlassInput label="Buscar estabelecimento ou cidade" leadingIcon={<Search size={18} aria-hidden="true" />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: barbearia, Brasília" />
          </div>
          {filtered.length ? (
            <ul className="booking-start-list">
              {filtered.map((item) => (
                <li key={item.id}>
                  <Link href={`/e/${encodeURIComponent(item.slug)}/booking`} className="booking-start-card">
                    <span className="booking-start-avatar" aria-hidden="true">{item.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>
                    <span className="booking-start-copy"><strong>{item.name}</strong><small><MapPin size={14} aria-hidden="true" />{[item.address.city, item.address.state].filter(Boolean).join(" · ") || "Atendimento presencial"}</small></span>
                    <span className="booking-start-action">Ver horários <ArrowRight size={16} aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="booking-empty"><CalendarDays size={18} aria-hidden="true" /><p>{establishments.length ? "Nenhum estabelecimento encontrado para essa busca." : "Ainda não há estabelecimentos disponíveis para agendamento."}</p></div>}
        </GlassSurface>
      </div>
    </main>
  );
}
