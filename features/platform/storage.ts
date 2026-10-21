import type { Establishment, PublicPageConfig, User } from "@/types";
import { establishments, users } from "@/mocks";
import { ACCOUNT_DATA_VERSION, ACCOUNT_DATA_VERSION_KEY, PLATFORM_ESTABLISHMENTS_KEY, PLATFORM_USERS_KEY, REGISTERED_CUSTOMERS_KEY, REMEMBERED_SESSION_KEY, SESSION_STORAGE_KEY } from "@/features/auth/constants";

export const PLATFORM_PAGE_CONFIG_KEY = "agendito.mock.public-page-configs";
export const PLATFORM_DELETED_ESTABLISHMENTS_KEY = "agendito.mock.deleted-establishments";

export interface StoredPlatformUser extends User { passwordHash: string; establishmentId?: string }

const INITIAL_OWNER_ID = "usr-agendito-admin";
const INITIAL_OWNER_EMAIL = "joao@gmail.com";
const OWNER_ROLE_MIGRATION_KEY = "agendito.mock.owner-role-version.v1";
const OWNER_ROLE_MIGRATION_VERSION = "platform-owner-v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return false;
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

const RECOVERY_SNAPSHOT_KEY = "agendito.mock.recovery.snapshot.v1";
const MIGRATION_VERSION = ACCOUNT_DATA_VERSION;

function recordIds(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => item && typeof item === "object" && "id" in item ? String(item.id) : null).filter(Boolean);
    if (parsed && typeof parsed === "object") return Object.keys(parsed);
  } catch { /* retain the raw value in the recovery snapshot */ }
  return [];
}

export function ensureDemoAccountMigration() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(ACCOUNT_DATA_VERSION_KEY) === MIGRATION_VERSION) return;
    const localKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith("agendito.mock.")) && key !== RECOVERY_SNAPSHOT_KEY);
    const sessionKeys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith("agendito.mock.")));
    const snapshot = {
      version: 1,
      capturedAt: new Date().toISOString(),
      scope: "Somente chaves Agendito com prefixo agendito.mock.",
      records: Object.fromEntries(localKeys.map((key) => [key, window.localStorage.getItem(key)])),
      session: Object.fromEntries(sessionKeys.map((key) => [key, window.sessionStorage.getItem(key)])),
      affectedRecordIds: Object.fromEntries(localKeys.map((key) => [key, recordIds(window.localStorage.getItem(key))])),
    };
    // Persist recovery data before removing any operational or account records.
    if ((localKeys.length || sessionKeys.length) && !window.localStorage.getItem(RECOVERY_SNAPSHOT_KEY)) {
      window.localStorage.setItem(RECOVERY_SNAPSHOT_KEY, JSON.stringify(snapshot));
    }
    for (const key of localKeys) window.localStorage.removeItem(key);
    for (const key of sessionKeys) window.sessionStorage.removeItem(key);
    window.localStorage.setItem(ACCOUNT_DATA_VERSION_KEY, MIGRATION_VERSION);
  } catch { /* storage may be unavailable */ }
}

function ensureInitialOwnerRoleMigration() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(OWNER_ROLE_MIGRATION_KEY) === OWNER_ROLE_MIGRATION_VERSION) return;
    ensureDemoAccountMigration();

    let usersChanged = false;
    const migratedUsers = read<StoredPlatformUser>(PLATFORM_USERS_KEY).map((user) => {
      const isOwner = user.id === INITIAL_OWNER_ID || user.email.trim().toLowerCase() === INITIAL_OWNER_EMAIL;
      if (!isOwner) return user;
      usersChanged ||= user.role !== "PLATFORM_ADMIN" || "establishmentId" in user;
      const owner = { ...user, role: "PLATFORM_ADMIN" as const };
      delete owner.establishmentId;
      return owner;
    });
    if (usersChanged && !write(PLATFORM_USERS_KEY, migratedUsers)) return;

    let establishmentsChanged = false;
    const migratedEstablishments = read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY).map((establishment) => {
      if (!establishment.adminUserIds.includes(INITIAL_OWNER_ID)) return establishment;
      establishmentsChanged = true;
      return { ...establishment, adminUserIds: establishment.adminUserIds.filter((id) => id !== INITIAL_OWNER_ID) };
    });
    if (establishmentsChanged && !write(PLATFORM_ESTABLISHMENTS_KEY, migratedEstablishments)) return;

    for (const [storage, key] of [[window.localStorage, REMEMBERED_SESSION_KEY], [window.sessionStorage, SESSION_STORAGE_KEY]] as const) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        const session = JSON.parse(raw) as { userId?: string; role?: string };
        if (session.userId === INITIAL_OWNER_ID && session.role !== "PLATFORM_ADMIN") storage.removeItem(key);
      } catch { storage.removeItem(key); }
    }
    window.localStorage.setItem(OWNER_ROLE_MIGRATION_KEY, OWNER_ROLE_MIGRATION_VERSION);
  } catch { /* retry the scoped migration on the next storage access */ }
}

export function listAllEstablishments() {
  ensureDemoAccountMigration();
  ensureInitialOwnerRoleMigration();
  const deleted = new Set(read<string>(PLATFORM_DELETED_ESTABLISHMENTS_KEY));
  const merged = new Map([...establishments, ...read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY)].map((item) => [item.id, item]));
  return [...merged.values()].filter((item) => !deleted.has(item.id));
}
export function findLocalPublicEstablishment(slug: string) {
  return listAllEstablishments().find((item) => item.slug === slug && item.active !== false) ?? null;
}
export function listAllUsers() {
  ensureDemoAccountMigration();
  ensureInitialOwnerRoleMigration();
  return [...new Map([...users, ...read<StoredPlatformUser>(PLATFORM_USERS_KEY)].map((user) => [user.id, user])).values()].map((user) => {
    if (user.id !== INITIAL_OWNER_ID && user.email.trim().toLowerCase() !== INITIAL_OWNER_EMAIL) return user;
    const owner = { ...(user as StoredPlatformUser), role: "PLATFORM_ADMIN" as const };
    delete owner.establishmentId;
    return owner;
  });
}
export function isAccountEmailAvailable(email: string, exceptUserId?: string) {
  ensureDemoAccountMigration();
  const normalized = email.trim().toLowerCase();
  if (listAllUsers().some((user) => user.id !== exceptUserId && user.email.trim().toLowerCase() === normalized)) return false;
  return !read<{ email: string }>(REGISTERED_CUSTOMERS_KEY).some((customer) => customer.email.trim().toLowerCase() === normalized);
}
export function listCreatedEstablishments() { return read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY); }

export function saveCreatedEstablishment(establishment: Establishment, admin: StoredPlatformUser) {
  ensureDemoAccountMigration();
  const savedEstablishments = [...listCreatedEstablishments().filter((item) => item.id !== establishment.id), establishment];
  const savedUsers = [...read<StoredPlatformUser>(PLATFORM_USERS_KEY).filter((item) => item.id !== admin.id), admin];
  return write(PLATFORM_ESTABLISHMENTS_KEY, savedEstablishments) && write(PLATFORM_USERS_KEY, savedUsers);
}

export function saveEstablishment(establishment: Establishment) {
  const saved = [...listCreatedEstablishments().filter((item) => item.id !== establishment.id), establishment];
  return write(PLATFORM_ESTABLISHMENTS_KEY, saved);
}

export function savePlatformUser(user: StoredPlatformUser) {
  ensureDemoAccountMigration();
  const savedUsers = [...read<StoredPlatformUser>(PLATFORM_USERS_KEY).filter((item) => item.id !== user.id), user];
  return write(PLATFORM_USERS_KEY, savedUsers);
}

export function deleteEstablishment(establishmentId: string) {
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  const deleted = [...new Set([...read<string>(PLATFORM_DELETED_ESTABLISHMENTS_KEY), establishmentId])];
  const remainingEstablishments = listCreatedEstablishments().filter((item) => item.id !== establishmentId);
  const remainingUsers = read<StoredPlatformUser>(PLATFORM_USERS_KEY).filter((item) => item.establishmentId !== establishmentId && !establishment?.adminUserIds.includes(item.id));
  const remainingConfigs = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).filter((item) => item.establishmentId !== establishmentId);
  return write(PLATFORM_DELETED_ESTABLISHMENTS_KEY, deleted)
    && write(PLATFORM_ESTABLISHMENTS_KEY, remainingEstablishments)
    && write(PLATFORM_USERS_KEY, remainingUsers)
    && write(PLATFORM_PAGE_CONFIG_KEY, remainingConfigs);
}

export function savePageConfig(config: PublicPageConfig) {
  const all = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).filter((item) => item.establishmentId !== config.establishmentId);
  return write(PLATFORM_PAGE_CONFIG_KEY, [...all, config]);
}

export function getPageConfig(establishmentId: string) {
  return read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).find((item) => item.establishmentId === establishmentId) ?? null;
}

export async function hashPlatformPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
