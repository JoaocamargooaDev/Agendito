import type { TenantScopedRecord } from "@/types";
import { listAllEstablishments } from "@/features/platform/storage";
import { isFeatureEnabled } from "@/features/platform/policies";
import { CAPABILITIES, canCurrentSession, currentSessionUserId } from "@/features/auth/capabilities";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";
import { getPublicBookingBlockReason } from "@/features/platform/policies";
import { getPageConfig } from "@/features/platform/storage";
import { getService, listServices } from "@/features/services/repository";
import { listEmployees } from "@/features/employees/repository";

export type OptionalModule = "waitlist" | "recurrences" | "loyalty" | "packages" | "commissions";
export type WaitlistState = "WAITING" | "MATCHED" | "BOOKED" | "CANCELLED";
export interface WaitlistEntry extends TenantScopedRecord {
  id: string; customerId?: string; customerName: string; phone: string; serviceId: string; employeeId?: string;
  weekdays: number[]; preferredStart?: string; preferredEnd?: string; status: WaitlistState;
  matches?: Array<{ date: string; start: string; end: string; employeeId: string }>; createdAt: string; updatedAt: string;
}
export type RecurrenceFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export interface RecurrenceSeries extends TenantScopedRecord {
  id: string; customerId: string; serviceId: string; employeeId: string; frequency: RecurrenceFrequency;
  startDate: string; startTime: string; endDate?: string; maxOccurrences: number; appointmentIds: string[];
  status: "ACTIVE" | "CANCELLED"; createdAt: string; updatedAt: string;
}
export interface LoyaltySettings { pointsPerCurrencyUnit: number; visitsPerReward?: number; benefits: Array<{ id: string; name: string; pointsRequired: number; description: string }>; }
export interface LoyaltyLedgerEntry extends TenantScopedRecord { id: string; customerId: string; kind: "EARNED" | "REDEEMED" | "ADJUSTED" | "VISIT" | "VISIT_REDEEMED"; points: number; note: string; appointmentId?: string; createdAt: string; }
export interface ServicePackage extends TenantScopedRecord { id: string; customerId: string; serviceId: string; sessionsTotal: number; sessionsUsed: number; validUntil?: string; status: "ACTIVE" | "EXPIRED" | "COMPLETED"; createdAt: string; history: Array<{ id: string; action: "PURCHASED" | "SESSION_USED"; at: string; note: string }>; }
export interface CommissionRule extends TenantScopedRecord { id: string; serviceId: string; fixedAmountInCents?: number; updatedAt: string; }

export const ADVANCED_STORAGE_KEYS = {
  waitlist: "agendito.mock.waitlist.v1", recurrences: "agendito.mock.recurrence-series.v1",
  loyaltySettings: "agendito.mock.loyalty-settings.v1", loyaltyLedger: "agendito.mock.loyalty-ledger.v1",
  packages: "agendito.mock.service-packages.v1", commissions: "agendito.mock.commission-rules.v1",
} as const;
const changed = "agendito:advanced-features-updated";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value as T[] : []; } catch { return []; }
}
function save<T>(key: string, records: T[]) {
  if (typeof window === "undefined") return false;
  try { localStorage.setItem(key, JSON.stringify(records)); window.dispatchEvent(new Event(changed)); return true; } catch { return false; }
}
function enabled(establishmentId: string, module: OptionalModule) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  return Boolean(establishment && isFeatureEnabled(establishment, module));
}
function canManageModule(establishmentId: string, module: OptionalModule) {
  return enabled(establishmentId, module) && canCurrentSession(CAPABILITIES.establishmentAdvanced, establishmentId);
}
function isCurrentCustomer(customerId: string) {
  const userId = currentSessionUserId();
  if (!userId || !canCurrentSession(CAPABILITIES.customerAppointments)) return false;
  try { return (JSON.parse(localStorage.getItem("agendito.mock.registered-customers") ?? "[]") as Array<{ id: string; userId: string }>).some((item) => item.id === customerId && item.userId === userId); } catch { return false; }
}
function isPublicWaitlistOpen(establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  return Boolean(establishment && isPublishedPublicEstablishment(establishmentId) && enabled(establishmentId, "waitlist") && !getPublicBookingBlockReason(establishment, getPageConfig(establishmentId)));
}
function scoped<T extends TenantScopedRecord>(key: string, establishmentId: string) { return read<T>(key).filter((item) => item.establishmentId === establishmentId); }
function replaceTenant<T extends TenantScopedRecord>(key: string, establishmentId: string, tenantRecords: T[]) {
  const other = read<T>(key).filter((item) => item.establishmentId !== establishmentId);
  return save(key, [...other, ...tenantRecords]);
}
const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function listWaitlist(establishmentId: string) { return canManageModule(establishmentId, "waitlist") ? scoped<WaitlistEntry>(ADVANCED_STORAGE_KEYS.waitlist, establishmentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []; }
export function createWaitlistEntry(input: Omit<WaitlistEntry, "id" | "status" | "createdAt" | "updatedAt">) {
  if (!enabled(input.establishmentId, "waitlist") || (!canManageModule(input.establishmentId, "waitlist") && !isPublicWaitlistOpen(input.establishmentId)) || input.customerId && !canManageModule(input.establishmentId, "waitlist") && !isCurrentCustomer(input.customerId) || !input.customerName.trim() || !input.phone.trim() || !input.serviceId || !input.weekdays.length || input.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return null;
  const service = listServices(input.establishmentId).find((item) => item.id === input.serviceId && item.active && item.status !== "ARCHIVED");
  if (!service) return null;
  if (input.employeeId && !listEmployees(input.establishmentId).some((employee) => employee.id === input.employeeId && employee.active && employee.serviceIds.includes(input.serviceId))) return null;
  if (Boolean(input.preferredStart) !== Boolean(input.preferredEnd) || input.preferredStart && (!/^\d{2}:\d{2}$/.test(input.preferredStart) || !/^\d{2}:\d{2}$/.test(input.preferredEnd ?? "") || input.preferredStart >= (input.preferredEnd ?? ""))) return null;
  const normalizedPhone = input.phone.replace(/\D/g, "");
  const existing = scoped<WaitlistEntry>(ADVANCED_STORAGE_KEYS.waitlist, input.establishmentId);
  if (existing.some((entry) => entry.status === "WAITING" && entry.serviceId === input.serviceId && (entry.employeeId ?? "any") === (input.employeeId ?? "any") && entry.phone.replace(/\D/g, "") === normalizedPhone && JSON.stringify([...entry.weekdays].sort()) === JSON.stringify([...input.weekdays].sort()) && entry.preferredStart === input.preferredStart && entry.preferredEnd === input.preferredEnd)) return null;
  const now = new Date().toISOString(); const entry: WaitlistEntry = { ...input, customerName: input.customerName.trim(), phone: input.phone.trim(), id: id("wait"), status: "WAITING", createdAt: now, updatedAt: now };
  return replaceTenant(ADVANCED_STORAGE_KEYS.waitlist, input.establishmentId, [...existing, entry]) ? entry : null;
}
export function updateWaitlistEntry(establishmentId: string, entryId: string, patch: Partial<Pick<WaitlistEntry, "status" | "matches">>) {
  if (!canManageModule(establishmentId, "waitlist")) return null;
  const entries = listWaitlist(establishmentId); const index = entries.findIndex((item) => item.id === entryId); if (index < 0) return null;
  const updated = { ...entries[index], ...patch, updatedAt: new Date().toISOString() }; entries[index] = updated;
  return replaceTenant(ADVANCED_STORAGE_KEYS.waitlist, establishmentId, entries) ? updated : null;
}

export function listRecurrenceSeries(establishmentId: string) { return canManageModule(establishmentId, "recurrences") ? scoped<RecurrenceSeries>(ADVANCED_STORAGE_KEYS.recurrences, establishmentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []; }
export function saveRecurrenceSeries(input: Omit<RecurrenceSeries, "id" | "createdAt" | "updatedAt">) {
  if (!canManageModule(input.establishmentId, "recurrences") || !input.appointmentIds.length || !input.customerId || !input.employeeId || !input.serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{2}:\d{2}$/.test(input.startTime) || !Number.isInteger(input.maxOccurrences) || input.maxOccurrences < 1 || input.maxOccurrences > 52 || input.endDate && input.endDate < input.startDate) return null;
  const appointments = scoped<{ id: string; establishmentId: string; customerId: string; employeeId: string; serviceId: string }>("agendito.mock.appointments.v1", input.establishmentId);
  if (input.appointmentIds.some((appointmentId) => !appointments.some((appointment) => appointment.id === appointmentId && appointment.customerId === input.customerId && appointment.employeeId === input.employeeId && appointment.serviceId === input.serviceId))) return null;
  if (!getService(input.serviceId, input.establishmentId) || !listEmployees(input.establishmentId).some((employee) => employee.id === input.employeeId)) return null;
  const now = new Date().toISOString(); const item: RecurrenceSeries = { ...input, id: id("series"), createdAt: now, updatedAt: now };
  return replaceTenant(ADVANCED_STORAGE_KEYS.recurrences, input.establishmentId, [item, ...listRecurrenceSeries(input.establishmentId)]) ? item : null;
}
export function updateRecurrenceSeries(establishmentId: string, seriesId: string, patch: Partial<Pick<RecurrenceSeries, "appointmentIds" | "status" | "startTime" | "endDate" | "maxOccurrences">>) {
  if (!canManageModule(establishmentId, "recurrences")) return null;
  const items = listRecurrenceSeries(establishmentId); const index = items.findIndex((item) => item.id === seriesId); if (index < 0) return null;
  if (patch.appointmentIds && patch.appointmentIds.some((appointmentId) => !scoped<{ id: string; establishmentId: string }>("agendito.mock.appointments.v1", establishmentId).some((appointment) => appointment.id === appointmentId))) return null;
  items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
  return replaceTenant(ADVANCED_STORAGE_KEYS.recurrences, establishmentId, items) ? items[index] : null;
}

export function getLoyaltySettings(establishmentId: string): LoyaltySettings {
  if (!enabled(establishmentId, "loyalty") || !canManageModule(establishmentId, "loyalty") && !canCurrentSession(CAPABILITIES.establishmentAppointments, establishmentId)) return { pointsPerCurrencyUnit: 1, visitsPerReward: 10, benefits: [] };
  const all = typeof window === "undefined" ? {} : (() => { try { return JSON.parse(localStorage.getItem(ADVANCED_STORAGE_KEYS.loyaltySettings) ?? "{}") as Record<string, LoyaltySettings>; } catch { return {}; } })();
  return all[establishmentId] ?? { pointsPerCurrencyUnit: 1, visitsPerReward: 10, benefits: [] };
}
export function saveLoyaltySettings(establishmentId: string, settings: LoyaltySettings) {
  if (!canManageModule(establishmentId, "loyalty") || !Number.isFinite(settings.pointsPerCurrencyUnit) || settings.pointsPerCurrencyUnit < 0 || settings.pointsPerCurrencyUnit > 100 || settings.visitsPerReward !== undefined && (!Number.isInteger(settings.visitsPerReward) || settings.visitsPerReward < 2 || settings.visitsPerReward > 100) || settings.benefits.some((item) => !item.name.trim() || !Number.isInteger(item.pointsRequired) || item.pointsRequired < 1)) return false;
  try { const all = JSON.parse(localStorage.getItem(ADVANCED_STORAGE_KEYS.loyaltySettings) ?? "{}") as Record<string, LoyaltySettings>; all[establishmentId] = settings; localStorage.setItem(ADVANCED_STORAGE_KEYS.loyaltySettings, JSON.stringify(all)); window.dispatchEvent(new Event(changed)); return true; } catch { return false; }
}
export function listLoyaltyLedger(establishmentId: string, customerId?: string) { if (!enabled(establishmentId, "loyalty") || !canManageModule(establishmentId, "loyalty") && !canCurrentSession(CAPABILITIES.establishmentAppointments, establishmentId) && !(customerId && isCurrentCustomer(customerId))) return []; return scoped<LoyaltyLedgerEntry>(ADVANCED_STORAGE_KEYS.loyaltyLedger, establishmentId).filter((item) => !customerId || item.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function recordLoyaltyEvent(input: Omit<LoyaltyLedgerEntry, "id" | "createdAt">) {
  if (!enabled(input.establishmentId, "loyalty") || (!canManageModule(input.establishmentId, "loyalty") && !canCurrentSession(CAPABILITIES.establishmentAppointments, input.establishmentId)) || !input.customerId || !Number.isInteger(input.points) || input.points <= 0 || !input.note.trim()) return null;
  if (input.appointmentId && !read<{ id: string; establishmentId: string; customerId: string }>("agendito.mock.appointments.v1").some((item) => item.id === input.appointmentId && item.establishmentId === input.establishmentId && item.customerId === input.customerId)) return null;
  const history = listLoyaltyLedger(input.establishmentId);
  if (input.kind === "REDEEMED" && loyaltyBalance(input.establishmentId, input.customerId) < input.points) return null;
  if (input.appointmentId && history.some((item) => item.appointmentId === input.appointmentId && item.kind === input.kind)) return null;
  const entry: LoyaltyLedgerEntry = { ...input, id: id("points"), note: input.note.trim(), createdAt: new Date().toISOString() };
  return replaceTenant(ADVANCED_STORAGE_KEYS.loyaltyLedger, input.establishmentId, [entry, ...history]) ? entry : null;
}
export function loyaltyBalance(establishmentId: string, customerId: string) { return listLoyaltyLedger(establishmentId, customerId).reduce((sum, item) => item.kind === "VISIT" ? sum : sum + (item.kind === "REDEEMED" ? -item.points : item.points), 0); }
export function loyaltyVisitBalance(establishmentId: string, customerId: string) { return listLoyaltyLedger(establishmentId, customerId).reduce((sum, item) => sum + (item.kind === "VISIT" ? item.points : item.kind === "VISIT_REDEEMED" ? -item.points : 0), 0); }
export function redeemLoyaltyBenefit(establishmentId: string, customerId: string, benefitId: string) {
  if (!enabled(establishmentId, "loyalty")) return null;
  const benefit = getLoyaltySettings(establishmentId).benefits.find((item) => item.id === benefitId);
  if (!benefit || loyaltyBalance(establishmentId, customerId) < benefit.pointsRequired) return null;
  return recordLoyaltyEvent({ establishmentId, customerId, kind: "REDEEMED", points: benefit.pointsRequired, note: `Resgate: ${benefit.name}` });
}
export function redeemLoyaltyVisits(establishmentId: string, customerId: string) {
  if (!enabled(establishmentId, "loyalty")) return null;
  const required = getLoyaltySettings(establishmentId).visitsPerReward ?? 10;
  if (loyaltyVisitBalance(establishmentId, customerId) < required) return null;
  return recordLoyaltyEvent({ establishmentId, customerId, kind: "VISIT_REDEEMED", points: required, note: "Cartão de visitas resgatado" });
}
export function awardLoyaltyForCompletedAppointment(appointment: { id: string; establishmentId: string; customerId: string; priceInCentsSnapshot: number }) {
  if (!enabled(appointment.establishmentId, "loyalty")) return null;
  recordLoyaltyEvent({ establishmentId: appointment.establishmentId, customerId: appointment.customerId, kind: "VISIT", points: 1, note: "Visita no cartão de fidelidade", appointmentId: appointment.id });
  const points = Math.floor(appointment.priceInCentsSnapshot / 100 * getLoyaltySettings(appointment.establishmentId).pointsPerCurrencyUnit);
  if (points < 1) return null;
  return recordLoyaltyEvent({ establishmentId: appointment.establishmentId, customerId: appointment.customerId, kind: "EARNED", points, note: "Pontos por atendimento concluído", appointmentId: appointment.id });
}

export function listServicePackages(establishmentId: string, customerId?: string) { if (!enabled(establishmentId, "packages") || !canManageModule(establishmentId, "packages") && !canCurrentSession(CAPABILITIES.establishmentAppointments, establishmentId) && !(customerId && isCurrentCustomer(customerId))) return []; return scoped<ServicePackage>(ADVANCED_STORAGE_KEYS.packages, establishmentId).filter((item) => !customerId || item.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function createServicePackage(input: Omit<ServicePackage, "id" | "sessionsUsed" | "status" | "createdAt" | "history">) {
  if (!canManageModule(input.establishmentId, "packages") || !input.customerId || !input.serviceId || !getService(input.serviceId, input.establishmentId) || !Number.isInteger(input.sessionsTotal) || input.sessionsTotal < 2 || input.sessionsTotal > 100 || input.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil)) return null;
  const now = new Date().toISOString(); const item: ServicePackage = { ...input, id: id("pack"), sessionsUsed: 0, status: "ACTIVE", createdAt: now, history: [{ id: id("history"), action: "PURCHASED", at: now, note: "Pacote registrado localmente." }] };
  return replaceTenant(ADVANCED_STORAGE_KEYS.packages, input.establishmentId, [item, ...listServicePackages(input.establishmentId)]) ? item : null;
}
export function consumePackageSession(establishmentId: string, packageId: string, note = "Sessão concluída") {
  if (!enabled(establishmentId, "packages") || !canManageModule(establishmentId, "packages") && !canCurrentSession(CAPABILITIES.establishmentAppointments, establishmentId)) return null;
  const items = listServicePackages(establishmentId); const index = items.findIndex((item) => item.id === packageId); if (index < 0) return null;
  const item = items[index]; if (item.status !== "ACTIVE" || item.sessionsUsed >= item.sessionsTotal || item.validUntil && item.validUntil < new Date().toISOString().slice(0, 10)) return null;
  const at = new Date().toISOString(); items[index] = { ...item, sessionsUsed: item.sessionsUsed + 1, status: item.sessionsUsed + 1 >= item.sessionsTotal ? "COMPLETED" : "ACTIVE", history: [...item.history, { id: id("history"), action: "SESSION_USED", at, note }] };
  return replaceTenant(ADVANCED_STORAGE_KEYS.packages, establishmentId, items) ? items[index] : null;
}

export function listCommissionRules(establishmentId: string) { return canManageModule(establishmentId, "commissions") ? scoped<CommissionRule>(ADVANCED_STORAGE_KEYS.commissions, establishmentId) : []; }
export function saveCommissionRule(establishmentId: string, serviceId: string, fixedAmountInCents?: number) {
  if (!canManageModule(establishmentId, "commissions") || !serviceId || !getService(serviceId, establishmentId) || fixedAmountInCents !== undefined && (!Number.isInteger(fixedAmountInCents) || fixedAmountInCents < 0)) return null;
  const items = listCommissionRules(establishmentId).filter((item) => item.serviceId !== serviceId);
  const item: CommissionRule = { id: `commission-${serviceId}`, establishmentId, serviceId, fixedAmountInCents, updatedAt: new Date().toISOString() };
  return replaceTenant(ADVANCED_STORAGE_KEYS.commissions, establishmentId, [item, ...items]) ? item : null;
}

export function advancedFeatureStorageChangedEvent() { return changed; }
