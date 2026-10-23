import { CAPABILITIES, canCurrentSession } from "@/features/auth/capabilities";
import { getPublicBookingBlockReason } from "@/features/platform/policies";
import { getPageConfig, listAllEstablishments } from "@/features/platform/storage";
import { isPublishedPublicEstablishment } from "@/features/platform/public-access";

export const GUEST_CUSTOMERS_STORAGE_KEY = "agendito.mock.guest-customers.v1";

export interface GuestCustomer {
  id: string;
  establishmentId: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export function saveGuestCustomer(customer: GuestCustomer) {
  if (typeof window === "undefined") return false;
  const establishment = listAllEstablishments().find((item) => item.id === customer.establishmentId);
  const operationalAccess = canCurrentSession(CAPABILITIES.establishmentCustomers, customer.establishmentId) || canCurrentSession(CAPABILITIES.establishmentAdvanced, customer.establishmentId);
  const publicAccess = Boolean(establishment && isPublishedPublicEstablishment(customer.establishmentId) && !getPublicBookingBlockReason(establishment, getPageConfig(customer.establishmentId)));
  if (!establishment || (!operationalAccess && !publicAccess)) return false;
  try {
    const current = JSON.parse(localStorage.getItem(GUEST_CUSTOMERS_STORAGE_KEY) ?? "[]") as GuestCustomer[];
    const existing = current.find((item) => item.id === customer.id);
    if (existing && existing.establishmentId !== customer.establishmentId) return false;
    localStorage.setItem(GUEST_CUSTOMERS_STORAGE_KEY, JSON.stringify([...current.filter((item) => item.id !== customer.id), customer]));
    return true;
  } catch { return false; }
}

export function removeGuestCustomer(id: string, establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  const publicAccess = Boolean(establishment && isPublishedPublicEstablishment(establishmentId) && !getPublicBookingBlockReason(establishment, getPageConfig(establishmentId)));
  if (typeof window === "undefined" || !canCurrentSession(CAPABILITIES.establishmentCustomers, establishmentId) && !canCurrentSession(CAPABILITIES.establishmentAdvanced, establishmentId) && !publicAccess) return false;
  try {
    const current = JSON.parse(localStorage.getItem(GUEST_CUSTOMERS_STORAGE_KEY) ?? "[]") as GuestCustomer[];
    if (!current.some((item) => item.id === id && item.establishmentId === establishmentId)) return false;
    localStorage.setItem(GUEST_CUSTOMERS_STORAGE_KEY, JSON.stringify(current.filter((item) => item.id !== id || item.establishmentId !== establishmentId)));
    return true;
  } catch { /* Keep the original booking failure visible to the caller. */ }
  return false;
}

export function getGuestCustomer(id: string, establishmentId: string) {
  if (typeof window === "undefined") return null;
  if (!canCurrentSession(CAPABILITIES.establishmentCustomers, establishmentId) && !canCurrentSession(CAPABILITIES.employeeClients, establishmentId)) return null;
  try {
    const current = JSON.parse(localStorage.getItem(GUEST_CUSTOMERS_STORAGE_KEY) ?? "[]") as GuestCustomer[];
    return current.find((item) => item.id === id && item.establishmentId === establishmentId) ?? null;
  } catch { return null; }
}
