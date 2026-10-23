import type { AppointmentStatus } from "@/types";

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
