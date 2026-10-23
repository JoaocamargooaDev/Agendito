import type { PageDesignConfig, PublicPageSection, PublicSectionId, PublicTemplateId } from "@/types";
import { CAPABILITIES, canCurrentSession } from "@/features/auth/capabilities";
import { DEFAULT_PUBLIC_PAGE_SECTIONS } from "./public-page-builder";

export interface PublicPageTemplateDefinition {
  id: Extract<PublicTemplateId, "essential" | "premium" | "professionals" | "services" | "clinic">;
  name: string;
  description: string;
  focus: string;
  sections: PublicSectionId[];
}

export interface SavedPublicPageTemplate {
  id: string;
  name: string;
  content: PageDesignConfig;
  createdAt: string;
}

const TEMPLATE_STORAGE_KEY = "agendito.platform.public-page-templates.v1";

export const PUBLIC_PAGE_TEMPLATES: PublicPageTemplateDefinition[] = [
  { id: "essential", name: "Essencial", description: "Minimalista, com serviços e agendamento em destaque.", focus: "Serviços + agendamento", sections: ["hero", "services", "booking", "hours", "contact", "footer"] },
  { id: "premium", name: "Premium", description: "Apresentação sofisticada com capa, galeria e conteúdo institucional.", focus: "Marca + apresentação", sections: ["hero", "about", "gallery", "services", "professionals", "hours", "location", "contact", "faq", "policies", "booking", "footer"] },
  { id: "professionals", name: "Profissionais", description: "Equipe em evidência, com perfis e acesso para agendar com especialistas.", focus: "Equipe + especialistas", sections: ["hero", "professionals", "services", "about", "hours", "contact", "booking", "footer"] },
  { id: "services", name: "Serviços", description: "Catálogo priorizado para comparar opções e escolher um horário rapidamente.", focus: "Catálogo + horários", sections: ["hero", "services", "booking", "professionals", "hours", "contact", "footer"] },
  { id: "clinic", name: "Clínica / Estética", description: "Visual profissional para serviços, estrutura e informações de atendimento.", focus: "Institucional + atendimento", sections: ["hero", "about", "services", "professionals", "hours", "location", "contact", "policies", "faq", "booking", "footer"] },
];

function orderedSections(ids: PublicSectionId[], existing?: PublicPageSection[]): PublicPageSection[] {
  const byId = new Map((existing ?? []).map((section) => [section.id, section]));
  const included = new Set(ids);
  const primary = ids.map((id) => {
    const fallback = DEFAULT_PUBLIC_PAGE_SECTIONS.find((section) => section.id === id)!;
    return { ...fallback, ...byId.get(id), id, visible: true };
  });
  const hidden = (existing ?? DEFAULT_PUBLIC_PAGE_SECTIONS)
    .filter((section) => !included.has(section.id))
    .map((section) => ({ ...section, visible: false }));
  return [...primary, ...hidden];
}

/** Applies only presentation/layout defaults; establishment-specific copy, media and selections remain intact. */
export function applyPublicPageTemplate(content: PageDesignConfig, templateId: PublicPageTemplateDefinition["id"]): PageDesignConfig {
  const template = PUBLIC_PAGE_TEMPLATES.find((item) => item.id === templateId)!;
  const cardSections: PublicSectionId[] = templateId === "essential" || templateId === "services"
    ? ["services"]
    : templateId === "professionals" || templateId === "clinic"
      ? ["services", "professionals"]
      : ["services", "professionals", "gallery"];
  return {
    ...content,
    template: template.id,
    sections: orderedSections(template.sections, content.sections).map((section) => ({
      ...section,
      layout: cardSections.includes(section.id) ? "cards" : "default",
    })),
    typography: template.id === "premium" || template.id === "clinic" ? "editorial" : template.id === "professionals" ? "rounded" : "modern",
    cardStyle: template.id === "essential" || template.id === "services" ? "solid" : template.id === "clinic" ? "outline" : "glass",
    sectionSpacing: template.id === "essential" || template.id === "services" ? "compact" : template.id === "premium" ? "airy" : "comfortable",
    cornerRadius: template.id === "clinic" ? 14 : template.id === "premium" ? 24 : 18,
  };
}

/** Converts the legacy template values to the closest new catalog preset without changing their saved content. */
export function getCatalogTemplateId(id: PublicTemplateId): PublicPageTemplateDefinition["id"] {
  switch (id) {
    case "minimal": return "essential";
    case "atelier": return "premium";
    case "barber": return "services";
    case "studio": return "clinic";
    case "heritage": return "premium";
    case "editorial": return "professionals";
    default: return id;
  }
}

export function listSavedPublicPageTemplates(): SavedPublicPageTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedPublicPageTemplate => !!item && typeof item.id === "string" && typeof item.name === "string" && !!item.content && typeof item.content === "object")
      .map((item) => ({ ...item, content: Object.fromEntries(Object.entries(item.content).filter(([key]) => !["serviceIds", "employeeIds", "allowProfessionalChoice", "allowGuestBooking", "bookingFields", "allowCustomerCancel", "allowCustomerReschedule", "policies"].includes(key))) as PageDesignConfig }));
  } catch { return []; }
}

export function savePublicPageTemplate(name: string, content: PageDesignConfig): SavedPublicPageTemplate | null {
  if (typeof window === "undefined" || !canCurrentSession(CAPABILITIES.platformPages) || !name.trim()) return null;
  const templates = listSavedPublicPageTemplates();
  const saved: SavedPublicPageTemplate = {
    id: `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    content: { ...structuredClone(content), logoUrl: "", coverUrl: "", backgroundImageUrl: undefined, galleryImages: [] },
    createdAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify([...templates, saved]));
    return saved;
  } catch { return null; }
}

/** Reuses custom visual structure while preserving the destination's own business content and linked records. */
export function applySavedPublicPageTemplate(content: PageDesignConfig, saved: SavedPublicPageTemplate): PageDesignConfig {
  const source = saved.content;
  const destinationSections = new Map((content.sections ?? []).map((section) => [section.id, section]));
  return {
    ...content,
    template: source.template,
    palette: source.palette,
    primaryColor: source.primaryColor,
    secondaryColor: source.secondaryColor,
    backgroundColor: source.backgroundColor,
    buttonColor: source.buttonColor,
    typography: source.typography,
    cardStyle: source.cardStyle,
    cornerRadius: source.cornerRadius,
    sectionSpacing: source.sectionSpacing,
    sections: source.sections?.map((section) => ({
      ...section,
      title: destinationSections.get(section.id)?.title ?? section.title,
      description: destinationSections.get(section.id)?.description ?? section.description,
    })) ?? content.sections,
  };
}
