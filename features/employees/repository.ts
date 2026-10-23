import { ensureLocalDataMigration } from "@/features/platform";
import { createLocalTenantRepository } from "@/features/platform/tenant-repository";
import type { Employee, Schedule, TimeRange } from "@/types";
import { listAllEstablishments } from "@/features/platform/storage";
import { canModifyEstablishmentData, isFeatureEnabled } from "@/features/platform/policies";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionUserId, isCurrentSessionUser } from "@/features/auth/capabilities";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";
import { publicEmployeeRecord } from "@/features/platform/data-projections.mjs";

function canEditTeam(establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  return Boolean(establishment && canCurrentSession(CAPABILITIES.establishmentEmployees, establishmentId) && canModifyEstablishmentData(establishment) && isFeatureEnabled(establishment, "team-schedule"));
}

export const EMPLOYEES_STORAGE_KEY = "agendito.mock.employees.v1";
export const SCHEDULES_STORAGE_KEY = "agendito.mock.schedules.v1";
const employeesRepository = createLocalTenantRepository<Employee>(EMPLOYEES_STORAGE_KEY, "agendito:employees-updated");
const schedulesRepository = createLocalTenantRepository<Schedule>(SCHEDULES_STORAGE_KEY, "agendito:employees-updated");

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
export function listSchedules(establishmentId?: string) {
  ensureLocalDataMigration();
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return [];
  const list = schedulesRepository.listForEstablishment(tenantId);
  if (canEditTeam(tenantId)) return list;
  if (canCurrentSession(CAPABILITIES.employeeSchedule, tenantId)) return list.filter((item) => !item.employeeId || employeesRepository.findForEstablishment(tenantId, item.employeeId)?.userId === currentSessionUserId());
  return isPublishedPublicEstablishment(tenantId) ? list.filter((item) => item.active) : [];
}
export function updateEmployeeSchedule(employeeId: string, establishmentId: string, scheduleByDay: Record<number, TimeRange[]>) {
  ensureLocalDataMigration();
  if (!canEditTeam(establishmentId)) return null;
  const items = schedulesRepository.listAll();
  const other = items.filter((item) => !(item.employeeId === employeeId && item.establishmentId === establishmentId));
  const next = [
    ...other,
    ...Object.entries(scheduleByDay)
      .filter(([, ranges]) => ranges.length)
      .map(([weekday, workingHours], index) => ({
        id: `sch-${employeeId}-${weekday}-${Date.now()}-${index}`,
        establishmentId,
        employeeId,
        weekday: Number(weekday) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        workingHours,
        active: true,
      })),
  ];
  return schedulesRepository.replaceAll(next) ? next.filter((item) => item.employeeId === employeeId && item.establishmentId === establishmentId) : null;
}
