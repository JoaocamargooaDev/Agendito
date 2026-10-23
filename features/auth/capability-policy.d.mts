import type { UserRole } from "@/types";

export function evaluateCapabilityAccess(input: {
  role?: UserRole | null;
  capability: string;
  allowedCapabilities: readonly string[];
  boundEstablishmentId?: string | null;
  targetEstablishmentId?: string;
  bootstrap?: boolean;
}): boolean;
