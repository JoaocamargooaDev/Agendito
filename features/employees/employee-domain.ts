import { listKnownCustomers, profileForCustomer } from "@/features/customer/repository";
import { listAllEstablishments } from "@/features/platform";
import { canTransitionAppointment, listAppointments, listBlockedPeriods, updateAppointment, updateAppointmentStatus, validateSlot } from "@/features/agenda";
import { isEditableAppointmentStatus } from "@/features/agenda/status";
import { listEmployees, updateEmployee, deactivateEmployee } from "./repository";
import { listServices } from "@/features/services";
import { dateKeyInTimezone } from "@/features/booking/rules";
import type { Appointment, AppointmentStatus, Employee } from "@/types";

export function employeeForUser(userId: string) { return listEmployees().find((item) => item.userId === userId && item.active) ?? null; }
export function employeeEstablishment(employee: Employee) { return listAllEstablishments().find((item) => item.id === employee.establishmentId && item.active !== false) ?? null; }
export function employeeAppointments(employee: Employee) { return listAppointments().filter((item) => item.employeeId === employee.id && item.establishmentId === employee.establishmentId); }
export function canEmployeeTransition(employee: Employee, appointment: Appointment, next: AppointmentStatus) { return appointment.employeeId === employee.id && appointment.establishmentId === employee.establishmentId && canTransitionAppointment(appointment.status, next); }
export function updateEmployeeAppointmentStatus(employee: Employee, appointmentId: string, next: AppointmentStatus) { const appointment = employeeAppointments(employee).find((item) => item.id === appointmentId); if (!appointment || !canEmployeeTransition(employee, appointment, next)) return { ok: false as const, reason: "Essa transição não é permitida para este atendimento." }; const updated = updateAppointmentStatus(appointmentId, next, employee.establishmentId, "EMPLOYEE"); return updated ? { ok: true as const, appointment: updated } : { ok: false as const, reason: "Não foi possível atualizar o atendimento." }; }
export function employeeCustomers(employee: Employee) { const ids = new Set(employeeAppointments(employee).map((item) => item.customerId)); return listKnownCustomers().filter((item) => ids.has(item.id)).map((customer) => ({ customer, user: profileForCustomer(customer.id)?.user, appointments: employeeAppointments(employee).filter((item) => item.customerId === customer.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt)) })); }
export function employeeProfileUpdate(employee: Employee, phone: string) { return updateEmployee(employee.id, { phone }, employee.establishmentId); }

export function futureEmployeeAppointments(employee: Employee) { const now = new Date().toISOString(); return employeeAppointments(employee).filter((item) => item.startsAt > now && isEditableAppointmentStatus(item.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); }

export function transferEmployeeAppointments(employee: Employee, targetEmployeeId: string) {
  const establishmentId = employee.establishmentId;
  const target = listEmployees(establishmentId).find((item) => item.id === targetEmployeeId && item.active);
  if (!target || target.id === employee.id) return { ok: false as const, reason: "Selecione outro profissional ativo do mesmo estabelecimento." };
  const future = futureEmployeeAppointments(employee);
  const services = listServices(establishmentId);
  const timezone = listAllEstablishments().find((item) => item.id === establishmentId)?.timezone ?? "America/Sao_Paulo";
  const movingIds = new Set(future.map((item) => item.id));
  const simulated = listAppointments(establishmentId).filter((item) => !movingIds.has(item.id));
  const plan = [] as Array<{ id: string; startsAt: string; endsAt: string }>;
  for (const appointment of future) {
    const snapshots = appointment.serviceSnapshots?.length ? appointment.serviceSnapshots : [{ id: appointment.serviceId, name: appointment.serviceNameSnapshot, durationMinutes: appointment.durationMinutesSnapshot, priceInCents: appointment.priceInCentsSnapshot }];
    const linkedServices = snapshots.map((snapshot) => {
      const service = services.find((item) => item.id === snapshot.id);
      return service ? { ...service, employeeOverrides: undefined, durationMinutes: snapshot.durationMinutes, priceInCents: snapshot.priceInCents } : null;
    });
    if (linkedServices.some((item) => !item)) return { ok: false as const, reason: `O serviço de ${appointment.serviceNameSnapshot} não está mais disponível no catálogo.` };
    const requested = linkedServices as NonNullable<(typeof linkedServices)[number]>[];
    const validation = validateSlot({ establishmentId, employeeId: target.id, service: requested[0], services: requested, dateKey: dateKeyInTimezone(new Date(appointment.startsAt), timezone), timezone, appointments: simulated, blockedPeriods: listBlockedPeriods(establishmentId), source: "internal", allowInactiveServices: true }, appointment.startsAt, appointment.endsAt);
    if (!validation.ok) return { ok: false as const, reason: `Não foi possível transferir o agendamento de ${new Date(appointment.startsAt).toLocaleString("pt-BR")}: ${validation.reason}` };
    plan.push({ id: appointment.id, startsAt: appointment.startsAt, endsAt: appointment.endsAt });
    simulated.push({ ...appointment, employeeId: target.id });
  }
  for (const appointment of future) if (!updateAppointment(appointment.id, { employeeId: target.id }, establishmentId)) return { ok: false as const, reason: "Uma reserva mudou durante a transferência. Nenhuma nova reserva deve ser transferida; confira a agenda e tente novamente." };
  return { ok: true as const, transferred: plan.length, target };
}

export function deactivateEmployeeWithFuturePolicy(employee: Employee, policy: "KEEP_HISTORY" | "CANCEL_FUTURE" | "TRANSFER", targetEmployeeId?: string) {
  const future = futureEmployeeAppointments(employee);
  if (policy === "TRANSFER") {
    if (!targetEmployeeId) return { ok: false as const, reason: "Escolha quem receberá os agendamentos." };
    const result = transferEmployeeAppointments(employee, targetEmployeeId);
    if (!result.ok) return result;
  }
  if (policy === "CANCEL_FUTURE") for (const appointment of future) if (!updateAppointmentStatus(appointment.id, "CANCELLED", employee.establishmentId)) return { ok: false as const, reason: "Não foi possível cancelar todas as reservas futuras." };
  const saved = deactivateEmployee(employee.id, employee.establishmentId);
  return saved ? { ok: true as const } : { ok: false as const, reason: "Não foi possível desativar este profissional." };
}
