import type { Establishment, PublicPageConfig, User } from "@/types";
import type { PlatformEstablishmentRecord, PlatformManagerContact, PlatformPageAdminRecord, PlatformRepository } from "./repository-contracts";
import { getPublicPageStatus, isEstablishmentOperational, isEstablishmentPublic } from "./domain";
import { establishments, users } from "@/mocks";
import { ACCOUNT_DATA_VERSION, ACCOUNT_DATA_VERSION_KEY, PLATFORM_ESTABLISHMENTS_KEY, PLATFORM_USERS_KEY, REGISTERED_CUSTOMERS_KEY, REMEMBERED_SESSION_KEY, SESSION_STORAGE_KEY } from "@/features/auth/constants";
import { sha256Hex } from "@/lib/sha256";
import { CAPABILITIES, canCurrentSession, currentSessionEstablishmentId, currentSessionRole, currentSessionUserId, isCurrentSessionUser } from "@/features/auth/capabilities";
import { platformPageRecord, publicEstablishmentRecord } from "./data-projections.mjs";

export const PLATFORM_PAGE_CONFIG_KEY = "agendito.mock.public-page-configs";
export const PLATFORM_DELETED_ESTABLISHMENTS_KEY = "agendito.mock.deleted-establishments";
const ESTABLISHMENT_OWNED_PAGE_FIELDS = ["serviceIds", "employeeIds", "allowProfessionalChoice", "allowGuestBooking", "bookingFields", "allowCustomerCancel", "allowCustomerReschedule", "policies"] as const;
const DEFAULT_ESTABLISHMENT_PAGE_FIELDS = { serviceIds: undefined, employeeIds: undefined, allowProfessionalChoice: true, allowGuestBooking: false, bookingFields: { name: true, email: true, phone: true, notes: false }, allowCustomerCancel: true, allowCustomerReschedule: true, policies: "" };

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

export function ensureLocalDataMigration() {
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
    // Keep existing local records intact. The recovery snapshot is additive;
    // migrations must never erase tenant data as a side effect of reading it.
    window.localStorage.setItem(ACCOUNT_DATA_VERSION_KEY, MIGRATION_VERSION);
  } catch { /* storage may be unavailable */ }
}

/** Backward-compatible name retained for feature modules from earlier iterations. */
export const ensureDemoAccountMigration = ensureLocalDataMigration;

function ensureInitialOwnerRoleMigration() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(OWNER_ROLE_MIGRATION_KEY) === OWNER_ROLE_MIGRATION_VERSION) return;
    ensureLocalDataMigration();

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

function readAllEstablishments() {
  ensureLocalDataMigration();
  ensureInitialOwnerRoleMigration();
  const deleted = new Set(read<string>(PLATFORM_DELETED_ESTABLISHMENTS_KEY));
  const merged = new Map([...establishments, ...read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY)].map((item) => [item.id, item]));
  return [...merged.values()].filter((item) => !deleted.has(item.id));
}

/** Context-scoped establishment query. Platform callers receive no operational settings. */
export function listAllEstablishments() {
  const all = readAllEstablishments();
  const role = currentSessionRole();
  const tenantId = currentSessionEstablishmentId();
  if (role === "PLATFORM_ADMIN") return all.map((item) => toPlatformEstablishmentRecord(item) as Establishment);
  if (role === "ADMIN" || role === "EMPLOYEE") return tenantId ? all.filter((item) => item.id === tenantId) : [];
  return all.filter((item) => isEstablishmentPublic(item) && getPublicPageStatus(getPageConfig(item.id), item) === "PUBLISHED")
    .map((item) => publicEstablishmentRecord(item) as Establishment);
}

/** Resolves only the tenant identity needed while restoring a mock login session. */
export function establishmentIdForAccount(userId: string) {
  const establishment = readAllEstablishments().find((item) => item.adminUserIds.includes(userId));
  if (establishment) return establishment.id;
  try {
    const employees = JSON.parse(window.localStorage.getItem("agendito.mock.employees.v1") ?? "[]") as Array<{ userId: string; establishmentId: string }>;
    return employees.find((item) => item.userId === userId)?.establishmentId ?? null;
  } catch { return null; }
}

/** Bootstrap-only lookup used by the local demo-account seeder. */
export function findEstablishmentForDemoSetup(establishmentId: string) {
  return readAllEstablishments().find((item) => item.id === establishmentId) ?? null;
}

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key as K))) as Omit<T, K>;
}

function toPlatformEstablishmentRecord(establishment: Establishment): PlatformEstablishmentRecord {
  return omitKeys(establishment, ["settings", "timezone", "adminUserIds"]);
}

/** Platform-specific administrative query. Operational settings and timezone are intentionally omitted. */
export function listPlatformEstablishments(): PlatformEstablishmentRecord[] {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return [];
  return readAllEstablishments().filter((item) => item.name.trim().length > 0).map(toPlatformEstablishmentRecord);
}

export function findPlatformEstablishment(establishmentId: string): PlatformEstablishmentRecord | null {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return null;
  const establishment = readAllEstablishments().find((item) => item.id === establishmentId);
  return establishment ? toPlatformEstablishmentRecord(establishment) : null;
}

/** Returns only the linked establishment manager, never the platform-wide user table. */
export function getPlatformManagerContact(establishmentId: string): PlatformManagerContact | null {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments, establishmentId)) return null;
  const establishment = readAllEstablishments().find((item) => item.id === establishmentId);
  if (!establishment) return null;
  // Resolve only the administrator explicitly linked to this establishment.
  // Never enumerate or return unrelated users (employees/customers included).
  const linkedManagerIds = new Set(establishment.adminUserIds);
  const manager = [...users, ...read<StoredPlatformUser>(PLATFORM_USERS_KEY)]
    .filter((user) => linkedManagerIds.has(user.id) && user.role === "ADMIN")
    .at(-1);
  return manager ? { name: manager.name, email: manager.email, phone: manager.phone } : null;
}

function toPlatformPageConfig(config: PublicPageConfig): PlatformPageAdminRecord {
  return platformPageRecord(config) as PlatformPageAdminRecord;
}

export function getPlatformPageConfig(establishmentId: string): PlatformPageAdminRecord | null {
  if (!canCurrentSession(CAPABILITIES.platformPages, establishmentId)) return null;
  const config = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).find((item) => item.establishmentId === establishmentId);
  return config ? toPlatformPageConfig(config) : null;
}
export function findEstablishmentByPublicSlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  const item = readAllEstablishments().find((candidate) => candidate.slug.toLowerCase() === normalized || candidate.publicSlugAliases?.some((alias) => alias.toLowerCase() === normalized));
  if (!item || !isEstablishmentPublic(item) || getPublicPageStatus(getPageConfig(item.id), item) !== "PUBLISHED") return null;
  return publicEstablishmentRecord(item) as Establishment;
}
/** Public booking directory: published, operational establishments with no administrative or operational settings. */
export function listPublicBookingEstablishments(): Array<Pick<Establishment, "id" | "name" | "slug" | "address">> {
  return readAllEstablishments()
    .filter((item) => isEstablishmentOperational(item) && getPublicPageStatus(getPageConfig(item.id), item) === "PUBLISHED")
    .map(({ id, name, slug, address }) => ({ id, name, slug, address }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export function findPublishedEstablishmentById(establishmentId: string) {
  const item = readAllEstablishments().find((candidate) => candidate.id === establishmentId);
  if (!item || !isEstablishmentPublic(item) || getPublicPageStatus(getPageConfig(item.id), item) !== "PUBLISHED") return null;
  return publicEstablishmentRecord(item) as Establishment;
}
export function findLocalPublicEstablishment(slug: string) {
  return findEstablishmentByPublicSlug(slug);
}

function readAllUsers() {
  ensureLocalDataMigration();
  ensureInitialOwnerRoleMigration();
  return [...new Map([...users, ...read<StoredPlatformUser>(PLATFORM_USERS_KEY)].map((user) => [user.id, user])).values()].map((user) => {
    if (user.id !== INITIAL_OWNER_ID && user.email.trim().toLowerCase() !== INITIAL_OWNER_EMAIL) return user;
    const owner = { ...(user as StoredPlatformUser), role: "PLATFORM_ADMIN" as const };
    delete owner.establishmentId;
    return owner;
  });
}

/** Scoped user query for UI. Authentication uses the separate identity lookup below. */
export function listAllUsers() {
  const role = currentSessionRole();
  const userId = currentSessionUserId();
  const all = readAllUsers();
  if (!role || !userId || role === "PLATFORM_ADMIN") return [];
  const stripCredential = (user: User) => { const { passwordHash: _passwordHash, ...safeUser } = user as StoredPlatformUser; return safeUser; };
  if (role === "CUSTOMER") return all.filter((user) => user.id === userId).map(stripCredential);
  if (role === "EMPLOYEE") return all.filter((user) => user.id === userId).map(stripCredential);
  const establishmentId = currentSessionEstablishmentId();
  if (!establishmentId || !canCurrentSession(CAPABILITIES.establishmentEmployees, establishmentId)) return [];
  const establishment = readAllEstablishments().find((item) => item.id === establishmentId);
  const allowedIds = new Set([...(establishment?.adminUserIds ?? []), ...all.filter((user) => "establishmentId" in user && user.establishmentId === establishmentId).map((user) => user.id)]);
  return all.filter((user) => allowedIds.has(user.id)).map(stripCredential);
}

/** Identity-only directory for the local mock-auth adapter and demo-account seeder. */
export function listAllUsersForAuthentication() { return readAllUsers(); }
export function isAccountEmailAvailable(email: string, exceptUserId?: string) {
  ensureLocalDataMigration();
  const normalized = email.trim().toLowerCase();
  if (listAllUsersForAuthentication().some((user) => user.id !== exceptUserId && user.email.trim().toLowerCase() === normalized)) return false;
  return !read<{ email: string }>(REGISTERED_CUSTOMERS_KEY).some((customer) => customer.email.trim().toLowerCase() === normalized);
}
export function listCreatedEstablishments(): PlatformEstablishmentRecord[] {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return [];
  return read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY).map(toPlatformEstablishmentRecord);
}

export function saveCreatedEstablishment(establishment: Establishment, admin: StoredPlatformUser) {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return false;
  ensureLocalDataMigration();
  const savedEstablishments = [...read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY).filter((item) => item.id !== establishment.id), establishment];
  const savedUsers = [...read<StoredPlatformUser>(PLATFORM_USERS_KEY).filter((item) => item.id !== admin.id), admin];
  return write(PLATFORM_ESTABLISHMENTS_KEY, savedEstablishments) && write(PLATFORM_USERS_KEY, savedUsers);
}

export function saveEstablishment(establishment: Establishment) {
  const platformAccess = canCurrentSession(CAPABILITIES.platformEstablishments, establishment.id);
  const establishmentAccess = canCurrentSession(CAPABILITIES.establishmentSettings, establishment.id);
  if (!platformAccess && !establishmentAccess) return false;
  const current = readAllEstablishments().find((item) => item.id === establishment.id);
  if (!current && !platformAccess) return false;
  const next = platformAccess || !current ? establishment : {
    ...establishment,
    id: current.id,
    slug: current.slug,
    logoUrl: current.logoUrl,
    coverUrl: current.coverUrl,
    adminUserIds: current.adminUserIds,
    status: current.status,
    active: current.active,
    statusBeforeArchive: current.statusBeforeArchive,
    suspensionReason: current.suspensionReason,
    enabledFeatures: current.enabledFeatures,
    featureConfigVersion: current.featureConfigVersion,
    simulatedPlan: current.simulatedPlan,
    segment: current.segment,
    createdAt: current.createdAt,
  };
  const saved = [...read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY).filter((item) => item.id !== establishment.id), next];
  return write(PLATFORM_ESTABLISHMENTS_KEY, saved);
}

/** Saves a platform-owned projection while preserving fields owned by the establishment. */
export function savePlatformEstablishment(establishment: PlatformEstablishmentRecord) {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments, establishment.id)) return false;
  const current = readAllEstablishments().find((item) => item.id === establishment.id);
  if (!current) return false;
  return saveEstablishment({ ...current, ...establishment, settings: current.settings, timezone: current.timezone, adminUserIds: current.adminUserIds });
}

export function savePlatformUser(user: StoredPlatformUser) {
  const platformAccess = canCurrentSession(CAPABILITIES.platformManagerAccess, user.establishmentId);
  const teamAccess = user.role === "EMPLOYEE" && Boolean(user.establishmentId)
    && canCurrentSession(CAPABILITIES.establishmentEmployees, user.establishmentId);
  const selfAdminAccess = user.role === "ADMIN" && Boolean(user.establishmentId)
    && canCurrentSession(CAPABILITIES.establishmentSettings, user.establishmentId)
    && isCurrentSessionUser(user.id, "ADMIN");
  if (!platformAccess && !teamAccess && !selfAdminAccess) return false;
  ensureLocalDataMigration();
  const savedUsers = [...read<StoredPlatformUser>(PLATFORM_USERS_KEY).filter((item) => item.id !== user.id), user];
  return write(PLATFORM_USERS_KEY, savedUsers);
}

export function deleteEstablishment(establishmentId: string) {
  if (!canCurrentSession(CAPABILITIES.platformEstablishments)) return false;
  const establishment = readAllEstablishments().find((item) => item.id === establishmentId);
  const deleted = [...new Set([...read<string>(PLATFORM_DELETED_ESTABLISHMENTS_KEY), establishmentId])];
  const remainingEstablishments = read<Establishment>(PLATFORM_ESTABLISHMENTS_KEY).filter((item) => item.id !== establishmentId);
  const remainingUsers = read<StoredPlatformUser>(PLATFORM_USERS_KEY).filter((item) => item.establishmentId !== establishmentId && !establishment?.adminUserIds.includes(item.id));
  const remainingConfigs = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).filter((item) => item.establishmentId !== establishmentId);
  return write(PLATFORM_DELETED_ESTABLISHMENTS_KEY, deleted)
    && write(PLATFORM_ESTABLISHMENTS_KEY, remainingEstablishments)
    && write(PLATFORM_USERS_KEY, remainingUsers)
    && write(PLATFORM_PAGE_CONFIG_KEY, remainingConfigs);
}

export function savePageConfig(config: PublicPageConfig) {
  if (!canCurrentSession(CAPABILITIES.platformPages, config.establishmentId)) return false;
  const records = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY);
  const current = records.find((item) => item.establishmentId === config.establishmentId);
  const preserveBusinessFields = <T extends object>(candidate: T, baseline: object): T => {
    const next = { ...candidate } as Record<string, unknown>;
    const savedValues = baseline as Record<string, unknown>;
    ESTABLISHMENT_OWNED_PAGE_FIELDS.forEach((field) => { if (field in savedValues) next[field] = savedValues[field]; });
    return next as T;
  };
  const protectedBaseline = current ?? DEFAULT_ESTABLISHMENT_PAGE_FIELDS;
  let safeConfig = preserveBusinessFields(config, protectedBaseline);
  const originalPublishedContent = current?.publishedSnapshot ?? current ?? DEFAULT_ESTABLISHMENT_PAGE_FIELDS;
  if (safeConfig.publishedSnapshot && originalPublishedContent) {
    safeConfig = { ...safeConfig, publishedSnapshot: preserveBusinessFields(safeConfig.publishedSnapshot, originalPublishedContent) };
  }
  if (safeConfig.versions?.length && originalPublishedContent) {
    safeConfig = { ...safeConfig, versions: safeConfig.versions.map((version) => {
      const baseline = current?.versions?.find((item) => item.id === version.id)?.content ?? originalPublishedContent;
      return { ...version, content: preserveBusinessFields(version.content, baseline) };
    }) };
  }
  const all = records.filter((item) => item.establishmentId !== config.establishmentId);
  const saved = write(PLATFORM_PAGE_CONFIG_KEY, [...all, safeConfig]);
  if (saved && typeof window !== "undefined") window.dispatchEvent(new Event("agendito:public-page-updated"));
  return saved;
}

/** Keeps the platform repository's page reads presentation-only. */
export function getPageAdminConfig(establishmentId: string) {
  return getPlatformPageConfig(establishmentId);
}

export function getPageConfig(establishmentId: string) {
  const config = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).find((item) => item.establishmentId === establishmentId) ?? null;
  if (!config) return null;
  if (currentSessionRole() === "PLATFORM_ADMIN") return toPlatformPageConfig(config) as PublicPageConfig;
  const role = currentSessionRole();
  if ((role === "ADMIN" || role === "EMPLOYEE") && currentSessionEstablishmentId() === establishmentId) return config;
  const establishment = readAllEstablishments().find((item) => item.id === establishmentId);
  const status = establishment ? getPublicPageStatus(config, establishment) : "DRAFT";
  if (status !== "PUBLISHED") return { establishmentId, status, updatedAt: config.updatedAt } as PublicPageConfig;
  const published = (config.publishedSnapshot ?? config) as PublicPageConfig;
  const { versions: _versions, publishedSnapshot: _publishedSnapshot, ...content } = published;
  return { ...content, establishmentId, status: "PUBLISHED", publishedAt: config.publishedAt, updatedAt: config.updatedAt } as PublicPageConfig;
}

export function removePageConfig(establishmentId: string) {
  const remaining = read<PublicPageConfig>(PLATFORM_PAGE_CONFIG_KEY).filter((item) => item.establishmentId !== establishmentId);
  return write(PLATFORM_PAGE_CONFIG_KEY, remaining);
}

/** Current adapter. Features may depend on the repository contract, not localStorage. */
export const localPlatformRepository = {
  establishments: {
    listAll: listPlatformEstablishments,
    findById: findPlatformEstablishment,
    save: savePlatformEstablishment,
    createWithManager: saveCreatedEstablishment,
  },
  publicPages: {
    findByEstablishment: getPageAdminConfig,
  },
  managers: {
    getManagerContact: getPlatformManagerContact,
  },
} satisfies PlatformRepository;

export async function hashPlatformPassword(password: string) {
  return sha256Hex(password);
}
