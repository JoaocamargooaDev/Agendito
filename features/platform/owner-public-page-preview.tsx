"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { GlassSurface } from "@/components/ui";
import { PublicPageRenderer } from "@/features/public-establishment/public-establishment-page";
import { getPlatformPublicPageDraft } from "./public-page-builder";
import { findPlatformEstablishment } from "./storage";
import type { PlatformEstablishmentRecord } from "./repository-contracts";
import type { PageDesignConfig } from "@/types";
import { PLATFORM_PAGE_PREVIEW_ESTABLISHMENT, PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA } from "./public-page-preview-data";

export function OwnerPublicPagePreview({ establishmentId }: { establishmentId: string }) {
  const [establishment, setEstablishment] = useState<PlatformEstablishmentRecord | null>(null);
  const [draft, setDraft] = useState<PageDesignConfig | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = findPlatformEstablishment(establishmentId);
      setEstablishment(current);
      if (current) setDraft(getPlatformPublicPageDraft(current));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [establishmentId]);

  if (!establishment || !draft) return <main className="platform-shell"><GlassSurface material="frosted"><h1>Prévia não disponível</h1><p>O estabelecimento não foi encontrado neste navegador.</p><Link href="/platform/pages">Voltar às páginas públicas</Link></GlassSurface></main>;
  return <main className="owner-public-preview-shell"><div className="owner-public-preview-banner"><Link href="/platform/pages"><ArrowLeft size={16} />Voltar às páginas</Link><span><Eye size={15} />Prévia privada do proprietário · {establishment.name}</span><small>Exemplo demonstrativo para validar o design; não representa os dados operacionais desta empresa.</small></div><PublicPageRenderer establishment={{ ...PLATFORM_PAGE_PREVIEW_ESTABLISHMENT, name: draft.publicName || draft.heroTitle || PLATFORM_PAGE_PREVIEW_ESTABLISHMENT.name, description: draft.heroSubtitle || PLATFORM_PAGE_PREVIEW_ESTABLISHMENT.description }} config={draft} operationalData={PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA} bookingAllowed={false} preview /></main>;
}
