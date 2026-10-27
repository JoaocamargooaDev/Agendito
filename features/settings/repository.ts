import { establishments, schedules } from "@/mocks";
import type { BlockedPeriod, BusinessHoursDay, Establishment, EstablishmentSettings } from "@/types";
import { createBlockedPeriod, isOccupyingStatus, listAppointments, listBlockedPeriods, removeBlockedPeriod } from "@/features/agenda/repository";
import { addDays, isoForLocalTime } from "@/features/booking/rules";
import { listAllEstablishments, saveEstablishment } from "@/features/platform";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionRole } from "@/features/auth/capabilities";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";

export const ESTABLISHMENT_SETTINGS_STORAGE_KEY = "agendito.mock.establishment-settings.v1";
const dayNames = [1, 2, 3, 4, 5, 6, 0] as const;
function defaults(establishmentId: string): EstablishmentSettings { return { businessHours: dayNames.map((weekday) => ({ weekday, open: schedules.some((item) => item.establishmentId === establishmentId && item.weekday === weekday && item.active), intervals: schedules.filter((item) => item.establishmentId === establishmentId && item.weekday === weekday && item.active).flatMap((item) => item.workingHours) })), booking: { minimumLeadMinutes: 0, maximumDaysAhead: 30, slotStepMinutes: 30, allowAnyEmployee: true, anyEmployeeStrategy: "FIRST_AVAILABLE", bufferBeforeMinutes: 0, bufferAfterMinutes: 0, requiresApproval: true }, cancellation: { customerCanCancel: true, minimumLeadMinutes: 120 }, rescheduling: { customerCanReschedule: true, minimumLeadMinutes: 120 } }; }
function read<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } }
function write(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("agendito:settings-updated")); return true; } catch { return false; } }
export function getEstablishmentSettings(establishmentId: string) { const fallback = defaults(establishmentId); const role = currentSessionRole(); const ownTenant = currentSessionEstablishmentId() === establishmentId && (role === "ADMIN" || role === "EMPLOYEE"); const publicAccess = isPublishedPublicEstablishment(establishmentId); if (!ownTenant && !publicAccess) return fallback; const saved = read<Record<string, EstablishmentSettings>>(ESTABLISHMENT_SETTINGS_STORAGE_KEY, {})[establishmentId]; const settings = saved ? { ...fallback, ...saved, booking: { ...fallback.booking, ...saved.booking }, cancellation: { ...fallback.cancellation, ...saved.cancellation }, rescheduling: { ...fallback.rescheduling, ...saved.rescheduling } } : fallback; if (ownTenant) return settings; return { businessHours: settings.businessHours, booking: { minimumLeadMinutes: settings.booking.minimumLeadMinutes, maximumDaysAhead: settings.booking.maximumDaysAhead, slotStepMinutes: settings.booking.slotStepMinutes, allowAnyEmployee: settings.booking.allowAnyEmployee, anyEmployeeStrategy: settings.booking.anyEmployeeStrategy, bufferBeforeMinutes: settings.booking.bufferBeforeMinutes, bufferAfterMinutes: settings.booking.bufferAfterMinutes, requiresApproval: settings.booking.requiresApproval }, cancellation: settings.cancellation, rescheduling: settings.rescheduling }; }
export function updateEstablishmentSettings(establishmentId: string, settings: EstablishmentSettings) { if (!canCurrentSession(CAPABILITIES.establishmentSettings, establishmentId)) return null; const all = read<Record<string, EstablishmentSettings>>(ESTABLISHMENT_SETTINGS_STORAGE_KEY, {}); return write(ESTABLISHMENT_SETTINGS_STORAGE_KEY, { ...all, [establishmentId]: settings }) ? settings : null; }
export function getPersistedEstablishment(establishmentId: string) { if (!canCurrentSession(CAPABILITIES.establishmentSettings, establishmentId)) return null; return listAllEstablishments().find((item) => item.id === establishmentId) ?? establishments.find((item) => item.id === establishmentId) ?? null; }
export function updateEstablishmentInfo(establishmentId: string, patch: Partial<Establishment>) { if (!canCurrentSession(CAPABILITIES.establishmentSettings, establishmentId)) return { ok: false as const, reason: "Acesso não permitido para esta configuração." }; if ("logoUrl" in patch || "coverUrl" in patch) return { ok: false as const, reason: "A identidade visual da página é gerenciada pelo Agendito." }; const current = getPersistedEstablishment(establishmentId); if (!current) return { ok: false as const, reason: "Estabelecimento não encontrado." }; if (patch.name !== undefined && patch.name.trim().length < 2) return { ok: false as const, reason: "Informe um nome comercial válido." }; if (patch.instagram && !/^(@?[\w.]+|https:\/\/instagram\.com\/[^\s/]+\/?$)/i.test(patch.instagram.trim())) return { ok: false as const, reason: "Informe um Instagram válido." }; const allowedPatch: Partial<Establishment> = { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.phone !== undefined ? { phone: patch.phone } : {}), ...(patch.instagram !== undefined ? { instagram: patch.instagram } : {}), ...(patch.address !== undefined ? { address: patch.address } : {}), ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}) }; const updated = { ...current, ...allowedPatch, id: current.id, slug: current.slug, adminUserIds: current.adminUserIds }; if (!saveEstablishment(updated)) return { ok: false as const, reason: "Não foi possível salvar as informações." }; if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("agendito:settings-updated")); return { ok: true as const, establishment: updated }; }
export function validateBusinessHours(days: BusinessHoursDay[]) { for (const day of days) { const sorted = day.intervals.slice().sort((a, b) => a.start.localeCompare(b.start)); for (const interval of sorted) if (!/^\d{2}:\d{2}$/.test(interval.start) || !/^\d{2}:\d{2}$/.test(interval.end) || interval.start >= interval.end) return "Os intervalos precisam ter início e fim válidos."; for (let i = 1; i < sorted.length; i++) if (sorted[i - 1].end > sorted[i].start) return "Existem intervalos sobrepostos."; } return null; }
export function updateBusinessHours(establishmentId: string, days: BusinessHoursDay[]) {
  const error = validateBusinessHours(days);
  if (error) return { ok: false as const, reason: error };
  const timezone = getPersistedEstablishment(establishmentId)?.timezone ?? "America/Sao_Paulo";
  const weekdayNames: Record<string, BusinessHoursDay["weekday"]> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const future = listAppointments().filter((item) => item.establishmentId === establishmentId && item.endsAt > new Date().toISOString() && isOccupyingStatus(item.status));
  const conflicts = future.filter((item) => {
    const date = new Date(item.startsAt);
    const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
    const day = weekdayNames[weekdayName];
    const current = days.find((entry) => entry.weekday === day);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
    return !current?.open || !current.intervals.some((range) => time >= range.start && time < range.end);
  });
  if (conflicts.length) return { ok: false as const, reason: `${conflicts.length} agendamento(s) futuro(s) seriam afetados por este horário.` };
  const settings = getEstablishmentSettings(establishmentId);
  return updateEstablishmentSettings(establishmentId, { ...settings, businessHours: days }) ? { ok: true as const } : { ok: false as const, reason: "Não foi possível salvar o funcionamento." };
}
export function updateBookingRules(establishmentId: string, booking: EstablishmentSettings["booking"]) { const numericValues = [booking.minimumLeadMinutes, booking.maximumDaysAhead, booking.slotStepMinutes, booking.bufferBeforeMinutes ?? 0, booking.bufferAfterMinutes ?? 0]; if (numericValues.some((value) => !Number.isFinite(value) || value < 0) || !Number.isInteger(booking.minimumLeadMinutes) || !Number.isInteger(booking.maximumDaysAhead) || ![5, 10, 15, 30].includes(booking.slotStepMinutes) || booking.maximumDaysAhead < 1) return { ok: false as const, reason: "Confira os valores das regras de agendamento." }; const settings = getEstablishmentSettings(establishmentId); return updateEstablishmentSettings(establishmentId, { ...settings, booking }) ? { ok: true as const } : { ok: false as const, reason: "Não foi possível salvar as regras." }; }
export function updateCustomerPolicies(establishmentId: string, cancellation: EstablishmentSettings["cancellation"], rescheduling: EstablishmentSettings["rescheduling"]) { if (cancellation.minimumLeadMinutes < 0 || rescheduling.minimumLeadMinutes < 0) return { ok: false as const, reason: "A antecedência não pode ser negativa." }; const settings = getEstablishmentSettings(establishmentId); return updateEstablishmentSettings(establishmentId, { ...settings, cancellation, rescheduling }) ? { ok: true as const } : { ok: false as const, reason: "Não foi possível salvar as políticas." }; }

export function listEstablishmentClosures(establishmentId: string) {
  return listBlockedPeriods()
    .filter((period) => period.establishmentId === establishmentId && !period.employeeId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export interface EstablishmentClosureInput {
  startDate: string;
  endDate: string;
  reason: string;
}

export function createEstablishmentClosure(establishmentId: string, timezone: string, input: EstablishmentClosureInput) {
  const startDate = input.startDate.trim();
  const endDate = (input.endDate || input.startDate).trim();
  const reason = input.reason.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { ok: false as const, reason: "Informe as datas do fechamento." };
  if (endDate < startDate) return { ok: false as const, reason: "A data final não pode ser anterior à data inicial." };
  if (reason.length < 2) return { ok: false as const, reason: "Informe o motivo do fechamento." };

  const startsAt = isoForLocalTime(startDate, "00:00", timezone);
  const endsAt = isoForLocalTime(addDays(endDate, 1), "00:00", timezone);
  const conflicts = listAppointments().filter((appointment) =>
    appointment.establishmentId === establishmentId
    && isOccupyingStatus(appointment.status)
    && appointment.startsAt < endsAt
    && appointment.endsAt > startsAt,
  );
  if (conflicts.length) return { ok: false as const, reason: `${conflicts.length} agendamento(s) ativo(s) estão dentro deste período. Reorganize-os antes de fechar.` };

  const period: BlockedPeriod = {
    id: `closure-${establishmentId}-${Date.now()}`,
    establishmentId,
    startsAt,
    endsAt,
    reason,
  };
  return createBlockedPeriod(period)
    ? { ok: true as const, period }
    : { ok: false as const, reason: "Não foi possível salvar o fechamento neste navegador." };
}

export function removeEstablishmentClosure(establishmentId: string, periodId: string) {
  const period = listEstablishmentClosures(establishmentId).find((item) => item.id === periodId);
  if (!period) return { ok: false as const, reason: "Fechamento não encontrado." };
  return removeBlockedPeriod(periodId, establishmentId)
    ? { ok: true as const }
    : { ok: false as const, reason: "Não foi possível remover o fechamento." };
}
