import type { BusinessHoursDay, Establishment, EstablishmentOperationalData, PublicProfessionalData, PublicServiceData } from "@/types";

/** Fixed sample content for the visual editor; it is never read from tenant repositories. */
export const PLATFORM_PAGE_PREVIEW_ESTABLISHMENT: Pick<Establishment, "id" | "name" | "slug" | "description" | "logoUrl" | "coverUrl" | "phone" | "instagram" | "address"> = {
  id: "platform-preview-only",
  name: "Ateliê Aurora",
  slug: "previa-agendito",
  description: "Um espaço pensado para cuidar de você com atenção em cada detalhe.",
  phone: "(11) 4000-1234",
  instagram: "@atelieaurora.demo",
  address: { street: "Rua das Flores", number: "120", district: "Jardins", city: "São Paulo", state: "SP", postalCode: "00000-000" },
};

export const PLATFORM_PAGE_PREVIEW_SERVICES: PublicServiceData[] = [
  { id: "preview-service-cut", name: "Corte personalizado", description: "Consultoria e acabamento feitos para você.", durationMinutes: 45, priceInCents: 8500, displayOrder: 1 },
  { id: "preview-service-care", name: "Ritual de cuidado", description: "Uma pausa para renovar e relaxar.", durationMinutes: 60, priceInCents: 12000, displayOrder: 2 },
];

export const PLATFORM_PAGE_PREVIEW_EMPLOYEES: PublicProfessionalData[] = [
  { id: "preview-professional-ana", displayName: "Ana Martins", title: "Especialista", bio: "Atendimento cuidadoso e personalizado.", serviceIds: ["preview-service-cut", "preview-service-care"] },
  { id: "preview-professional-luiza", displayName: "Luiza Costa", title: "Profissional sênior", bio: "Experiência e atenção em cada etapa.", serviceIds: ["preview-service-cut"] },
];

export const PLATFORM_PAGE_PREVIEW_HOURS: BusinessHoursDay[] = [
  { weekday: 0, open: false, intervals: [] },
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday: weekday as 1 | 2 | 3 | 4 | 5, open: true, intervals: [{ start: "09:00", end: "18:00" }] })),
  { weekday: 6, open: true, intervals: [{ start: "09:00", end: "14:00" }] },
];

export const PLATFORM_PAGE_PREVIEW_OPERATIONAL_DATA: EstablishmentOperationalData = {
  services: PLATFORM_PAGE_PREVIEW_SERVICES,
  professionals: PLATFORM_PAGE_PREVIEW_EMPLOYEES,
  businessHours: PLATFORM_PAGE_PREVIEW_HOURS,
  policies: "Alterações demonstrativas podem ser feitas com até 24 horas de antecedência.",
};
