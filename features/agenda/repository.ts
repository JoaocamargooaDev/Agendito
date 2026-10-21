import { ensureDemoAccountMigration } from "@/features/platform";
import type { Appointment, AppointmentStatus, BlockedPeriod } from "@/types";

const APPOINTMENTS_KEY = "agendito.mock.appointments.v1";
const BLOCKED_KEY = "agendito.mock.blocked-periods.v1";
const ACTIVE_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) { try { window.localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("agendito:agenda-updated")); return true; } catch { return false; } }

export function listAppointments() { ensureDemoAccountMigration(); return read<Appointment[]>(APPOINTMENTS_KEY, []); }
export function listBlockedPeriods() { ensureDemoAccountMigration(); return read<BlockedPeriod[]>(BLOCKED_KEY, []); }
export function getAppointment(id: string) { return listAppointments().find((item) => item.id === id) ?? null; }
export function createAppointment(appointment: Appointment) { const current = listAppointments(); return write(APPOINTMENTS_KEY, [...current, appointment]) ? appointment : null; }
export function updateAppointment(id: string, patch: Partial<Appointment>) { const current = listAppointments(); const updated = current.map((item) => item.id === id ? { ...item, ...patch } : item); const result = updated.find((item) => item.id === id) ?? null; return result && write(APPOINTMENTS_KEY, updated) ? result : null; }
export function updateAppointmentStatus(id: string, status: AppointmentStatus) { return updateAppointment(id, { status }); }
export function createBlockedPeriod(period: BlockedPeriod) { const current = listBlockedPeriods(); return write(BLOCKED_KEY, [...current, period]) ? period : null; }
export function updateBlockedPeriod(id: string, patch: Partial<BlockedPeriod>) { const current = listBlockedPeriods(); const updated = current.map((item) => item.id === id ? { ...item, ...patch } : item); const result = updated.find((item) => item.id === id) ?? null; return result && write(BLOCKED_KEY, updated) ? result : null; }
export function removeBlockedPeriod(id: string) { const updated = listBlockedPeriods().filter((item) => item.id !== id); return write(BLOCKED_KEY, updated); }
export function isOccupyingStatus(status: AppointmentStatus) { return ACTIVE_STATUSES.includes(status); }
