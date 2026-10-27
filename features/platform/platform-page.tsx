"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, ArrowDown, ArrowRight, ArrowUp, Building2, CheckCircle2, Clock3, Copy, Download, ExternalLink, Eye, FileText, LayoutTemplate, Pencil, Search, ShieldAlert, Store, Zap } from "lucide-react";
import { ContentGrid, DataTable, GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, Pagination, StatCard, StatusBadge, useConfirmation } from "@/components/ui";
import { PageHeader, PageSection, PageShell, SectionHeader } from "@/components/admin/page-layout";
import { getEstablishmentStatus, getPublicPageStatus, localPlatformRepository } from "@/features/platform";
import { getOwnerDashboardSnapshot, listPlatformActions, listRecentPlatformActions, listRegisteredEstablishments, recordPlatformAction } from "@/features/platform/owner-dashboard";
import { EstablishmentProvisioningWizard } from "@/features/platform/establishment-provisioning-wizard";
import type { PageDesignConfig } from "@/types";
import type { PlatformEstablishmentRecord } from "./repository-contracts";
import { PLATFORM_FEATURES, createEstablishmentLifecycleUpdate, getEnabledFeatureIds } from "@/features/platform/policies";
import { getPlatformPublicPageDraft, savePublicPageDraft } from "@/features/platform/public-page-builder";
import { emitEstablishmentNotification } from "@/features/notifications/repository";

const platformRepository = localPlatformRepository;
const PAGE_SIZE = 8;
const statusLabels = { ACTIVE: "Ativo", INACTIVE: "Inativo", DRAFT: "Rascunho", SUSPENDED: "Suspenso", ARCHIVED: "Arquivado" } as const;
type PlatformEditorConfig = PageDesignConfig & {
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  establishmentName: string; slug: string; segment: string; addressStreet: string; addressNumber: string;
  addressDistrict: string; addressPostalCode: string; addressCity: string; addressState: string; contactPhone: string;
  enabledFeatures: string[];
  simulatedContractStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

export function PlatformEstablishmentsPage() {
  const searchParams = useSearchParams();
  const confirm = useConfirmation();
  const [, setRefresh] = useState(0);
  const [editing, setEditing] = useState<PlatformEstablishmentRecord | null>(null);
  const [editor, setEditor] = useState<PlatformEditorConfig | null>(null);
  const [feedback, setFeedback] = useState("");
  const [pendingAction, setPendingAction] = useState<{ establishment: PlatformEstablishmentRecord; action: "suspend" | "archive" } | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [details, setDetails] = useState<PlatformEstablishmentRecord | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const snapshot = getOwnerDashboardSnapshot();
  const establishments = listRegisteredEstablishments();
  const recentActions = listRecentPlatformActions(5);
  const filteredEstablishments = useMemo(() => {
    const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return establishments.filter((establishment) => {
      const admin = platformRepository.managers.getManagerContact(establishment.id);
      const haystack = `${establishment.name} ${establishment.slug} ${establishment.segment ?? ""} ${admin?.name ?? ""} ${establishment.address.city}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const operational = getEstablishmentStatus(establishment) === "DRAFT" ? "INACTIVE" : getEstablishmentStatus(establishment);
      const statusMatch = statusFilter === "all" || (statusFilter === "archived" ? getEstablishmentStatus(establishment) === "ARCHIVED" : getEstablishmentStatus(establishment) !== "ARCHIVED" && operational === statusFilter);
      return haystack.includes(normalized) && statusMatch;
    }).sort((a, b) => (a.name.localeCompare(b.name, "pt-BR") * (sortDirection === "asc" ? 1 : -1)));
  }, [establishments, query, sortDirection, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredEstablishments.length / PAGE_SIZE));
  const visibleEstablishments = filteredEstablishments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    const events = ["agendito:agenda-updated", "agendito:employees-updated", "agendito:services-updated", "agendito:settings-updated", "agendito:public-page-updated", "agendito:platform-updated", "storage"];
    const refreshDashboard = () => setRefresh((value) => value + 1);
    events.forEach((event) => window.addEventListener(event, refreshDashboard));
    return () => events.forEach((event) => window.removeEventListener(event, refreshDashboard));
  }, []);

  function refresh() { setRefresh((value) => value + 1); }
  function track(establishment: Pick<PlatformEstablishmentRecord, "id" | "name">, action: string) { recordPlatformAction(establishment, action); }

  function startEditing(establishment: PlatformEstablishmentRecord) {
    const pageStatus = getPublicPageStatus(platformRepository.publicPages.findByEstablishment(establishment.id), establishment);
    const pageDesign = getPlatformPublicPageDraft(establishment);
    setEditing(establishment);
    setEditor({ ...pageDesign, status: pageStatus, establishmentName: establishment.name, slug: establishment.slug, segment: establishment.segment ?? "", simulatedContractStatus: establishment.simulatedContractStatus, addressStreet: establishment.address.street, addressNumber: establishment.address.number, addressDistrict: establishment.address.district, addressPostalCode: establishment.address.postalCode, addressCity: establishment.address.city, addressState: establishment.address.state, contactPhone: establishment.phone, enabledFeatures: getEnabledFeatureIds(establishment) });
    setFeedback("");
  }

  async function saveEditor() {
    if (!editing || !editor) return;
    const next = { ...editing, description: editor.heroSubtitle, logoUrl: editor.logoUrl, coverUrl: editor.coverUrl };
    const slug = editor.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) { setFeedback("O identificador público deve usar letras minúsculas, números e hífens."); return; }
    if (listRegisteredEstablishments().some((item) => item.id !== editing.id && (item.slug.toLowerCase() === slug || item.publicSlugAliases?.some((alias) => alias.toLowerCase() === slug)))) { setFeedback("Este endereço público já pertence a outro estabelecimento."); return; }
    if (slug !== editing.slug && !await confirm({ title: "Alterar link público?", description: `O endereço mudará de /e/${editing.slug} para /e/${slug}. Links antigos podem deixar de funcionar fora do Agendito. Um alias local será mantido neste navegador; o identificador interno e os dados não serão alterados.`, confirmLabel: "Alterar link" })) return;
    const publicSlugAliases = slug === editing.slug ? editing.publicSlugAliases : [...new Set([...(editing.publicSlugAliases ?? []), editing.slug])];
    const updated = { ...next, name: editor.establishmentName.trim() || editing.name, slug, publicSlugAliases, address: { street: editor.addressStreet, number: editor.addressNumber, district: editor.addressDistrict, postalCode: editor.addressPostalCode, city: editor.addressCity, state: editor.addressState }, phone: editor.contactPhone, segment: editor.segment, simulatedContractStatus: editor.simulatedContractStatus, enabledFeatures: editor.enabledFeatures, featureConfigVersion: 2 };
    const previousFeatures = new Set(getEnabledFeatureIds(editing));
    const pageDesign: PageDesignConfig = { ...getPlatformPublicPageDraft(updated), template: "editorial", heroTitle: editor.heroTitle, heroSubtitle: editor.heroSubtitle, aboutText: editor.aboutText, backgroundColor: editor.backgroundColor, primaryColor: editor.primaryColor, secondaryColor: editor.secondaryColor, backgroundImageUrl: editor.backgroundImageUrl, logoUrl: editor.logoUrl, profileImageUrl: editor.profileImageUrl, coverUrl: editor.coverUrl };
    if (!platformRepository.establishments.save(updated) || !savePublicPageDraft(updated, pageDesign)) {
      setFeedback("Não foi possível salvar a página.");
      return;
    }
    setEditing(updated);
    track(updated, "Cadastro comercial e rascunho da página atualizados");
    const enabledNow = new Set(editor.enabledFeatures);
    PLATFORM_FEATURES.forEach((feature) => {
      if (previousFeatures.has(feature.id) !== enabledNow.has(feature.id)) track(updated, `${enabledNow.has(feature.id) ? "Recurso habilitado" : "Recurso desabilitado"}: ${feature.label}`);
    });
    refresh();
    setFeedback("Estabelecimento atualizado. O conteúdo público não muda até publicar as alterações.");
  }

  function updateOperationalStatus(establishment: PlatformEstablishmentRecord, status: "ACTIVE" | "INACTIVE" | "SUSPENDED") {
    const updated = createEstablishmentLifecycleUpdate(establishment, status, suspensionReason);
    if (!platformRepository.establishments.save(updated)) { setFeedback("Não foi possível salvar o status neste navegador."); return; }
    track(updated, status === "ACTIVE" ? "Estabelecimento reativado" : status === "INACTIVE" ? "Estabelecimento desativado" : `Estabelecimento suspenso: ${updated.suspensionReason || "sem motivo informado"}`);
    if (status === "ACTIVE") emitEstablishmentNotification(updated.id, "ESTABLISHMENT_REACTIVATED", updated.name);
    if (status === "SUSPENDED") emitEstablishmentNotification(updated.id, "ESTABLISHMENT_SUSPENDED", updated.name);
    setDetails((current) => current?.id === updated.id ? updated : current);
    refresh();
    setPendingAction(null); setSuspensionReason("");
    setFeedback(`${updated.name} agora está ${statusLabels[status].toLowerCase()}.`);
  }

  function toggleArchive(establishment: PlatformEstablishmentRecord) {
    const restoring = getEstablishmentStatus(establishment) === "ARCHIVED";
    const restoreTo = establishment.statusBeforeArchive && establishment.statusBeforeArchive !== "DRAFT" ? establishment.statusBeforeArchive : "INACTIVE";
    const updated = restoring ? createEstablishmentLifecycleUpdate(establishment, restoreTo) : createEstablishmentLifecycleUpdate(establishment, "ARCHIVED");
    if (!platformRepository.establishments.save(updated)) { setFeedback("Não foi possível arquivar o estabelecimento."); return; }
    track(updated, restoring ? `Estabelecimento restaurado para ${statusLabels[restoreTo].toLowerCase()}` : "Estabelecimento arquivado sem excluir dados");
    if (restoring && restoreTo === "ACTIVE") emitEstablishmentNotification(updated.id, "ESTABLISHMENT_REACTIVATED", updated.name);
    setDetails((current) => current?.id === updated.id ? updated : current);
    setPage(1);
    refresh();
    setPendingAction(null);
    setFeedback(restoring ? `${updated.name} foi restaurado. Os dados e vínculos foram preservados.` : `${updated.name} foi arquivado. Os dados e vínculos foram preservados.`);
  }

  function exportEstablishments() {
    const bundle = {
      exportedAt: new Date().toISOString(),
      summary: { establishments: snapshot.total, active: snapshot.active, inactive: snapshot.inactive, suspended: snapshot.suspended, publishedPages: snapshot.publishedPages },
      establishments: establishments.map((establishment) => ({
        id: establishment.id,
        name: establishment.name,
        slug: establishment.slug,
        segment: establishment.segment,
        createdAt: establishment.createdAt,
        status: getEstablishmentStatus(establishment),
        publicPageStatus: getPublicPageStatus(platformRepository.publicPages.findByEstablishment(establishment.id), establishment),
        publicPage: (() => {
          const page = platformRepository.publicPages.findByEstablishment(establishment.id);
          if (!page) return null;
          return { status: page.status, template: page.template, palette: page.palette, heroTitle: page.heroTitle, publicName: page.publicName, heroSubtitle: page.heroSubtitle, aboutText: page.aboutText, backgroundColor: page.backgroundColor, primaryColor: page.primaryColor, secondaryColor: page.secondaryColor, buttonColor: page.buttonColor, logoUrl: page.logoUrl, coverUrl: page.coverUrl, backgroundImageUrl: page.backgroundImageUrl, galleryImages: page.galleryImages, cardStyle: page.cardStyle, typography: page.typography, cornerRadius: page.cornerRadius, buttonCornerRadius: page.buttonCornerRadius, sectionSpacing: page.sectionSpacing, sections: page.sections };
        })(),
        manager: platformRepository.managers.getManagerContact(establishment.id),
      })),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "agendito-dados-demonstrativos.json"; anchor.click(); URL.revokeObjectURL(url);
    setFeedback("Dados demonstrativos exportados.");
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setFeedback("Link copiado."); }
    catch { setFeedback(value); }
  }

  return <PageShell as="main" className="platform-shell">
    <PageHeader variant="content" className="platform-header platform-dashboard-header" style={{ padding: 0, border: 0, borderRadius: 0, background: "transparent", boxShadow: "none" }} breadcrumbs={<><Link href="/platform/establishments#platform-dashboard">Dashboard</Link><span aria-hidden="true">/</span><span>Home</span></>} eyebrow="Visão geral" title="Painel da plataforma" description="Visão global e gestão independente dos estabelecimentos cadastrados." />
    <PageSection className="platform-grid" aria-label="Cadastro de estabelecimentos">
      <EstablishmentProvisioningWizard anchorId="platform-new-establishment" onCreated={(message) => { setFeedback(message); refresh(); }} />
    </PageSection>
    {feedback && !feedback.toLocaleLowerCase("pt-BR").includes("página excluída") && <p className="platform-feedback platform-global-feedback" role="status">{feedback}</p>}
    <PageSection id="platform-dashboard" className="owner-dashboard" aria-label="Painel global da plataforma">
      <ContentGrid className="owner-metric-grid">
        <StatCard className="owner-metric" label="Estabelecimentos" value={snapshot.total} detail="Cadastros não arquivados" icon={<Building2 />} />
        <StatCard className="owner-metric" label="Ativos" value={snapshot.active} detail="Operação liberada" icon={<CheckCircle2 />} tone="success" />
        <StatCard className="owner-metric" label="Inativos" value={snapshot.inactive} detail="Temporariamente desativados" icon={<Store />} />
        <StatCard className="owner-metric" label="Suspensos" value={snapshot.suspended} detail="Operação interrompida" icon={<ShieldAlert />} tone="warning" />
        <StatCard className="owner-metric" label="Páginas criadas" value={snapshot.pagesCreated} detail="Vinculadas aos cadastros" icon={<LayoutTemplate />} />
        <StatCard className="owner-metric" label="Publicadas" value={snapshot.publishedPages} detail="Visíveis publicamente" icon={<ExternalLink />} />
        <StatCard className="owner-metric" label="Despublicadas" value={snapshot.unpublishedPages} detail="Fora do ar" icon={<Eye />} />
        <StatCard className="owner-metric" label="Rascunhos" value={snapshot.draftPages} detail="Ainda não publicadas" icon={<Pencil />} />
      </ContentGrid>
      <div className="owner-dashboard-panels">
        <GlassSurface material="frosted" className="owner-chart-panel owner-quick-panel">
          <div className="owner-panel-heading"><div><Zap size={19} /><h3>Ações rápidas</h3></div></div>
          <p className="owner-panel-description">Acesse as operações mais usadas da plataforma.</p>
          <div className="owner-quick-actions">
            <Link className="owner-quick-action" href="#platform-establishments"><span><Building2 size={18} /></span><span><strong>Gerenciar estabelecimentos</strong><small>Consultar e administrar cadastros</small></span><ArrowRight size={17} /></Link>
            <Link className="owner-quick-action" href="/platform/pages"><span><LayoutTemplate size={18} /></span><span><strong>Gerenciar páginas</strong><small>Visualizar e publicar páginas públicas</small></span><ArrowRight size={17} /></Link>
            <button className="owner-quick-action" type="button" onClick={exportEstablishments}><span><Download size={18} /></span><span><strong>Exportar cadastro</strong><small>Baixar os dados cadastrados</small></span><ArrowRight size={17} /></button>
          </div>
        </GlassSurface>
      <GlassSurface material="frosted" className="owner-chart-panel owner-feature-panel" id="platform-features">
          <div className="owner-panel-heading"><div><CheckCircle2 size={19} /><h3>Recursos em uso</h3></div></div>
          <p className="owner-panel-description">Recursos habilitados nos estabelecimentos ativos.</p>
          <div className="owner-activity-list">{snapshot.featureUsage.filter((feature) => feature.enabled > 0).map((feature) => <div className="owner-feature-summary" key={feature.featureId}><span className="owner-feature-check"><CheckCircle2 size={16} /></span><span><strong>{PLATFORM_FEATURES.find((item) => item.id === feature.featureId)?.label ?? feature.featureId}</strong><small>Habilitado em {feature.enabled} de {feature.total}</small></span></div>)}</div>
          {!snapshot.featureUsage.some((feature) => feature.enabled > 0) && <p className="owner-empty-inline">Nenhum recurso habilitado nos estabelecimentos ativos.</p>}
        </GlassSurface>
        <GlassSurface material="frosted" className="owner-chart-panel owner-activity-panel">
          <div className="owner-panel-heading"><div><Clock3 size={19} /><h3>Atividade recente</h3></div></div>
          <p className="owner-panel-description">Últimas ações administrativas registradas.</p>
          {recentActions.length ? <div className="owner-activity-list">{recentActions.map((action) => {
            const establishment = establishments.find((item) => item.id === action.establishmentId);
            return <button className="owner-activity-row" key={action.id} type="button" disabled={!establishment} onClick={() => establishment && setDetails(establishment)}><span className="owner-activity-icon"><FileText size={17} /></span><span><strong>{action.action}</strong><small>{action.establishmentName}</small></span><time>{new Date(action.occurredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time></button>;
          })}</div> : <p className="owner-empty-inline">As ações registradas aparecerão aqui.</p>}
          <Link className="owner-activity-link" href="#platform-establishments">Ver estabelecimentos <ArrowRight size={15} /></Link>
        </GlassSurface>
      </div>
    </PageSection>
    <PageSection id="platform-establishments" className="platform-grid" aria-label="Gestão e provisionamento de estabelecimentos">
      <section className={`platform-list owner-establishment-list${establishments.length === 0 ? " is-empty" : ""}`}>
        {establishments.length > 0 && <SectionHeader className="platform-section-heading"><span className="platform-icon"><Store size={18} /></span><div><h2>Estabelecimentos</h2><p>{filteredEstablishments.length} de {establishments.length} registros · cadastro e publicação das páginas.</p></div></SectionHeader>}
        {establishments.length > 0 && <div className="owner-list-toolbar"><GlassInput label="Pesquisar" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nome, responsável, segmento ou identificador" leadingIcon={<Search size={16} />} /><GlassSelect label="Status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} options={[{ value: "all", label: "Todos os status" }, { value: "ACTIVE", label: "Ativos" }, { value: "INACTIVE", label: "Inativos" }, { value: "SUSPENDED", label: "Suspensos" }, { value: "archived", label: "Arquivados" }]} /><GlassButton variant="quiet" onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}><ArrowDown size={15} />Nome <span className="owner-sort-icon">{sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}</span></GlassButton></div>}
        {establishments.length === 0 && <GlassSurface material="regular" className="platform-empty-state">
          <span className="platform-empty-icon"><Building2 size={22} aria-hidden="true" /></span>
          <div><h3>Nenhum estabelecimento ainda</h3><p>Os estabelecimentos cadastrados aparecerão aqui. Crie o primeiro para começar.</p></div>
        </GlassSurface>}
        {establishments.length > 0 && <DataTable className="owner-establishment-table-wrap" tableClassName="owner-establishment-table"><thead><tr><th>Estabelecimento</th><th>Identificador / segmento</th><th>Responsável</th><th>Status</th><th>Página pública</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>
        {visibleEstablishments.map((establishment) => {
          const admin = platformRepository.managers.getManagerContact(establishment.id);
          const pageStatus = getPublicPageStatus(platformRepository.publicPages.findByEstablishment(establishment.id), establishment);
          const operationalStatus = getEstablishmentStatus(establishment);
          return <tr key={establishment.id} className={operationalStatus === "ARCHIVED" ? "is-archived" : ""}>
          <td><strong>{establishment.name}</strong><small>{establishment.address.city || "Cidade não informada"}</small></td>
          <td><code>{establishment.slug}</code><small>{establishment.segment ?? "Segmento não informado"}</small></td>
          <td><strong>{admin?.name ?? "Não informado"}</strong><small>{admin?.email ?? "Sem gestor vinculado"}</small></td>
          <td><StatusBadge tone={operationalStatus === "ACTIVE" ? "success" : operationalStatus === "SUSPENDED" ? "danger" : operationalStatus === "ARCHIVED" ? "warning" : "neutral"}>{statusLabels[operationalStatus]}</StatusBadge></td>
          <td><span className={`owner-page-badge ${pageStatus === "PUBLISHED" ? "is-published" : pageStatus === "UNPUBLISHED" ? "is-unpublished" : "is-draft"}`}>{pageStatus === "PUBLISHED" ? "Publicada" : pageStatus === "UNPUBLISHED" ? "Despublicada" : "Rascunho"}</span></td>
          <td>{establishment.createdAt ? new Date(establishment.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
          <td><div className="owner-row-actions">
            <GlassButton size="sm" variant="quiet" onClick={() => setDetails(establishment)} aria-label={`Ver detalhes de ${establishment.name}`}><Eye size={14} /></GlassButton>
            <GlassButton asChild size="sm" variant="quiet"><Link href={`/platform/establishments/${encodeURIComponent(establishment.id)}/page-builder`} aria-label={`Personalizar página de ${establishment.name}`} title={`Personalizar página de ${establishment.name}`}><LayoutTemplate size={14} /></Link></GlassButton>
            <GlassButton size="sm" variant="quiet" onClick={() => startEditing(establishment)} aria-label={`Editar ${establishment.name}`}><Pencil size={14} /></GlassButton>
            <GlassButton size="sm" variant="quiet" onClick={() => copy(`${window.location.origin}/e/${establishment.slug}`)} aria-label={`Copiar página pública de ${establishment.name}`}><Copy size={14} /></GlassButton>
            <GlassButton asChild size="sm" variant="ghost"><Link href={`/e/${establishment.slug}`} target="_blank" aria-label={`Abrir página pública de ${establishment.name}`}><ExternalLink size={14} /></Link></GlassButton>
            {operationalStatus !== "ARCHIVED" && operationalStatus !== "SUSPENDED" && <GlassButton size="sm" variant="quiet" onClick={() => { setSuspensionReason(""); setPendingAction({ establishment, action: "suspend" }); }} aria-label={`Suspender ${establishment.name}`}><ShieldAlert size={14} /></GlassButton>}
            {operationalStatus !== "ARCHIVED" && operationalStatus !== "ACTIVE" && <GlassButton size="sm" variant="quiet" onClick={() => updateOperationalStatus(establishment, "ACTIVE")} aria-label={`Reativar ${establishment.name}`}><CheckCircle2 size={14} /></GlassButton>}
            {operationalStatus !== "ARCHIVED" && operationalStatus === "ACTIVE" && <GlassButton size="sm" variant="quiet" onClick={() => updateOperationalStatus(establishment, "INACTIVE")} aria-label={`Desativar ${establishment.name}`}><Store size={14} /></GlassButton>}
            <GlassButton size="sm" variant="quiet" onClick={() => setPendingAction({ establishment, action: "archive" })} aria-label={`${operationalStatus === "ARCHIVED" ? "Restaurar" : "Arquivar"} ${establishment.name}`}><Archive size={14} /></GlassButton>
          </div></td>
        </tr>; })}
        </tbody></DataTable>}
        {establishments.length > 0 && filteredEstablishments.length === 0 && <p className="owner-empty-inline">Nenhum estabelecimento corresponde à pesquisa e aos filtros selecionados.</p>}
        {filteredEstablishments.length > PAGE_SIZE && <Pagination current={page} total={totalPages} onChange={setPage} className="owner-pagination" />}
      </section>
    </PageSection>
    {editing && editor && <PageSection className="platform-editor" aria-label={`Editor visual de ${editing.name}`}>
      <SectionHeader className="platform-editor-heading"><div><span className="eyebrow">Editor visual</span><h2>{editing.name}</h2><p>Personalize diretamente as cores, imagens e textos da página.</p></div><GlassButton variant="quiet" onClick={() => { setEditing(null); setEditor(null); }}>Fechar editor</GlassButton></SectionHeader>
      <div className="platform-editor-grid">
        <GlassSurface material="frosted" className="platform-editor-panel">
          <div className="platform-subheading"><Store size={17} /><h3>Cores da página</h3></div>
          <p>Edite as cores diretamente ou use o construtor para ajustar as imagens e os detalhes visuais.</p>
        </GlassSurface>
        <GlassSurface material="frosted" className="platform-editor-panel">
          <div className="platform-subheading"><Pencil size={17} /><h3>Conteúdo e aparência</h3></div>
          <div className="platform-form">
            <GlassInput label="Nome do estabelecimento" value={editor.establishmentName} onChange={(event) => setEditor({ ...editor, establishmentName: event.target.value })} required />
            <GlassInput label="Identificador público" value={editor.slug} onChange={(event) => setEditor({ ...editor, slug: event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} hint="O identificador interno permanecerá o mesmo." />
            <GlassInput label="Título principal" value={editor.heroTitle} onChange={(event) => setEditor({ ...editor, heroTitle: event.target.value })} />
            <GlassInput label="Texto de destaque" value={editor.heroSubtitle} onChange={(event) => setEditor({ ...editor, heroSubtitle: event.target.value })} />
            <GlassInput label="Texto sobre o estabelecimento" value={editor.aboutText} onChange={(event) => setEditor({ ...editor, aboutText: event.target.value })} />
            <GlassInput label="Segmento" value={editor.segment} onChange={(event) => setEditor({ ...editor, segment: event.target.value })} placeholder="Ex.: Barbearia" />
            <GlassSelect label="Situação do contrato simulado" value={editor.simulatedContractStatus ?? "NOT_CONFIGURED"} onChange={(event) => setEditor({ ...editor, simulatedContractStatus: event.target.value === "NOT_CONFIGURED" ? undefined : event.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED" })} options={[{ value: "NOT_CONFIGURED", label: "Não configurado" }, { value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }, { value: "SUSPENDED", label: "Suspenso" }]} />
            <GlassInput label="Rua" value={editor.addressStreet} onChange={(event) => setEditor({ ...editor, addressStreet: event.target.value })} />
            <div className="platform-form-row"><GlassInput label="Número" value={editor.addressNumber} onChange={(event) => setEditor({ ...editor, addressNumber: event.target.value })} /><GlassInput label="Bairro" value={editor.addressDistrict} onChange={(event) => setEditor({ ...editor, addressDistrict: event.target.value })} /></div>
            <GlassInput label="CEP" value={editor.addressPostalCode} onChange={(event) => setEditor({ ...editor, addressPostalCode: event.target.value })} />
            <div className="platform-form-row"><GlassInput label="Cidade" value={editor.addressCity} onChange={(event) => setEditor({ ...editor, addressCity: event.target.value })} /><GlassInput label="Estado" value={editor.addressState} onChange={(event) => setEditor({ ...editor, addressState: event.target.value })} /></div>
            <GlassInput label="Telefone" value={editor.contactPhone} onChange={(event) => setEditor({ ...editor, contactPhone: event.target.value })} />
            <GlassInput label="URL da foto ou logo circular" value={editor.logoUrl ?? ""} onChange={(event) => setEditor({ ...editor, logoUrl: event.target.value })} placeholder="/brand/minha-logo.svg" />
            <GlassInput label="URL da capa horizontal" value={editor.coverUrl ?? ""} onChange={(event) => setEditor({ ...editor, coverUrl: event.target.value })} placeholder="/images/minha-capa.jpg" />
            <div className="platform-form-row">
              <GlassInput label="Cor de fundo" value={editor.backgroundColor} onChange={(event) => setEditor({ ...editor, backgroundColor: event.target.value })} placeholder="#f4f2ec" />
            </div>
            <div className="platform-form-row"><GlassInput label="Cor principal" type="color" value={editor.primaryColor ?? "#91b895"} onChange={(event) => setEditor({ ...editor, primaryColor: event.target.value })} /><GlassInput label="Cor secundária" type="color" value={editor.secondaryColor ?? "#e2a078"} onChange={(event) => setEditor({ ...editor, secondaryColor: event.target.value })} /></div>
            <section className="onboarding-feature-list"><strong>Funcionalidades habilitadas</strong>{PLATFORM_FEATURES.map((feature) => <label key={feature.id}><input type="checkbox" checked={editor.enabledFeatures.includes(feature.id)} onChange={(event) => setEditor({ ...editor, enabledFeatures: event.target.checked ? [...editor.enabledFeatures, feature.id] : editor.enabledFeatures.filter((item) => item !== feature.id) })} /><span><strong>{feature.label}</strong><small>{feature.description}</small></span></label>)}</section>
            <div className="platform-editor-actions"><GlassButton variant="primary" onClick={saveEditor}>Salvar informações e rascunho</GlassButton><GlassButton variant="quiet" onClick={() => setPendingAction({ establishment: editing, action: "archive" })}><Archive size={15} />Arquivar estabelecimento</GlassButton></div>
          </div>
        </GlassSurface>
      </div>
    </PageSection>}
    <GlassModal open={Boolean(pendingAction)} onClose={() => { setPendingAction(null); setSuspensionReason(""); }} title={pendingAction?.action === "suspend" ? "Suspender estabelecimento?" : pendingAction && getEstablishmentStatus(pendingAction.establishment) === "ARCHIVED" ? "Restaurar estabelecimento?" : "Arquivar estabelecimento?"} description={pendingAction ? `${pendingAction.establishment.name}: os dados locais e os vínculos operacionais serão preservados.` : undefined} footer={<><GlassButton variant="quiet" onClick={() => { setPendingAction(null); setSuspensionReason(""); }}>Cancelar</GlassButton><GlassButton variant="primary" disabled={pendingAction?.action === "suspend" && !suspensionReason.trim()} onClick={() => pendingAction && (pendingAction.action === "suspend" ? updateOperationalStatus(pendingAction.establishment, "SUSPENDED") : toggleArchive(pendingAction.establishment))}>{pendingAction?.action === "suspend" ? "Suspender" : pendingAction && getEstablishmentStatus(pendingAction.establishment) === "ARCHIVED" ? "Restaurar" : "Arquivar"}</GlassButton></>}><p>{pendingAction?.action === "suspend" ? "O acesso ao painel e as operações ficarão bloqueados até a reativação." : "Arquivar preserva todos os registros para consulta do proprietário."}</p>{pendingAction?.action === "suspend" && <GlassInput label="Motivo da suspensão" value={suspensionReason} onChange={(event) => setSuspensionReason(event.target.value)} required />}</GlassModal>
    <GlassModal open={Boolean(details)} onClose={() => setDetails(null)} title={details?.name ?? "Detalhes do estabelecimento"} description={details ? `${details.address.city || "Cidade não informada"} · ${details.slug}` : undefined} footer={details ? <><GlassButton variant="quiet" onClick={() => { setDetails(null); startEditing(details); }}><Pencil size={15} />Editar dados</GlassButton><GlassButton asChild variant="ghost"><Link href={`/e/${details.slug}`} target="_blank"><ExternalLink size={15} />Página pública</Link></GlassButton></> : undefined}>
      {details && <div className="owner-detail-content"><div className="owner-detail-grid"><div><span>Responsável</span><strong>{platformRepository.managers.getManagerContact(details.id)?.name ?? "Não informado"}</strong><small>{platformRepository.managers.getManagerContact(details.id)?.email ?? "Sem gestor vinculado"}</small></div><div><span>Status</span><strong>{statusLabels[getEstablishmentStatus(details)]}</strong>{details.suspensionReason && <small>{details.suspensionReason}</small>}</div><div><span>Página pública</span><strong>{{ PUBLISHED: "Publicada", DRAFT: "Rascunho", UNPUBLISHED: "Despublicada" }[getPublicPageStatus(platformRepository.publicPages.findByEstablishment(details.id), details)]}</strong></div><div><span>Data de cadastro</span><strong>{details.createdAt ? new Date(details.createdAt).toLocaleDateString("pt-BR") : "Data não informada"}</strong></div><div><span>Contato administrativo</span><strong>{details.phone || "Telefone não informado"}</strong><small>{details.address.city || "Cidade não informada"}</small></div><div><span>Funcionalidades habilitadas</span><strong>{getEnabledFeatureIds(details).map((id) => PLATFORM_FEATURES.find((feature) => feature.id === id)?.label ?? id).join(" · ") || "Nenhum recurso habilitado"}</strong></div></div><section className="owner-history"><h3>Histórico de ações administrativas</h3>{listPlatformActions(details.id).length ? listPlatformActions(details.id).slice(0, 8).map((action) => <div key={action.id}><span>{action.action}</span><time>{new Date(action.occurredAt).toLocaleString("pt-BR")}</time></div>) : <p>Nenhuma ação administrativa registrada ainda.</p>}</section></div>}
    </GlassModal>
    <footer className="platform-footer"><span>Agendito</span><span aria-hidden="true">·</span><span>Console do proprietário</span></footer>
  </PageShell>;
}
