import { ensureDemoAccountMigration } from "@/features/platform";
import type { Employee, Schedule, TimeRange } from "@/types";

const EMPLOYEES_KEY = "agendito.mock.employees.v1";
const SCHEDULES_KEY = "agendito.mock.schedules.v1";
function read<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function write<T>(key: string, value: T) { try { window.localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("agendito:employees-updated")); return true; } catch { return false; } }
export function listEmployees(establishmentId?: string) { ensureDemoAccountMigration(); const items = read<Employee[]>(EMPLOYEES_KEY, []); return establishmentId ? items.filter((item) => item.establishmentId === establishmentId) : items; }
export function getEmployee(id: string, establishmentId?: string) { return listEmployees(establishmentId).find((item) => item.id === id) ?? null; }
export function createEmployee(employee: Employee) { const items = listEmployees(); return write(EMPLOYEES_KEY, [...items, employee]) ? employee : null; }
export function updateEmployee(id: string, patch: Partial<Employee>, establishmentId: string) { const items = listEmployees(); const current = items.find((item) => item.id === id && item.establishmentId === establishmentId); if (!current) return null; const updated = { ...current, ...patch, establishmentId: current.establishmentId }; const next = items.map((item) => item.id === id ? updated : item); return write(EMPLOYEES_KEY, next) ? updated : null; }
export function updateEmployeeServices(id: string, serviceIds: string[], establishmentId: string) { return updateEmployee(id, { serviceIds }, establishmentId); }
export function activateEmployee(id: string, establishmentId: string) { return updateEmployee(id, { active: true }, establishmentId); }
export function deactivateEmployee(id: string, establishmentId: string) { return updateEmployee(id, { active: false }, establishmentId); }
export function listSchedules(establishmentId?: string) { ensureDemoAccountMigration(); const items = read<Schedule[]>(SCHEDULES_KEY, []); return establishmentId ? items.filter((item) => item.establishmentId === establishmentId) : items; }
export function updateEmployeeSchedule(employeeId: string, establishmentId: string, scheduleByDay: Record<number, TimeRange[]>) { const items = listSchedules(); const other = items.filter((item) => !(item.employeeId === employeeId && item.establishmentId === establishmentId)); const next = [...other, ...Object.entries(scheduleByDay).filter(([, ranges]) => ranges.length).map(([weekday, workingHours], index) => ({ id: `sch-${employeeId}-${weekday}-${Date.now()}-${index}`, establishmentId, employeeId, weekday: Number(weekday) as 0|1|2|3|4|5|6, workingHours, active: true }))]; return write(SCHEDULES_KEY, next) ? next.filter((item) => item.employeeId === employeeId) : null; }
