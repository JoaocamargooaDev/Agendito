"use client";

import { useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui";
import { findLocalPublicEstablishment, getPageConfig } from "@/features/platform";
import { findPublicEstablishment } from "./data";
import { PublicEstablishmentPage } from "./public-establishment-page";
import type { Establishment } from "@/types";

export function PublicEstablishmentRoute({ slug }: { slug: string }) {
  const [establishment, setEstablishment] = useState<Establishment | null>(() => findPublicEstablishment(slug));
  const [config, setConfig] = useState(() => establishment ? getPageConfig(establishment.id) : null);
  useEffect(() => { const timer = window.setTimeout(() => setEstablishment(findLocalPublicEstablishment(slug)), 0); return () => window.clearTimeout(timer); }, [slug]);
  useEffect(() => { if (establishment) { const timer = window.setTimeout(() => setConfig(getPageConfig(establishment.id)), 0); return () => window.clearTimeout(timer); } }, [establishment]);
  if (!establishment) return <main className="customer-loading"><GlassSurface material="frosted"><span className="eyebrow">Página pública</span><h1>Estabelecimento não encontrado</h1><p>Confira o link ou aguarde a publicação da página.</p></GlassSurface></main>;
  const configured = config?.establishmentId === establishment.id ? { ...establishment, name: config.heroTitle || establishment.name, description: config.heroSubtitle || establishment.description } : establishment;
  return <PublicEstablishmentPage establishment={configured} />;
}
