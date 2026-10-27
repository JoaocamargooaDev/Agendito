"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Eye, History, MessageCircle, Pencil, Plus, RotateCcw, Share2, Store } from "lucide-react";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, useConfirmation } from "@/components/ui";
import { PageHeader, PageSection, PageShell } from "@/components/admin/page-layout";
import { getEstablishmentStatus, getPublicPageStatus } from "./domain";
import { getPlatformPublicPageDraft, initializePublicPageConfig, publishPublicPageDraft, reactivatePublicPage, savePublicPageDraft, setPublicPagePublicationStatus } from "./public-page-builder";
import { copyPublicPageAppearance } from "./public-page-appearance";
import { getPlatformPageConfig, listPlatformEstablishments } from "./storage";
import { listPlatformActions, recordPlatformAction } from "./owner-dashboard";
import type { PageDesignConfig, PublicPageStatus } from "@/types";
import type { PlatformEstablishmentRecord, PlatformPageAdminRecord } from "./repository-contracts";

const pageStatusLabels: Record<PublicPageStatus, string> = { PUBLISHED: "Publicada", DRAFT: "Rascunho", UNPUBLISHED: "Despublicada" };

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function pageUrl(slug: string) {
  return typeof window === "undefined" ? `/e/${slug}` : `${window.location.origin}/e/${slug}`;
}

export function PublicPagesManagementPage() {
  const confirm = useConfirmation();
  const [establishments, setEstablishments] = useState<PlatformEstablishmentRecord[]>([]);
  const [configs, setConfigs] = useState<Record<string, PlatformPageAdminRecord | null>>({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [historyTarget, setHistoryTarget] = useState<PlatformEstablishmentRecord | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<PlatformEstablishmentRecord | null>(null);
  const [sourceId, setSourceId] = useState("");

  function refresh() {
    const all = listPlatformEstablishments().filter((item) => item.name.trim());
    setEstablishments(all);
    setConfigs(Object.fromEntries(all.map((item) => [item.id, getPlatformPageConfig(item.id)])));
  }

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener("agendito:public-page-updated", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", refresh); window.removeEventListener("agendito:public-page-updated", refresh); };
  }, []);

  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = establishments.filter((establishment) => {
    const config = configs[establishment.id];
    const status = getPublicPageStatus(config, establishment);
    const text = `${establishment.name} ${establishment.slug} ${pageUrl(establishment.slug)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.includes(normalized) && (filter === "all" || status === filter);
  });

  function createPage(establishment: PlatformEstablishmentRecord) {
    const current = getPlatformPageConfig(establishment.id);
    if (current) return;
    const initialized = initializePublicPageConfig(establishment);
    if (!initialized) { setFeedback("Não foi possível inicializar a página neste navegador."); return; }
    recordPlatformAction(establishment, "Configuração da página pública inicializada");
    setFeedback("Página pronta para edição. Uma página legada publicada continua preservada até você publicar alterações.");
    refresh();
  }

  function publish(establishment: PlatformEstablishmentRecord) {
    const saved = publishPublicPageDraft(establishment, getPlatformPublicPageDraft(establishment));
    if (!saved) { setFeedback("Não foi possível publicar a página neste navegador."); return; }
    recordPlatformAction(establishment, "Página pública publicada pelo gestor da plataforma");
    setFeedback(`Página de ${establishment.name} publicada.`);
    refresh();
  }

  async function unpublish(establishment: PlatformEstablishmentRecord) {
    if (!await confirm({ title: `Despublicar a página de ${establishment.name}?`, description: "O conteúdo e o histórico serão preservados.", destructive: true, confirmLabel: "Despublicar" })) return;
    const saved = setPublicPagePublicationStatus(establishment, "UNPUBLISHED");
    if (!saved) { setFeedback("Não foi possível despublicar a página."); return; }
    recordPlatformAction(establishment, "Página pública despublicada pelo gestor da plataforma");
    setFeedback(`Página de ${establishment.name} despublicada; os dados foram preservados.`);
    refresh();
  }

  function reactivate(establishment: PlatformEstablishmentRecord) {
    const saved = reactivatePublicPage(establishment);
    if (!saved) { setFeedback("Não foi possível reativar a página."); return; }
    recordPlatformAction(establishment, "Página pública reativada pelo gestor da plataforma");
    setFeedback(`Última versão publicada da página de ${establishment.name} restaurada.`);
    refresh();
  }

  async function restorePublished(establishment: PlatformEstablishmentRecord) {
    const config = getPlatformPageConfig(establishment.id);
    if (!config?.publishedSnapshot || !await confirm({ title: "Restaurar versão publicada?", description: `A versão publicada de ${establishment.name} será copiada para o rascunho. A página pública não muda até uma nova publicação.`, confirmLabel: "Restaurar rascunho" })) return;
    const saved = savePublicPageDraft(establishment, config.publishedSnapshot);
    if (!saved) { setFeedback("Não foi possível restaurar o rascunho."); return; }
    recordPlatformAction(establishment, "Rascunho restaurado da última versão publicada");
    setFeedback("Rascunho restaurado. A versão pública permaneceu intacta.");
    refresh();
  }

  async function copyLink(establishment: PlatformEstablishmentRecord) {
    const url = pageUrl(establishment.slug);
    try { await navigator.clipboard.writeText(url); setFeedback("Link público copiado."); }
    catch { setFeedback(`Copie o link: ${url}`); }
  }

  async function share(establishment: PlatformEstablishmentRecord) {
    const url = pageUrl(establishment.slug);
    try {
      if (navigator.share) await navigator.share({ title: establishment.name, text: `Conheça ${establishment.name}`, url });
      else setFeedback("O compartilhamento do dispositivo não está disponível neste navegador. Use o botão do WhatsApp ou copie o link.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setFeedback("Não foi possível abrir o compartilhamento neste navegador.");
    }
  }

  function shareWhatsApp(establishment: PlatformEstablishmentRecord) {
    const url = pageUrl(establishment.slug);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Conheça ${establishment.name}: ${url}`)}`, "_blank", "noopener,noreferrer");
  }

  async function restoreVersion(establishment: PlatformEstablishmentRecord, content: PageDesignConfig) {
    if (!await confirm({ title: "Restaurar versão no rascunho?", description: `A página pública de ${establishment.name} só mudará quando você publicar novamente.`, confirmLabel: "Restaurar versão" })) return;
    const saved = savePublicPageDraft(establishment, content);
    if (!saved) { setFeedback("Não foi possível restaurar esta versão no rascunho."); return; }
    recordPlatformAction(establishment, "Rascunho restaurado de uma versão publicada anterior");
    setHistoryTarget(null); setFeedback("Versão restaurada no rascunho; a página pública atual não foi alterada."); refresh();
  }

  function duplicateAppearance() {
    const target = duplicateTarget;
    const source = establishments.find((item) => item.id === sourceId);
    if (!target || !source || source.id === target.id) return;
    const sourceContent = getPlatformPublicPageDraft(source);
    const targetContent = getPlatformPublicPageDraft(target);
    const copied = copyPublicPageAppearance(targetContent, sourceContent);
    const saved = savePublicPageDraft(target, copied);
    if (!saved) { setFeedback("Não foi possível duplicar a aparência."); return; }
    recordPlatformAction(target, `Configuração visual copiada de ${source.name}`);
    setDuplicateTarget(null); setSourceId(""); setFeedback(`Aparência copiada para ${target.name}. Dados comerciais e vínculos foram mantidos.`); refresh();
  }

  return <PageShell as="main" className="platform-shell public-pages-management">
    <PageHeader variant="content" className="platform-header" breadcrumbs={<Link className="page-builder-back" href="/platform/establishments"><ArrowLeft size={16} />Console do proprietário</Link>} eyebrow="GESTÃO DA PLATAFORMA" title="Páginas públicas" description="Publicação, links e versões das páginas de cada estabelecimento." actions={<Link className="glass-button button-quiet button-md" href="/platform/establishments"><Store size={15} />Estabelecimentos</Link>} />
    {feedback && <p className="platform-feedback platform-global-feedback" role="status">{feedback}</p>}
    <PageSection className="public-pages-section" aria-label="Páginas públicas dos estabelecimentos">
    <GlassSurface material="frosted" className="public-pages-panel">
      <div className="public-pages-toolbar"><GlassInput label="Pesquisar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Estabelecimento, slug ou URL" /><GlassSelect label="Publicação" value={filter} onChange={(event) => setFilter(event.target.value)} options={[{ value: "all", label: "Todos os status" }, { value: "PUBLISHED", label: "Publicadas" }, { value: "DRAFT", label: "Rascunhos" }, { value: "UNPUBLISHED", label: "Despublicadas" }]} /></div>
      {visible.length ? <div className="public-pages-list">{visible.map((establishment) => {
        const config = configs[establishment.id];
        const status = getPublicPageStatus(config, establishment);
        const version = config?.versions?.at(-1);
        const publishedAt = config?.publishedAt ?? version?.publishedAt;
        const archived = getEstablishmentStatus(establishment) === "ARCHIVED";
        return <article className="public-pages-row" key={establishment.id}>
          <div className="public-pages-identity"><strong>{establishment.name}</strong><code>{establishment.slug}</code><a href={pageUrl(establishment.slug)} target="_blank" rel="noreferrer">{pageUrl(establishment.slug)}</a></div>
          <div className="public-pages-meta"><span className={`owner-page-badge ${status === "PUBLISHED" ? "is-published" : status === "UNPUBLISHED" ? "is-unpublished" : "is-draft"}`}>{pageStatusLabels[status]}</span><small>Alterada: {formatDate(config?.updatedAt)}</small><small>Publicada: {formatDate(publishedAt)}</small>{getEstablishmentStatus(establishment) !== "ACTIVE" && <small className="public-pages-operation-note">Operação: {getEstablishmentStatus(establishment).toLowerCase()}</small>}</div>
          <div className="public-pages-actions">
            {!config && <GlassButton size="sm" variant="primary" disabled={archived} onClick={() => createPage(establishment)}><Plus size={14} />Criar página</GlassButton>}
            {!archived && <GlassButton asChild size="sm" variant="quiet"><Link href={`/platform/establishments/${encodeURIComponent(establishment.id)}/page-builder`}><Pencil size={14} />Editar</Link></GlassButton>}
            <GlassButton asChild size="sm" variant="quiet" disabled={archived}><Link href={`/platform/pages/${encodeURIComponent(establishment.id)}/preview`}><Eye size={14} />Prévia privada</Link></GlassButton>
            {status === "PUBLISHED" ? <GlassButton size="sm" variant="quiet" disabled={archived} onClick={() => unpublish(establishment)}>Despublicar</GlassButton> : <GlassButton size="sm" variant="primary" disabled={archived} onClick={() => status === "UNPUBLISHED" ? reactivate(establishment) : publish(establishment)}><Check size={14} />{status === "UNPUBLISHED" ? "Reativar" : "Publicar"}</GlassButton>}
            <GlassButton size="sm" variant="quiet" onClick={() => void copyLink(establishment)}><Copy size={14} />Copiar link</GlassButton>
            <GlassButton size="sm" variant="quiet" onClick={() => void share(establishment)}><Share2 size={14} />Compartilhar</GlassButton>
            <GlassButton size="sm" variant="quiet" onClick={() => shareWhatsApp(establishment)}><MessageCircle size={14} />WhatsApp</GlassButton>
            <GlassButton size="sm" variant="quiet" onClick={() => { setDuplicateTarget(establishment); setSourceId(establishments.find((item) => item.id !== establishment.id && configs[item.id])?.id ?? ""); }}><Copy size={14} />Duplicar visual</GlassButton>
            {config?.publishedSnapshot && <GlassButton size="sm" variant="quiet" onClick={() => restorePublished(establishment)}><RotateCcw size={14} />Restaurar publicada</GlassButton>}
            <GlassButton size="sm" variant="quiet" onClick={() => setHistoryTarget(establishment)}><History size={14} />Histórico ({config?.versions?.length ?? 0})</GlassButton>
            {status === "PUBLISHED" && <Link className="public-pages-open-link" href={`/e/${establishment.slug}`} target="_blank"><ExternalLink size={14} />Abrir pública</Link>}
          </div>
        </article>;
      })}</div> : <p className="owner-empty-inline">Nenhuma página corresponde à pesquisa e ao filtro selecionados.</p>}
    </GlassSurface>
    </PageSection>

    <GlassModal open={Boolean(duplicateTarget)} onClose={() => setDuplicateTarget(null)} title="Duplicar configuração visual" description="Somente o visual e a estrutura serão reutilizados. Dados comerciais, identificadores e registros continuam independentes." footer={<><GlassButton variant="quiet" onClick={() => setDuplicateTarget(null)}>Cancelar</GlassButton><GlassButton variant="primary" disabled={!sourceId} onClick={duplicateAppearance}><Copy size={15} />Duplicar visual</GlassButton></>}>
      {duplicateTarget && <div className="public-pages-modal-content"><p>Aplicar aparência em <strong>{duplicateTarget.name}</strong> com base em outro estabelecimento:</p><GlassSelect label="Página de origem" value={sourceId} onChange={(event) => setSourceId(event.target.value)} options={establishments.filter((item) => item.id !== duplicateTarget.id).map((item) => ({ value: item.id, label: item.name }))} /></div>}
    </GlassModal>

    <GlassModal open={Boolean(historyTarget)} onClose={() => setHistoryTarget(null)} title={`Histórico de versões · ${historyTarget?.name ?? "Página"}`} description="As versões são registradas localmente neste navegador quando a página é publicada.">
      {historyTarget && <div className="public-pages-version-list">{(() => { const config = configs[historyTarget.id]; const versions = [...(config?.versions ?? [])].reverse(); if (!versions.length && config?.publishedSnapshot) return <article><div><strong>Última versão publicada</strong><time>{formatDate(config.publishedAt)}</time><small>Snapshot de publicação preservado.</small></div><GlassButton size="sm" variant="quiet" onClick={() => restoreVersion(historyTarget, config.publishedSnapshot!)}><RotateCcw size={14} />Restaurar rascunho</GlassButton></article>; return versions.length ? versions.map((item) => <article key={item.id}><div><strong>{item.content.publicName || item.content.heroTitle}</strong><time>{formatDate(item.publishedAt)}</time></div><GlassButton size="sm" variant="quiet" onClick={() => restoreVersion(historyTarget, item.content)}><RotateCcw size={14} />Restaurar rascunho</GlassButton></article>) : <p>Nenhuma publicação foi registrada ainda.</p>; })()}
        {listPlatformActions(historyTarget.id).filter((item) => item.action.toLowerCase().includes("página") || item.action.toLowerCase().includes("rascunho")).slice(0, 8).map((item) => <article key={item.id}><strong>{item.action}</strong><time>{formatDate(item.occurredAt)}</time></article>)}
      </div>}
    </GlassModal>
  </PageShell>;
}
