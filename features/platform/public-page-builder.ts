import type { Establishment, PageDesignConfig, PublicPageConfig, PublicPageContent, PublicPageSection, PublicSectionId } from "@/types";
import { getPlatformPageConfig, savePageConfig } from "./storage";
import { getPublicPageStatus } from "./domain";
import { emitEstablishmentNotification } from "@/features/notifications/repository";
import type { PlatformPageAdminRecord } from "./repository-contracts";

type PageEstablishmentContext = Pick<Establishment, "id" | "name" | "slug" | "description" | "logoUrl" | "coverUrl" | "status" | "active" | "archivedAt">;

export const PUBLIC_PAGE_SECTIONS: Array<Pick<PublicPageSection, "id" | "title" | "description">> = [
  { id: "hero", title: "Apresentação principal", description: "Capa, nome público e chamada principal." },
  { id: "about", title: "Sobre o estabelecimento", description: "Descrição comercial do espaço." },
  { id: "services", title: "Lista de serviços", description: "Serviços selecionados para a página." },
  { id: "professionals", title: "Profissionais", description: "Apresente a equipe disponível." },
  { id: "gallery", title: "Galeria", description: "Imagens de apresentação do estabelecimento." },
  { id: "hours", title: "Horários de funcionamento", description: "Dias e horários de atendimento." },
  { id: "location", title: "Endereço e localização", description: "Endereço e acesso ao mapa." },
  { id: "contact", title: "Informações de contato", description: "Telefone e redes de contato." },
  { id: "faq", title: "Perguntas frequentes", description: "Respostas para dúvidas comuns." },
  { id: "policies", title: "Políticas de atendimento", description: "Orientações para os clientes." },
  { id: "booking", title: "Botão principal de agendamento", description: "Chamada para iniciar uma reserva." },
  { id: "footer", title: "Rodapé", description: "Fechamento e assinatura da página." },
];

const sectionIdSet = new Set<PublicSectionId>(PUBLIC_PAGE_SECTIONS.map(({ id }) => id));
export const DEFAULT_PUBLIC_PAGE_SECTIONS: PublicPageSection[] = PUBLIC_PAGE_SECTIONS.map((section) => ({ ...section, visible: true, layout: "default" }));

export function createDefaultPageDesignConfig(establishment: PageEstablishmentContext): PageDesignConfig {
  return {
    template: "editorial", palette: "moss", heroTitle: establishment.name, publicName: establishment.name,
    heroSubtitle: establishment.description, aboutText: establishment.description, backgroundColor: "#f4f2ec",
    primaryColor: "#3f5845", secondaryColor: "#758276", buttonColor: "#3f5845", logoUrl: establishment.logoUrl,
    profileImageUrl: establishment.logoUrl, coverUrl: establishment.coverUrl, cardStyle: "glass", typography: "modern", cornerRadius: 20, buttonCornerRadius: 18,
    sectionSpacing: "comfortable", sections: DEFAULT_PUBLIC_PAGE_SECTIONS.map((section) => section.id === "hero" ? { ...section, title: establishment.name, description: establishment.description } : section.id === "footer" ? { ...section, title: establishment.name } : { ...section }),
    galleryImages: [], showPrices: true, showDurations: true,
    bookingButtonLabel: "Agendar horário", faq: [],
  };
}

export function createDefaultPublicPageContent(establishment: PageEstablishmentContext): PublicPageContent {
  return {
    ...createDefaultPageDesignConfig(establishment), allowProfessionalChoice: true,
    bookingFields: { name: true, email: true, phone: true, notes: false }, allowGuestBooking: false,
    allowCustomerCancel: true, allowCustomerReschedule: true, policies: "",
  };
}

function contentOnly(config: PublicPageConfig): PublicPageContent {
  return Object.fromEntries(Object.entries(config).filter(([key]) => !["establishmentId", "status", "publishedSnapshot", "publishedAt", "versions", "updatedAt"].includes(key))) as PublicPageContent;
}

function withSectionDefaults(sections?: PublicPageSection[]) {
  if (!sections) return DEFAULT_PUBLIC_PAGE_SECTIONS.map((section) => ({ ...section }));
  const known = new Map(sections.filter((section) => sectionIdSet.has(section.id)).map((section) => [section.id, section]));
  return PUBLIC_PAGE_SECTIONS.map((defaultSection) => ({ ...defaultSection, visible: true, layout: "default" as const, ...known.get(defaultSection.id) }));
}

export function normalizePublicPageContent(content: PublicPageContent): PublicPageContent {
  return { ...content, sections: withSectionDefaults(content.sections), galleryImages: content.galleryImages ?? [], bookingFields: { name: true, email: true, phone: true, notes: false, ...content.bookingFields }, allowGuestBooking: content.allowGuestBooking ?? false, faq: content.faq ?? [] };
}

const PAGE_DESIGN_FIELDS = new Set<keyof PageDesignConfig>([
  "template", "palette", "heroTitle", "heroSubtitle", "aboutText", "primaryColor", "secondaryColor",
  "backgroundColor", "backgroundImageUrl", "logoUrl", "profileImageUrl", "coverUrl", "publicName", "buttonColor", "cardStyle",
  "typography", "cornerRadius", "buttonCornerRadius", "sectionSpacing", "sections", "galleryImages", "showPrices", "showDurations",
  "bookingButtonLabel", "faq",
]);

function designOnly(content: Partial<PublicPageContent>): PageDesignConfig {
  return Object.fromEntries(Object.entries(content).filter(([key]) => PAGE_DESIGN_FIELDS.has(key as keyof PageDesignConfig))) as unknown as PageDesignConfig;
}

function normalizePageDesignConfig(content: PageDesignConfig): PageDesignConfig {
  return { ...content, sections: withSectionDefaults(content.sections), galleryImages: content.galleryImages ?? [], faq: content.faq ?? [] };
}

export function getPublicPageDraft(establishment: PageEstablishmentContext) {
  const current = getPlatformPageConfig(establishment.id);
  const defaults = createDefaultPublicPageContent(establishment);
  return current ? normalizePublicPageContent({ ...defaults, ...contentOnly(current) }) : defaults;
}

/** Platform editor projection excludes services, team choices, booking fields and customer policies. */
export function getPlatformPublicPageDraft(establishment: PageEstablishmentContext) {
  const current = getPlatformPageConfig(establishment.id);
  const defaults = createDefaultPageDesignConfig(establishment);
  return current ? normalizePageDesignConfig({ ...defaults, ...designOnly(current) }) : defaults;
}

export function getPlatformPublishedPageContent(config: PlatformPageAdminRecord | null | undefined): PageDesignConfig | null {
  if (!config || (!config.publishedSnapshot && config.status !== undefined && config.status !== "PUBLISHED")) return null;
  return normalizePageDesignConfig({ ...createDefaultPageDesignConfig({ id: config.establishmentId, name: "", slug: "", description: "", status: "ACTIVE" }), ...designOnly(config.publishedSnapshot ?? config) });
}

function operationData(config?: PublicPageContent | null): Pick<PublicPageContent, "serviceIds" | "employeeIds" | "allowProfessionalChoice" | "allowGuestBooking" | "bookingFields" | "allowCustomerCancel" | "allowCustomerReschedule" | "policies"> {
  return {
    serviceIds: config?.serviceIds,
    employeeIds: config?.employeeIds,
    allowProfessionalChoice: config?.allowProfessionalChoice,
    allowGuestBooking: config?.allowGuestBooking,
    bookingFields: config?.bookingFields,
    allowCustomerCancel: config?.allowCustomerCancel,
    allowCustomerReschedule: config?.allowCustomerReschedule,
    policies: config?.policies,
  };
}

/** Creates a local page explicitly as a draft, even when a legacy active tenant was implicitly public. */
export function initializePublicPageConfig(establishment: PageEstablishmentContext) {
  const existing = getPlatformPageConfig(establishment.id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const content = createDefaultPublicPageContent(establishment);
  const status = getPublicPageStatus(null, establishment);
  const next: PublicPageConfig = { ...content, establishmentId: establishment.id, status, publishedSnapshot: status === "PUBLISHED" ? content : undefined, updatedAt: now };
  return savePageConfig(next) ? getPlatformPageConfig(establishment.id) : null;
}

/** Draft saves preserve the current public snapshot, including first-time migration from legacy pages. */
export function savePublicPageDraft(establishment: PageEstablishmentContext, draft: PageDesignConfig) {
  const current = getPlatformPageConfig(establishment.id) as PublicPageConfig | null;
  const status = getPublicPageStatus(current, establishment);
  const publishedSnapshot = current?.publishedSnapshot
    ? normalizePublicPageContent(current.publishedSnapshot)
    : status === "PUBLISHED"
      ? normalizePublicPageContent(current ? contentOnly(current) : createDefaultPublicPageContent(establishment))
      : undefined;
  const preservedOperationalData = operationData(current ?? createDefaultPublicPageContent(establishment));
  const next: PublicPageConfig = { ...preservedOperationalData, ...normalizePageDesignConfig(draft), establishmentId: establishment.id, status, publishedSnapshot, publishedAt: current?.publishedAt, versions: current?.versions, updatedAt: new Date().toISOString() };
  return savePageConfig(next) ? getPlatformPageConfig(establishment.id) : null;
}

export function publishPublicPageDraft(establishment: PageEstablishmentContext, draft: PageDesignConfig) {
  const current = getPlatformPageConfig(establishment.id) as PublicPageConfig | null;
  const content: PublicPageContent = { ...operationData(current ?? createDefaultPublicPageContent(establishment)), ...normalizePageDesignConfig(draft) };
  const publishedAt = new Date().toISOString();
  const history = current?.versions ?? [];
  const versions = [...history, { id: `publication-${Date.now().toString(36)}`, publishedAt, content }].slice(-5);
  const next: PublicPageConfig = { ...content, establishmentId: establishment.id, status: "PUBLISHED", publishedSnapshot: content, publishedAt, versions, updatedAt: publishedAt };
  if (!savePageConfig(next)) return null;
  emitEstablishmentNotification(establishment.id, "PAGE_PUBLISHED", establishment.name, `page-published:${establishment.id}:${publishedAt}`, publishedAt, `/e/${establishment.slug}`);
  return getPlatformPageConfig(establishment.id);
}

/** Reactivation restores the last published content; an unpublished first draft is published as-is. */
export function reactivatePublicPage(establishment: PageEstablishmentContext) {
  const current = getPlatformPageConfig(establishment.id);
  const content = getPlatformPublishedPageContent(current) ?? getPlatformPublicPageDraft(establishment);
  return publishPublicPageDraft(establishment, content);
}

export function setPublicPagePublicationStatus(establishment: PageEstablishmentContext, status: "DRAFT" | "UNPUBLISHED") {
  const current = getPlatformPageConfig(establishment.id) as PublicPageConfig | null;
  const content = current ? normalizePublicPageContent(contentOnly(current)) : createDefaultPublicPageContent(establishment);
  const currentStatus = getPublicPageStatus(current, establishment);
  const publishedSnapshot = current?.publishedSnapshot
    ? normalizePublicPageContent(current.publishedSnapshot)
    : currentStatus === "PUBLISHED"
      ? normalizePublicPageContent(current ? contentOnly(current) : createDefaultPublicPageContent(establishment))
      : undefined;
  const next: PublicPageConfig = { ...content, establishmentId: establishment.id, status, publishedSnapshot, publishedAt: current?.publishedAt, versions: current?.versions, updatedAt: new Date().toISOString() };
  return savePageConfig(next) ? getPlatformPageConfig(establishment.id) : null;
}

export function getPublishedPageContent(config: PublicPageConfig | null | undefined): PublicPageContent | null {
  if (!config || (config.status !== undefined && config.status !== "PUBLISHED")) return null;
  return normalizePublicPageContent(config.publishedSnapshot ?? contentOnly(config));
}
