import type { Appointment, AppointmentHistoryEvent } from "@/types";
import { REGISTERED_CUSTOMERS_KEY } from "@/features/auth/constants";
import { CAPABILITIES, canCurrentSession, currentSessionUserId } from "@/features/auth/capabilities";
import { customers as mockCustomers, users as mockUsers } from "@/mocks";
import { listAllEstablishments } from "@/features/platform/storage";
import { isFeatureEnabled } from "@/features/platform/policies";

export const NOTIFICATIONS_STORAGE_KEY = "agendito.mock.notifications.v1";
export const NOTIFICATION_PREFERENCES_KEY = "agendito.mock.notification-preferences.v1";
const NOTIFICATION_DEDUPE_KEY = "agendito.mock.notification-dedupe.v1";
export type NotificationContext = "OWNER" | "ESTABLISHMENT" | "EMPLOYEE" | "CUSTOMER";
export type NotificationType = "BOOKING_CREATED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED" | "STATUS_CHANGED" | "PAGE_PUBLISHED" | "ESTABLISHMENT_SUSPENDED" | "ESTABLISHMENT_REACTIVATED" | "REMINDER_24H" | "REMINDER_2H" | "REMINDER_CUSTOM" | "WAITLIST_OPPORTUNITY" | "COMMUNICATION";
export interface LocalNotification {
  id: string; context: NotificationContext; contextId: string; establishmentId?: string; employeeId?: string; customerId?: string;
  type: NotificationType; title: string; message: string; createdAt: string; readAt?: string; relatedId?: string; link?: string;
}
export interface CommunicationRecord { id: string; establishmentId: string; relatedId?: string; method: "COPY" | "WHATSAPP"; at: string; message: string; }
export interface NotificationPreferences {
  enabledTypes: NotificationType[]; reminders: { hours24: boolean; hours2: boolean; custom: boolean; customMinutes: number };
  templates: Partial<Record<NotificationType, { title: string; message: string }>>;
}

const ALL_TYPES: NotificationType[] = ["BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED", "STATUS_CHANGED", "PAGE_PUBLISHED", "ESTABLISHMENT_SUSPENDED", "ESTABLISHMENT_REACTIVATED", "REMINDER_24H", "REMINDER_2H", "REMINDER_CUSTOM", "WAITLIST_OPPORTUNITY", "COMMUNICATION"];
const defaultTemplates: NotificationPreferences["templates"] = {
  BOOKING_CREATED: { title: "Novo agendamento", message: "{customer} agendou {service} para {date}." },
  BOOKING_CANCELLED: { title: "Agendamento cancelado", message: "O horário de {customer} para {service} foi liberado." },
  BOOKING_RESCHEDULED: { title: "Agendamento reagendado", message: "O atendimento de {customer} foi atualizado para {date}." },
  STATUS_CHANGED: { title: "Status atualizado", message: "O atendimento de {customer} agora está: {status}." },
  PAGE_PUBLISHED: { title: "Página publicada", message: "A página pública de {establishment} está publicada." },
  ESTABLISHMENT_SUSPENDED: { title: "Estabelecimento suspenso", message: "{establishment} foi suspenso pelo proprietário." },
  ESTABLISHMENT_REACTIVATED: { title: "Estabelecimento reativado", message: "{establishment} foi reativado pelo proprietário." },
  REMINDER_24H: { title: "Lembrete de atendimento", message: "Lembrete: {customer} tem {service} em aproximadamente 24 horas ({date})." },
  REMINDER_2H: { title: "Atendimento em breve", message: "Lembrete: {customer} tem {service} em aproximadamente 2 horas ({date})." },
  REMINDER_CUSTOM: { title: "Lembrete de atendimento", message: "Lembrete: {customer} tem {service} em {date}." },
  WAITLIST_OPPORTUNITY: { title: "Horário disponível", message: "Encontramos opções para {customer} no serviço {service}. Confira a lista de espera." },
  COMMUNICATION: { title: "Comunicação preparada", message: "Uma mensagem foi preparada para compartilhamento. Nenhum envio foi realizado pelo Agendito." },
};
const DEFAULT_PREFERENCES: NotificationPreferences = { enabledTypes: ALL_TYPES.filter((type) => type !== "COMMUNICATION"), reminders: { hours24: true, hours2: true, custom: false, customMinutes: 60 }, templates: defaultTemplates };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
function write<T>(key: string, value: T) { if (typeof window === "undefined") return false; try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event("agendito:notifications-updated")); return true; } catch { return false; } }
function preferenceKey(establishmentId?: string) { return establishmentId ? `establishment:${establishmentId}` : "platform"; }
function storedNotificationPreferences(establishmentId?: string): NotificationPreferences {
  const saved = read<Record<string, NotificationPreferences>>(NOTIFICATION_PREFERENCES_KEY, {})[preferenceKey(establishmentId)];
  if (!saved) return structuredClone(DEFAULT_PREFERENCES);
  return { ...DEFAULT_PREFERENCES, ...saved, reminders: { ...DEFAULT_PREFERENCES.reminders, ...saved.reminders }, templates: { ...defaultTemplates, ...saved.templates } };
}
export function getNotificationPreferences(establishmentId?: string): NotificationPreferences {
  if (establishmentId && !canCurrentSession(CAPABILITIES.establishmentNotifications, establishmentId)) return structuredClone(DEFAULT_PREFERENCES);
  if (!establishmentId && !canCurrentSession(CAPABILITIES.platformSettings)) return structuredClone(DEFAULT_PREFERENCES);
  return storedNotificationPreferences(establishmentId);
}
export function saveNotificationPreferences(establishmentId: string | undefined, preferences: NotificationPreferences) {
  if (establishmentId ? !canCurrentSession(CAPABILITIES.establishmentNotifications, establishmentId) : !canCurrentSession(CAPABILITIES.platformSettings)) return false;
  const all = read<Record<string, NotificationPreferences>>(NOTIFICATION_PREFERENCES_KEY, {});
  all[preferenceKey(establishmentId)] = preferences;
  return write(NOTIFICATION_PREFERENCES_KEY, all);
}
function interpolate(template: { title: string; message: string } | undefined, defaults: { title: string; message: string }, values: Record<string, string>) {
  const source = template ?? defaults;
  const replace = (input: string) => input.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => values[key] ?? "");
  return { title: replace(source.title), message: replace(source.message) };
}
function appendNotifications(records: Omit<LocalNotification, "createdAt">[], at = new Date().toISOString()) {
  const existing = read<LocalNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
  const known = new Set([...existing.map((item) => item.id), ...read<string[]>(NOTIFICATION_DEDUPE_KEY, [])]);
  const additions = records.filter((item) => !known.has(item.id)).map((item) => ({ ...item, createdAt: at }));
  if (!additions.length) return;
  write(NOTIFICATION_DEDUPE_KEY, [...known, ...additions.map((item) => item.id)].slice(-5000));
  write(NOTIFICATIONS_STORAGE_KEY, [...additions, ...existing].slice(0, 1500));
}
function contextsForAppointment(appointment: Appointment) { return [
  { context: "ESTABLISHMENT" as const, contextId: appointment.establishmentId, link: `/agenda?date=${appointment.startsAt.slice(0, 10)}` },
  { context: "EMPLOYEE" as const, contextId: appointment.employeeId, employeeId: appointment.employeeId, link: "/employee/appointments" },
  { context: "CUSTOMER" as const, contextId: appointment.customerId, customerId: appointment.customerId, link: `/customer/appointments/${appointment.id}` },
]; }
function labelDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(value: string) { return ({ SCHEDULED: "Agendado", CONFIRMED: "Confirmado", IN_PROGRESS: "Em atendimento", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" } as Record<string, string>)[value] ?? value; }
function customerLabel(customerId: string) {
  const customer = mockCustomers.find((item) => item.id === customerId);
  const mockName = customer ? mockUsers.find((item) => item.id === customer.userId)?.name : undefined;
  const registered = read<Array<{ id: string; preferredName?: string; name?: string }>>(REGISTERED_CUSTOMERS_KEY, []).find((item) => item.id === customerId);
  const guest = read<Array<{ id: string; name: string }>>("agendito.mock.guest-customers.v1", []).find((item) => item.id === customerId);
  const overrides = read<Record<string, { name?: string }>>("agendito.mock.customer-profile-overrides.v1", {});
  return overrides[customerId]?.name ?? guest?.name ?? registered?.preferredName ?? registered?.name ?? mockName ?? "Cliente";
}
export function emitAppointmentNotification(appointment: Appointment, event: AppointmentHistoryEvent) {
  if (event.type === "CUSTOMER_MERGED") return;
  const establishment = listAllEstablishments().find((item) => item.id === appointment.establishmentId);
  if (!establishment || !isFeatureEnabled(establishment, "notifications")) return;
  const type: NotificationType = event.type === "CREATED" ? "BOOKING_CREATED" : event.type === "RESCHEDULED" ? "BOOKING_RESCHEDULED" : event.toStatus === "CANCELLED" ? "BOOKING_CANCELLED" : "STATUS_CHANGED";
  const preferences = storedNotificationPreferences(appointment.establishmentId);
  if (!preferences.enabledTypes.includes(type)) return;
  const template = preferences.templates[type] ?? defaultTemplates[type]!;
  const values = { customer: customerLabel(appointment.customerId), service: appointment.serviceNameSnapshot, date: labelDate(event.startsAt ?? appointment.startsAt), status: statusLabel(event.toStatus ?? appointment.status), establishment: establishment.name };
  const content = interpolate(template, defaultTemplates[type]!, values);
  appendNotifications(contextsForAppointment(appointment).map((audience) => ({ ...audience, establishmentId: appointment.establishmentId, type, relatedId: appointment.id, id: `${event.id}:${audience.context}:${audience.contextId}`, ...content })), event.at);
}
export function emitEstablishmentNotification(establishmentId: string, type: Extract<NotificationType, "PAGE_PUBLISHED" | "ESTABLISHMENT_SUSPENDED" | "ESTABLISHMENT_REACTIVATED">, name: string, eventId = `${type}:${establishmentId}:${Date.now()}`, at = new Date().toISOString(), publicPath?: string) {
  const preferences = storedNotificationPreferences(establishmentId);
  if (!preferences.enabledTypes.includes(type)) return;
  const content = interpolate(preferences.templates[type] ?? defaultTemplates[type]!, defaultTemplates[type]!, { establishment: name });
  appendNotifications([
    { id: `${eventId}:OWNER:platform`, context: "OWNER", contextId: "platform", establishmentId, type, relatedId: establishmentId, link: publicPath ?? "/platform/establishments", ...content },
    { id: `${eventId}:ESTABLISHMENT:${establishmentId}`, context: "ESTABLISHMENT", contextId: establishmentId, establishmentId, type, relatedId: establishmentId, link: publicPath ?? "/dashboard", ...content },
  ], at);
}
export function listNotifications(context: NotificationContext, contextId: string, establishmentId?: string) {
  if (!canAccessNotificationContext(context, contextId, establishmentId)) return [];
  return read<LocalNotification[]>(NOTIFICATIONS_STORAGE_KEY, []).filter((item) => item.context === context && item.contextId === contextId && (context !== "OWNER" || isOwnerAdministrativeNotification(item)) && (context === "OWNER" || !establishmentId || item.establishmentId === establishmentId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function isOwnerAdministrativeNotification(item: LocalNotification) { return ["PAGE_PUBLISHED", "ESTABLISHMENT_SUSPENDED", "ESTABLISHMENT_REACTIVATED"].includes(item.type); }
function canAccessNotificationContext(context: NotificationContext, contextId: string, establishmentId?: string) {
  if (context === "OWNER") return contextId === "platform" && canCurrentSession(CAPABILITIES.platformEstablishments);
  if (context === "ESTABLISHMENT") return Boolean(establishmentId && contextId === establishmentId && canCurrentSession(CAPABILITIES.establishmentNotifications, establishmentId));
  if (context === "EMPLOYEE") {
    const userId = currentSessionUserId();
    if (!userId || !canCurrentSession(CAPABILITIES.employeeAppointments, establishmentId)) return false;
    try { return (JSON.parse(localStorage.getItem("agendito.mock.employees.v1") ?? "[]") as Array<{ id: string; userId: string }>).some((employee) => employee.id === contextId && employee.userId === userId); } catch { return false; }
  }
  if (context === "CUSTOMER") {
    const userId = currentSessionUserId();
    if (!userId || !canCurrentSession(CAPABILITIES.customerAppointments)) return false;
    try { return (JSON.parse(localStorage.getItem(REGISTERED_CUSTOMERS_KEY) ?? "[]") as Array<{ id: string; userId: string }>).some((customer) => customer.id === contextId && customer.userId === userId); } catch { return false; }
  }
  return false;
}
function canAccessNotification(item: LocalNotification) { return canAccessNotificationContext(item.context, item.contextId, item.establishmentId); }
export function markNotificationRead(id: string) { const records = read<LocalNotification[]>(NOTIFICATIONS_STORAGE_KEY, []); const target = records.find((item) => item.id === id); if (!target || !canAccessNotification(target) || target.context === "OWNER" && !isOwnerAdministrativeNotification(target)) return false; return write(NOTIFICATIONS_STORAGE_KEY, records.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)); }
export function markAllNotificationsRead(context: NotificationContext, contextId: string, establishmentId?: string) { if (!canAccessNotificationContext(context, contextId, establishmentId)) return false; const records = read<LocalNotification[]>(NOTIFICATIONS_STORAGE_KEY, []); const at = new Date().toISOString(); return write(NOTIFICATIONS_STORAGE_KEY, records.map((item) => item.context === context && item.contextId === contextId && (context !== "OWNER" || isOwnerAdministrativeNotification(item)) && (context === "OWNER" || !establishmentId || item.establishmentId === establishmentId) && !item.readAt ? { ...item, readAt: at } : item)); }
export function deleteNotification(id: string) { const records = read<LocalNotification[]>(NOTIFICATIONS_STORAGE_KEY, []); const target = records.find((item) => item.id === id); if (!target || !canAccessNotification(target) || target.context === "OWNER" && !isOwnerAdministrativeNotification(target)) return false; return write(NOTIFICATIONS_STORAGE_KEY, records.filter((item) => item.id !== id)); }
export function clearNotifications(context: NotificationContext, contextId: string, establishmentId?: string) {
  if (!canAccessNotificationContext(context, contextId, establishmentId)) return false;
  const records = read<LocalNotification[]>(NOTIFICATIONS_STORAGE_KEY, []);
  return write(NOTIFICATIONS_STORAGE_KEY, records.filter((item) => !(item.context === context && item.contextId === contextId && (context !== "OWNER" || isOwnerAdministrativeNotification(item)) && (context === "OWNER" || !establishmentId || item.establishmentId === establishmentId))));
}
export function recordCommunication(establishmentId: string, relatedId: string | undefined, method: CommunicationRecord["method"], message: string) {
  if (!canCurrentSession(CAPABILITIES.establishmentNotifications, establishmentId)) return false;
  const history = read<CommunicationRecord[]>("agendito.mock.communication-history.v1", []);
  const record = { id: `communication-${Date.now()}-${Math.random().toString(36).slice(2)}`, establishmentId, relatedId, method, message, at: new Date().toISOString() };
  if (!write("agendito.mock.communication-history.v1", [record, ...history].slice(0, 500))) return false;
  return true;
}
export function listCommunicationHistory(establishmentId: string) { return canCurrentSession(CAPABILITIES.establishmentNotifications, establishmentId) ? read<CommunicationRecord[]>("agendito.mock.communication-history.v1", []).filter((record) => record.establishmentId === establishmentId).sort((a, b) => b.at.localeCompare(a.at)) : []; }
export function emitReminder(appointment: Appointment, type: "REMINDER_24H" | "REMINDER_2H" | "REMINDER_CUSTOM") {
  const preferences = storedNotificationPreferences(appointment.establishmentId);
  const enabled = type === "REMINDER_24H" ? preferences.reminders.hours24 : type === "REMINDER_2H" ? preferences.reminders.hours2 : preferences.reminders.custom;
  if (!enabled || !preferences.enabledTypes.includes(type)) return;
  const template = preferences.templates[type] ?? defaultTemplates[type]!;
  const content = interpolate(template, defaultTemplates[type]!, { customer: customerLabel(appointment.customerId), service: appointment.serviceNameSnapshot, date: labelDate(appointment.startsAt) });
  const id = `reminder:${appointment.id}:${type}`;
  appendNotifications(contextsForAppointment(appointment).map((audience) => ({ ...audience, establishmentId: appointment.establishmentId, type, relatedId: appointment.id, id: `${id}:${audience.context}:${audience.contextId}`, ...content })), new Date().toISOString());
}
export function emitWaitlistOpportunity(input: { establishmentId: string; entryId: string; customerId?: string; customerName: string; serviceName: string; at?: string }) {
  const establishment = listAllEstablishments().find((item) => item.id === input.establishmentId);
  if (!establishment || !isFeatureEnabled(establishment, "waitlist")) return;
  const preferences = storedNotificationPreferences(input.establishmentId);
  if (!preferences.enabledTypes.includes("WAITLIST_OPPORTUNITY")) return;
  const content = interpolate(preferences.templates.WAITLIST_OPPORTUNITY, defaultTemplates.WAITLIST_OPPORTUNITY!, { customer: input.customerName, service: input.serviceName, establishment: establishment.name, date: "" });
  const items: Omit<LocalNotification, "createdAt">[] = [{ id: `waitlist:${input.entryId}:ESTABLISHMENT:${input.establishmentId}`, context: "ESTABLISHMENT", contextId: input.establishmentId, establishmentId: input.establishmentId, type: "WAITLIST_OPPORTUNITY", title: content.title, message: content.message, link: "/features", relatedId: input.entryId }];
  if (input.customerId) items.push({ id: `waitlist:${input.entryId}:CUSTOMER:${input.customerId}`, context: "CUSTOMER", contextId: input.customerId, establishmentId: input.establishmentId, customerId: input.customerId, type: "WAITLIST_OPPORTUNITY", title: content.title, message: content.message, link: "/customer/appointments", relatedId: input.entryId });
  appendNotifications(items, input.at);
}
export function reminderOffsets(preferences: NotificationPreferences) { return [preferences.reminders.hours24 ? ["REMINDER_24H", 24 * 60] as const : null, preferences.reminders.hours2 ? ["REMINDER_2H", 2 * 60] as const : null, preferences.reminders.custom ? ["REMINDER_CUSTOM", Math.min(10080, Math.max(5, preferences.reminders.customMinutes))] as const : null].filter((item): item is readonly ["REMINDER_24H" | "REMINDER_2H" | "REMINDER_CUSTOM", number] => Boolean(item)); }
