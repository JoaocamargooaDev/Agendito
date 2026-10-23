import type { Establishment, PublicPageConfig } from "@/types";
import { getEstablishmentStatus, getPublicPageStatus, isEstablishmentOperational } from "./domain";

export const PLATFORM_FEATURES = [
  { id: "public-booking", label: "Agendamento público", description: "Reservas iniciadas pela página pública.", navigation: null },
  { id: "team-schedule", label: "Agenda de equipe", description: "Agenda, equipe e disponibilidade.", navigation: ["agenda", "employees"] },
  { id: "customers", label: "Gestão de clientes", description: "Cadastro e relacionamento com clientes.", navigation: "customers" },
  { id: "advanced-services", label: "Serviços avançados", description: "Catálogo e gestão de serviços.", navigation: ["services"] },
  { id: "reports", label: "Relatórios", description: "Indicadores operacionais do estabelecimento.", navigation: null },
  { id: "notifications", label: "Notificações", description: "Avisos do estabelecimento.", navigation: null },
  { id: "waitlist", label: "Lista de espera", description: "Cadastro de clientes aguardando horários.", navigation: null },
  { id: "recurrences", label: "Recorrências", description: "Agendamentos recorrentes.", navigation: null },
  { id: "packages", label: "Pacotes", description: "Combinações de serviços.", navigation: null },
  { id: "loyalty", label: "Fidelidade", description: "Benefícios e histórico de fidelidade.", navigation: null },
  { id: "commissions", label: "Comissões", description: "Regras de comissão da equipe.", navigation: null },
  { id: "multi-unit", label: "Gestão de múltiplas unidades", description: "Operação de unidades vinculadas.", navigation: null },
] as const;

const legacyAliases: Record<string, string[]> = {
  "team-schedule": ["agenda", "employees"],
  "advanced-services": ["services"],
};

export function getNavigationFeatureId(navigationId: string) {
  return PLATFORM_FEATURES.find((feature) => (feature.navigation as readonly string[] | null)?.includes(navigationId))?.id;
}

const OPTIONAL_FEATURES = ["waitlist", "recurrences", "packages", "loyalty", "commissions", "multi-unit"] as const;
export function hasEnabledOptionalFeature(establishment: Establishment) {
  return OPTIONAL_FEATURES.some((featureId) => isFeatureEnabled(establishment, featureId));
}

/** Preserve legacy core access, but keep newly introduced add-ons opt-in per tenant. */
type EstablishmentFeatureFields = Pick<Establishment, "enabledFeatures" | "featureConfigVersion">;

export function isFeatureEnabled(establishment: EstablishmentFeatureFields, featureId: string) {
  if (establishment.enabledFeatures === undefined) return !OPTIONAL_FEATURES.includes(featureId as (typeof OPTIONAL_FEATURES)[number]);
  const enabled = new Set(establishment.enabledFeatures);
  if (establishment.featureConfigVersion !== 2 && !enabled.has(featureId)) {
    if (featureId === "public-booking") return true;
    if (OPTIONAL_FEATURES.includes(featureId as (typeof OPTIONAL_FEATURES)[number])) return false;
  }
  if (enabled.has(featureId)) return true;
  return (legacyAliases[featureId] ?? []).some((alias) => enabled.has(alias));
}

export function getEnabledFeatureIds(establishment: EstablishmentFeatureFields) {
  if (establishment.featureConfigVersion === 2) return PLATFORM_FEATURES.filter((feature) => isFeatureEnabled(establishment, feature.id)).map((feature) => feature.id);
  if (establishment.enabledFeatures === undefined) return PLATFORM_FEATURES.filter((feature) => isFeatureEnabled(establishment, feature.id)).map((feature) => feature.id);
  const legacy = new Set(establishment.enabledFeatures);
  const result = PLATFORM_FEATURES.filter((feature) => {
    if (OPTIONAL_FEATURES.includes(feature.id as (typeof OPTIONAL_FEATURES)[number])) return legacy.has(feature.id);
    if (feature.id === "team-schedule") return legacy.has("agenda") || legacy.has("employees");
    if (feature.id === "advanced-services") return legacy.has("services");
    return legacy.has(feature.id);
  }).map((feature) => feature.id);
  return result;
}

export function getOperationalBlockReason(establishment: Establishment) {
  switch (getEstablishmentStatus(establishment)) {
    case "ACTIVE": return null;
    case "INACTIVE": return "Este estabelecimento está temporariamente inativo e não aceita novas operações.";
    case "SUSPENDED": return establishment.suspensionReason?.trim() || "As operações deste estabelecimento estão temporariamente suspensas.";
    case "ARCHIVED": return "Este estabelecimento foi arquivado e está disponível somente para consulta administrativa.";
    case "DRAFT": return "Este estabelecimento ainda está em configuração.";
  }
}

export function canModifyEstablishmentData(establishment: Establishment) {
  const status = getEstablishmentStatus(establishment);
  return status !== "SUSPENDED" && status !== "ARCHIVED";
}

export function getPublicPageBlockReason(establishment: Establishment, page: PublicPageConfig | null | undefined) {
  if (getEstablishmentStatus(establishment) === "ARCHIVED") return "Esta página não está disponível.";
  if (getPublicPageStatus(page, establishment) !== "PUBLISHED") return "Esta página não está publicada.";
  return null;
}

export function getPublicBookingBlockReason(establishment: Establishment, page?: PublicPageConfig | null) {
  const publicPageReason = getPublicPageBlockReason(establishment, page);
  if (publicPageReason) return publicPageReason;
  const operationalReason = getOperationalBlockReason(establishment);
  if (operationalReason) return operationalReason;
  if (!isEstablishmentOperational(establishment)) return "O estabelecimento não está disponível para novos agendamentos.";
  if (!isFeatureEnabled(establishment, "public-booking")) return "O agendamento público está temporariamente indisponível.";
  return null;
}

export function createEstablishmentLifecycleUpdate<T extends Establishment & object>(establishment: T, status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED", reason?: string): T;
export function createEstablishmentLifecycleUpdate<T extends Pick<Establishment, "status" | "archivedAt" | "active" | "statusBeforeArchive" | "suspensionReason"> & object>(establishment: T, status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED", reason?: string): T;
export function createEstablishmentLifecycleUpdate(establishment: Pick<Establishment, "status" | "archivedAt" | "active" | "statusBeforeArchive" | "suspensionReason">, status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED", reason?: string) {
  if (status === "ARCHIVED") {
    const current = getEstablishmentStatus(establishment);
    return { ...establishment, status, archivedAt: establishment.archivedAt ?? new Date().toISOString(), statusBeforeArchive: current === "ARCHIVED" ? establishment.statusBeforeArchive ?? "INACTIVE" : current, active: false };
  }
  return { ...establishment, status, active: status === "ACTIVE", archivedAt: undefined, statusBeforeArchive: undefined, suspensionReason: status === "SUSPENDED" ? reason?.trim() || establishment.suspensionReason : undefined };
}
