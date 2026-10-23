import { canCurrentSession, CAPABILITIES } from "@/features/auth/capabilities";
import { findPublishedEstablishmentById } from "./storage";

/** Public data reads are available only for a currently published, non-archived page. */
export function isPublishedPublicEstablishment(establishmentId: string) {
  if (canCurrentSession(CAPABILITIES.platformConsole)) return false;
  return Boolean(findPublishedEstablishmentById(establishmentId));
}
