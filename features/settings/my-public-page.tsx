"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Copy, ExternalLink, Eye, Image as ImageIcon, Monitor, ShieldCheck } from "lucide-react";
import { GlassButton, GlassSurface } from "@/components/ui";
import { PageSection, PageShell, SectionHeader } from "@/components/admin/page-layout";
import { useAuth } from "@/features/auth";
import { getEstablishmentStatus, getPublicPageStatus } from "@/features/platform/domain";
import { getPlatformPublicPageDraft, getPlatformPublishedPageContent } from "@/features/platform/public-page-builder";
import { getPageConfig } from "@/features/platform/storage";
import { getPersistedEstablishment } from "./repository";
import type { Establishment, PageDesignConfig, PublicPageStatus } from "@/types";

const publicationLabels: Record<PublicPageStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  UNPUBLISHED: "Despublicada",
};

export function MyPublicPage() {
  const { user } = useAuth();
  const establishmentId = user?.role === "ADMIN" ? user.establishmentId : undefined;
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [publicationStatus, setPublicationStatus] = useState<PublicPageStatus>("DRAFT");
  const [publishedDesign, setPublishedDesign] = useState<PageDesignConfig | null>(null);
  const [currentDesign, setCurrentDesign] = useState<PageDesignConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    if (!establishmentId) return;
    const refresh = () => {
      const currentEstablishment = getPersistedEstablishment(establishmentId);
      const config = getPageConfig(establishmentId);
      setEstablishment(currentEstablishment);
      setPublicationStatus(currentEstablishment ? getPublicPageStatus(config, currentEstablishment) : "DRAFT");
      setPublishedDesign(getPlatformPublishedPageContent(config));
      setCurrentDesign(currentEstablishment ? getPlatformPublicPageDraft(currentEstablishment) : null);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("agendito:public-page-updated", refresh);
    window.addEventListener("agendito:settings-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("agendito:public-page-updated", refresh);
      window.removeEventListener("agendito:settings-updated", refresh);
    };
  }, [establishmentId]);

  if (!establishment || !establishmentId) {
    return <PageShell className="admin-page-container my-public-page"><GlassSurface material="frosted"><h1>Página do estabelecimento indisponível</h1><p>Não foi possível carregar as informações deste estabelecimento.</p></GlassSurface></PageShell>;
  }

  const visibleDesign = publishedDesign ?? currentDesign;
  const publicName = visibleDesign?.publicName || visibleDesign?.heroTitle || establishment.name;
  const logoUrl = visibleDesign?.logoUrl || establishment.logoUrl;
  const coverUrl = visibleDesign?.coverUrl || establishment.coverUrl;
  const publicPath = `/e/${establishment.slug}`;
  const publicUrl = typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`;
  const isOperational = getEstablishmentStatus(establishment) === "ACTIVE";

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      setCopyError("Não foi possível copiar automaticamente. Selecione e copie o endereço exibido.");
    }
  };

  return <PageShell className="admin-page-container my-public-page">
    <p className="my-public-page-description">Consulte a página do seu estabelecimento e compartilhe o link com seus clientes.</p>

    <PageSection className="my-public-page-summary">
      <SectionHeader>
        <div><span className="eyebrow">Status da página</span><h2>{publicationLabels[publicationStatus]}</h2></div>
        <span className={`my-public-page-status status-${publicationStatus.toLowerCase()}`}><i />{publicationLabels[publicationStatus]}</span>
      </SectionHeader>
      <p>{publicationStatus === "PUBLISHED" ? "Sua página está disponível no link público. As informações de serviços, equipe e horários são atualizadas pela operação do estabelecimento." : "Sua página ainda não está publicada. O proprietário da plataforma gerencia sua apresentação e publicação."}</p>
      {!isOperational && <p className="my-public-page-note">A operação está {getEstablishmentStatus(establishment).toLowerCase()}; novos agendamentos podem estar indisponíveis.</p>}
      <div className="my-public-page-link-row"><code title={publicUrl}>{publicUrl}</code><div><GlassButton variant="secondary" onClick={copyPublicLink}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Link copiado" : "Copiar link"}</GlassButton>{publicationStatus === "PUBLISHED" ? <GlassButton asChild variant="primary"><a href={publicPath} target="_blank" rel="noreferrer"><ExternalLink size={16} />Abrir página</a></GlassButton> : <GlassButton variant="primary" disabled><ExternalLink size={16} />Abrir página</GlassButton>}</div></div>
      {copyError && <p role="status" className="my-public-page-note">{copyError}</p>}
    </PageSection>

    <div className="my-public-page-grid">
      <PageSection className="my-public-page-preview-section">
        <SectionHeader><div><span className="eyebrow">Prévia pública</span><h2><Eye size={18} />Visualização para clientes</h2></div><span className="my-public-page-readonly"><ShieldCheck size={15} />Somente consulta</span></SectionHeader>
        {publicationStatus === "PUBLISHED" ? <div className="my-public-page-frame"><div className="my-public-page-frame-toolbar"><Monitor size={15} />Página pública · {establishment.name}</div><iframe title={`Prévia pública de ${establishment.name}`} src={publicPath} loading="lazy" /></div> : <div className="my-public-page-unpublished"><Eye size={24} /><strong>Prévia indisponível</strong><span>A página só pode ser visualizada publicamente depois que o proprietário da plataforma publicá-la.</span></div>}
      </PageSection>

      <PageSection className="my-public-page-identity-section">
        <SectionHeader><div><span className="eyebrow">Identidade visual</span><h2>Apresentação atual</h2></div></SectionHeader>
        <p className="my-public-page-helper">Essas informações são somente leitura neste painel. Para solicitar alterações, entre em contato com o proprietário da plataforma.</p>
        <div className="my-public-page-identity-card">
          {coverUrl ? <div className="my-public-page-cover" style={{ backgroundImage: `url("${coverUrl.replaceAll('"', "%22")}")` }} /> : <div className="my-public-page-cover my-public-page-cover-empty"><ImageIcon size={22} /><span>Sem imagem de capa</span></div>}
          <div className="my-public-page-brand-row">{logoUrl ? <Image className="my-public-page-logo" src={logoUrl} alt={`Logotipo de ${publicName}`} width={56} height={56} unoptimized /> : <span className="my-public-page-logo my-public-page-logo-fallback">{publicName.slice(0, 1)}</span>}<div><strong>{publicName}</strong><span>{visibleDesign?.template ? `Template ${visibleDesign.template}` : "Template padrão"}</span></div></div>
        </div>
        <div className="my-public-page-identity-footnote"><ShieldCheck size={15} />O design e a publicação são gerenciados centralmente pelo Agendito.</div>
      </PageSection>
    </div>
  </PageShell>;
}
