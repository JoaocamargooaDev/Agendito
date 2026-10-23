import type { Appointment, Employee, Establishment, Service, PublicPageConfig } from "@/types";

export function tenantRecords<T extends { establishmentId: string }>(records: T[], establishmentId: string): T[];
export function publicAppointmentRecord<T extends Appointment>(appointment: T): T;
export function publicAvailabilityAppointmentRecord<T extends Appointment>(appointment: T): T;
export function publicEmployeeRecord(employee: Employee): Employee;
export function publicServiceRecord(service: Service): Service;
export function publicEstablishmentRecord(establishment: Establishment): Establishment;
export function platformPageRecord(config: PublicPageConfig): Partial<PublicPageConfig>;
