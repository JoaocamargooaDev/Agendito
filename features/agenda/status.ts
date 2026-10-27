import type { AppointmentStatus } from "@/types";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Pendente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function getAppointmentTransitions(status: AppointmentStatus) {
  return APPOINTMENT_TRANSITIONS[status];
}

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus) {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

export function isCustomerManageableAppointmentStatus(status: AppointmentStatus) {
  return isEditableAppointmentStatus(status);
}

const ACTIVE_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
]);

const EDITABLE_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "SCHEDULED",
  "CONFIRMED",
]);

export function isActiveAppointmentStatus(status: AppointmentStatus) {
  return ACTIVE_APPOINTMENT_STATUSES.has(status);
}

export function isEditableAppointmentStatus(status: AppointmentStatus) {
  return EDITABLE_APPOINTMENT_STATUSES.has(status);
}

export function occupiesAppointmentTime(status: AppointmentStatus) {
  return ACTIVE_APPOINTMENT_STATUSES.has(status) || status === "COMPLETED";
}
