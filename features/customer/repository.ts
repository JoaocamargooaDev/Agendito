import { customers, users } from "@/mocks";
import { listAllEstablishments } from "@/features/platform";
import { REGISTERED_CUSTOMERS_KEY } from "@/features/auth/constants";
import { isActiveAppointmentStatus, isCustomerManageableAppointmentStatus, listAppointments, listCustomerAppointments, relinkAppointmentCustomer, updateAppointment } from "@/features/agenda";
import { getEmployee } from "@/features/employees/repository";
import type { Appointment } from "@/types";
import { getEstablishmentSettings } from "@/features/settings";
import { getPageConfig } from "@/features/platform/storage";
import { getPublishedPageContent } from "@/features/platform/public-page-builder";
import { getGuestCustomer } from "@/features/booking/guest-repository";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionUserId, isCurrentSessionUser } from "@/features/auth/capabilities";

export const CUSTOMER_CANCEL_LEAD_MINUTES = 120;
export const CUSTOMER_PROFILE_OVERRIDES_KEY = "agendito.mock.customer-profile-overrides.v1";
export const CUSTOMER_ESTABLISHMENT_PROFILES_KEY = "agendito.mock.customer-establishment-profiles.v1";

export interface CustomerEstablishmentProfile { establishmentId: string; customerId: string; notes: string; preferences: string; tags: string[]; mergedIntoId?: string; }
function profileKey(establishmentId: string, customerId: string) { return `${establishmentId}:${customerId}`; }
function readCustomerEstablishmentProfiles(): Record<string, CustomerEstablishmentProfile> {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_ESTABLISHMENT_PROFILES_KEY) ?? "{}") as Record<string, CustomerEstablishmentProfile>; } catch { return {}; }
}
export function getCustomerEstablishmentProfile(establishmentId: string, customerId: string): CustomerEstablishmentProfile {
  if (canCurrentSession(CAPABILITIES.platformConsole)) return { establishmentId, customerId, notes: "", preferences: "", tags: [] };
  if (!canCurrentSession(CAPABILITIES.establishmentCustomers, establishmentId) || !listAppointments(establishmentId).some((item) => item.customerId === customerId)) return { establishmentId, customerId, notes: "", preferences: "", tags: [] };
  if (typeof window === "undefined") return { establishmentId, customerId, notes: "", preferences: "", tags: [] };
  return readCustomerEstablishmentProfiles()[profileKey(establishmentId, customerId)] ?? { establishmentId, customerId, notes: "", preferences: "", tags: [] };
}
export function updateCustomerEstablishmentProfile(establishmentId: string, customerId: string, input: { notes: string; preferences: string; tags: string[] }) {
  if (typeof window === "undefined" || !canCurrentSession(CAPABILITIES.establishmentCustomers, establishmentId) || !listAppointments(establishmentId).some((item) => item.customerId === customerId)) return false;
  const profiles = readCustomerEstablishmentProfiles();
  const key = profileKey(establishmentId, customerId);
  profiles[key] = { ...profiles[key], establishmentId, customerId, notes: input.notes, preferences: input.preferences, tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))] };
  try { localStorage.setItem(CUSTOMER_ESTABLISHMENT_PROFILES_KEY, JSON.stringify(profiles)); window.dispatchEvent(new Event("agendito:customer-profile-updated")); return true; } catch { return false; }
}

/** Moves duplicate customer appointments into a canonical customer record without deleting appointment history. */
export function mergeCustomerRecords(establishmentId: string, canonicalCustomerId: string, duplicateCustomerId: string) {
  if (canonicalCustomerId === duplicateCustomerId || typeof window === "undefined") return false;
  const scopedAppointments = listAppointments(establishmentId);
  const duplicates = scopedAppointments.filter((item) => item.customerId === duplicateCustomerId);
  if (!duplicates.length || !scopedAppointments.some((item) => item.customerId === canonicalCustomerId)) return false;
  for (const appointment of duplicates) {
    if (!relinkAppointmentCustomer(appointment.id, establishmentId, canonicalCustomerId, "ADMIN")) return false;
  }
  const profiles = readCustomerEstablishmentProfiles();
  const canonicalKey = profileKey(establishmentId, canonicalCustomerId);
  const duplicateKey = profileKey(establishmentId, duplicateCustomerId);
  const canonical = profiles[canonicalKey] ?? { establishmentId, customerId: canonicalCustomerId, notes: "", preferences: "", tags: [] };
  const duplicate = profiles[duplicateKey] ?? { establishmentId, customerId: duplicateCustomerId, notes: "", preferences: "", tags: [] };
  profiles[canonicalKey] = { ...canonical, notes: [canonical.notes, duplicate.notes].filter(Boolean).join("\n"), preferences: [canonical.preferences, duplicate.preferences].filter(Boolean).join("\n"), tags: [...new Set([...canonical.tags, ...duplicate.tags])] };
  profiles[duplicateKey] = { ...duplicate, mergedIntoId: canonicalCustomerId };
  try { localStorage.setItem(CUSTOMER_ESTABLISHMENT_PROFILES_KEY, JSON.stringify(profiles)); window.dispatchEvent(new Event("agendito:customer-profile-updated")); return true; } catch { return false; }
}

export function listKnownCustomers() {
  if (canCurrentSession(CAPABILITIES.platformConsole)) return [];
  if (canCurrentSession(CAPABILITIES.customerProfile)) {
    const userId = currentSessionUserId();
    return userId ? [...customers, ...registeredCustomers()].filter((item) => item.userId === userId) : [];
  }
  if (typeof window === "undefined") return customers;
  try {
    const tenantId = currentSessionEstablishmentId();
    if (!tenantId || !(canCurrentSession(CAPABILITIES.establishmentCustomers, tenantId) || canCurrentSession(CAPABILITIES.employeeClients, tenantId))) return [];
    const customerIds = new Set(listAppointments(tenantId).map((item) => item.customerId));
    return [...new Map([...customers, ...registeredCustomers()].filter((item) => customerIds.has(item.id)).map((item) => [item.id, item])).values()];
  } catch { return []; }
}

function registeredCustomers() {
  try { return JSON.parse(localStorage.getItem(REGISTERED_CUSTOMERS_KEY) ?? "[]") as Array<{ id: string; userId: string; phone: string; preferredName?: string; email?: string }>; } catch { return []; }
}

export function customerAppointments(customerId: string) { return listCustomerAppointments(customerId); }
export function upcomingCustomerAppointments(customerId: string, now = new Date()) { return customerAppointments(customerId).filter((item) => isActiveAppointmentStatus(item.status) && new Date(item.startsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); }
export function customerHistory(customerId: string, now = new Date()) { return customerAppointments(customerId).filter((item) => item.status === "COMPLETED" || item.status === "CANCELLED" || item.status === "NO_SHOW" || new Date(item.endsAt) < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt)); }
export function getOwnedAppointment(customerId: string, id: string) { return customerAppointments(customerId).find((item) => item.id === id) ?? null; }
export function establishmentForAppointment(appointment: Appointment) { return listAllEstablishments().find((item) => item.id === appointment.establishmentId && item.active !== false) ?? null; }
export function employeeNameForAppointment(appointment: Appointment) { return getEmployee(appointment.employeeId, appointment.establishmentId)?.displayName ?? "Profissional"; }
export function canCancelAppointment(appointment: Appointment, now = new Date()) { if (!isCustomerManageableAppointmentStatus(appointment.status)) return { ok: false, reason: "Este agendamento não pode mais ser cancelado." }; const establishment = establishmentForAppointment(appointment); if (!establishment) return { ok: false, reason: "O estabelecimento não está disponível." }; if (getPublishedPageContent(getPageConfig(establishment.id))?.allowCustomerCancel === false) return { ok: false, reason: "O estabelecimento não permite cancelamento pelo cliente." }; const policy = getEstablishmentSettings(establishment.id).cancellation; if (!policy.customerCanCancel) return { ok: false, reason: "O estabelecimento não permite cancelamento pelo cliente." }; const minutes = (new Date(appointment.startsAt).getTime() - now.getTime()) / 60000; return minutes >= policy.minimumLeadMinutes ? { ok: true } : { ok: false, reason: `Cancelamentos precisam ser feitos com pelo menos ${policy.minimumLeadMinutes / 60} horas de antecedência.` }; }
export function cancelOwnedAppointment(customerId: string, id: string, now = new Date()) { const appointment = getOwnedAppointment(customerId, id); if (!appointment) return { ok: false as const, reason: "Agendamento não encontrado." }; const permission = canCancelAppointment(appointment, now); if (!permission.ok) return permission; const updated = updateAppointment(id, { status: "CANCELLED" }, appointment.establishmentId, "internal", "CUSTOMER"); return updated ? { ok: true as const, appointment: updated } : { ok: false as const, reason: "Não foi possível salvar o cancelamento." }; }
export function canRescheduleAppointment(appointment: Appointment, now = new Date()) { if (!isCustomerManageableAppointmentStatus(appointment.status)) return { ok: false, reason: "Este agendamento não pode ser reagendado." }; const establishment = establishmentForAppointment(appointment); if (!establishment) return { ok: false, reason: "O estabelecimento não está disponível." }; if (getPublishedPageContent(getPageConfig(establishment.id))?.allowCustomerReschedule === false) return { ok: false, reason: "O estabelecimento não permite reagendamento pelo cliente." }; const policy = getEstablishmentSettings(establishment.id).rescheduling; if (!policy.customerCanReschedule) return { ok: false, reason: "O estabelecimento não permite reagendamento pelo cliente." }; const minutes = (new Date(appointment.startsAt).getTime() - now.getTime()) / 60000; return minutes >= policy.minimumLeadMinutes ? { ok: true } : { ok: false, reason: `Reagendamentos precisam ser feitos com pelo menos ${policy.minimumLeadMinutes / 60} horas de antecedência.` }; }
export function updateOwnedAppointment(customerId: string, id: string, startsAt: string, endsAt: string, now = new Date()) { const appointment = getOwnedAppointment(customerId, id); if (!appointment) return { ok: false as const, reason: "Agendamento não encontrado." }; const permission = canRescheduleAppointment(appointment, now); if (!permission.ok) return permission; const updated = updateAppointment(id, { startsAt, endsAt }, appointment.establishmentId, "public", "CUSTOMER"); return updated ? { ok: true as const, appointment: updated } : { ok: false as const, reason: "Esse horário não está mais disponível. Escolha uma nova opção." }; }
export function profileForCustomer(customerId: string) {
  if (canCurrentSession(CAPABILITIES.platformConsole)) return null;
  const customer = customers.find((item) => item.id === customerId) ?? registeredCustomers().find((item) => item.id === customerId);
  const user = customer ? users.find((item) => item.id === customer.userId) : undefined;
  const ownCustomer = Boolean(customer && isCurrentSessionUser(customer.userId, "CUSTOMER"));
  const tenantId = currentSessionEstablishmentId();
  const operationalAccess = Boolean(tenantId && (canCurrentSession(CAPABILITIES.establishmentCustomers, tenantId) || canCurrentSession(CAPABILITIES.employeeClients, tenantId)) && listAppointments(tenantId).some((item) => item.customerId === customerId));
  if (!ownCustomer && !operationalAccess) return null;
  if (customer && user) return { customer, user };
  const guest = operationalAccess && tenantId ? getGuestCustomer(customerId, tenantId) : null;
  if (guest) return { customer: { id: guest.id, userId: guest.id, phone: guest.phone ?? "", preferredName: guest.name }, user: { id: guest.id, name: guest.name, email: guest.email ?? "", role: "CUSTOMER" as const, phone: guest.phone, createdAt: guest.createdAt } };
  if (customer) {
    const registered = registeredCustomers().find((item) => item.id === customerId);
    return { customer, user: { id: customer.userId, name: customer.preferredName ?? "Cliente", email: registered?.email ?? "", role: "CUSTOMER" as const, phone: customer.phone, createdAt: new Date().toISOString() } };
  }
  return null;
}
export function updateCustomerProfile(customerId: string, input: { name: string; email: string; phone: string }) { if (!canCurrentSession(CAPABILITIES.customerProfile) || !isCustomerRecordOwnedBySession(customerId)) return { ok: false as const, reason: "Você não pode alterar este perfil." }; const profile = profileForCustomer(customerId); if (!profile) return { ok: false as const, reason: "Perfil não encontrado." }; if (!input.name.trim() || !/^\S+@\S+\.\S+$/.test(input.email)) return { ok: false as const, reason: "Informe nome e e-mail válidos." }; try { const stored = JSON.parse(localStorage.getItem(REGISTERED_CUSTOMERS_KEY) ?? "[]") as Array<Record<string, unknown>>; const registered = stored.map((item) => item.id === customerId ? { ...item, preferredName: input.name.trim(), phone: input.phone, email: input.email.trim().toLowerCase() } : item); localStorage.setItem(REGISTERED_CUSTOMERS_KEY, JSON.stringify(registered)); const overrides = JSON.parse(localStorage.getItem(CUSTOMER_PROFILE_OVERRIDES_KEY) ?? "{}") as Record<string, unknown>; overrides[customerId] = { name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone }; localStorage.setItem(CUSTOMER_PROFILE_OVERRIDES_KEY, JSON.stringify(overrides)); return { ok: true as const }; } catch { return { ok: false as const, reason: "Não foi possível salvar o perfil neste navegador." }; } }

function isCustomerRecordOwnedBySession(customerId: string) {
  const userId = canCurrentSession(CAPABILITIES.customerProfile) ? currentSessionUserId() : null;
  if (!userId) return false;
  return listKnownCustomers().some((customer) => customer.id === customerId && customer.userId === userId)
    || (() => { try { return (JSON.parse(localStorage.getItem(REGISTERED_CUSTOMERS_KEY) ?? "[]") as Array<{ id: string; userId: string }>).some((item) => item.id === customerId && item.userId === userId); } catch { return false; } })();
}
export function displayUserForCustomer(customerId: string) { const profile = profileForCustomer(customerId); return profile ? { ...profile.user, customer: profile.customer } : null; }
