import type { Appointment, BlockedPeriod, Employee, Schedule, Service } from "@/types";
import { isOccupyingStatus } from "./repository";
import { listEmployees, listSchedules } from "@/features/employees";
import { getEstablishmentSettings } from "@/features/settings/repository";

export interface AvailabilityRequest { establishmentId: string; employeeId: string; service: Service; dateKey: string; timezone: string; appointments: Appointment[]; blockedPeriods: BlockedPeriod[]; }
export interface AvailabilityResult { ok: boolean; reason?: string; }
export interface AvailableSlot { start: string; end: string; }

function weekday(dateKey: string) { const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay(); return day as 0 | 1 | 2 | 3 | 4 | 5 | 6; }
function minutes(value: string) { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; }
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) { return aStart < bEnd && bStart < aEnd; }
function localMinutes(iso: string, timezone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)); return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0); }
function dateOf(iso: string, timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }

export function employeeForService(employeeId: string, service: Service, establishmentId: string): Employee | null { const employee = listEmployees(establishmentId).find((item) => item.id === employeeId && item.active); return employee && employee.serviceIds.includes(service.id) ? employee : null; }
export function scheduleForEmployee(employeeId: string, establishmentId: string, dateKey: string): Schedule | null { const day = weekday(dateKey); const schedules = listSchedules(establishmentId); return schedules.find((item) => item.employeeId === employeeId && item.weekday === day && item.active) ?? schedules.find((item) => !item.employeeId && item.weekday === day && item.active) ?? null; }

export function validateSlot(request: AvailabilityRequest, startIso: string, endIso: string, ignoreAppointmentId?: string): AvailabilityResult {
  const { establishmentId, employeeId, service, dateKey, timezone, appointments, blockedPeriods } = request;
  if (!employeeForService(employeeId, service, establishmentId)) return { ok: false, reason: "Este profissional não realiza o serviço selecionado." };
  if (dateOf(new Date(startIso).toISOString(), timezone) !== dateKey) return { ok: false, reason: "O horário precisa pertencer à data selecionada." };
  const start = localMinutes(startIso, timezone); const end = localMinutes(endIso, timezone); const duration = Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (end <= start || duration !== service.durationMinutes) return { ok: false, reason: "A duração do horário é inválida." };
  const schedule = scheduleForEmployee(employeeId, establishmentId, dateKey); if (!schedule) return { ok: false, reason: "Este profissional não possui expediente nesta data." };
  const businessDay = getEstablishmentSettings(establishmentId).businessHours.find((item) => item.weekday === weekday(dateKey));
  if (!businessDay?.open || !businessDay.intervals.some((range) => start >= minutes(range.start) && end <= minutes(range.end))) return { ok: false, reason: "O estabelecimento está fechado neste horário." };
  if (!schedule.workingHours.some((range) => start >= minutes(range.start) && end <= minutes(range.end))) return { ok: false, reason: "O horário está fora do expediente ou atravessa um intervalo." };
  const slotStart = new Date(startIso).getTime();
  const slotEnd = new Date(endIso).getTime();
  const relevantBlocks = blockedPeriods.filter((block) => block.establishmentId === establishmentId && (!block.employeeId || block.employeeId === employeeId));
  if (relevantBlocks.some((block) => slotStart < new Date(block.endsAt).getTime() && new Date(block.startsAt).getTime() < slotEnd)) return { ok: false, reason: "O horário conflita com um bloqueio ou fechamento do estabelecimento." };
  const relevantAppointments = appointments.filter((item) => item.id !== ignoreAppointmentId && item.establishmentId === establishmentId && item.employeeId === employeeId && isOccupyingStatus(item.status) && dateOf(item.startsAt, timezone) === dateKey);
  if (relevantAppointments.some((item) => overlaps(start, end, localMinutes(item.startsAt, timezone), localMinutes(item.endsAt, timezone)))) return { ok: false, reason: "O horário conflita com outro agendamento." };
  return { ok: true };
}

export function getAvailableSlots(request: Omit<AvailabilityRequest, "appointments" | "blockedPeriods"> & { appointments: Appointment[]; blockedPeriods: BlockedPeriod[] }, stepMinutes = 30): AvailableSlot[] {
  const schedule = scheduleForEmployee(request.employeeId, request.establishmentId, request.dateKey); if (!schedule) return [];
  const slots: AvailableSlot[] = []; const offset = request.timezone === "America/Sao_Paulo" ? "-03:00" : "Z";
  for (const range of schedule.workingHours) for (let start = minutes(range.start); start + request.service.durationMinutes <= minutes(range.end); start += stepMinutes) { const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`; const endValue = start + request.service.durationMinutes; const endTime = `${String(Math.floor(endValue / 60)).padStart(2, "0")}:${String(endValue % 60).padStart(2, "0")}`; const startIso = new Date(`${request.dateKey}T${time}:00${offset}`).toISOString(); const endIso = new Date(`${request.dateKey}T${endTime}:00${offset}`).toISOString(); if (validateSlot(request, startIso, endIso).ok) slots.push({ start: time, end: endTime }); }
  return slots;
}
