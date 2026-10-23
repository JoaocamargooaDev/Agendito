import { findEstablishmentByPublicSlug, getPageConfig, getPublicPageStatus, isEstablishmentPublic } from "@/features/platform";
import type { Establishment } from "@/types";

export function findPublicEstablishment(slug: string): Establishment | null {
  const establishment = findEstablishmentByPublicSlug(slug);
  return establishment && isEstablishmentPublic(establishment) && getPublicPageStatus(getPageConfig(establishment.id), establishment) === "PUBLISHED" ? establishment : null;
}
