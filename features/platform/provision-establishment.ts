import type { Establishment, EstablishmentSettings, PublicPageConfig } from "@/types";
import { APPOINTMENTS_STORAGE_KEY, BLOCKED_PERIODS_STORAGE_KEY } from "@/features/agenda/repository";
import { EMPLOYEES_STORAGE_KEY, SCHEDULES_STORAGE_KEY } from "@/features/employees/repository";
import { SERVICES_STORAGE_KEY } from "@/features/services/repository";
import { ESTABLISHMENT_SETTINGS_STORAGE_KEY } from "@/features/settings/repository";
import { validateBusinessHours } from "@/features/settings/repository";
import { PLATFORM_ESTABLISHMENTS_KEY, PLATFORM_USERS_KEY } from "@/features/auth/constants";
import { isValidEstablishmentSlug } from "./establishment-onboarding";
import { ensureLocalDataMigration, isAccountEmailAvailable, listPlatformEstablishments, type StoredPlatformUser } from "./storage";
import { PLATFORM_PAGE_CONFIG_KEY } from "./storage";
import { CAPABILITIES, canCurrentSession } from "@/features/auth/capabilities";
import { getInitialSettings } from "./establishment-onboarding";

export interface EstablishmentProvisioningInput {
  establishment: Establishment;
  manager: StoredPlatformUser;
  publicPage: PublicPageConfig;
}

type ProvisioningResult = { ok: true } | { ok: false; reason: string };

function readArray<T>(key: string): T[] | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as T[] : null;
  } catch { return null; }
}

function readRecord<T>(key: string): Record<string, T> | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, T> : null;
  } catch { return null; }
}

/** Stores the complete tenant bootstrap as one recoverable local transaction. */
export function provisionEstablishment(input: EstablishmentProvisioningInput): ProvisioningResult {
  if (typeof window === "undefined") return { ok: false, reason: "O cadastro só pode ser concluído no navegador." };
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return { ok: false, reason: "Apenas o proprietário da plataforma pode provisionar estabelecimentos." };
  ensureLocalDataMigration();
  const { establishment, manager, publicPage } = input;
  const settings = getInitialSettings();
  if (!establishment.name.trim() || !establishment.id || !manager.name.trim()) return { ok: false, reason: "Revise os campos obrigatórios antes de criar." };
  if (manager.role !== "ADMIN" || manager.establishmentId !== establishment.id || !establishment.adminUserIds.includes(manager.id) || publicPage.establishmentId !== establishment.id) return { ok: false, reason: "Os vínculos do estabelecimento estão inconsistentes." };
  if (validateBusinessHours(settings.businessHours) || ![5, 10, 15, 30].includes(settings.booking.slotStepMinutes) || settings.booking.minimumLeadMinutes < 0 || settings.booking.maximumDaysAhead < 1 || settings.cancellation.minimumLeadMinutes < 0 || settings.rescheduling.minimumLeadMinutes < 0) return { ok: false, reason: "As configurações iniciais da operação são inválidas." };
  if (!isValidEstablishmentSlug(establishment.slug)) return { ok: false, reason: "O endereço público contém caracteres inválidos." };
  if (!isAccountEmailAvailable(manager.email)) return { ok: false, reason: "Este e-mail já está vinculado a outra conta." };

  const existing = listPlatformEstablishments();
  if (existing.some((item) => item.id === establishment.id)) return { ok: false, reason: "O identificador gerado já existe. Tente criar novamente." };
  if (existing.some((item) => item.slug.trim().toLowerCase() === establishment.slug.toLowerCase())) return { ok: false, reason: "Este endereço público já está em uso." };

  const establishments = readArray<Establishment>(PLATFORM_ESTABLISHMENTS_KEY);
  const users = readArray<StoredPlatformUser>(PLATFORM_USERS_KEY);
  const pages = readArray<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY);
  const settingsByEstablishment = readRecord<EstablishmentSettings>(ESTABLISHMENT_SETTINGS_STORAGE_KEY);
  if (!establishments || !users || !pages || !settingsByEstablishment) {
    return { ok: false, reason: "Há dados locais em formato inválido. Nenhum registro foi alterado." };
  }
  if (users.some((item) => item.id === manager.id)) return { ok: false, reason: "O identificador do gestor já está em uso. Tente novamente." };

  const collections = [
    APPOINTMENTS_STORAGE_KEY,
    BLOCKED_PERIODS_STORAGE_KEY,
    EMPLOYEES_STORAGE_KEY,
    SCHEDULES_STORAGE_KEY,
    SERVICES_STORAGE_KEY,
  ];
  const collectionValues = new Map<string, unknown[]>();
  for (const key of collections) {
    const records = readArray<unknown>(key);
    if (!records) return { ok: false, reason: "Uma coleção local está inválida. Nenhum registro foi alterado." };
    collectionValues.set(key, records);
  }

  const nextEstablishment = [...establishments.filter((item) => item.id !== establishment.id), establishment];
  const nextUsers = [...users.filter((item) => item.id !== manager.id), manager];
  const nextPages = [...pages.filter((item) => item.establishmentId !== establishment.id), publicPage];
  const nextSettings = { ...settingsByEstablishment, [establishment.id]: settings };
  const writes = new Map<string, string>([
    [PLATFORM_ESTABLISHMENTS_KEY, JSON.stringify(nextEstablishment)],
    [PLATFORM_USERS_KEY, JSON.stringify(nextUsers)],
    [PLATFORM_PAGE_CONFIG_KEY, JSON.stringify(nextPages)],
    [ESTABLISHMENT_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings)],
    ...[...collectionValues.entries()].map(([key, value]) => [key, JSON.stringify(value)] as [string, string]),
  ]);
  const previous = new Map([...writes.keys()].map((key) => [key, window.localStorage.getItem(key)]));

  try {
    for (const [key, value] of writes) window.localStorage.setItem(key, value);
  } catch {
    for (const [key, value] of [...previous.entries()].reverse()) {
      try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* best-effort rollback for quota-restricted storage */ }
    }
    return { ok: false, reason: "Não foi possível concluir o provisionamento local. O sistema tentou restaurar os dados anteriores." };
  }

  window.dispatchEvent(new CustomEvent("agendito:settings-updated"));
  window.dispatchEvent(new CustomEvent("agendito:agenda-updated"));
  window.dispatchEvent(new CustomEvent("agendito:employees-updated"));
  window.dispatchEvent(new CustomEvent("agendito:services-updated"));
  window.dispatchEvent(new CustomEvent("agendito:platform-updated"));
  return { ok: true };
}
