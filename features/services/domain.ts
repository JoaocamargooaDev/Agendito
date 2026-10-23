import type { Service } from "@/types";

export function serviceIsActive(service: Service) {
  return service.status ? service.status === "ACTIVE" : service.active;
}

export function serviceIsArchived(service: Service) {
  return service.status === "ARCHIVED";
}

export function serviceForEmployee(service: Service, employeeId: string): Service {
  const override = service.employeeOverrides?.[employeeId];
  return {
    ...service,
    priceInCents: override?.priceInCents ?? service.priceInCents,
    durationMinutes: override?.durationMinutes ?? service.durationMinutes,
  };
}

export function serviceSetTotals(services: Service[], employeeId: string) {
  const adjusted = services.map((service) => serviceForEmployee(service, employeeId));
  return {
    services: adjusted,
    durationMinutes: adjusted.reduce((total, service) => total + service.durationMinutes, 0),
    priceInCents: adjusted.reduce((total, service) => total + service.priceInCents, 0),
  };
}

export function serviceAllowsWeekday(service: Service, weekday: number) {
  return !service.availableWeekdays?.length || service.availableWeekdays.includes(weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6);
}
