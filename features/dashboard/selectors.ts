import { listAppointments, listBlockedPeriods } from "@/features/agenda";
import { listEmployees } from "@/features/employees";
import { isProfessionalAvailableOnDate, scheduleForEmployee } from "@/features/agenda/availability";
import { addDays, dateKeyInTimezone } from "@/features/booking/rules";
import { isActiveAppointmentStatus } from "@/features/agenda/status";
import type { Appointment, AppointmentStatus, Employee, Schedule } from "@/types";

export type DashboardTimezone = string;
export interface DashboardDateContext { dateKey: string; timezone: DashboardTimezone; now: Date }
export interface DashboardMetric { label: string; value: number; detail: string; tone?: "accent" | "quiet" | "warning" }
export interface WeeklyPoint { dateKey: string; label: string; total: number; completed: number; cancelled: number; noShow: number; estimatedValueInCents: number }
export interface StaffSnapshot { employee: Employee; schedule: Schedule | null; appointmentCount: number; completedCount: number; blocked: boolean }
export interface DashboardSnapshot {
  date: DashboardDateContext;
  todayAppointments: Appointment[];
  nextAppointment: Appointment | null;
  metrics: { total: number; completed: number; pending: number; inProgress: number; cancelled: number; noShow: number; projectedValueInCents: number; completedValueInCents: number };
  weekly: WeeklyPoint[];
  staffToday: StaffSnapshot[];
  topService: { name: string; count: number } | null;
  busiestDay: { label: string; count: number } | null;
  relatedCustomerCount: number;
}

const NON_CANCELLED_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"];

function dateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export { dateKeyInTimezone };
export function weekdayInTimezone(date: Date, timezone: string) { const weekday = dateParts(date, timezone).weekday; return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6; }
export function formatTime(date: string, timezone: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(date)); }
export function formatShortDate(date: Date, timezone: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(date); }
function startOfWeek(dateKey: string, weekday: number) { return addDays(dateKey, weekday === 0 ? -6 : 1 - weekday); }
function appointmentDateKey(appointment: Appointment, timezone: string) { return dateKeyInTimezone(new Date(appointment.startsAt), timezone); }

export function filterAppointmentsByEstablishment(establishmentId: string) { return listAppointments().filter((appointment) => appointment.establishmentId === establishmentId); }
export function getAppointmentsForDate(establishmentId: string, dateKey: string, timezone: string) { return filterAppointmentsByEstablishment(establishmentId).filter((appointment) => appointmentDateKey(appointment, timezone) === dateKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); }

export function getDashboardSnapshot(establishmentId: string, timezone: string, now = new Date()): DashboardSnapshot {
  const dateKey = dateKeyInTimezone(now, timezone); const weekday = weekdayInTimezone(now, timezone); const establishmentAppointments = filterAppointmentsByEstablishment(establishmentId); const todayAppointments = getAppointmentsForDate(establishmentId, dateKey, timezone);
  const activeToday = todayAppointments.filter((appointment) => isActiveAppointmentStatus(appointment.status));
  const nextAppointment = activeToday.filter((appointment) => new Date(appointment.startsAt).getTime() >= now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  const completed = todayAppointments.filter((appointment) => appointment.status === "COMPLETED");
  const projected = todayAppointments.filter((appointment) => isActiveAppointmentStatus(appointment.status)).reduce((sum, appointment) => sum + appointment.priceInCentsSnapshot, 0);
  const weekStart = startOfWeek(dateKey, weekday); const weekKeys = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekly = weekKeys.map((key) => { const dayAppointments = establishmentAppointments.filter((appointment) => appointmentDateKey(appointment, timezone) === key); return { dateKey: key, label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${key}T12:00:00Z`)).replace(".", ""), total: dayAppointments.filter((appointment) => NON_CANCELLED_STATUSES.includes(appointment.status)).length, completed: dayAppointments.filter((appointment) => appointment.status === "COMPLETED").length, cancelled: dayAppointments.filter((appointment) => appointment.status === "CANCELLED").length, noShow: dayAppointments.filter((appointment) => appointment.status === "NO_SHOW").length, estimatedValueInCents: dayAppointments.filter((appointment) => NON_CANCELLED_STATUSES.includes(appointment.status)).reduce((sum, appointment) => sum + appointment.priceInCentsSnapshot, 0) }; });
  const employeeList = listEmployees(establishmentId); const blockedPeriods = listBlockedPeriods(); const staffToday = employeeList.filter((employee) => employee.active).map((employee) => { const schedule = scheduleForEmployee(employee.id, establishmentId, dateKey); const employeeAppointments = todayAppointments.filter((appointment) => appointment.employeeId === employee.id); const blocked = !isProfessionalAvailableOnDate(employee.id, establishmentId, dateKey) || blockedPeriods.some((period) => period.establishmentId === establishmentId && !period.employeeId && dateKeyInTimezone(new Date(period.startsAt), timezone) === dateKey); return { employee, schedule, appointmentCount: employeeAppointments.length, completedCount: employeeAppointments.filter((appointment) => appointment.status === "COMPLETED").length, blocked }; }).filter((snapshot) => snapshot.schedule !== null);
  const serviceCounts = new Map<string, number>(); establishmentAppointments.filter((appointment) => NON_CANCELLED_STATUSES.includes(appointment.status)).forEach((appointment) => serviceCounts.set(appointment.serviceNameSnapshot, (serviceCounts.get(appointment.serviceNameSnapshot) ?? 0) + 1)); const topServiceEntry = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiest = [...weekly].sort((a, b) => b.total - a.total)[0];
  return { date: { dateKey, timezone, now }, todayAppointments, nextAppointment, metrics: { total: todayAppointments.length, completed: completed.length, pending: todayAppointments.filter((appointment) => ["SCHEDULED", "CONFIRMED"].includes(appointment.status)).length, inProgress: todayAppointments.filter((appointment) => appointment.status === "IN_PROGRESS").length, cancelled: todayAppointments.filter((appointment) => appointment.status === "CANCELLED").length, noShow: todayAppointments.filter((appointment) => appointment.status === "NO_SHOW").length, projectedValueInCents: projected, completedValueInCents: completed.reduce((sum, appointment) => sum + appointment.priceInCentsSnapshot, 0) }, weekly, staffToday, topService: topServiceEntry ? { name: topServiceEntry[0], count: topServiceEntry[1] } : null, busiestDay: busiest && busiest.total !== 0 ? { label: busiest.label, count: busiest.total } : null, relatedCustomerCount: new Set(establishmentAppointments.map((appointment) => appointment.customerId)).size };
}
