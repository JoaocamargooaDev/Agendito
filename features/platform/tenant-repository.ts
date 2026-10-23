import type { EstablishmentId, TenantScopedRecord } from "@/types";
import { tenantRecords } from "./data-projections.mjs";

/**
 * Repository port for establishment-owned resources. Remote adapters may
 * return promises; the current browser adapter remains synchronous so the
 * existing screens and local persistence continue to work unchanged.
 */
export type RepositoryResult<T> = T | Promise<T>;

export interface TenantRepository<T extends TenantScopedRecord> {
  listForEstablishment(establishmentId: EstablishmentId): RepositoryResult<T[]>;
  findForEstablishment(establishmentId: EstablishmentId, id: string): RepositoryResult<T | null>;
  create(record: T): RepositoryResult<T | null>;
  update(establishmentId: EstablishmentId, id: string, patch: Partial<Omit<T, "id" | "establishmentId">>): RepositoryResult<T | null>;
  remove(establishmentId: EstablishmentId, id: string): RepositoryResult<boolean>;
}

export interface LocalTenantRepository<T extends TenantScopedRecord> extends TenantRepository<T> {
  listAll(): T[];
  replaceAll(records: T[]): boolean;
  listForEstablishment(establishmentId: EstablishmentId): T[];
  findForEstablishment(establishmentId: EstablishmentId, id: string): T | null;
  create(record: T): T | null;
  update(establishmentId: EstablishmentId, id: string, patch: Partial<Omit<T, "id" | "establishmentId">>): T | null;
  remove(establishmentId: EstablishmentId, id: string): boolean;
}

function readRecords<T extends TenantScopedRecord>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

export function createLocalTenantRepository<T extends TenantScopedRecord>(key: string, updateEvent: string): LocalTenantRepository<T> {
  function replaceAll(records: T[]) {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(records));
      window.dispatchEvent(new CustomEvent(updateEvent));
      return true;
    } catch {
      return false;
    }
  }

  return {
    listAll: () => readRecords<T>(key),
    listForEstablishment: (establishmentId) => tenantRecords(readRecords<T>(key), establishmentId),
    findForEstablishment: (establishmentId, id) => readRecords<T>(key).find((record) => record.id === id && record.establishmentId === establishmentId) ?? null,
    replaceAll,
    create: (record) => {
      const current = readRecords<T>(key);
      if (current.some((item) => item.id === record.id)) return null;
      return replaceAll([...current, record]) ? record : null;
    },
    update: (establishmentId, id, patch) => {
      const current = readRecords<T>(key);
      const existing = current.find((record) => record.id === id && record.establishmentId === establishmentId);
      if (!existing) return null;
      const updated = { ...existing, ...patch, id: existing.id, establishmentId: existing.establishmentId } as T;
      return replaceAll(current.map((record) => record.id === id && record.establishmentId === establishmentId ? updated : record)) ? updated : null;
    },
    remove: (establishmentId, id) => {
      const current = readRecords<T>(key);
      const next = current.filter((record) => record.id !== id || record.establishmentId !== establishmentId);
      return next.length !== current.length && replaceAll(next);
    },
  };
}
