"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, LayoutTemplate, Monitor, Save, Smartphone, Tablet, Upload, X } from "lucide-react";
import { GlassButton, GlassInput, GlassSelect, GlassSurface, useConfirmation } from "@/components/ui";
import { PageHeader, PageSection, PageShell } from "@/components/admin/page-layout";
import { findPlatformEstablishment, getPlatformPageConfig } from "@/features/platform/storage";
import { getPlatformPublicPageDraft, getPlatformPublishedPageContent, publishPublicPageDraft, PUBLIC_PAGE_SECTIONS, savePublicPageDraft, setPublicPagePublicationStatus } from "@/features/platform/public-page-builder";
import { getPublicPageStatus } from "@/features/platform/domain";
import { recordPlatformAction } from "@/features/platform/owner-dashboard";
import { PublicPageRenderer } from "@/features/public-establishment/public-establishment-page";
import type { PageDesignConfig, PublicSectionId } from "@/types";
import type { PlatformEstablishmentRecord } from "./repository-contracts";
import { PLATFORM_PAGE_PREVIEW_ESTABLISHMENT, PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA } from "@/features/platform/public-page-preview-data";
import { safePublicImageReference } from "@/features/public-establishment/theme";

type EditorTab = "identity" | "sections" | "booking";
type PreviewSize = "desktop" | "tablet" | "mobile";
const titleForStatus = { PUBLISHED: "Publicada", DRAFT: "Rascunho", UNPUBLISHED: "Despublicada" } as const;
const isColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

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
  const [galleryInput, setGalleryInput] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [establishmentId]);

  const publicUrl = establishment && typeof window !== "undefined" ? `${window.location.origin}/e/${establishment.slug}` : "";

  function update(patch: Partial<PageDesignConfig>) { setDraft((current) => current ? { ...current, ...patch } : current); }
  function updateSection(id: PublicSectionId, patch: Partial<NonNullable<PageDesignConfig["sections"]>[number]>) {
    setDraft((current) => current ? { ...current, sections: (current.sections ?? []).map((section) => section.id === id ? { ...section, ...patch } : section) } : current);
  }
  function announce(message: string, error = false) { setFeedback(message); setFeedbackError(error); }

  function validateDraft() {
    if (!draft) return null;
    if (!draft.heroTitle.trim() || !draft.publicName?.trim()) { announce("Informe o nome público e o título principal.", true); return null; }
    if (draft.publicName.length > 80 || draft.heroTitle.length > 120 || draft.heroSubtitle.length > 280 || draft.aboutText.length > 2000 || (draft.bookingButtonLabel?.length ?? 0) > 40 || (draft.faq ?? []).some((item) => item.question.length > 140 || item.answer.length > 800)) {
      announce("Revise os textos: alguns ultrapassam o limite permitido.", true); return null;
    }
    if (![draft.backgroundColor, draft.primaryColor, draft.secondaryColor, draft.buttonColor].every((color) => !color || isColor(color))) { announce("Revise as cores: use o formato hexadecimal, como #3979bd.", true); return null; }
    const gallery = galleryInput === null ? draft.galleryImages ?? [] : parseGallery(galleryInput);
    if (!gallery) { announce("Use até 12 imagens válidas. Aceitamos links HTTPS ou caminhos locais de imagem.", true); return null; }
    const images = [draft.logoUrl, draft.profileImageUrl, draft.coverUrl, draft.backgroundImageUrl, ...gallery];
    if (images.some((image) => image && !safePublicImageReference(image))) { announce("Revise as imagens: use HTTPS, um caminho local ou envie um arquivo de imagem.", true); return null; }
    return { ...draft, galleryImages: gallery };
  }

  function saveDraft() {
    if (!establishment) return;
    const content = validateDraft();
    if (!content) return;
    const saved = savePublicPageDraft(establishment, content);
    if (!saved) { announce("Não foi possível salvar o rascunho neste navegador.", true); return; }
    recordPlatformAction(establishment, "Rascunho da página pública salvo");
    setStatus(saved.status ?? "DRAFT");
    setPublished(getPlatformPublishedPageContent(saved));
    setDraft(content);
    setGalleryInput(null);
    announce("Rascunho salvo. A página pública continua com a última versão publicada.");
  }

  function publish() {
    if (!establishment) return;
    const content = validateDraft();
    if (!content) return;
    const saved = publishPublicPageDraft(establishment, content);
    if (!saved) { announce("Não foi possível publicar as alterações neste navegador.", true); return; }
    recordPlatformAction(establishment, "Alterações da página pública publicadas");
    setStatus("PUBLISHED");
    setPublished(getPlatformPublishedPageContent(saved));
    setDraft(content);
    setGalleryInput(null);
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

  async function uploadImage(file: File | undefined, field: "logoUrl" | "profileImageUrl" | "coverUrl" | "backgroundImageUrl") {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(file.type)) { announce("Escolha uma imagem PNG, JPEG, WebP, GIF ou AVIF.", true); return; }
    if (file.size > 700_000) { announce("Escolha uma imagem de até 700 KB para manter o armazenamento local disponível.", true); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Arquivo inválido")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }).catch(() => null);
    if (!data) { announce("Não foi possível carregar esta imagem.", true); return; }
    if (!safePublicImageReference(data)) { announce("Este arquivo de imagem não pôde ser validado.", true); return; }
    update({ [field]: data }); announce("Imagem carregada e aplicada à prévia. Salve como rascunho para manter a alteração.");
  }

  function parseGallery(value: string) {
    const urls = value.split("\n").map((item) => item.trim()).filter(Boolean);
    return urls.length <= 12 && urls.every((item) => Boolean(safePublicImageReference(item))) ? urls : null;
  }

  function setGallery(value = galleryInput ?? draft?.galleryImages?.join("\n") ?? "") {
    const urls = parseGallery(value);
    if (!urls) { announce("Use até 12 imagens válidas. Aceitamos links HTTPS ou caminhos locais de imagem.", true); return; }
    update({ galleryImages: urls }); setGalleryInput(null); announce(`${urls.length} imagem(ns) de apresentação adicionada(s) à prévia.`);
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

  if (!resolved) return <PageShell as="main" className="platform-shell page-builder-shell"><GlassSurface material="frosted"><h1>Abrindo o construtor da página…</h1></GlassSurface></PageShell>;
  if (!establishment || !draft) return <PageShell as="main" className="platform-shell page-builder-shell"><GlassSurface material="frosted"><h1>Estabelecimento não encontrado</h1><GlassButton asChild variant="quiet"><Link href="/platform/establishments"><ArrowLeft size={16} />Voltar ao console</Link></GlassButton></GlassSurface></PageShell>;


  return <PageShell as="main" className="platform-shell page-builder-shell">
    <PageHeader variant="content" className="page-builder-header platform-header" breadcrumbs={<><Link href="/platform/establishments" className="page-builder-back"><ArrowLeft size={16} /> Console do proprietário</Link><span className={`owner-page-badge ${status === "PUBLISHED" ? "is-published" : status === "UNPUBLISHED" ? "is-unpublished" : "is-draft"}`}>{titleForStatus[status]}</span></>} title="Construtor da página pública" description={`${establishment.name} · /e/${establishment.slug}`} actionsClassName="page-builder-actions" actions={<><GlassButton asChild variant="quiet"><Link href={`/e/${establishment.slug}`} target="_blank"><Eye size={16} />Abrir versão pública</Link></GlassButton><GlassButton variant="quiet" onClick={saveDraft}><Save size={16} />Salvar rascunho</GlassButton><GlassButton variant="primary" onClick={publish}>Publicar alterações</GlassButton></>} />
    {feedback && <p className={`page-builder-feedback${feedbackError ? " is-error" : ""}`} role="status">{feedback}</p>}
    <PageSection className="page-builder-workspace" aria-label="Configuração e prévia da página pública">
      <section className="page-builder-controls" aria-label="Configurações da página">
        <div className="page-builder-tabs" role="tablist" aria-label="Editor da página">
          <button type="button" role="tab" aria-selected={tab === "identity"} className={tab === "identity" ? "is-active" : ""} onClick={() => setTab("identity")}><LayoutTemplate size={15} />Personalização</button>
          <button type="button" role="tab" aria-selected={tab === "sections"} className={tab === "sections" ? "is-active" : ""} onClick={() => setTab("sections")}>Estrutura</button>
          <button type="button" role="tab" aria-selected={tab === "booking"} className={tab === "booking" ? "is-active" : ""} onClick={() => setTab("booking")}>Agendamento</button>
        </div>

        {tab === "identity" && <div className="page-builder-tab-content">
          <GlassSurface material="frosted" className="page-builder-panel"><h2>Marca e apresentação</h2>
            <GlassInput label="Nome público" value={draft.publicName ?? ""} onChange={(event) => update({ publicName: event.target.value })} />
            <GlassInput label="Título principal" value={draft.heroTitle} onChange={(event) => update({ heroTitle: event.target.value })} />
            <GlassInput label="Subtítulo" value={draft.heroSubtitle} onChange={(event) => update({ heroSubtitle: event.target.value })} />
            <label className="page-builder-field"><span>Descrição comercial</span><textarea rows={4} value={draft.aboutText} onChange={(event) => update({ aboutText: event.target.value })} /></label>
            <div className="page-builder-media-row"><GlassInput label="URL do logotipo" value={draft.logoUrl ?? ""} onChange={(event) => update({ logoUrl: event.target.value })} placeholder="https://... ou /imagens/logo.png" /><label className="page-builder-upload"><Upload size={15} />Enviar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void uploadImage(event.target.files?.[0], "logoUrl")} /></label></div>
            <div className="page-builder-media-row"><GlassInput label="Imagem de perfil" value={draft.profileImageUrl ?? ""} onChange={(event) => update({ profileImageUrl: event.target.value })} placeholder="https://... ou /imagens/perfil.jpg" /><label className="page-builder-upload"><Upload size={15} />Enviar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void uploadImage(event.target.files?.[0], "profileImageUrl")} /></label></div>
            <div className="page-builder-media-row"><GlassInput label="Imagem de capa" value={draft.coverUrl ?? ""} onChange={(event) => update({ coverUrl: event.target.value })} placeholder="https://... ou /imagens/capa.jpg" /><label className="page-builder-upload"><Upload size={15} />Enviar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void uploadImage(event.target.files?.[0], "coverUrl")} /></label></div>
            <div className="page-builder-media-row"><GlassInput label="Imagem de fundo" value={draft.backgroundImageUrl ?? ""} onChange={(event) => update({ backgroundImageUrl: event.target.value })} placeholder="https://... ou /imagens/fundo.jpg" /><label className="page-builder-upload"><Upload size={15} />Enviar<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => void uploadImage(event.target.files?.[0], "backgroundImageUrl")} /></label></div>
            <label className="page-builder-field"><span>Imagens de apresentação (uma URL por linha)</span><textarea rows={3} value={galleryInput ?? draft.galleryImages?.join("\n") ?? ""} onChange={(event) => setGalleryInput(event.target.value)} onBlur={(event) => setGallery(event.currentTarget.value)} placeholder="https://..." /></label>
            <div className="page-builder-color-grid"><GlassInput type="color" label="Cor principal" value={draft.primaryColor ?? "#3f5845"} onChange={(event) => update({ primaryColor: event.target.value })} /><GlassInput type="color" label="Cor secundária" value={draft.secondaryColor ?? "#758276"} onChange={(event) => update({ secondaryColor: event.target.value })} /><GlassInput type="color" label="Fundo" value={draft.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} /><GlassInput type="color" label="Botões" value={draft.buttonColor ?? draft.primaryColor ?? "#3f5845"} onChange={(event) => update({ buttonColor: event.target.value })} /></div>
            <GlassSelect label="Tipografia" value={draft.typography ?? "modern"} onChange={(event) => update({ typography: event.target.value as PageDesignConfig["typography"] })} options={[{ value: "modern", label: "Moderna" }, { value: "editorial", label: "Editorial" }, { value: "rounded", label: "Arredondada" }]} />
            <GlassSelect label="Estilo dos cartões" value={draft.cardStyle ?? "glass"} onChange={(event) => update({ cardStyle: event.target.value as PageDesignConfig["cardStyle"] })} options={[{ value: "glass", label: "Vidro" }, { value: "solid", label: "Sólido" }, { value: "outline", label: "Contornado" }]} />
            <GlassSelect label="Espaçamento das seções" value={draft.sectionSpacing ?? "comfortable"} onChange={(event) => update({ sectionSpacing: event.target.value as PageDesignConfig["sectionSpacing"] })} options={[{ value: "compact", label: "Compacto" }, { value: "comfortable", label: "Confortável" }, { value: "airy", label: "Amplo" }]} />
            <label className="page-builder-field"><span>Arredondamento dos cartões: {draft.cornerRadius ?? 20}px</span><input type="range" min={0} max={36} step={2} value={draft.cornerRadius ?? 20} onChange={(event) => update({ cornerRadius: Number(event.target.value) })} /></label>
            <label className="page-builder-field"><span>Arredondamento dos botões: {draft.buttonCornerRadius ?? 18}px</span><input type="range" min={0} max={32} step={1} value={draft.buttonCornerRadius ?? 18} onChange={(event) => update({ buttonCornerRadius: Number(event.target.value) })} /></label>
          </GlassSurface>
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
