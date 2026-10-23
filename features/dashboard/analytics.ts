import { listAppointments, listBlockedPeriods } from "@/features/agenda";
import { listEmployees } from "@/features/employees";
import { listAllEstablishments } from "@/features/platform";
import { listServices } from "@/features/services";
import { addDays, dateKeyInTimezone as bookingDateKey, isoForLocalTime } from "@/features/booking/rules";
import { scheduleForEmployee } from "@/features/agenda/availability";
import { occupiesAppointmentTime, isActiveAppointmentStatus } from "@/features/agenda/status";
import type { Appointment, AppointmentStatus, Employee, Service } from "@/types";

export type DashboardPeriod = "today" | "week" | "month" | "custom";
export interface DashboardFilters {
  period: DashboardPeriod;
  startDate: string;
  endDate: string;
  employeeId: string;
  serviceId: string;
  status: "all" | AppointmentStatus;
}
export interface DateRange { startDate: string; endDate: string }
export interface AppointmentMetrics {
  total: number; scheduled: number; confirmed: number; inProgress: number;
  completed: number; cancelled: number; noShow: number;
  projectedRevenueInCents: number; receivedRevenueInCents: number;
}
export interface TrendPoint { key: string; label: string; appointments: number; completed: number; revenueInCents: number }

const STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

function weekdayForKey(key: string) { return new Date(`${key}T12:00:00Z`).getUTCDay(); }
function startOfWeek(key: string) { return addDays(key, weekdayForKey(key) === 0 ? -6 : 1 - weekdayForKey(key)); }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()); }
function dateInRange(appointment: Appointment, timezone: string, range: DateRange) {
  const key = bookingDateKey(new Date(appointment.startsAt), timezone);
  return key >= range.startDate && key <= range.endDate;
}

export function defaultDashboardFilters(now = new Date()): DashboardFilters {
  const today = bookingDateKey(now, "America/Sao_Paulo");
  return { period: "month", startDate: today, endDate: today, employeeId: "all", serviceId: "all", status: "all" };
}

export function resolveDateRange(filters: DashboardFilters, timezone: string, now = new Date()): DateRange {
  const today = bookingDateKey(now, timezone);
  if (filters.period === "today") return { startDate: today, endDate: today };
  if (filters.period === "week") { const startDate = startOfWeek(today); return { startDate, endDate: addDays(startDate, 6) }; }
  if (filters.period === "custom") {
    const startDate = validDate(filters.startDate) ? filters.startDate : today;
    const endDate = validDate(filters.endDate) ? filters.endDate : startDate;
    return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
  }
  const [year, month] = today.split("-").map(Number);
  return { startDate: `${year}-${String(month).padStart(2, "0")}-01`, endDate: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}

export function getFilteredEstablishmentAppointments(establishmentId: string, timezone: string, filters: DashboardFilters, now = new Date()) {
  const range = resolveDateRange(filters, timezone, now);
  return listAppointments(establishmentId)
    .filter((item) => dateInRange(item, timezone, range))
    .filter((item) => filters.employeeId === "all" || item.employeeId === filters.employeeId)
    .filter((item) => filters.serviceId === "all" || item.serviceId === filters.serviceId || item.serviceSnapshots?.some((service) => service.id === filters.serviceId))
    .filter((item) => filters.status === "all" || item.status === filters.status)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function calculateAppointmentMetrics(appointments: Appointment[]): AppointmentMetrics {
  const sum = (predicate: (item: Appointment) => boolean) => appointments.filter(predicate).reduce((total, item) => total + item.priceInCentsSnapshot, 0);
  return {
    total: appointments.length,
    scheduled: appointments.filter((item) => item.status === "SCHEDULED").length,
    confirmed: appointments.filter((item) => item.status === "CONFIRMED").length,
    inProgress: appointments.filter((item) => item.status === "IN_PROGRESS").length,
    completed: appointments.filter((item) => item.status === "COMPLETED").length,
    cancelled: appointments.filter((item) => item.status === "CANCELLED").length,
    noShow: appointments.filter((item) => item.status === "NO_SHOW").length,
    projectedRevenueInCents: sum((item) => isActiveAppointmentStatus(item.status)),
    receivedRevenueInCents: sum((item) => item.status === "COMPLETED"),
  };
}

function mergedMinutes(intervals: Array<[number, number]>) {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  let total = 0; let current: [number, number] | null = null;
  for (const interval of sorted) {
    if (!current) current = [...interval];
    else if (interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
    else { total += (current[1] - current[0]) / 60_000; current = [...interval]; }
  }
  if (current) total += (current[1] - current[0]) / 60_000;
  return total;
}

/** Occupancy is booked minutes / scheduled minutes after blocked periods are removed. */
export function calculateOccupancy(establishmentId: string, timezone: string, range: DateRange, appointments: Appointment[], employeeId = "all") {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  if (!establishment) return { percent: null as number | null, bookedMinutes: 0, availableMinutes: 0 };
  const activeEmployees = listEmployees(establishmentId).filter((employee) => employee.active && (employeeId === "all" || employee.id === employeeId));
  const blocks = listBlockedPeriods(establishmentId);
  const startTime = new Date(`${range.startDate}T12:00:00Z`).getTime();
  const endTime = new Date(`${range.endDate}T12:00:00Z`).getTime();
  const days = Math.round((endTime - startTime) / 86_400_000) + 1;
  if (!activeEmployees.length || days > 366) return { percent: null as number | null, bookedMinutes: 0, availableMinutes: 0 };

  let availableMinutes = 0; let bookedMinutes = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = addDays(range.startDate, offset);
    for (const employee of activeEmployees) {
      const hours = scheduleForEmployee(employee.id, establishmentId, dateKey)?.workingHours ?? [];
      for (const interval of hours) {
        const shiftStart = new Date(isoForLocalTime(dateKey, interval.start, timezone)).getTime();
        const shiftEnd = new Date(isoForLocalTime(dateKey, interval.end, timezone)).getTime();
        if (shiftEnd <= shiftStart) continue;
        const employeeBlocks = blocks.filter((block) => !block.employeeId || block.employeeId === employee.id)
          .map((block) => [Math.max(shiftStart, new Date(block.startsAt).getTime()), Math.min(shiftEnd, new Date(block.endsAt).getTime())] as [number, number])
          .filter(([start, end]) => end > start);
        const freeWindows: Array<[number, number]> = [];
        let cursor = shiftStart;
        for (const [start, end] of employeeBlocks.sort((a, b) => a[0] - b[0])) {
          if (start > cursor) freeWindows.push([cursor, start]);
          cursor = Math.max(cursor, end);
        }
        if (cursor < shiftEnd) freeWindows.push([cursor, shiftEnd]);
        const blockedMinutes = mergedMinutes(employeeBlocks);
        availableMinutes += Math.max(0, (shiftEnd - shiftStart) / 60_000 - blockedMinutes);
        const busyIntervals: Array<[number, number]> = [];
        for (const appointment of appointments) {
          if (appointment.employeeId !== employee.id || !occupiesAppointmentTime(appointment.status)) continue;
          const appointmentStart = new Date(appointment.startsAt).getTime();
          const appointmentEnd = new Date(appointment.endsAt).getTime();
          if (!Number.isFinite(appointmentStart) || !Number.isFinite(appointmentEnd)) continue;
          for (const [freeStart, freeEnd] of freeWindows) {
            const start = Math.max(freeStart, appointmentStart); const end = Math.min(freeEnd, appointmentEnd);
            if (end > start) busyIntervals.push([start, end]);
          }
        }
        bookedMinutes += mergedMinutes(busyIntervals);
      }
    }
  }
  return { percent: availableMinutes ? Math.round(bookedMinutes / availableMinutes * 100) : null, bookedMinutes, availableMinutes };
}

function serviceNames(appointment: Appointment) {
  return appointment.serviceSnapshots?.length ? appointment.serviceSnapshots.map((service) => ({ id: service.id, name: service.name })) : [{ id: appointment.serviceId, name: appointment.serviceNameSnapshot }];
}

export function getEstablishmentAnalytics(establishmentId: string, timezone: string, filters: DashboardFilters, now = new Date()) {
  const range = resolveDateRange(filters, timezone, now);
  const appointments = getFilteredEstablishmentAppointments(establishmentId, timezone, filters, now);
  const employees = listEmployees(establishmentId).filter((item) => item.active);
  const serviceCounts = new Map<string, { name: string; count: number }>();
  const employeeCounts = new Map<string, number>();
  const customerCounts = new Map<string, number>();
  for (const appointment of appointments) {
    for (const service of serviceNames(appointment)) {
      if (filters.serviceId !== "all" && service.id !== filters.serviceId) continue;
      const entry = serviceCounts.get(service.id) ?? { name: service.name, count: 0 };
      entry.count += 1; serviceCounts.set(service.id, entry);
    }
    employeeCounts.set(appointment.employeeId, (employeeCounts.get(appointment.employeeId) ?? 0) + 1);
    if (appointment.status === "COMPLETED") customerCounts.set(appointment.customerId, (customerCounts.get(appointment.customerId) ?? 0) + 1);
  }
  // Occupancy is operational load, so cancelled/no-show filtering must not erase occupied slots.
  const occupancyAppointments = filters.status === "all" ? appointments : getFilteredEstablishmentAppointments(establishmentId, timezone, { ...filters, status: "all" }, now);
  const occupancy = calculateOccupancy(establishmentId, timezone, range, occupancyAppointments, filters.employeeId);
  return {
    range, appointments, metrics: calculateAppointmentMetrics(appointments), occupancy,
    topServices: [...serviceCounts.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.count - a.count).slice(0, 5),
    topEmployees: employees.map((employee) => ({ employee, count: employeeCounts.get(employee.id) ?? 0 })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 5),
    recurringCustomers: [...customerCounts.values()].filter((count) => count > 1).length,
    trend: buildTrend(appointments, timezone, range),
  };
}

function buildTrend(appointments: Appointment[], timezone: string, range: DateRange): TrendPoint[] {
  const days = Math.round((new Date(`${range.endDate}T12:00:00Z`).getTime() - new Date(`${range.startDate}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  const grouping: "day" | "week" | "month" = days <= 14 ? "day" : days <= 62 ? "week" : "month";
  const groups = new Map<string, TrendPoint>();
  for (let offset = 0; offset < Math.min(days, 366); offset += 1) {
    const date = addDays(range.startDate, offset);
    const pointKey = grouping === "day" ? date : grouping === "week" ? startOfWeek(date) : date.slice(0, 7);
    if (groups.has(pointKey)) continue;
    const pointDate = new Date(`${pointKey.length === 7 ? `${pointKey}-01` : pointKey}T12:00:00Z`);
    const label = grouping === "month" ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(pointDate) : grouping === "week" ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(pointDate) : new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit" }).format(pointDate).replace(".", "");
    groups.set(pointKey, { key: pointKey, label, appointments: 0, completed: 0, revenueInCents: 0 });
  }
  for (const appointment of appointments) {
    const date = bookingDateKey(new Date(appointment.startsAt), timezone);
    const key = grouping === "day" ? date : grouping === "week" ? startOfWeek(date) : date.slice(0, 7);
    const point = groups.get(key);
    if (!point) continue;
    point.appointments += 1;
    if (appointment.status === "COMPLETED") { point.completed += 1; point.revenueInCents += appointment.priceInCentsSnapshot; }
  }
  return [...groups.values()];
}

export function formatCsvCell(value: string | number) { return `"${String(value).replace(/"/g, '""')}"`; }
export function appointmentsToCsv(appointments: Appointment[], names: { customer: (id: string) => string; employee: (id: string, establishmentId: string) => string; establishment?: (id: string) => string; timezone?: (establishmentId: string) => string }) {
  const rows = [["Estabelecimento", "Data", "Início", "Cliente", "Profissional", "Serviço", "Status", "Duração (min)", "Receita prevista", "Receita recebida"], ...appointments.map((item) => [
    names.establishment?.(item.establishmentId) ?? "",
    new Intl.DateTimeFormat("pt-BR", { timeZone: names.timezone?.(item.establishmentId) ?? "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(item.startsAt)),
    new Intl.DateTimeFormat("pt-BR", { timeZone: names.timezone?.(item.establishmentId) ?? "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.startsAt)),
    names.customer(item.customerId), names.employee(item.employeeId, item.establishmentId), item.serviceNameSnapshot, appointmentStatusLabel(item.status), item.durationMinutesSnapshot,
    isActiveAppointmentStatus(item.status) ? (item.priceInCentsSnapshot / 100).toFixed(2).replace(".", ",") : "0,00", item.status === "COMPLETED" ? (item.priceInCentsSnapshot / 100).toFixed(2).replace(".", ",") : "0,00",
  ])];
  return `\uFEFF${rows.map((row) => row.map((cell) => formatCsvCell(cell)).join(";")).join("\r\n")}`;
}

export function statusFilterOptions() { return STATUSES; }
export function appointmentStatusLabel(status: AppointmentStatus) { return ({ SCHEDULED: "Agendado", CONFIRMED: "Confirmado", IN_PROGRESS: "Em atendimento", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Falta" } as const)[status]; }
export function activeEmployeesFor(establishmentId: string): Employee[] { return listEmployees(establishmentId).filter((item) => item.active); }
export function activeServicesFor(establishmentId: string): Service[] { return listServices(establishmentId).filter((item) => item.active && item.status !== "ARCHIVED"); }
