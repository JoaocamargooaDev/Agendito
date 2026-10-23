import type { BusinessHoursDay, EstablishmentSettings, PublicPaletteId, PublicTemplateId } from "@/types";
import { PLATFORM_FEATURES } from "./policies";

export const ESTABLISHMENT_ONBOARDING_DRAFT_KEY = "agendito.mock.platform-onboarding-draft.v1";

export const establishmentPresets = [
  { id: "empty", name: "Estabelecimento vazio", segment: "", description: "", template: "essential" as PublicTemplateId },
  { id: "salon", name: "Salão de beleza", segment: "Salão de beleza", description: "Atendimento de beleza com hora marcada.", template: "premium" as PublicTemplateId },
  { id: "barber", name: "Barbearia", segment: "Barbearia", description: "Cortes, barba e cuidados pessoais.", template: "services" as PublicTemplateId },
  { id: "aesthetic", name: "Clínica de estética", segment: "Clínica de estética", description: "Cuidados estéticos personalizados com horário agendado.", template: "clinic" as PublicTemplateId },
  { id: "office", name: "Consultório não clínico", segment: "Consultório não clínico", description: "Atendimentos especializados com hora marcada.", template: "professionals" as PublicTemplateId },
  { id: "services", name: "Serviços em geral", segment: "Serviços", description: "Serviços personalizados com agendamento online.", template: "essential" as PublicTemplateId },
] as const;

export type EstablishmentPresetId = (typeof establishmentPresets)[number]["id"];

export const onboardingFeatureOptions = PLATFORM_FEATURES;

const weekDays: BusinessHoursDay["weekday"][] = [1, 2, 3, 4, 5, 6, 0];
const businessHours = (days: BusinessHoursDay["weekday"][], start = "09:00", end = "18:00"): BusinessHoursDay[] => weekDays.map((weekday) => ({
  weekday,
  open: days.includes(weekday),
  intervals: days.includes(weekday) ? [{ start, end }] : [],
}));

export interface EstablishmentOnboardingForm {
  preset: EstablishmentPresetId;
  establishmentName: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  managerPassword: string;
  managerPasswordConfirmation: string;
  segment: string;
  description: string;
  street: string;
  number: string;
  district: string;
  postalCode: string;
  city: string;
  state: string;
  timezone: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  palette: PublicPaletteId;
  template: PublicTemplateId;
  publicName: string;
  slug: string;
  businessHours: BusinessHoursDay[];
  slotStepMinutes: number;
  minimumLeadMinutes: number;
  maximumDaysAhead: number;
  customerCanCancel: boolean;
  cancellationLeadMinutes: number;
  customerCanReschedule: boolean;
  reschedulingLeadMinutes: number;
  allowAnyEmployee: boolean;
  enabledFeatures: string[];
  publishAfterCreate: boolean;
  step: number;
}

export function slugifyEstablishment(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
}

export function isValidEstablishmentSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 60;
}

export function createDefaultOnboardingForm(): EstablishmentOnboardingForm {
  return {
    preset: "empty", establishmentName: "", managerName: "", managerEmail: "", managerPhone: "",
    managerPassword: "", managerPasswordConfirmation: "", segment: "", description: "", street: "", number: "", district: "", postalCode: "", city: "", state: "", timezone: "America/Sao_Paulo",
    logoUrl: "", primaryColor: "#3979bd", secondaryColor: "#66d8e8", palette: "moss", template: "essential", publicName: "", slug: "",
    businessHours: businessHours([]), slotStepMinutes: 30, minimumLeadMinutes: 0, maximumDaysAhead: 30,
    customerCanCancel: true, cancellationLeadMinutes: 120, customerCanReschedule: true, reschedulingLeadMinutes: 120,
    allowAnyEmployee: true, enabledFeatures: onboardingFeatureOptions.map(({ id }) => id).filter((id) => !["waitlist", "recurrences", "packages", "loyalty", "commissions", "multi-unit"].includes(id)), publishAfterCreate: false, step: 0,
  };
}

export function applyEstablishmentPreset(current: EstablishmentOnboardingForm, presetId: EstablishmentPresetId): EstablishmentOnboardingForm {
  const preset = establishmentPresets.find((item) => item.id === presetId) ?? establishmentPresets[0];
  return {
    ...current,
    preset: presetId,
    segment: preset.segment,
    description: preset.description,
    template: preset.template,
  };
}

export function getInitialSettings(): EstablishmentSettings {
  return {
    // Safe bootstrap defaults only; operational settings belong to the establishment owner.
    businessHours: businessHours([]),
    booking: { minimumLeadMinutes: 0, maximumDaysAhead: 30, slotStepMinutes: 30, allowAnyEmployee: true },
    cancellation: { customerCanCancel: true, minimumLeadMinutes: 120 },
    rescheduling: { customerCanReschedule: true, minimumLeadMinutes: 120 },
  };
}
