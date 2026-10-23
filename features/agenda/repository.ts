import { ensureLocalDataMigration } from "@/features/platform";
import { createLocalTenantRepository } from "@/features/platform/tenant-repository";
import type { Appointment, AppointmentEventOrigin, AppointmentHistoryEvent, AppointmentServiceSnapshot, AppointmentStatus, BlockedPeriod, Service } from "@/types";
import { listAllEstablishments } from "@/features/platform/storage";
import { canModifyEstablishmentData, getOperationalBlockReason, getPublicBookingBlockReason, isFeatureEnabled } from "@/features/platform/policies";
import { isEstablishmentOperational } from "@/features/platform/domain";
import { getPageConfig } from "@/features/platform/storage";
import { validateSlot } from "./availability";
import { dateKeyInTimezone } from "@/features/booking/rules";
import { getEstablishmentSettings } from "@/features/settings/repository";
import { emitAppointmentNotification } from "@/features/notifications/repository";
import { awardLoyaltyForCompletedAppointment, consumePackageSession, listServicePackages } from "@/features/advanced/repository";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionUserId, isCurrentSessionUser } from "@/features/auth/capabilities";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";
import { publicAppointmentRecord, publicAvailabilityAppointmentRecord } from "@/features/platform/data-projections.mjs";
import { isActiveAppointmentStatus, isEditableAppointmentStatus } from "./status";

function canWriteAppointment(establishmentId: string, source: "internal" | "public", origin?: AppointmentEventOrigin) {
  // Public bookings are intentionally available without an authenticated account;
  // role capabilities apply to internal administrative writes only.
  if (source === "public") return true;
  if (origin === "CUSTOMER") return canCurrentSession(CAPABILITIES.customerAppointments);
  if (origin === "EMPLOYEE") return canCurrentSession(CAPABILITIES.employeeAppointments, establishmentId);
  return canCurrentSession(CAPABILITIES.establishmentAppointments, establishmentId);
}

function canManageAvailability(establishmentId: string) {
  return canCurrentSession(CAPABILITIES.establishmentAgenda, establishmentId)
    || canCurrentSession(CAPABILITIES.employeeAvailability, establishmentId);
}

function validationServices(appointment: Appointment): Service[] {
  const snapshots: AppointmentServiceSnapshot[] = appointment.serviceSnapshots?.length ? appointment.serviceSnapshots : [{ id: appointment.serviceId, name: appointment.serviceNameSnapshot, durationMinutes: appointment.durationMinutesSnapshot, priceInCents: appointment.priceInCentsSnapshot }];
  let catalog: Service[] = [];
  if (typeof window !== "undefined") try { catalog = JSON.parse(localStorage.getItem("agendito.mock.services.v1") ?? "[]") as Service[]; } catch { catalog = []; }
  return snapshots.map((snapshot) => {
    const current = catalog.find((item) => item.id === snapshot.id && item.establishmentId === appointment.establishmentId);
    return { ...current, id: snapshot.id, establishmentId: appointment.establishmentId, name: snapshot.name, description: current?.description ?? "", durationMinutes: snapshot.durationMinutes, priceInCents: snapshot.priceInCents, employeeOverrides: undefined, active: current?.active ?? true, status: current?.status, groupCapacity: snapshot.groupCapacity ?? current?.groupCapacity, preparationMinutes: snapshot.preparationMinutes ?? current?.preparationMinutes, cleanupMinutes: snapshot.cleanupMinutes ?? current?.cleanupMinutes, availableWeekdays: snapshot.availableWeekdays ?? current?.availableWeekdays, availabilityWindows: snapshot.availabilityWindows ?? current?.availabilityWindows };
  });
}

export const APPOINTMENTS_STORAGE_KEY = "agendito.mock.appointments.v1";
export const BLOCKED_PERIODS_STORAGE_KEY = "agendito.mock.blocked-periods.v1";
const appointmentsRepository = createLocalTenantRepository<Appointment>(APPOINTMENTS_STORAGE_KEY, "agendito:agenda-updated");
const blockedPeriodsRepository = createLocalTenantRepository<BlockedPeriod>(BLOCKED_PERIODS_STORAGE_KEY, "agendito:agenda-updated");
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [], CANCELLED: [], NO_SHOW: [],
};
export function getAppointmentTransitions(status: AppointmentStatus) { return APPOINTMENT_TRANSITIONS[status]; }
export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus) { return APPOINTMENT_TRANSITIONS[from].includes(to); }
function historyEvent(type: AppointmentHistoryEvent["type"], origin: AppointmentEventOrigin, values: Partial<AppointmentHistoryEvent> = {}): AppointmentHistoryEvent {
  return { id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`, type, at: new Date().toISOString(), origin, ...values };
}

export function listAppointments(establishmentId?: string) {
  ensureLocalDataMigration();
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return [];
  if (canCurrentSession(CAPABILITIES.establishmentAppointments, tenantId)) return appointmentsRepository.listForEstablishment(tenantId);
  if (canCurrentSession(CAPABILITIES.employeeAppointments, tenantId)) {
    const employeeId = currentEmployeeId(tenantId);
    return employeeId ? appointmentsRepository.listForEstablishment(tenantId).filter((item) => item.employeeId === employeeId) : [];
  }
  if (!isPublicBookingContext(tenantId)) return [];
  return appointmentsRepository.listForEstablishment(tenantId).map(publicAvailabilityAppointmentRecord);
}
export function listBlockedPeriods(establishmentId?: string) {
  ensureLocalDataMigration();
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return [];
  if (canCurrentSession(CAPABILITIES.establishmentAgenda, tenantId)) return blockedPeriodsRepository.listForEstablishment(tenantId);
  if (canCurrentSession(CAPABILITIES.employeeSchedule, tenantId) || canCurrentSession(CAPABILITIES.employeeAvailability, tenantId)) {
    const employeeId = currentEmployeeId(tenantId);
    return employeeId ? blockedPeriodsRepository.listForEstablishment(tenantId).filter((item) => !item.employeeId || item.employeeId === employeeId) : [];
  }
  if (!isPublicBookingContext(tenantId)) return [];
  return blockedPeriodsRepository.listForEstablishment(tenantId).map((period) => ({ ...period, reason: "Indisponível" }));
}
export function getAppointment(id: string, establishmentId?: string) {
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return null;
  const appointment = appointmentsRepository.findForEstablishment(tenantId, id);
  if (!appointment) return null;
  if (canCurrentSession(CAPABILITIES.establishmentAppointments, tenantId)) return appointment;
  if (canCurrentSession(CAPABILITIES.employeeAppointments, tenantId)) return currentEmployeeId(tenantId) === appointment.employeeId ? appointment : null;
  if (canCurrentSession(CAPABILITIES.customerAppointments) && isAppointmentOwnedByCurrentCustomer(appointment.customerId)) return appointment;
  return isPublicBookingContext(tenantId) ? publicAppointmentProjection(appointment) : null;
}

function isPublicBookingContext(establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  return Boolean(establishment && isPublishedPublicEstablishment(establishmentId) && !getPublicBookingBlockReason(establishment, getPageConfig(establishmentId)));
}

function currentEmployeeId(establishmentId: string) {
  const userId = currentSessionUserId();
  if (!userId) return null;
  try {
    const employees = JSON.parse(window.localStorage.getItem("agendito.mock.employees.v1") ?? "[]") as Array<{ id: string; userId: string; establishmentId: string }>;
    return employees.find((item) => item.userId === userId && item.establishmentId === establishmentId)?.id ?? null;
  } catch { return null; }
}

function publicAppointmentProjection(appointment: Appointment): Appointment { return publicAppointmentRecord(appointment); }

function isAppointmentOwnedByCurrentCustomer(customerId: string) {
  const userId = currentSessionUserId();
  if (!userId) return false;
  if (isCurrentSessionUser(userId, "CUSTOMER")) {
    try {
      const registered = JSON.parse(window.localStorage.getItem("agendito.mock.registered-customers") ?? "[]") as Array<{ id: string; userId: string }>;
      if (registered.some((item) => item.id === customerId && item.userId === userId)) return true;
    } catch { /* Invalid local records do not grant access. */ }
  }
  return false;
}

export function listCustomerAppointments(customerId: string) {
  if (!isCurrentSessionUser(currentSessionUserId() ?? "", "CUSTOMER") || !isAppointmentOwnedByCurrentCustomer(customerId)) return [];
  return appointmentsRepository.listAll().filter((item) => item.customerId === customerId);
}
export function createAppointment(input: Omit<Appointment, "id" | "createdAt"> & { id?: string; createdAt?: string }, source: "internal" | "public" = "internal") {
  ensureLocalDataMigration();
  if (!canWriteAppointment(input.establishmentId, source, source === "public" ? "PUBLIC" : "ADMIN")) return null;
  const existingAppointments = listAppointments(input.establishmentId);
  const baseId = `apt-${input.establishmentId}-${input.employeeId}-${input.startsAt}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  let id = input.id ?? baseId;
  let suffix = 1;
  while (existingAppointments.some((item) => item.id === id)) { id = `${baseId}-${suffix}`; suffix += 1; }
  const createdAt = input.createdAt ?? new Date().toISOString();
  const appointment: Appointment = { ...input, id, createdAt, history: [...(input.history ?? []), historyEvent("CREATED", source === "public" ? "PUBLIC" : "ADMIN", { toStatus: input.status, startsAt: input.startsAt, endsAt: input.endsAt })] };
  const establishment = listAllEstablishments().find((item) => item.id === appointment.establishmentId);
  if (!establishment || getOperationalBlockReason(establishment) || !isFeatureEnabled(establishment, "team-schedule")) return null;
  if (source === "public" && getPublicBookingBlockReason(establishment, getPageConfig(establishment.id))) return null;
  const services = validationServices(appointment); const service = services[0];
  if (source === "public" && services.some((item) => item.active === false || item.status === "INACTIVE" || item.status === "ARCHIVED" || item.publicVisible === false)) return null;
  const validation = validateSlot({ establishmentId: establishment.id, employeeId: appointment.employeeId, service, services, dateKey: dateKeyInTimezone(new Date(appointment.startsAt), establishment.timezone), timezone: establishment.timezone, appointments: listAppointments(establishment.id), blockedPeriods: listBlockedPeriods(establishment.id), source }, appointment.startsAt, appointment.endsAt);
  if (!validation.ok) return null;
  const saved = appointmentsRepository.create(appointment);
  if (saved) emitAppointmentNotification(saved, saved.history![saved.history!.length - 1]);
  return saved;
}
export function updateAppointment(id: string, patch: Partial<Omit<Appointment, "id" | "establishmentId">>, establishmentId?: string, source: "internal" | "public" = "internal", origin?: AppointmentEventOrigin) {
  const existing = getAppointment(id, establishmentId);
  if (existing) {
    if (!canWriteAppointment(existing.establishmentId, source, origin ?? (source === "public" ? "PUBLIC" : "ADMIN"))) return null;
    const establishment = listAllEstablishments().find((item) => item.id === existing.establishmentId);
    if (!establishment || !canModifyEstablishmentData(establishment) || (patch.startsAt !== undefined && !isEstablishmentOperational(establishment))) return null;
    if (patch.status !== undefined && patch.status !== existing.status && !canTransitionAppointment(existing.status, patch.status)) return null;
    const scheduleChanged = patch.startsAt !== undefined && patch.startsAt !== existing.startsAt || patch.endsAt !== undefined && patch.endsAt !== existing.endsAt;
    const serviceChanged = patch.serviceId !== undefined && patch.serviceId !== existing.serviceId || patch.serviceSnapshots !== undefined || patch.durationMinutesSnapshot !== undefined;
    const employeeChanged = patch.employeeId !== undefined && patch.employeeId !== existing.employeeId;
    const customerChanged = patch.customerId !== undefined && patch.customerId !== existing.customerId;
    if (!isEditableAppointmentStatus(existing.status) && Object.keys(patch).some((key) => key !== "status")) return null;
    if ((scheduleChanged || serviceChanged || employeeChanged) && !isEditableAppointmentStatus(existing.status)) return null;
    if (customerChanged && !isEditableAppointmentStatus(existing.status)) return null;
    if (patch.startsAt !== undefined || patch.endsAt !== undefined || employeeChanged || patch.serviceId !== undefined || patch.durationMinutesSnapshot !== undefined || patch.serviceSnapshots !== undefined) {
      const next = { ...existing, ...patch };
      const services = validationServices(next); const service = services[0];
      const validation = validateSlot({ establishmentId: existing.establishmentId, employeeId: next.employeeId, service, services, dateKey: dateKeyInTimezone(new Date(next.startsAt), establishment.timezone), timezone: establishment.timezone, appointments: listAppointments(existing.establishmentId), blockedPeriods: listBlockedPeriods(existing.establishmentId), source }, next.startsAt, next.endsAt, id);
      if (!validation.ok) return null;
    }
    const resolvedOrigin = origin ?? (source === "public" ? "PUBLIC" : "ADMIN");
    const events: AppointmentHistoryEvent[] = [];
    if (patch.status !== undefined && patch.status !== existing.status) events.push(historyEvent("STATUS_CHANGED", resolvedOrigin, { fromStatus: existing.status, toStatus: patch.status }));
    const nextStartsAt = patch.startsAt ?? existing.startsAt; const nextEndsAt = patch.endsAt ?? existing.endsAt;
    if (nextStartsAt !== existing.startsAt || nextEndsAt !== existing.endsAt) events.push(historyEvent("RESCHEDULED", resolvedOrigin, { previousStartsAt: existing.startsAt, previousEndsAt: existing.endsAt, startsAt: nextStartsAt, endsAt: nextEndsAt }));
    if (patch.customerId !== undefined && patch.customerId !== existing.customerId) events.push(historyEvent("CUSTOMER_MERGED", resolvedOrigin, { previousCustomerId: existing.customerId, customerId: patch.customerId }));
    const nextPatch = events.length ? { ...patch, history: [...(existing.history ?? []), ...events] } : patch;
    const saved = appointmentsRepository.update(existing.establishmentId, id, nextPatch);
    if (saved) events.forEach((event) => emitAppointmentNotification(saved, event));
    if (saved && patch.status === "COMPLETED" && existing.status !== "COMPLETED") {
      awardLoyaltyForCompletedAppointment(saved);
      const eligiblePackage = listServicePackages(saved.establishmentId, saved.customerId).find((item) => item.serviceId === saved.serviceId && item.status === "ACTIVE" && item.sessionsUsed < item.sessionsTotal && (!item.validUntil || item.validUntil >= dateKeyInTimezone(new Date(saved.startsAt), establishment.timezone)));
      if (eligiblePackage) consumePackageSession(saved.establishmentId, eligiblePackage.id, `Sessão consumida no agendamento ${saved.id}`);
    }
    return saved;
  }
  return null;
}
export function relinkAppointmentCustomer(id: string, establishmentId: string, customerId: string, origin: AppointmentEventOrigin = "ADMIN") {
  if (origin !== "ADMIN" || !canCurrentSession(CAPABILITIES.establishmentCustomers, establishmentId)) return null;
  const existing = getAppointment(id, establishmentId);
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  if (!existing || !establishment || existing.customerId === customerId || !canModifyEstablishmentData(establishment)) return null;
  return appointmentsRepository.update(establishmentId, id, { customerId, history: [...(existing.history ?? []), historyEvent("CUSTOMER_MERGED", origin, { previousCustomerId: existing.customerId, customerId })] });
}
export function updateAppointmentStatus(id: string, status: AppointmentStatus, establishmentId?: string, origin: AppointmentEventOrigin = "ADMIN") {
  return updateAppointment(id, { status }, establishmentId, "internal", origin);
}
export function createBlockedPeriod(input: Omit<BlockedPeriod, "id"> & { id?: string }) {
  ensureLocalDataMigration();
  if (!canManageAvailability(input.establishmentId)) return null;
  if (!canCurrentSession(CAPABILITIES.establishmentAgenda, input.establishmentId) && currentEmployeeId(input.establishmentId) !== input.employeeId) return null;
  const establishment = listAllEstablishments().find((item) => item.id === input.establishmentId);
  if (!establishment || getOperationalBlockReason(establishment) || !isFeatureEnabled(establishment, "team-schedule")) return null;
  const start = new Date(input.startsAt).getTime();
  const end = new Date(input.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const booking = getEstablishmentSettings(establishment.id).booking;
  const beforeMs = (booking.bufferBeforeMinutes ?? 0) * 60000;
  const afterMs = (booking.bufferAfterMinutes ?? 0) * 60000;
  const conflict = listAppointments(establishment.id).some((appointment) => isActiveAppointmentStatus(appointment.status) && (!input.employeeId || appointment.employeeId === input.employeeId) && new Date(appointment.startsAt).getTime() - beforeMs < end && new Date(appointment.endsAt).getTime() + afterMs > start);
  if (conflict) return null;
  const baseId = `block-${input.establishmentId}-${input.employeeId ?? "all"}-${input.startsAt}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  let id = input.id ?? baseId;
  let suffix = 1;
  while (blockedPeriodsRepository.listAll().some((item) => item.id === id)) { if (input.id) return null; id = `${baseId}-${suffix}`; suffix += 1; }
  const period: BlockedPeriod = { ...input, id };
  return blockedPeriodsRepository.create(period);
}
export function updateBlockedPeriod(id: string, patch: Partial<Omit<BlockedPeriod, "id" | "establishmentId">>, establishmentId?: string) {
  const existing = establishmentId
    ? blockedPeriodsRepository.findForEstablishment(establishmentId, id)
    : blockedPeriodsRepository.listAll().find((item) => item.id === id) ?? null;
  if (!existing) return null;
  if (!canManageAvailability(existing.establishmentId)) return null;
  if (!canCurrentSession(CAPABILITIES.establishmentAgenda, existing.establishmentId) && currentEmployeeId(existing.establishmentId) !== existing.employeeId) return null;
  const establishment = listAllEstablishments().find((item) => item.id === existing.establishmentId);
  if (!establishment || !canModifyEstablishmentData(establishment) || !isFeatureEnabled(establishment, "team-schedule")) return null;
  const next = { ...existing, ...patch };
  const start = new Date(next.startsAt).getTime();
  const end = new Date(next.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const conflict = listAppointments(establishment.id).some((appointment) => isActiveAppointmentStatus(appointment.status) && (!next.employeeId || appointment.employeeId === next.employeeId) && new Date(appointment.startsAt).getTime() < end && new Date(appointment.endsAt).getTime() > start);
  if (conflict) return null;
  return blockedPeriodsRepository.update(existing.establishmentId, id, patch);
}
export function removeBlockedPeriod(id: string, establishmentId?: string) {
  const existing = establishmentId
    ? blockedPeriodsRepository.findForEstablishment(establishmentId, id)
    : blockedPeriodsRepository.listAll().find((item) => item.id === id) ?? null;
  if (!existing) return false;
  if (!canManageAvailability(existing.establishmentId)) return false;
  if (!canCurrentSession(CAPABILITIES.establishmentAgenda, existing.establishmentId) && currentEmployeeId(existing.establishmentId) !== existing.employeeId) return false;
  const establishment = listAllEstablishments().find((item) => item.id === existing.establishmentId);
  if (!establishment || !canModifyEstablishmentData(establishment) || !isFeatureEnabled(establishment, "team-schedule")) return false;
  return blockedPeriodsRepository.remove(existing.establishmentId, id);
}
export function isOccupyingStatus(status: AppointmentStatus) { return isActiveAppointmentStatus(status); }
