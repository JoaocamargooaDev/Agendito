import { listEmployees } from "@/features/employees/repository";
import { getCustomerEstablishmentProfile, listKnownCustomers, profileForCustomer } from "@/features/customer/repository";
import { isActiveAppointmentStatus, listAppointments } from "@/features/agenda";
import type { Appointment, Customer } from "@/types";

export interface CustomerSnapshot {
  customer: Customer; name: string; email: string; appointments: Appointment[]; completed: Appointment[]; upcoming: Appointment[];
  cancelled: number; noShow: number; lastCompleted: Appointment | null; nextAppointment: Appointment | null;
  topService: { name: string; count: number } | null; topEmployee: { name: string; count: number } | null;
  completedValueInCents: number; recurring: boolean; inactive: boolean; duplicateCustomerIds: string[];
  establishmentProfile: ReturnType<typeof getCustomerEstablishmentProfile>;
}
function normalizePhone(value: string) { return value.replace(/\D/g, ""); }
function customerIdentity(customer: Customer) { const profile = profileForCustomer(customer.id); return { name: profile?.user.name ?? customer.preferredName ?? "Cliente", email: profile?.user.email ?? "E-mail não informado" }; }
export function getRelatedCustomers(establishmentId: string) {
  const ids = new Set(listAppointments(establishmentId).map((item) => item.customerId));
  return listKnownCustomers().filter((customer) => ids.has(customer.id) && !getCustomerEstablishmentProfile(establishmentId, customer.id).mergedIntoId);
}
export function getDuplicateCustomerIds(establishmentId: string) {
  const customers = getRelatedCustomers(establishmentId);
  const groups = new Map<string, string[]>();
  for (const customer of customers) {
    const identity = customerIdentity(customer);
    const email = identity.email.toLowerCase().trim();
    const phone = normalizePhone(customer.phone);
    const keys = [email !== "e-mail não informado" && email.includes("@") ? `email:${email}` : "", phone.length >= 8 ? `phone:${phone}` : ""].filter(Boolean);
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), customer.id]);
  }
  const duplicates = new Map<string, string[]>();
  for (const ids of groups.values()) if (ids.length > 1) for (const id of ids) duplicates.set(id, ids.filter((other) => other !== id));
  return duplicates;
}
export function getCustomerSnapshot(customerId: string, establishmentId: string, now = new Date()): CustomerSnapshot | null {
  const customer = listKnownCustomers().find((item) => item.id === customerId);
  if (!customer) return null;
  const appointments = listAppointments(establishmentId).filter((item) => item.customerId === customerId).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const completed = appointments.filter((item) => item.status === "COMPLETED");
  const upcoming = appointments.filter((item) => isActiveAppointmentStatus(item.status) && new Date(item.startsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const serviceCounts = new Map<string, number>(); const employeeCounts = new Map<string, number>();
  completed.forEach((item) => { serviceCounts.set(item.serviceNameSnapshot, (serviceCounts.get(item.serviceNameSnapshot) ?? 0) + 1); employeeCounts.set(item.employeeId, (employeeCounts.get(item.employeeId) ?? 0) + 1); });
  const topService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const topEmployee = [...employeeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const lastCompleted = completed.at(-1) ?? null;
  const identity = customerIdentity(customer);
  const cutoff = now.getTime() - 90 * 86400000;
  return {
    customer, ...identity, appointments, completed, upcoming,
    cancelled: appointments.filter((item) => item.status === "CANCELLED").length,
    noShow: appointments.filter((item) => item.status === "NO_SHOW").length,
    lastCompleted, nextAppointment: upcoming[0] ?? null,
    topService: topService ? { name: topService[0], count: topService[1] } : null,
    topEmployee: topEmployee ? { name: listEmployees(establishmentId).find((item) => item.id === topEmployee[0])?.displayName ?? topEmployee[0], count: topEmployee[1] } : null,
    completedValueInCents: completed.reduce((sum, item) => sum + item.priceInCentsSnapshot, 0),
    recurring: completed.length >= 5,
    inactive: upcoming.length === 0 && (!lastCompleted || new Date(lastCompleted.endsAt).getTime() < cutoff),
    duplicateCustomerIds: getDuplicateCustomerIds(establishmentId).get(customerId) ?? [],
    establishmentProfile: getCustomerEstablishmentProfile(establishmentId, customerId),
  };
}
export function filterCustomerSnapshots(establishmentId: string, query: string, filter: string) {
  const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return getRelatedCustomers(establishmentId).map((customer) => getCustomerSnapshot(customer.id, establishmentId)).filter((snapshot): snapshot is CustomerSnapshot => Boolean(snapshot)).filter((snapshot) => {
    const search = `${snapshot.name} ${snapshot.email} ${snapshot.customer.phone}`;
    const matchesQuery = !normalizedQuery || search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedQuery) || (normalizePhone(query).length >= 3 && normalizePhone(snapshot.customer.phone).includes(normalizePhone(query)));
    const daysSinceVisit = snapshot.lastCompleted ? Date.now() - new Date(snapshot.lastCompleted.endsAt).getTime() : Number.POSITIVE_INFINITY;
    const matchesFilter = filter === "all" || (filter === "upcoming" && Boolean(snapshot.nextAppointment)) || (filter === "recent" && Boolean(snapshot.lastCompleted && daysSinceVisit <= 30 * 86400000)) || (filter === "stale" && snapshot.inactive) || (filter === "recurring" && snapshot.recurring) || (filter === "duplicates" && snapshot.duplicateCustomerIds.length > 0) || (filter === "cancelled" && snapshot.cancelled > 0) || (filter === "no-show" && snapshot.noShow > 0);
    return matchesQuery && matchesFilter;
  });
}
