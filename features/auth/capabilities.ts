import type { UserRole } from "@/types";
import { PLATFORM_USERS_KEY, REMEMBERED_SESSION_KEY, SESSION_STORAGE_KEY } from "./constants";
import { evaluateCapabilityAccess } from "./capability-policy.mjs";
import { capabilityForPath } from "./route-capabilities.mjs";

/** Mock authorization catalog. These checks organize UI and local actions; they are not a production security boundary. */
export const CAPABILITIES = {
  platformConsole: "platform.console.access",
  platformEstablishments: "platform.establishments.manage",
  platformPages: "platform.pages.manage",
  platformFeatures: "platform.features.manage",
  platformSettings: "platform.settings.manage",
  platformManagerAccess: "platform.manager-access.manage",
  establishmentConsole: "establishment.console.access",
  establishmentDashboard: "establishment.dashboard.view",
  establishmentAgenda: "establishment.agenda.manage",
  establishmentAppointments: "establishment.appointments.manage",
  establishmentCustomers: "establishment.customers.manage",
  establishmentEmployees: "establishment.employees.manage",
  establishmentServices: "establishment.services.manage",
  establishmentReports: "establishment.reports.view",
  establishmentSettings: "establishment.settings.manage",
  establishmentNotifications: "establishment.notifications.view",
  establishmentAdvanced: "establishment.advanced-use",
  employeeSchedule: "employee.schedule.view",
  employeeAppointments: "employee.appointments.manage",
  employeeClients: "employee.clients.view",
  employeeAvailability: "employee.availability.manage",
  employeeProfile: "employee.profile.manage",
  customerProfile: "customer.profile.manage",
  customerAppointments: "customer.appointments.view",
  publicBooking: "public.booking.create",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  PLATFORM_ADMIN: [
    CAPABILITIES.platformConsole,
    CAPABILITIES.platformEstablishments,
    CAPABILITIES.platformPages,
    CAPABILITIES.platformFeatures,
    CAPABILITIES.platformSettings,
    CAPABILITIES.platformManagerAccess,
  ],
  ADMIN: [
    CAPABILITIES.establishmentConsole,
    CAPABILITIES.establishmentDashboard,
    CAPABILITIES.establishmentAgenda,
    CAPABILITIES.establishmentAppointments,
    CAPABILITIES.establishmentCustomers,
    CAPABILITIES.establishmentEmployees,
    CAPABILITIES.establishmentServices,
    CAPABILITIES.establishmentReports,
    CAPABILITIES.establishmentSettings,
    CAPABILITIES.establishmentNotifications,
    CAPABILITIES.establishmentAdvanced,
  ],
  EMPLOYEE: [
    CAPABILITIES.employeeSchedule,
    CAPABILITIES.employeeAppointments,
    CAPABILITIES.employeeClients,
    CAPABILITIES.employeeAvailability,
    CAPABILITIES.employeeProfile,
  ],
  CUSTOMER: [CAPABILITIES.customerProfile, CAPABILITIES.customerAppointments, CAPABILITIES.publicBooking],
};

export function hasCapability(role: UserRole | null | undefined, capability: Capability): boolean {
  return Boolean(role && ROLE_CAPABILITIES[role].includes(capability));
}

export function capabilitiesForRole(role: UserRole): readonly Capability[] {
  return ROLE_CAPABILITIES[role];
}

let bootstrapDepth = 0;

/** Allows only the account seeder to initialize demo data before a session exists. */
export function runLocalAccountBootstrap<T>(task: () => T): T {
  let hasSession = false;
  try { hasSession = Boolean(window.localStorage.getItem(REMEMBERED_SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY)); } catch { return task(); }
  if (hasSession) return task();
  bootstrapDepth += 1;
  try { return task(); } finally { bootstrapDepth -= 1; }
}

export function isCurrentSessionUser(userId: string, role?: UserRole): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return bootstrapDepth > 0;
    const session = JSON.parse(raw) as { userId?: string; role?: UserRole };
    return session.userId === userId && (!role || session.role === role);
  } catch { return false; }
}

export function currentSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { userId?: string }).userId ?? null : null;
  } catch { return null; }
}

export function currentSessionRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { role?: UserRole }).role ?? null : null;
  } catch { return null; }
}

/** Resolves the active tenant binding without granting access to other tenants. */
export function currentSessionEstablishmentId(): string | null {
  if (typeof window === "undefined") return null;
  const userId = currentSessionUserId();
  if (!userId) return null;
  try {
    const users: Array<{ id: string; establishmentId?: string }> = JSON.parse(window.localStorage.getItem(PLATFORM_USERS_KEY) ?? "[]");
    return users.find((user) => user.id === userId)?.establishmentId ?? null;
  } catch { return null; }
}

/** Checks the current mock session and tenant binding before local admin mutations. */
export function canCurrentSession(capability: Capability, establishmentId?: string): boolean {
  if (typeof window === "undefined") return false;
  let rawSession: string | null = null;
  try { rawSession = window.localStorage.getItem(REMEMBERED_SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY); } catch { return false; }
  if (!rawSession) return bootstrapDepth > 0;
  let session: { userId?: string; role?: UserRole };
  try { session = JSON.parse(rawSession) as { userId?: string; role?: UserRole }; } catch { return false; }
  const boundEstablishmentId = currentSessionEstablishmentId();
  return evaluateCapabilityAccess({
    role: session.role,
    capability,
    allowedCapabilities: session.role ? ROLE_CAPABILITIES[session.role] : [],
    boundEstablishmentId,
    targetEstablishmentId: establishmentId,
  });
}

export function capabilityForRoute(pathname: string): Capability | null {
  return capabilityForPath(pathname) as Capability | null;
}
