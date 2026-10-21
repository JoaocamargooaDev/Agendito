"use client";

import { useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui";
import { findLocalPublicEstablishment } from "@/features/platform";
import { findPublicEstablishment } from "@/features/public-establishment/data";
import type { Establishment } from "@/types";
import { PublicBookingPage } from "./public-booking-page";

export function PublicBookingRoute({ slug, serviceParam, employeeParam }: { slug: string; serviceParam?: string; employeeParam?: string }) {
  const [establishment, setEstablishment] = useState<Establishment | null>(() => findPublicEstablishment(slug));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEstablishment(findLocalPublicEstablishment(slug));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [slug]);
  if (!ready) return <main className="customer-loading"><GlassSurface material="frosted"><p>Preparando agendamento…</p></GlassSurface></main>;
  if (!establishment) return <main className="customer-loading"><GlassSurface material="frosted"><h1>Estabelecimento não encontrado</h1><p>Confira o link ou aguarde a publicação da página.</p></GlassSurface></main>;
  return <PublicBookingPage establishment={establishment} serviceParam={serviceParam} employeeParam={employeeParam} />;
}
