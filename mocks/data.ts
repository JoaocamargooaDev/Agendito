import type { Appointment, Availability, BlockedPeriod, Customer, Employee, Establishment, Schedule, Service, User } from "@/types";

// Operational records start empty. Keep only the system owner and the empty
// structural establishment that reserves the existing public route.
export const users: User[] = [
  { id: "usr-agendito-admin", name: "Gestor geral", email: "joao@gmail.com", role: "PLATFORM_ADMIN", createdAt: "2026-10-21T00:00:00.000Z" },
];

export const establishments: Establishment[] = [
  { id: "est-agendito-initial", name: "", slug: "configuracao-inicial", description: "", phone: "", address: { street: "", number: "", district: "", city: "", state: "", postalCode: "" }, timezone: "America/Sao_Paulo", adminUserIds: [], active: false },
];

export const employees: Employee[] = [];
export const customers: Customer[] = [];
export const services: Service[] = [];
export const appointments: Appointment[] = [];
export const schedules: Schedule[] = [];
export const availabilities: Availability[] = [];
export const blockedPeriods: BlockedPeriod[] = [];
