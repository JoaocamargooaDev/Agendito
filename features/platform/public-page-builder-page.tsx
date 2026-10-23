"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Eye, LayoutTemplate, Monitor, RotateCcw, Save, Smartphone, Tablet, Upload, X } from "lucide-react";
import { GlassButton, GlassInput, GlassSelect, GlassSurface, useConfirmation } from "@/components/ui";
import { PageHeader, PageSection, PageShell } from "@/components/admin/page-layout";
import { findPlatformEstablishment, listPlatformEstablishments, getPlatformPageConfig } from "@/features/platform/storage";
import { createDefaultPageDesignConfig, getPlatformPublicPageDraft, getPlatformPublishedPageContent, publishPublicPageDraft, PUBLIC_PAGE_SECTIONS, savePublicPageDraft, setPublicPagePublicationStatus } from "@/features/platform/public-page-builder";
import { getPublicPageStatus } from "@/features/platform/domain";
import { recordPlatformAction } from "@/features/platform/owner-dashboard";
import { PublicPageRenderer } from "@/features/public-establishment/public-establishment-page";
import type { PageDesignConfig, PublicSectionId } from "@/types";
import type { PlatformEstablishmentRecord } from "./repository-contracts";
import { applyPublicPageTemplate, applySavedPublicPageTemplate, getCatalogTemplateId, listSavedPublicPageTemplates, PUBLIC_PAGE_TEMPLATES, savePublicPageTemplate, type SavedPublicPageTemplate } from "@/features/platform/public-page-templates";
import { PLATFORM_PAGE_PREVIEW_ESTABLISHMENT, PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA } from "@/features/platform/public-page-preview-data";

type EditorTab = "templates" | "identity" | "sections" | "booking";
type PreviewSize = "desktop" | "tablet" | "mobile";
type PendingTemplate = { name: string; apply: (content: PageDesignConfig) => PageDesignConfig };
const titleForStatus = { PUBLISHED: "Publicada", DRAFT: "Rascunho", UNPUBLISHED: "Despublicada" } as const;
const isColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const paletteColors = { moss: ["#3f5845", "#758276"], copper: ["#b06f49", "#e2a078"], sand: ["#a98258", "#e0bf83"], ink: ["#28312c", "#bac8be"], sage: ["#758276", "#b7c9aa"] } as const;

export function PublicPageBuilderPage({ establishmentId }: { establishmentId: string }) {
  const confirm = useConfirmation();
  const [establishment, setEstablishment] = useState<PlatformEstablishmentRecord | null>(null);
  const [resolved, setResolved] = useState(false);
  const [draft, setDraft] = useState<PageDesignConfig | null>(null);
  const [published, setPublished] = useState<PageDesignConfig | null>(null);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "UNPUBLISHED">("DRAFT");
  const [tab, setTab] = useState<EditorTab>("identity");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState(false);
  const [galleryInput, setGalleryInput] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedPublicPageTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [pendingTemplate, setPendingTemplate] = useState<PendingTemplate | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = findPlatformEstablishment(establishmentId);
      setEstablishment(current);
      setResolved(true);
      if (!current) return;
      const page = getPlatformPageConfig(current.id);
      setDraft(getPlatformPublicPageDraft(current));
      setPublished(getPlatformPublishedPageContent(page));
      setStatus(getPublicPageStatus(page, current));
      setSavedTemplates(listSavedPublicPageTemplates());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [establishmentId]);

  const publicUrl = establishment && typeof window !== "undefined" ? `${window.location.origin}/e/${establishment.slug}` : "";

  function update(patch: Partial<PageDesignConfig>) { setDraft((current) => current ? { ...current, ...patch } : current); }
  function updateSection(id: PublicSectionId, patch: Partial<NonNullable<PageDesignConfig["sections"]>[number]>) {
    setDraft((current) => current ? { ...current, sections: (current.sections ?? []).map((section) => section.id === id ? { ...section, ...patch } : section) } : current);
  }
  function announce(message: string, error = false) { setFeedback(message); setFeedbackError(error); }

  function saveDraft() {
    if (!establishment || !draft) return;
    if (!draft.heroTitle.trim() || !draft.publicName?.trim()) { announce("Informe o título principal e o nome público.", true); return; }
    if (![draft.backgroundColor, draft.primaryColor, draft.secondaryColor, draft.buttonColor].every((color) => !color || isColor(color))) { announce("Revise as cores: use o formato hexadecimal, como #3979bd.", true); return; }
    const saved = savePublicPageDraft(establishment, draft);
    if (!saved) { announce("Não foi possível salvar o rascunho neste navegador.", true); return; }
    recordPlatformAction(establishment, "Rascunho da página pública salvo");
    setStatus(saved.status ?? "DRAFT");
    setPublished(getPlatformPublishedPageContent(saved));
    announce("Rascunho salvo. A página pública continua com a última versão publicada.");
  }

  function publish() {
    if (!establishment || !draft) return;
    if (!draft.heroTitle.trim() || !draft.publicName?.trim()) { announce("Informe o título principal e o nome público antes de publicar.", true); return; }
    const saved = publishPublicPageDraft(establishment, draft);
    if (!saved) { announce("Não foi possível publicar as alterações neste navegador.", true); return; }
    recordPlatformAction(establishment, "Alterações da página pública publicadas");
    setStatus("PUBLISHED");
    setPublished(getPlatformPublishedPageContent(saved));
    announce("Alterações publicadas. A página pública já usa esta versão.");
  }

  async function unpublish() {
    if (!establishment || !await confirm({ title: "Despublicar página?", description: "O conteúdo publicado será preservado e poderá ser publicado novamente depois.", destructive: true, confirmLabel: "Despublicar" })) return;
    const saved = setPublicPagePublicationStatus(establishment, "UNPUBLISHED");
    if (!saved) { announce("Não foi possível despublicar a página.", true); return; }
    recordPlatformAction(establishment, "Página pública despublicada");
    setStatus("UNPUBLISHED");
    announce("Página despublicada. O conteúdo publicado foi preservado.");
  }

  async function restoreDefaults() {
    if (!establishment || !await confirm({ title: "Restaurar configurações padrão?", description: "O rascunho atual será substituído, mas a versão publicada continuará intacta até você publicar novamente.", destructive: true, confirmLabel: "Restaurar padrão" })) return;
    setDraft(createDefaultPageDesignConfig(establishment));
    announce("Configuração padrão carregada no editor. Salve como rascunho ou publique para aplicar.");
  }

  function duplicateFrom(sourceId: string) {
    const source = listPlatformEstablishments().find((item) => item.id === sourceId);
    if (!source || !establishment || !draft) return;
    const sourceContent = getPlatformPublishedPageContent(getPlatformPageConfig(source.id)) ?? getPlatformPublicPageDraft(source);
    setDraft({ ...sourceContent, heroTitle: establishment.name, publicName: establishment.name, logoUrl: establishment.logoUrl, coverUrl: establishment.coverUrl, galleryImages: [...(sourceContent.galleryImages ?? [])], sections: sourceContent.sections?.map((section) => ({ ...section })) });
    announce(`Configuração visual copiada de ${source.name}. As imagens e a estrutura agora podem ser ajustadas para este estabelecimento.`);
  }

  async function uploadImage(file: File | undefined, field: "logoUrl" | "coverUrl") {
    if (!file) return;
    if (file.size > 700_000) { announce("Escolha uma imagem de até 700 KB para manter o armazenamento local disponível.", true); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Arquivo inválido")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }).catch(() => null);
    if (!data) { announce("Não foi possível carregar esta imagem.", true); return; }
    update({ [field]: data }); announce("Imagem carregada. Salve como rascunho para manter a alteração.");
  }

  function setGallery() {
    const urls = galleryInput.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 12);
    update({ galleryImages: urls }); announce(`${urls.length} imagem(ns) de apresentação adicionada(s) ao rascunho.`);
  }

  function addFaq() {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    update({ faq: [...(draft?.faq ?? []), { question: faqQuestion.trim(), answer: faqAnswer.trim() }] });
    setFaqQuestion(""); setFaqAnswer("");
  }

  function moveSection(index: number, offset: -1 | 1) {
    const sections = [...(draft?.sections ?? [])]; const next = index + offset;
    if (next < 0 || next >= sections.length) return;
    [sections[index], sections[next]] = [sections[next], sections[index]];
    update({ sections });
  }

  function askForTemplate(name: string, apply: PendingTemplate["apply"]) {
    setPendingTemplate({ name, apply });
  }

  function applyPendingTemplate() {
    if (!pendingTemplate || !draft) return;
    setDraft(pendingTemplate.apply(draft));
    announce(`Template “${pendingTemplate.name}” aplicado ao rascunho. Sua identidade e os dados do estabelecimento foram preservados.`);
    setPendingTemplate(null);
  }

  function saveCurrentAsTemplate() {
    if (!draft) return;
    const saved = savePublicPageTemplate(templateName, draft);
    if (!saved) { announce("Não foi possível salvar este template neste navegador. Verifique o espaço disponível.", true); return; }
    setSavedTemplates((current) => [...current, saved]);
    setTemplateName("");
    announce(`Template “${saved.name}” salvo na biblioteca deste navegador.`);
  }

  function duplicateSavedTemplate(template: SavedPublicPageTemplate) {
    const saved = savePublicPageTemplate(`${template.name} (cópia)`, template.content);
    if (!saved) { announce("Não foi possível duplicar este template neste navegador.", true); return; }
    setSavedTemplates((current) => [...current, saved]);
    announce(`Cópia de “${template.name}” salva na biblioteca.`);
  }

  async function restoreCurrentTemplate() {
    if (!draft || !await confirm({ title: "Restaurar composição do template?", description: "Nome, textos, imagens, serviços, profissionais e configurações de agendamento serão preservados.", confirmLabel: "Restaurar composição" })) return;
    const templateId = getCatalogTemplateId(draft.template);
    setDraft((current) => current ? applyPublicPageTemplate(current, templateId) : current);
    announce("Composição padrão restaurada no rascunho. Publique para atualizar a página pública.");
  }

  if (!resolved) return <PageShell as="main" className="platform-shell page-builder-shell"><GlassSurface material="frosted"><h1>Abrindo o construtor da página…</h1></GlassSurface></PageShell>;
  if (!establishment || !draft) return <PageShell as="main" className="platform-shell page-builder-shell"><GlassSurface material="frosted"><h1>Estabelecimento não encontrado</h1><GlassButton asChild variant="quiet"><Link href="/platform/establishments"><ArrowLeft size={16} />Voltar ao console</Link></GlassButton></GlassSurface></PageShell>;


  return <PageShell as="main" className="platform-shell page-builder-shell">
    <PageHeader variant="content" className="page-builder-header platform-header" breadcrumbs={<><Link href="/platform/establishments" className="page-builder-back"><ArrowLeft size={16} /> Console do proprietário</Link><span className={`owner-page-badge ${status === "PUBLISHED" ? "is-published" : status === "UNPUBLISHED" ? "is-unpublished" : "is-draft"}`}>{titleForStatus[status]}</span></>} title="Construtor da página pública" description={`${establishment.name} · /e/${establishment.slug}`} actionsClassName="page-builder-actions" actions={<><GlassButton asChild variant="quiet"><Link href={`/e/${establishment.slug}`} target="_blank"><Eye size={16} />Abrir versão pública</Link></GlassButton><GlassButton variant="quiet" onClick={saveDraft}><Save size={16} />Salvar rascunho</GlassButton><GlassButton variant="primary" onClick={publish}>Publicar alterações</GlassButton></>} />
    {feedback && <p className={`page-builder-feedback${feedbackError ? " is-error" : ""}`} role="status">{feedback}</p>}
    <PageSection className="page-builder-workspace" aria-label="Configuração e prévia da página pública">
      <section className="page-builder-controls" aria-label="Configurações da página">
        <div className="page-builder-tabs" role="tablist" aria-label="Editor da página">
          <button type="button" role="tab" aria-selected={tab === "templates"} className={tab === "templates" ? "is-active" : ""} onClick={() => setTab("templates")}><LayoutTemplate size={15} />Templates</button>
          <button type="button" role="tab" aria-selected={tab === "identity"} className={tab === "identity" ? "is-active" : ""} onClick={() => setTab("identity")}>Identidade</button>
          <button type="button" role="tab" aria-selected={tab === "sections"} className={tab === "sections" ? "is-active" : ""} onClick={() => setTab("sections")}>Estrutura</button>
          <button type="button" role="tab" aria-selected={tab === "booking"} className={tab === "booking" ? "is-active" : ""} onClick={() => setTab("booking")}>Agendamento</button>
        </div>

        {tab === "templates" && <div className="page-builder-tab-content">
          <GlassSurface material="frosted" className="page-builder-panel"><div className="page-builder-library-heading"><div><h2>Biblioteca de templates</h2><p>Escolha uma composição para este estabelecimento. A troca altera apenas a apresentação e a organização das seções.</p></div><GlassButton variant="quiet" size="sm" onClick={restoreCurrentTemplate}><RotateCcw size={14} />Restaurar padrão</GlassButton></div>
            {pendingTemplate && <div className="page-builder-template-confirm" role="status"><strong>Prévia da alteração: {pendingTemplate.name}</strong><p>A composição, a ordem/visibilidade das seções e o estilo visual podem mudar. Nome, textos, logo, capa, galeria, serviços, profissionais, endereço, configurações, status e agendamentos permanecem vinculados a este estabelecimento.</p><div><GlassButton variant="quiet" size="sm" onClick={() => setPendingTemplate(null)}>Cancelar</GlassButton><GlassButton variant="primary" size="sm" onClick={applyPendingTemplate}><Check size={14} />Aplicar ao rascunho</GlassButton></div></div>}
            <div className="page-builder-template-grid">{PUBLIC_PAGE_TEMPLATES.map((template) => <article className={`page-builder-template-card template-${template.id}`} key={template.id}><div className="page-builder-template-thumbnail" aria-hidden="true"><span /><span /><span /><span /></div><div><div className="page-builder-template-title"><h3>{template.name}</h3>{getCatalogTemplateId(draft.template) === template.id && <span>Em uso</span>}</div><p>{template.description}</p><small>Foco: {template.focus}</small></div><div className="page-builder-template-actions"><GlassButton size="sm" variant="quiet" onClick={() => askForTemplate(template.name, (content) => applyPublicPageTemplate(content, template.id))}>Selecionar</GlassButton><GlassButton size="sm" variant="quiet" onClick={() => { const copy = applyPublicPageTemplate(draft, template.id); const saved = savePublicPageTemplate(`${template.name} personalizada`, copy); if (!saved) { announce("Não foi possível duplicar este template neste navegador.", true); return; } setSavedTemplates((current) => [...current, saved]); announce(`Cópia de “${template.name}” adicionada à biblioteca. Personalize e salve o rascunho quando quiser.`); }}><Copy size={13} />Duplicar</GlassButton></div></article>)}</div>
          </GlassSurface>
          <GlassSurface material="frosted" className="page-builder-panel"><h2>Templates personalizados</h2><p>Salve a aparência do rascunho para reaproveitá-la em outro estabelecimento. Conteúdo comercial e registros vinculados não são copiados ao aplicar.</p><div className="page-builder-save-template"><GlassInput label="Nome do template" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ex.: Identidade da unidade Centro" /><GlassButton variant="primary" onClick={saveCurrentAsTemplate} disabled={!templateName.trim()}><Save size={15} />Salvar aparência atual</GlassButton></div>
            {savedTemplates.length ? <div className="page-builder-saved-template-list">{savedTemplates.map((template) => <article key={template.id}><div><strong>{template.name}</strong><small>Salvo em {new Date(template.createdAt).toLocaleDateString("pt-BR")}</small></div><div><GlassButton size="sm" variant="quiet" onClick={() => askForTemplate(template.name, (content) => applySavedPublicPageTemplate(content, template))}>Usar</GlassButton><GlassButton size="sm" variant="quiet" onClick={() => duplicateSavedTemplate(template)}><Copy size={13} />Duplicar</GlassButton></div></article>)}</div> : <p className="page-builder-template-empty">Nenhum template personalizado salvo neste navegador.</p>}
          </GlassSurface>
        </div>}

        {tab === "identity" && <div className="page-builder-tab-content">
          <GlassSurface material="frosted" className="page-builder-panel"><h2>Marca e apresentação</h2>
            <GlassInput label="Nome público" value={draft.publicName ?? ""} onChange={(event) => update({ publicName: event.target.value })} />
            <GlassInput label="Título principal" value={draft.heroTitle} onChange={(event) => update({ heroTitle: event.target.value })} />
            <GlassInput label="Subtítulo" value={draft.heroSubtitle} onChange={(event) => update({ heroSubtitle: event.target.value })} />
            <label className="page-builder-field"><span>Descrição comercial</span><textarea rows={4} value={draft.aboutText} onChange={(event) => update({ aboutText: event.target.value })} /></label>
            <div className="page-builder-media-row"><GlassInput label="URL do logotipo" value={draft.logoUrl ?? ""} onChange={(event) => update({ logoUrl: event.target.value })} placeholder="https://... ou /imagens/logo.png" /><label className="page-builder-upload"><Upload size={15} />Enviar<input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0], "logoUrl")} /></label></div>
            <div className="page-builder-media-row"><GlassInput label="Imagem de capa" value={draft.coverUrl ?? ""} onChange={(event) => update({ coverUrl: event.target.value })} placeholder="https://... ou /imagens/capa.jpg" /><label className="page-builder-upload"><Upload size={15} />Enviar<input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0], "coverUrl")} /></label></div>
            <label className="page-builder-field"><span>Imagens de apresentação (uma URL por linha)</span><textarea rows={3} value={galleryInput || draft.galleryImages?.join("\n") || ""} onChange={(event) => setGalleryInput(event.target.value)} onBlur={setGallery} placeholder="https://..." /></label>
            <div className="page-builder-color-grid"><GlassInput type="color" label="Cor principal" value={draft.primaryColor ?? "#3f5845"} onChange={(event) => update({ primaryColor: event.target.value })} /><GlassInput type="color" label="Cor secundária" value={draft.secondaryColor ?? "#758276"} onChange={(event) => update({ secondaryColor: event.target.value })} /><GlassInput type="color" label="Fundo" value={draft.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} /><GlassInput type="color" label="Botões" value={draft.buttonColor ?? draft.primaryColor ?? "#3f5845"} onChange={(event) => update({ buttonColor: event.target.value })} /></div>
            <GlassSelect label="Modelo de página" value={getCatalogTemplateId(draft.template)} onChange={(event) => update(applyPublicPageTemplate(draft, event.target.value as "essential" | "premium" | "professionals" | "services" | "clinic"))} options={PUBLIC_PAGE_TEMPLATES.map(({ id, name }) => ({ value: id, label: name }))} />
            <GlassSelect label="Paleta base" value={draft.palette} onChange={(event) => { const palette = event.target.value as keyof typeof paletteColors; const [primaryColor, secondaryColor] = paletteColors[palette]; update({ palette, primaryColor, secondaryColor, buttonColor: primaryColor }); }} options={[{ value: "moss", label: "Verde natural" }, { value: "copper", label: "Terracota" }, { value: "sand", label: "Areia" }, { value: "ink", label: "Grafite" }, { value: "sage", label: "Sálvia" }]} />
            <GlassSelect label="Tipografia" value={draft.typography ?? "modern"} onChange={(event) => update({ typography: event.target.value as PageDesignConfig["typography"] })} options={[{ value: "modern", label: "Moderna" }, { value: "editorial", label: "Editorial" }, { value: "rounded", label: "Arredondada" }]} />
            <GlassSelect label="Estilo dos cartões" value={draft.cardStyle ?? "glass"} onChange={(event) => update({ cardStyle: event.target.value as PageDesignConfig["cardStyle"] })} options={[{ value: "glass", label: "Vidro" }, { value: "solid", label: "Sólido" }, { value: "outline", label: "Contornado" }]} />
            <GlassSelect label="Espaçamento das seções" value={draft.sectionSpacing ?? "comfortable"} onChange={(event) => update({ sectionSpacing: event.target.value as PageDesignConfig["sectionSpacing"] })} options={[{ value: "compact", label: "Compacto" }, { value: "comfortable", label: "Confortável" }, { value: "airy", label: "Amplo" }]} />
            <label className="page-builder-field"><span>Arredondamento: {draft.cornerRadius ?? 20}px</span><input type="range" min={0} max={36} step={2} value={draft.cornerRadius ?? 20} onChange={(event) => update({ cornerRadius: Number(event.target.value) })} /></label>
            <GlassButton variant="quiet" onClick={restoreDefaults}><RotateCcw size={15} />Restaurar configuração padrão</GlassButton>
          </GlassSurface>
          <GlassSurface material="frosted" className="page-builder-panel"><h2>Reaproveitar aparência</h2><p>Copie a estrutura e identidade visual. Informações e configurações do estabelecimento de destino permanecem vinculadas a ele.</p><div className="page-builder-duplicate-list">{listPlatformEstablishments().filter((item) => item.id !== establishment.id).map((item) => <GlassButton key={item.id} variant="quiet" onClick={() => duplicateFrom(item.id)}>{item.name} · Copiar visual</GlassButton>)}</div></GlassSurface>
        </div>}

        {tab === "sections" && <div className="page-builder-tab-content"><GlassSurface material="frosted" className="page-builder-panel"><h2>Ordem e visibilidade</h2><p>Use as setas para reorganizar. Seções ocultas permanecem guardadas no rascunho.</p><div className="page-builder-section-list">{(draft.sections ?? []).map((section, index) => <article className="page-builder-section-card" key={section.id}><div className="page-builder-section-toolbar"><label><input type="checkbox" checked={section.visible} onChange={(event) => updateSection(section.id, { visible: event.target.checked })} /><strong>{PUBLIC_PAGE_SECTIONS.find((item) => item.id === section.id)?.title}</strong></label><div><button type="button" aria-label="Mover seção para cima" disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={15} /></button><button type="button" aria-label="Mover seção para baixo" disabled={index === (draft.sections?.length ?? 0) - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={15} /></button></div></div><GlassInput label="Título da seção" value={section.id === "hero" ? draft.heroTitle : section.id === "footer" ? draft.publicName ?? section.title : section.title} onChange={(event) => { if (section.id === "hero") { update({ heroTitle: event.target.value }); updateSection(section.id, { title: event.target.value }); } else if (section.id === "footer") { update({ publicName: event.target.value }); updateSection(section.id, { title: event.target.value }); } else updateSection(section.id, { title: event.target.value }); }} /><GlassInput label="Descrição" value={section.id === "hero" ? draft.heroSubtitle : section.description} onChange={(event) => { if (section.id === "hero") { update({ heroSubtitle: event.target.value }); updateSection(section.id, { description: event.target.value }); } else updateSection(section.id, { description: event.target.value }); }} /><GlassSelect label="Layout" value={section.layout} onChange={(event) => updateSection(section.id, { layout: event.target.value as typeof section.layout })} options={[{ value: "default", label: "Padrão" }, { value: "cards", label: "Cartões" }, { value: "wide", label: "Amplo" }]} /></article>)}</div></GlassSurface></div>}

        {tab === "booking" && <div className="page-builder-tab-content"><GlassSurface material="frosted" className="page-builder-panel"><h2>Apresentação do agendamento</h2>
            <GlassInput label="Texto dos botões de agendamento" value={draft.bookingButtonLabel ?? "Agendar horário"} onChange={(event) => update({ bookingButtonLabel: event.target.value })} />
          <div className="page-builder-toggle-list">
            <label><input type="checkbox" checked={draft.showPrices !== false} onChange={(event) => update({ showPrices: event.target.checked })} />Exibir preços</label>
            <label><input type="checkbox" checked={draft.showDurations !== false} onChange={(event) => update({ showDurations: event.target.checked })} />Exibir duração dos serviços</label>
          </div>
          <p>As regras de reserva, os campos solicitados, a escolha de profissional e as informações de serviços e equipe são administrados pelo estabelecimento. Aqui você controla apenas a apresentação visual desses dados públicos.</p>
        </GlassSurface>
        <GlassSurface material="frosted" className="page-builder-panel"><h2>Conteúdo adicional</h2><p>As políticas de atendimento são definidas pelo gestor do estabelecimento.</p><h3>Perguntas frequentes</h3>{(draft.faq ?? []).map((faq, index) => <div className="page-builder-faq-row" key={`${faq.question}-${index}`}><div><strong>{faq.question}</strong><p>{faq.answer}</p></div><button type="button" aria-label="Remover pergunta" onClick={() => update({ faq: draft.faq?.filter((_, itemIndex) => itemIndex !== index) })}><X size={15} /></button></div>)}<GlassInput label="Pergunta" value={faqQuestion} onChange={(event) => setFaqQuestion(event.target.value)} /><label className="page-builder-field"><span>Resposta</span><textarea rows={2} value={faqAnswer} onChange={(event) => setFaqAnswer(event.target.value)} /></label><GlassButton variant="quiet" onClick={addFaq}>Adicionar pergunta</GlassButton></GlassSurface></div>}
      </section>

      <section className="page-builder-preview" aria-label="Pré-visualização responsiva"><div className="page-builder-preview-toolbar"><div><span className="eyebrow">Prévia</span><strong>{status === "PUBLISHED" ? "Versão pública · rascunho no editor" : "Rascunho local"}</strong></div><div className="page-builder-preview-sizes"><button type="button" className={previewSize === "desktop" ? "is-selected" : ""} onClick={() => setPreviewSize("desktop")} aria-label="Prévia desktop"><Monitor size={17} /></button><button type="button" className={previewSize === "tablet" ? "is-selected" : ""} onClick={() => setPreviewSize("tablet")} aria-label="Prévia tablet"><Tablet size={17} /></button><button type="button" className={previewSize === "mobile" ? "is-selected" : ""} onClick={() => setPreviewSize("mobile")} aria-label="Prévia smartphone"><Smartphone size={17} /></button></div></div>
        <div className={`page-builder-preview-frame preview-${previewSize}`}><PublicPageRenderer establishment={{ ...PLATFORM_PAGE_PREVIEW_ESTABLISHMENT, name: draft.publicName || draft.heroTitle || PLATFORM_PAGE_PREVIEW_ESTABLISHMENT.name, description: draft.heroSubtitle || PLATFORM_PAGE_PREVIEW_ESTABLISHMENT.description }} config={draft} operationalData={PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA} bookingAllowed={false} preview /></div>
        {published && status === "PUBLISHED" && <details className="page-builder-published-version"><summary>Conferir versão atualmente publicada</summary><div className="page-builder-preview-frame preview-desktop"><PublicPageRenderer establishment={{ ...PLATFORM_PAGE_PREVIEW_ESTABLISHMENT, name: published.publicName || published.heroTitle || PLATFORM_PAGE_PREVIEW_ESTABLISHMENT.name, description: published.heroSubtitle || PLATFORM_PAGE_PREVIEW_ESTABLISHMENT.description }} config={published} operationalData={PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA} bookingAllowed={false} preview /></div></details>}
      </section>
    </PageSection>
    <footer className="page-builder-footer"><span>As alterações são salvas neste navegador e permanecem separadas por estabelecimento.</span><div><GlassButton variant="quiet" onClick={unpublish} disabled={status !== "PUBLISHED"}>Despublicar página</GlassButton>{publicUrl && <a href={publicUrl} target="_blank" rel="noreferrer">Ver link público</a>}</div></footer>
  </PageShell>;
}
