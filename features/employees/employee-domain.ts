import { listKnownCustomers, profileForCustomer } from "@/features/customer/repository";
import { listAllEstablishments } from "@/features/platform";
import { canTransitionAppointment, createBlockedPeriod, listAppointments, listBlockedPeriods, removeBlockedPeriod, updateAppointment, updateAppointmentStatus, validateSlot } from "@/features/agenda";
import { listEmployees, listSchedules, updateEmployee, deactivateEmployee } from "./repository";
import { listServices } from "@/features/services";
import { dateKeyInTimezone } from "@/features/booking/rules";
import type { Appointment, AppointmentStatus, BlockedPeriod, Employee } from "@/types";

export function employeeForUser(userId: string) { return listEmployees().find((item) => item.userId === userId && item.active) ?? null; }
export function employeeEstablishment(employee: Employee) { return listAllEstablishments().find((item) => item.id === employee.establishmentId && item.active !== false) ?? null; }
export function employeeAppointments(employee: Employee) { return listAppointments().filter((item) => item.employeeId === employee.id && item.establishmentId === employee.establishmentId); }
export function canEmployeeTransition(employee: Employee, appointment: Appointment, next: AppointmentStatus) { return appointment.employeeId === employee.id && appointment.establishmentId === employee.establishmentId && canTransitionAppointment(appointment.status, next); }
export function updateEmployeeAppointmentStatus(employee: Employee, appointmentId: string, next: AppointmentStatus) { const appointment = employeeAppointments(employee).find((item) => item.id === appointmentId); if (!appointment || !canEmployeeTransition(employee, appointment, next)) return { ok: false as const, reason: "Essa transição não é permitida para este atendimento." }; const updated = updateAppointmentStatus(appointmentId, next, employee.establishmentId, "EMPLOYEE"); return updated ? { ok: true as const, appointment: updated } : { ok: false as const, reason: "Não foi possível atualizar o atendimento." }; }
export function employeeSchedules(employee: Employee) { return listSchedules(employee.establishmentId).filter((item) => item.employeeId === employee.id || (!item.employeeId && item.active)); }
export function employeeBlockedPeriods(employee: Employee) { return listBlockedPeriods().filter((item) => item.establishmentId === employee.establishmentId && item.employeeId === employee.id); }
function overlaps(a: Date, b: Date, c: Date, d: Date) { return a < d && c < b; }
export function createEmployeeBlock(employee: Employee, input: Pick<BlockedPeriod, "startsAt" | "endsAt" | "reason" | "recurrence">) { const start = new Date(input.startsAt); const end = new Date(input.endsAt); if (!(start < end)) return { ok: false as const, reason: "O período informado é inválido." }; const timezone = listAllEstablishments().find((item) => item.id === employee.establishmentId)?.timezone ?? "America/Sao_Paulo"; const all = listAppointments().filter((item) => item.establishmentId === employee.establishmentId && item.employeeId === employee.id && ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(item.status)); const conflict = all.some((item) => { if (overlaps(start, end, new Date(item.startsAt), new Date(item.endsAt))) return true; if (input.recurrence?.frequency !== "WEEKLY") return false; const dateKey = dateKeyInTimezone(new Date(item.startsAt), timezone); const fromDate = dateKeyInTimezone(start, timezone); const until = input.recurrence.until; if (dateKey < fromDate || until && dateKey > until || new Date(`${dateKey}T12:00:00Z`).getUTCDay() !== new Date(`${fromDate}T12:00:00Z`).getUTCDay()) return false; const minute = (value: string) => { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)); return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0); }; const blockStart = minute(input.startsAt); let blockEnd = minute(input.endsAt); if (blockEnd <= blockStart) blockEnd += 1440; return minute(item.startsAt) < blockEnd && blockStart < minute(item.endsAt); }); if (conflict) return { ok: false as const, reason: "O período conflita com um atendimento existente." }; const period: BlockedPeriod = { id: `blk-${employee.id}-${Date.now()}`, establishmentId: employee.establishmentId, employeeId: employee.id, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason || "Indisponibilidade pessoal", recurrence: input.recurrence }; return createBlockedPeriod(period) ? { ok: true as const, period } : { ok: false as const, reason: "Não foi possível salvar o bloqueio." }; }
export function removeEmployeeBlock(employee: Employee, id: string) { const period = employeeBlockedPeriods(employee).find((item) => item.id === id); if (!period) return { ok: false as const, reason: "Bloqueio não encontrado." }; return removeBlockedPeriod(id, employee.establishmentId) ? { ok: true as const } : { ok: false as const, reason: "Não foi possível remover o bloqueio." }; }
export function employeeCustomers(employee: Employee) { const ids = new Set(employeeAppointments(employee).map((item) => item.customerId)); return listKnownCustomers().filter((item) => ids.has(item.id)).map((customer) => ({ customer, user: profileForCustomer(customer.id)?.user, appointments: employeeAppointments(employee).filter((item) => item.customerId === customer.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt)) })); }
export function employeeProfileUpdate(employee: Employee, phone: string) { return updateEmployee(employee.id, { phone }, employee.establishmentId); }

export function futureEmployeeAppointments(employee: Employee) { const now = new Date().toISOString(); return employeeAppointments(employee).filter((item) => item.startsAt > now && ["SCHEDULED", "CONFIRMED"].includes(item.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); }

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
