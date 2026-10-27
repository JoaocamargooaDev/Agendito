import { ensureLocalDataMigration } from "@/features/platform";
import { createLocalTenantRepository } from "@/features/platform/tenant-repository";
import type { Employee, Schedule, TimeRange } from "@/types";
import { listAllEstablishments } from "@/features/platform/storage";
import { canModifyEstablishmentData, isFeatureEnabled } from "@/features/platform/policies";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionUserId, isCurrentSessionUser } from "@/features/auth/capabilities";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";
import { publicEmployeeRecord } from "@/features/platform/data-projections.mjs";
import { PLATFORM_USERS_KEY } from "@/features/auth/constants";

function canEditTeam(establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  return Boolean(establishment && canCurrentSession(CAPABILITIES.establishmentEmployees, establishmentId) && canModifyEstablishmentData(establishment) && isFeatureEnabled(establishment, "team-schedule"));
}

export const EMPLOYEES_STORAGE_KEY = "agendito.mock.employees.v1";
export const SCHEDULES_STORAGE_KEY = "agendito.mock.schedules.v1";
export const EMPLOYEE_DAILY_AVAILABILITY_STORAGE_KEY = "agendito.mock.employee-daily-availability.v1";
const employeesRepository = createLocalTenantRepository<Employee>(EMPLOYEES_STORAGE_KEY, "agendito:employees-updated");

function readSchedules(): Schedule[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SCHEDULES_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value as Schedule[] : [];
  } catch { return []; }
}

/** Returns an explicit weekly schedule when one has been configured for this employee. */
export function getEmployeeSchedule(employeeId: string, establishmentId: string, weekday: Schedule["weekday"]): Schedule | null {
  return readSchedules().find((item) => item.establishmentId === establishmentId && item.employeeId === employeeId && item.weekday === weekday) ?? null;
}

export function listEmployeeSchedules(employeeId: string, establishmentId: string): Schedule[] {
  return readSchedules().filter((item) => item.establishmentId === establishmentId && item.employeeId === employeeId).sort((a, b) => a.weekday - b.weekday);
}

/** Saves the complete weekly schedule while preserving records for other employees and tenants. */
export function saveEmployeeSchedules(employeeId: string, establishmentId: string, schedules: Array<Pick<Schedule, "weekday" | "active" | "workingHours">>) {
  if (!canEditTeam(establishmentId)) return { ok: false as const, reason: "Acesso não permitido para editar a escala." };
  if (!employeesRepository.findForEstablishment(establishmentId, employeeId)) return { ok: false as const, reason: "Profissional não encontrado." };
  const weekdays = new Set(schedules.map((item) => item.weekday));
  if (schedules.length !== 7 || weekdays.size !== 7 || [...weekdays].some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return { ok: false as const, reason: "Informe a escala completa da semana." };

  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  for (const day of schedules) {
    if (!Array.isArray(day.workingHours) || (day.active && day.workingHours.length === 0) || (!day.active && day.workingHours.length > 0)) return { ok: false as const, reason: "Confira os dias abertos e fechados da escala." };
    const ranges = [...day.workingHours].sort((a, b) => a.start.localeCompare(b.start));
    for (let index = 0; index < ranges.length; index += 1) {
      const range: TimeRange = ranges[index];
      if (!validTime(range.start) || !validTime(range.end) || range.start >= range.end || index > 0 && ranges[index - 1].end > range.start) return { ok: false as const, reason: "Os intervalos devem ter horários válidos e não podem se sobrepor." };
    }
  }

  const current = readSchedules();
  const next: Schedule[] = [
    ...current.filter((item) => !(item.establishmentId === establishmentId && item.employeeId === employeeId)),
    ...schedules.map((item) => ({ ...item, id: `schedule-${establishmentId}-${employeeId}-${item.weekday}`, establishmentId, employeeId })),
  ];
  try {
    window.localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("agendito:employees-updated"));
    window.dispatchEvent(new CustomEvent("agendito:agenda-updated"));
    return { ok: true as const };
  } catch { return { ok: false as const, reason: "Não foi possível salvar a escala neste navegador." }; }
}

interface EmployeeDailyAvailability { establishmentId: string; employeeId: string; dateKey: string; available: boolean }
function readDailyAvailability(): EmployeeDailyAvailability[] {
  if (typeof window === "undefined") return [];
  try {
    const records: unknown = JSON.parse(window.localStorage.getItem(EMPLOYEE_DAILY_AVAILABILITY_STORAGE_KEY) ?? "[]");
    return Array.isArray(records) ? records as EmployeeDailyAvailability[] : [];
  } catch { return []; }
}

function publicEmployeeProjection(employee: Employee): Employee { return publicEmployeeRecord(employee); }

export function listEmployees(establishmentId?: string) {
  ensureLocalDataMigration();
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return [];
  const list = employeesRepository.listForEstablishment(tenantId);
  if (canEditTeam(tenantId)) return list;
  if (canCurrentSession(CAPABILITIES.employeeSchedule, tenantId)) return list.filter((item) => item.userId === currentSessionUserId());
  return isPublishedPublicEstablishment(tenantId) ? list.filter((item) => item.active).map(publicEmployeeProjection) : [];
}
export function getEmployee(id: string, establishmentId?: string) {
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return null;
  const employee = employeesRepository.findForEstablishment(tenantId, id);
  if (!employee) return null;
  if (canEditTeam(tenantId)) return employee;
  if (canCurrentSession(CAPABILITIES.employeeSchedule, tenantId)) return employee.userId === currentSessionUserId() ? employee : null;
  return isPublishedPublicEstablishment(tenantId) && employee.active ? publicEmployeeProjection(employee) : null;
}
/** Identity binding used during local login restoration; does not expose the employee record. */
export function employeeAccountBinding(userId: string) {
  ensureLocalDataMigration();
  const employee = employeesRepository.listAll().find((item) => item.userId === userId);
  return employee ? { establishmentId: employee.establishmentId, active: employee.active } : null;
}
export function createEmployee(employee: Employee) {
  ensureLocalDataMigration();
  if (!canEditTeam(employee.establishmentId)) return null;
  return employeesRepository.create(employee);
}
export function updateEmployee(id: string, patch: Partial<Omit<Employee, "id" | "establishmentId">>, establishmentId: string) {
  ensureLocalDataMigration();
  if (!canEditTeam(establishmentId)) {
    const employee = getEmployee(id, establishmentId);
    const allowedSelfProfilePatch = Object.keys(patch).every((key) => key === "phone");
    if (!employee || !allowedSelfProfilePatch || !canCurrentSession(CAPABILITIES.employeeProfile, establishmentId) || !isCurrentSessionUser(employee.userId, "EMPLOYEE")) return null;
  }
  return employeesRepository.update(establishmentId, id, patch);
}
export function updateEmployeeServices(id: string, serviceIds: string[], establishmentId: string) { return updateEmployee(id, { serviceIds }, establishmentId); }
export function activateEmployee(id: string, establishmentId: string) { return updateEmployee(id, { active: true }, establishmentId); }
export function deactivateEmployee(id: string, establishmentId: string) { return updateEmployee(id, { active: false }, establishmentId); }
/** A missing override means available; permanent employee status is checked separately. */
export function getEmployeeDailyAvailability(employeeId: string, establishmentId: string, dateKey: string) {
  const employee = employeesRepository.findForEstablishment(establishmentId, employeeId);
  if (!employee || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const manager = currentSessionEstablishmentId() === establishmentId && canCurrentSession(CAPABILITIES.establishmentEmployees, establishmentId);
  const employeeSelf = currentSessionEstablishmentId() === establishmentId && employee.userId === currentSessionUserId() && canCurrentSession(CAPABILITIES.employeeSchedule, establishmentId);
  const publicAccess = isPublishedPublicEstablishment(establishmentId) && employee.active;
  if (!manager && !employeeSelf && !publicAccess) return false;
  return readDailyAvailability().find((item) => item.establishmentId === establishmentId && item.employeeId === employeeId && item.dateKey === dateKey)?.available ?? true;
}

export function setEmployeeDailyAvailability(employeeId: string, establishmentId: string, dateKey: string, available: boolean) {
  if (!canEditTeam(establishmentId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const employee = employeesRepository.findForEstablishment(establishmentId, employeeId);
  if (!employee) return false;
  const current = readDailyAvailability();
  const updated = current.filter((item) => !(item.establishmentId === establishmentId && item.employeeId === employeeId && item.dateKey === dateKey));
  updated.push({ establishmentId, employeeId, dateKey, available });
  try {
    window.localStorage.setItem(EMPLOYEE_DAILY_AVAILABILITY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("agendito:employees-updated"));
    return true;
  } catch { return false; }
}

export function removeEmployee(id: string, establishmentId: string) {
  if (!canEditTeam(establishmentId)) return { ok: false as const, reason: "Acesso não permitido para remover profissionais." };
  const employee = employeesRepository.findForEstablishment(establishmentId, id);
  if (!employee) return { ok: false as const, reason: "Profissional não encontrado." };
  const readArray = (key: string) => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value as Array<Record<string, unknown>> : null;
    } catch { return null; }
  };
  const employees = employeesRepository.listAll();
  const appointments = readArray("agendito.mock.appointments.v1");
  const accounts = readArray(PLATFORM_USERS_KEY);
  const availability = readArray(EMPLOYEE_DAILY_AVAILABILITY_STORAGE_KEY);
  const schedules = readArray(SCHEDULES_STORAGE_KEY);
  if (!appointments || !accounts || !availability || !schedules) return { ok: false as const, reason: "Os dados locais estão indisponíveis. Nenhuma alteração foi feita." };
  if (appointments.some((item) => item.establishmentId === establishmentId && item.employeeId === id)) return { ok: false as const, reason: "Este profissional possui agendamentos vinculados. Para preservar o histórico, desative-o em vez de removê-lo." };

  const keys = [EMPLOYEES_STORAGE_KEY, PLATFORM_USERS_KEY, EMPLOYEE_DAILY_AVAILABILITY_STORAGE_KEY, SCHEDULES_STORAGE_KEY];
  const previous = new Map(keys.map((key) => [key, window.localStorage.getItem(key)]));
  try {
    window.localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees.filter((item) => !(item.id === id && item.establishmentId === establishmentId))));
    window.localStorage.setItem(PLATFORM_USERS_KEY, JSON.stringify(accounts.filter((item) => item.id !== employee.userId)));
    window.localStorage.setItem(EMPLOYEE_DAILY_AVAILABILITY_STORAGE_KEY, JSON.stringify(availability.filter((item) => !(item.establishmentId === establishmentId && item.employeeId === id))));
    window.localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules.filter((item) => !(item.establishmentId === establishmentId && item.employeeId === id))));
  } catch {
    for (const [key, value] of [...previous.entries()].reverse()) {
      try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* best-effort rollback if browser storage is full */ }
    }
    return { ok: false as const, reason: "Não foi possível concluir a remoção. Os dados anteriores foram restaurados quando possível." };
  }
  window.dispatchEvent(new CustomEvent("agendito:employees-updated"));
  return { ok: true as const };
}
