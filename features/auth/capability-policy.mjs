/** Pure local authorization policy; this is a UI/data-integrity boundary, not production security. */
export function evaluateCapabilityAccess({ role, capability, allowedCapabilities, boundEstablishmentId, targetEstablishmentId, bootstrap = false }) {
  if (!role) return bootstrap;
  if (!allowedCapabilities.includes(capability)) return false;
  if (role === "PLATFORM_ADMIN") return capability.startsWith("platform.");
  if (role === "CUSTOMER") return capability.startsWith("customer.");
  if (role !== "ADMIN" && role !== "EMPLOYEE") return false;
  if (!boundEstablishmentId) return false;
  return !targetEstablishmentId || targetEstablishmentId === boundEstablishmentId;
}
