import { ensureLocalDataMigration } from "@/features/platform";
import { createLocalTenantRepository } from "@/features/platform/tenant-repository";
import { listEmployees, updateEmployee } from "@/features/employees";
import { listAppointments } from "@/features/agenda/repository";
import type { Service } from "@/types";
import { listAllEstablishments } from "@/features/platform/storage";
import { canModifyEstablishmentData, isFeatureEnabled } from "@/features/platform/policies";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionUserId } from "@/features/auth/capabilities";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";
import { publicServiceRecord } from "@/features/platform/data-projections.mjs";

function canEditServices(establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  return Boolean(establishment && canCurrentSession(CAPABILITIES.establishmentServices, establishmentId) && canModifyEstablishmentData(establishment) && isFeatureEnabled(establishment, "advanced-services"));
}

export const SERVICES_STORAGE_KEY = "agendito.mock.services.v1";
const servicesRepository = createLocalTenantRepository<Service>(SERVICES_STORAGE_KEY, "agendito:services-updated");

function publicServiceProjection(service: Service): Service { return publicServiceRecord(service); }

export function listServices(establishmentId?: string) {
  ensureLocalDataMigration();
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return [];
  if (canEditServices(tenantId)) return servicesRepository.listForEstablishment(tenantId);
  if (canCurrentSession(CAPABILITIES.employeeSchedule, tenantId) || canCurrentSession(CAPABILITIES.employeeAppointments, tenantId)) {
    const employee = listEmployees(tenantId).find((item) => item.userId === currentSessionUserId());
    return employee ? servicesRepository.listForEstablishment(tenantId).filter((item) => employee.serviceIds.includes(item.id)) : [];
  }
  if (!isPublishedPublicEstablishment(tenantId)) return [];
  return servicesRepository.listForEstablishment(tenantId).filter((item) => item.active && item.status !== "ARCHIVED" && item.publicVisible !== false).map(publicServiceProjection);
}
export function getService(id: string, establishmentId?: string) {
  const tenantId = establishmentId ?? currentSessionEstablishmentId();
  if (!tenantId) return null;
  const service = servicesRepository.findForEstablishment(tenantId, id);
  if (!service) return null;
  if (canEditServices(tenantId)) return service;
  if (canCurrentSession(CAPABILITIES.employeeSchedule, tenantId) || canCurrentSession(CAPABILITIES.employeeAppointments, tenantId)) {
    const employee = listEmployees(tenantId).find((item) => item.userId === currentSessionUserId());
    return employee?.serviceIds.includes(service.id) ? service : null;
  }
  return isPublishedPublicEstablishment(tenantId) && service.active && service.status !== "ARCHIVED" && service.publicVisible !== false ? publicServiceProjection(service) : null;
}
function validate(input: Pick<Service, "name" | "durationMinutes" | "priceInCents"> & Partial<Pick<Service, "preparationMinutes" | "cleanupMinutes" | "groupCapacity" | "availabilityWindows" | "availableWeekdays" | "packageOffer">>) {
  if (!input.name.trim()) return "Informe o nome do serviço.";
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 720) return "A duração deve estar entre 5 e 720 minutos.";
  if (!Number.isInteger(input.priceInCents) || input.priceInCents < 0) return "Informe um preço válido.";
  for (const minutes of [input.preparationMinutes ?? 0, input.cleanupMinutes ?? 0]) if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) return "Os intervalos de preparação e finalização devem ficar entre 0 e 180 minutos.";
  if (input.groupCapacity !== undefined && (!Number.isInteger(input.groupCapacity) || input.groupCapacity < 1 || input.groupCapacity > 100)) return "A capacidade do grupo deve ficar entre 1 e 100 pessoas.";
  if (input.packageOffer && (!Number.isInteger(input.packageOffer.sessions) || input.packageOffer.sessions < 2 || input.packageOffer.sessions > 100 || !Number.isFinite(input.packageOffer.discountPercent) || input.packageOffer.discountPercent < 0 || input.packageOffer.discountPercent > 90)) return "Configure um pacote entre 2 e 100 sessões, com desconto de até 90%.";
  if (input.availabilityWindows?.some((range) => !/^\d{2}:\d{2}$/.test(range.start) || !/^\d{2}:\d{2}$/.test(range.end) || range.start >= range.end)) return "Confira os horários específicos deste serviço.";
  return null;
}
export function createService(service: Service, employeeIds: string[] = []) {
  if (!canEditServices(service.establishmentId)) return null;
  const error = validate(service);
  if (error || listServices(service.establishmentId).some((item) => item.name.trim().toLowerCase() === service.name.trim().toLowerCase())) return null;
  const establishment = listAllEstablishments().find((item) => item.id === service.establishmentId);
  if (!establishment || (service.packageOffer && !isFeatureEnabled(establishment, "packages"))) return null;
  const validEmployees = listEmployees(service.establishmentId).filter((item) => item.active && employeeIds.includes(item.id));
  if (validEmployees.length !== new Set(employeeIds).size || employeeIds.some((id) => !validEmployees.some((item) => item.id === id))) return null;
  const currentServices = listServices(service.establishmentId);
  if ((service.complementaryServiceIds ?? []).some((id) => id === service.id || !currentServices.some((item) => item.id === id))) return null;
  const overrides = Object.fromEntries(Object.entries(service.employeeOverrides ?? {}).filter(([employeeId]) => employeeIds.includes(employeeId)));
  if (Object.values(overrides).some((value) => value.priceInCents !== undefined && (!Number.isInteger(value.priceInCents) || value.priceInCents < 0) || value.durationMinutes !== undefined && (!Number.isInteger(value.durationMinutes) || value.durationMinutes < 5 || value.durationMinutes > 720))) return null;
  const saved = servicesRepository.create({ ...service, status: service.active ? "ACTIVE" : "INACTIVE", publicVisible: service.publicVisible ?? true, displayOrder: service.displayOrder ?? currentServices.length, employeeOverrides: overrides, complementaryServiceIds: service.complementaryServiceIds ?? [], name: service.name.trim(), category: service.category?.trim() || "Geral", description: service.description.trim() });
  if (!saved) return null;
  validEmployees.forEach((employee) => updateEmployee(employee.id, { serviceIds: [...new Set([...employee.serviceIds, service.id])] }, service.establishmentId));
  return saved;
}
export function updateService(id: string, patch: Partial<Omit<Service, "id" | "establishmentId">>, establishmentId: string, employeeIds?: string[]) {
  if (!canEditServices(establishmentId)) return null;
  const current = getService(id, establishmentId);
  if (!current) return null;
  const updated = { ...current, ...patch };
  const error = validate(updated);
  if (error) return null;
  if (listServices(establishmentId).some((item) => item.id !== id && item.name.trim().toLowerCase() === updated.name.trim().toLowerCase())) return null;
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  if (!establishment || (updated.packageOffer && !isFeatureEnabled(establishment, "packages") && JSON.stringify(updated.packageOffer) !== JSON.stringify(current.packageOffer))) return null;
  const currentServices = listServices(establishmentId);
  if ((updated.complementaryServiceIds ?? []).some((serviceId) => serviceId === id || !currentServices.some((item) => item.id === serviceId))) return null;
  const tenantEmployees = listEmployees(establishmentId);
  const validEmployees = employeeIds ? tenantEmployees.filter((item) => item.active && employeeIds.includes(item.id)) : tenantEmployees;
  if (employeeIds) {
    if (validEmployees.length !== new Set(employeeIds).size) return null;
  }
  if (Object.keys(updated.employeeOverrides ?? {}).some((employeeId) => !validEmployees.some((item) => item.id === employeeId))) return null;
  if (Object.values(updated.employeeOverrides ?? {}).some((value) => value.priceInCents !== undefined && (!Number.isInteger(value.priceInCents) || value.priceInCents < 0) || value.durationMinutes !== undefined && (!Number.isInteger(value.durationMinutes) || value.durationMinutes < 5 || value.durationMinutes > 720))) return null;
  const status = patch.status ?? (patch.active === undefined ? current.status : patch.active ? "ACTIVE" : current.status === "ARCHIVED" ? "ARCHIVED" : "INACTIVE");
  const packageOffer = !isFeatureEnabled(establishment, "packages") ? current.packageOffer : patch.packageOffer;
  const saved = servicesRepository.update(establishmentId, id, { ...patch, packageOffer, status, active: status === "ACTIVE", name: updated.name.trim(), category: updated.category?.trim() || "Geral", description: updated.description.trim() });
  if (!saved) return null;
  if (employeeIds) {
    listEmployees(establishmentId).filter((employee) => employee.serviceIds.includes(id) && !employeeIds.includes(employee.id)).forEach((employee) => updateEmployee(employee.id, { serviceIds: employee.serviceIds.filter((serviceId) => serviceId !== id) }, establishmentId));
    listEmployees(establishmentId).filter((employee) => employeeIds.includes(employee.id)).forEach((employee) => updateEmployee(employee.id, { serviceIds: [...new Set([...employee.serviceIds, id])] }, establishmentId));
  }
  return saved;
}
export function activateService(id: string, establishmentId: string) { return updateService(id, { active: true, status: "ACTIVE", archivedAt: undefined }, establishmentId); }
export function deactivateService(id: string, establishmentId: string) { return updateService(id, { active: false, status: "INACTIVE" }, establishmentId); }
export function archiveService(id: string, establishmentId: string) { return updateService(id, { active: false, status: "ARCHIVED", archivedAt: new Date().toISOString() }, establishmentId); }
/** Hard deletion is allowed only when no appointment refers to this service. */
export function deleteService(id: string, establishmentId: string) {
  if (!canEditServices(establishmentId) || !servicesRepository.findForEstablishment(establishmentId, id)) return false;
  const hasAppointmentHistory = listAppointments(establishmentId).some((appointment) => appointment.serviceId === id || appointment.serviceSnapshots?.some((service) => service.id === id));
  if (hasAppointmentHistory) return false;

  const linkedEmployees = listEmployees(establishmentId).filter((employee) => employee.serviceIds.includes(id));
  const updatedEmployees: typeof linkedEmployees = [];
  for (const employee of linkedEmployees) {
    const updated = updateEmployee(employee.id, { serviceIds: employee.serviceIds.filter((serviceId) => serviceId !== id) }, establishmentId);
    if (!updated) {
      updatedEmployees.forEach((item) => updateEmployee(item.id, { serviceIds: item.serviceIds }, establishmentId));
      return false;
    }
    updatedEmployees.push(employee);
  }

  const nextServices = servicesRepository.listAll()
    .filter((service) => service.establishmentId !== establishmentId || service.id !== id)
    .map((service) => service.establishmentId === establishmentId && service.complementaryServiceIds?.includes(id)
      ? { ...service, complementaryServiceIds: service.complementaryServiceIds.filter((serviceId) => serviceId !== id) }
      : service);
  if (servicesRepository.replaceAll(nextServices)) return true;

  updatedEmployees.forEach((item) => updateEmployee(item.id, { serviceIds: item.serviceIds }, establishmentId));
  return false;
}
export function reorderServices(establishmentId: string, orderedIds: string[]) {
  const current = listServices(establishmentId);
  if (orderedIds.length !== current.length || new Set(orderedIds).size !== current.length || orderedIds.some((id) => !current.some((service) => service.id === id))) return false;
  const nextOrder = new Map(orderedIds.map((id, index) => [id, index]));
  const all = listServices().map((service) => service.establishmentId === establishmentId ? { ...service, displayOrder: nextOrder.get(service.id) ?? service.displayOrder } : service);
  return servicesRepository.replaceAll(all);
}
export function getServiceEmployees(serviceId: string, establishmentId: string) {
  return listEmployees(establishmentId).filter((employee) => employee.serviceIds.includes(serviceId));
}
