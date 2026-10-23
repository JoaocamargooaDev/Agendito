import { PLATFORM_FEATURES, isFeatureEnabled } from "./policies";
import { getEstablishmentStatus, getPublicPageStatus } from "./domain";
import { localPlatformRepository } from "./storage";
import type { Establishment } from "@/types";
import { CAPABILITIES, canCurrentSession } from "@/features/auth/capabilities";

export const PLATFORM_ACTIONS_KEY = "agendito.mock.platform-actions.v1";

export interface PlatformActionRecord {
  id: string;
  establishmentId: string;
  establishmentName: string;
  action: string;
  occurredAt: string;
}

export function listRegisteredEstablishments() {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return [];
  return localPlatformRepository.establishments.listAll();
}

export function getOwnerDashboardSnapshot() {
  const establishments = listRegisteredEstablishments();
  const current = establishments.filter((establishment) => getEstablishmentStatus(establishment) !== "ARCHIVED");
  const pageRecords = establishments.map((establishment) => localPlatformRepository.publicPages.findByEstablishment(establishment.id));
  const pageStatuses = establishments.map((establishment, index) => getPublicPageStatus(
    pageRecords[index], establishment,
  ));
  const templateForPage = (index: number) => pageRecords[index]?.template ?? "editorial";
  const templateUsage = [...new Set(establishments.map((_, index) => templateForPage(index)))].map((template) => ({ template, count: establishments.filter((_, index) => templateForPage(index) === template).length }));
  const contractStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "NOT_CONFIGURED"] as const;
  return {
    establishments,
    current,
    total: current.length,
    active: current.filter((item) => getEstablishmentStatus(item) === "ACTIVE").length,
    inactive: current.filter((item) => getEstablishmentStatus(item) === "INACTIVE" || getEstablishmentStatus(item) === "DRAFT").length,
    suspended: current.filter((item) => getEstablishmentStatus(item) === "SUSPENDED").length,
    archived: establishments.filter((item) => getEstablishmentStatus(item) === "ARCHIVED").length,
    publishedPages: pageStatuses.filter((status) => status === "PUBLISHED").length,
    draftPages: pageStatuses.filter((status) => status === "DRAFT").length,
    unpublishedPages: pageStatuses.filter((status) => status === "UNPUBLISHED").length,
    pagesCreated: establishments.length,
    templateUsage,
    contractStatusUsage: contractStatuses.map((status) => ({ status, count: establishments.filter((item) => (item.simulatedContractStatus ?? "NOT_CONFIGURED") === status).length })),
    featureUsage: PLATFORM_FEATURES.map((feature) => ({
      featureId: feature.id,
      enabled: current.filter((establishment) => isFeatureEnabled(establishment, feature.id)).length,
      total: current.length,
    })),
  };
}

export function listPlatformActions(establishmentId: string): PlatformActionRecord[] {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return [];
  if (typeof window === "undefined") return [];
  try {
    const records = JSON.parse(window.localStorage.getItem(PLATFORM_ACTIONS_KEY) ?? "[]") as PlatformActionRecord[];
    return records.filter((record) => record.establishmentId === establishmentId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  } catch { return []; }
}

export function recordPlatformAction(establishment: Pick<Establishment, "id" | "name">, action: string) {
  if (typeof window === "undefined" || !canCurrentSession(CAPABILITIES.platformEstablishments, establishment.id)) return false;
  try {
    const existing = JSON.parse(window.localStorage.getItem(PLATFORM_ACTIONS_KEY) ?? "[]") as PlatformActionRecord[];
    const record: PlatformActionRecord = {
      id: `platform-action-${crypto.randomUUID()}`,
      establishmentId: establishment.id,
      establishmentName: establishment.name,
      action,
      occurredAt: new Date().toISOString(),
    };
    window.localStorage.setItem(PLATFORM_ACTIONS_KEY, JSON.stringify([record, ...existing].slice(0, 500)));
    return true;
  } catch { return false; }
}

