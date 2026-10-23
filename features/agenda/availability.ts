import type { Appointment, BlockedPeriod, Employee, Schedule, Service } from "@/types";
import { listEmployees, listSchedules } from "@/features/employees";
import { getEstablishmentSettings } from "@/features/settings/repository";
import { listAllEstablishments } from "@/features/platform/storage";
import { getPageConfig } from "@/features/platform/storage";
import { getOperationalBlockReason, getPublicBookingBlockReason, isFeatureEnabled } from "@/features/platform/policies";
import { isEstablishmentOperational } from "@/features/platform/domain";
import { addDays, dateKeyInTimezone, isoForLocalTime } from "@/features/booking/rules";
import { serviceAllowsWeekday, serviceForEmployee, serviceIsActive } from "@/features/services/domain";
import { isActiveAppointmentStatus } from "./status";

export interface AvailabilityRequest {
  establishmentId: string;
  employeeId: string;
  service: Service;
  services?: Service[];
  dateKey: string;
  timezone: string;
  appointments: Appointment[];
  blockedPeriods: BlockedPeriod[];
  source?: "internal" | "public";
  allowInactiveServices?: boolean;
}
export interface AvailabilityResult { ok: boolean; reason?: string; }
export interface AvailableSlot { start: string; end: string; }

const dayOfWeek = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
const toMinutes = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
const localTime = (iso: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
};
const overlaps = (startA: number, endA: number, startB: number, endB: number) => startA < endB && startB < endA;

function blockConflicts(block: BlockedPeriod, dateKey: string, timezone: string, busyStartMinute: number, busyEndMinute: number, busyStartMs: number, busyEndMs: number) {
  if (block.recurrence?.frequency !== "WEEKLY") return busyStartMs < new Date(block.endsAt).getTime() && new Date(block.startsAt).getTime() < busyEndMs;
  if (block.recurrence.until && dateKey > block.recurrence.until) return false;
  const blockStartDate = dateKeyInTimezone(new Date(block.startsAt), timezone);
  if (dayOfWeek(blockStartDate) !== dayOfWeek(dateKey)) return false;
  const startMinute = localTime(block.startsAt, timezone);
  let endMinute = localTime(block.endsAt, timezone);
  if (endMinute <= startMinute) endMinute += 24 * 60;
  return busyStartMinute < endMinute && startMinute < busyEndMinute;
}

export function employeeForService(employeeId: string, service: Service, establishmentId: string, allowInactiveService = false): Employee | null {
  if (service.establishmentId !== establishmentId || (!allowInactiveService && !serviceIsActive(service))) return null;
  const employee = listEmployees(establishmentId).find((item) => item.id === employeeId && item.active);
  return employee && employee.establishmentId === establishmentId && employee.serviceIds.includes(service.id) ? employee : null;
}

export function scheduleForEmployee(employeeId: string, establishmentId: string, dateKey: string): Schedule | null {
  const day = dayOfWeek(dateKey);
  const schedules = listSchedules(establishmentId);
  return schedules.find((item) => item.establishmentId === establishmentId && item.employeeId === employeeId && item.weekday === day && item.active)
    ?? schedules.find((item) => item.establishmentId === establishmentId && !item.employeeId && item.weekday === day && item.active)
    ?? null;
}

/** Single source of truth for public booking, internal creation, edits and rescheduling. */
export function validateSlot(request: AvailabilityRequest, startIso: string, endIso: string, ignoreAppointmentId?: string): AvailabilityResult {
  const { establishmentId, employeeId, service, dateKey, timezone, appointments, blockedPeriods, source = "internal", allowInactiveServices = false } = request;
  const requestedServices = request.services?.length ? request.services : [service];
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  if (!establishment) return { ok: false, reason: "O estabelecimento não foi encontrado." };
  if (!isEstablishmentOperational(establishment) || getOperationalBlockReason(establishment)) return { ok: false, reason: getOperationalBlockReason(establishment) ?? "O estabelecimento não está operacional." };
  if (!isFeatureEnabled(establishment, "team-schedule")) return { ok: false, reason: "A agenda da equipe está indisponível neste estabelecimento." };
  if (source === "public") {
    const publicReason = getPublicBookingBlockReason(establishment, getPageConfig(establishmentId));
    if (publicReason) return { ok: false, reason: publicReason };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(Date.parse(startIso)) || !Number.isFinite(Date.parse(endIso))) return { ok: false, reason: "Informe uma data e um horário válidos." };
  try {
    if (dateKeyInTimezone(new Date(startIso), timezone) !== dateKey) return { ok: false, reason: "O horário precisa pertencer à data selecionada." };
  } catch { return { ok: false, reason: "O fuso horário do estabelecimento é inválido." }; }

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const effectiveServices = requestedServices.map((item) => serviceForEmployee(item, employeeId));
  const duration = Math.round((endMs - startMs) / 60000);
  const expectedDuration = effectiveServices.reduce((total, item) => total + item.durationMinutes, 0);
  if (endMs <= startMs || duration !== expectedDuration || effectiveServices.some((item) => !Number.isInteger(item.durationMinutes) || item.durationMinutes < 1)) return { ok: false, reason: "A duração do horário não corresponde aos serviços selecionados." };
  if (requestedServices.some((item) => !employeeForService(employeeId, item, establishmentId, allowInactiveServices))) return { ok: false, reason: "Este profissional não realiza todos os serviços selecionados." };

  const settings = getEstablishmentSettings(establishmentId);
  const booking = settings.booking;
  const minimumLeadMinutes = Number.isFinite(booking.minimumLeadMinutes) ? Math.max(0, booking.minimumLeadMinutes) : 0;
  const maximumDaysAhead = Number.isFinite(booking.maximumDaysAhead) ? Math.max(0, booking.maximumDaysAhead) : 30;
  const bufferBeforeMinutes = Number.isFinite(booking.bufferBeforeMinutes) ? Math.max(0, booking.bufferBeforeMinutes ?? 0) : 0;
  const bufferAfterMinutes = Number.isFinite(booking.bufferAfterMinutes) ? Math.max(0, booking.bufferAfterMinutes ?? 0) : 0;
  const now = Date.now();
  if (startMs < now + minimumLeadMinutes * 60000) return { ok: false, reason: "Este horário não respeita a antecedência mínima para reservas." };
  const today = dateKeyInTimezone(new Date(now), timezone);
  if (dateKey > addDays(today, maximumDaysAhead)) return { ok: false, reason: `As reservas estão disponíveis somente até ${maximumDaysAhead} dias à frente.` };

  const start = localTime(startIso, timezone);
  const end = localTime(endIso, timezone);
  if (end <= start) return { ok: false, reason: "O atendimento precisa terminar no mesmo dia em que começa." };
  const weekday = dayOfWeek(dateKey);
  const businessDay = settings.businessHours.find((item) => item.weekday === weekday);
  const bufferBefore = bufferBeforeMinutes + effectiveServices.reduce((total, item) => total + (item.preparationMinutes ?? 0), 0);
  const bufferAfter = bufferAfterMinutes + effectiveServices.reduce((total, item) => total + (item.cleanupMinutes ?? 0), 0);
  if (requestedServices.some((item) => !serviceAllowsWeekday(item, weekday))) return { ok: false, reason: "Um dos serviços não está disponível neste dia da semana." };
  if (requestedServices.some((item) => item.availabilityWindows?.length && !item.availabilityWindows.some((range) => start >= toMinutes(range.start) && end <= toMinutes(range.end)))) return { ok: false, reason: "O horário está fora da disponibilidade de um dos serviços." };
  const occupiedStartMinute = start - bufferBefore;
  const occupiedEndMinute = end + bufferAfter;
  if (!businessDay?.open || !businessDay.intervals.some((range) => occupiedStartMinute >= toMinutes(range.start) && occupiedEndMinute <= toMinutes(range.end))) return { ok: false, reason: "O horário ou seu intervalo de preparação está fora do funcionamento do estabelecimento." };

  const schedule = scheduleForEmployee(employeeId, establishmentId, dateKey);
  if (!schedule) return { ok: false, reason: "Este profissional não possui expediente nesta data." };
  if (!schedule.workingHours.some((range) => occupiedStartMinute >= toMinutes(range.start) && occupiedEndMinute <= toMinutes(range.end))) return { ok: false, reason: "O horário está fora do expediente ou atravessa uma pausa do profissional." };

  const busyStart = startMs - bufferBefore * 60000;
  const busyEnd = endMs + bufferAfter * 60000;
  const relevantBlocks = blockedPeriods.filter((block) => block.establishmentId === establishmentId && (!block.employeeId || block.employeeId === employeeId));
  if (relevantBlocks.some((block) => blockConflicts(block, dateKey, timezone, occupiedStartMinute, occupiedEndMinute, busyStart, busyEnd))) return { ok: false, reason: "O horário conflita com uma folga, pausa ou bloqueio cadastrado." };

  const relevantAppointments = appointments.filter((item) => item.id !== ignoreAppointmentId && item.establishmentId === establishmentId && item.employeeId === employeeId && isActiveAppointmentStatus(item.status));
  const conflictingAppointments = relevantAppointments.filter((item) => {
    const existingServices = item.serviceSnapshots?.length ? item.serviceSnapshots : [{ preparationMinutes: 0, cleanupMinutes: 0 }];
    const existingBufferBefore = bufferBeforeMinutes + existingServices.reduce((total, current) => total + (current.preparationMinutes ?? 0), 0);
    const existingBufferAfter = bufferAfterMinutes + existingServices.reduce((total, current) => total + (current.cleanupMinutes ?? 0), 0);
    const otherStart = new Date(item.startsAt).getTime() - existingBufferBefore * 60000;
    const otherEnd = new Date(item.endsAt).getTime() + existingBufferAfter * 60000;
    return overlaps(busyStart, busyEnd, otherStart, otherEnd);
  });
  if (conflictingAppointments.length) {
    const groupCapacity = requestedServices.length === 1 ? requestedServices[0].groupCapacity ?? 1 : 1;
    const isSameGroupSlot = groupCapacity > 1 && conflictingAppointments.every((item) => item.serviceId === service.id && new Date(item.startsAt).getTime() === startMs && new Date(item.endsAt).getTime() === endMs);
    const groupSize = relevantAppointments.filter((item) => item.serviceId === service.id && new Date(item.startsAt).getTime() === startMs && new Date(item.endsAt).getTime() === endMs).length;
    if (!isSameGroupSlot || groupSize >= groupCapacity) return { ok: false, reason: groupCapacity > 1 && isSameGroupSlot ? "Este grupo já atingiu a capacidade máxima." : "O horário conflita com outro agendamento do profissional." };
  }
  return { ok: true };
}

export function getAvailableSlots(input: AvailabilityRequest, stepMinutes?: number): AvailableSlot[] {
  const request = { ...input, source: input.source ?? "public" as const };
  const schedule = scheduleForEmployee(request.employeeId, request.establishmentId, request.dateKey);
  if (!schedule) return [];
  const settings = getEstablishmentSettings(request.establishmentId);
  const step = settings.booking.slotStepMinutes ?? stepMinutes ?? 30;
  if (![5, 10, 15, 30].includes(step)) return [];
  const slots: AvailableSlot[] = [];
  const effectiveServices = (request.services?.length ? request.services : [request.service]).map((item) => serviceForEmployee(item, request.employeeId));
  const duration = effectiveServices.reduce((total, item) => total + item.durationMinutes, 0);
  for (const range of schedule.workingHours) {
    for (let start = toMinutes(range.start); start + duration <= toMinutes(range.end); start += step) {
      const startTime = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
      const end = start + duration;
      const endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
      let startsAt: string;
      let endsAt: string;
      try {
        startsAt = isoForLocalTime(request.dateKey, startTime, request.timezone);
        endsAt = isoForLocalTime(request.dateKey, endTime, request.timezone);
      } catch { return []; }
      if (dateKeyInTimezone(new Date(startsAt), request.timezone) !== request.dateKey || localTime(startsAt, request.timezone) !== start) continue;
      if (validateSlot(request, startsAt, endsAt).ok) slots.push({ start: startTime, end: endTime });
    }
  }
  return slots;
}
