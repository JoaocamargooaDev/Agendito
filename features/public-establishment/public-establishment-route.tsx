"use client";

import { useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui";
import { findEstablishmentByPublicSlug, getPageConfig } from "@/features/platform";
import { PublicPageRenderer } from "./public-establishment-page";
import type { Establishment, EstablishmentOperationalData } from "@/types";
import { getEstablishmentStatus, getPublicPageStatus, isEstablishmentPublic } from "@/features/platform/domain";
import { getPublicBookingBlockReason } from "@/features/platform/policies";
import { getPublishedPageContent } from "@/features/platform/public-page-builder";
import { listEmployees } from "@/features/employees";
import { listServices } from "@/features/services";
import { getEstablishmentSettings } from "@/features/settings/repository";

export function PublicEstablishmentRoute({ slug }: { slug: string }) {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [config, setConfig] = useState<ReturnType<typeof getPageConfig>>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = findEstablishmentByPublicSlug(slug);
      setEstablishment(next);
      setConfig(next ? getPageConfig(next.id) : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [slug]);
  useEffect(() => {
    const refreshPage = () => { const next = findEstablishmentByPublicSlug(slug); setEstablishment(next); setConfig(next ? getPageConfig(next.id) : null); };
    const events = ["storage", "agendito:public-page-updated", "agendito:services-updated", "agendito:employees-updated", "agendito:settings-updated"];
    events.forEach((event) => window.addEventListener(event, refreshPage));
    return () => events.forEach((event) => window.removeEventListener(event, refreshPage));
  }, [slug]);
  if (!establishment) return <main className="customer-loading"><GlassSurface material="frosted"><span className="eyebrow">Página pública</span><h1>Página não encontrada</h1><p>Confira se o endereço foi digitado corretamente.</p></GlassSurface></main>;
  if (!isEstablishmentPublic(establishment) || (getEstablishmentStatus(establishment) !== "SUSPENDED" && getPublicPageStatus(config, establishment) !== "PUBLISHED")) return <main className="customer-loading"><GlassSurface material="frosted"><span className="eyebrow">Página pública</span><h1>Esta página não está disponível</h1><p>Confira o link ou entre em contato com o estabelecimento.</p></GlassSurface></main>;
  if (getEstablishmentStatus(establishment) === "SUSPENDED") return <main className="customer-loading"><GlassSurface material="frosted"><span className="eyebrow">Página temporariamente indisponível</span><h1>Este estabelecimento está suspenso</h1><p>{establishment.suspensionReason || "A página e as operações estão temporariamente indisponíveis."}</p></GlassSurface></main>;
  const publishedContent = getPublishedPageContent(config);
  const configured = publishedContent ? { ...establishment, name: publishedContent.heroTitle || establishment.name, description: publishedContent.heroSubtitle || establishment.description } : establishment;
  const publicServices = listServices(establishment.id).filter((item) => item.active && item.status !== "ARCHIVED" && item.publicVisible !== false).map(({ id, name, description, durationMinutes, priceInCents, imageUrl, displayOrder }) => ({ id, name, description, durationMinutes, priceInCents, imageUrl, displayOrder }));
  const publicServiceIds = new Set(publicServices.map((service) => service.id));
  const publicProfessionals = listEmployees(establishment.id).filter((item) => item.active).map(({ id, displayName, bio, title, photoUrl, serviceIds }) => ({ id, displayName, bio, title, photoUrl, serviceIds: serviceIds.filter((serviceId) => publicServiceIds.has(serviceId)) }));
  const operationalData: EstablishmentOperationalData = { services: publicServices, professionals: publicProfessionals, businessHours: getEstablishmentSettings(establishment.id).businessHours, policies: publishedContent?.policies };
  return <PublicPageRenderer establishment={configured} config={publishedContent} operationalData={operationalData} bookingAllowed={!getPublicBookingBlockReason(establishment, config)} />;
}
