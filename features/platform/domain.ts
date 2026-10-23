import type { Establishment, EstablishmentStatus, PublicPageConfig, PublicPageStatus } from "@/types";

/** Reads new explicit lifecycle state and falls back to the persisted legacy flag. */
type EstablishmentStatusFields = Pick<Establishment, "status" | "archivedAt" | "active">;

export function getEstablishmentStatus(establishment: EstablishmentStatusFields): EstablishmentStatus {
  if (establishment.archivedAt) return "ARCHIVED";
  if (establishment.status) return establishment.status;
  return establishment.active === false ? "INACTIVE" : "ACTIVE";
}

export function isEstablishmentPublic(establishment: EstablishmentStatusFields) {
  return getEstablishmentStatus(establishment) !== "ARCHIVED";
}

/** Legacy pages without status inherit publication state from their establishment. */
export function getPublicPageStatus(config: PublicPageConfig | null | undefined, establishment: EstablishmentStatusFields): PublicPageStatus {
  return config?.status ?? (isEstablishmentOperational(establishment) ? "PUBLISHED" : "DRAFT");
}

export function isEstablishmentOperational(establishment: EstablishmentStatusFields) {
  return getEstablishmentStatus(establishment) === "ACTIVE";
}
