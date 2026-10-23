import type { Establishment, PublicPageConfig, User } from "@/types";
import type { RepositoryResult } from "./tenant-repository";
import type { StoredPlatformUser } from "./storage";

/** Administrative projection: never includes operational timezone/settings or employee/customer collections. */
export type PlatformEstablishmentRecord = Omit<Establishment, "settings" | "timezone" | "adminUserIds">;
export type PlatformManagerContact = Pick<User, "name" | "email" | "phone">;

export type PlatformPageAdminRecord = Omit<PublicPageConfig,
  "serviceIds" | "employeeIds" | "allowProfessionalChoice" | "allowGuestBooking" | "bookingFields" | "allowCustomerCancel" | "allowCustomerReschedule" | "policies" | "publishedSnapshot" | "versions"
> & {
  publishedSnapshot?: Omit<NonNullable<PublicPageConfig["publishedSnapshot"]>, "serviceIds" | "employeeIds" | "allowProfessionalChoice" | "allowGuestBooking" | "bookingFields" | "allowCustomerCancel" | "allowCustomerReschedule" | "policies">;
  versions?: Array<Omit<NonNullable<PublicPageConfig["versions"]>[number], "content"> & { content: Omit<NonNullable<PublicPageConfig["publishedSnapshot"]>, "serviceIds" | "employeeIds" | "allowProfessionalChoice" | "allowGuestBooking" | "bookingFields" | "allowCustomerCancel" | "allowCustomerReschedule" | "policies"> }>;
};

/** Ports keep features independent from the current browser-storage adapter. */
export interface EstablishmentRepository {
  listAll(): RepositoryResult<PlatformEstablishmentRecord[]>;
  findById(id: string): RepositoryResult<PlatformEstablishmentRecord | null>;
  save(establishment: PlatformEstablishmentRecord): RepositoryResult<boolean>;
  createWithManager(establishment: Establishment, manager: StoredPlatformUser): RepositoryResult<boolean>;
}

export interface PublicPageRepository {
  findByEstablishment(establishmentId: string): RepositoryResult<PlatformPageAdminRecord | null>;
}

export interface PlatformManagerDirectory {
  getManagerContact(establishmentId: string): RepositoryResult<PlatformManagerContact | null>;
}

export interface PlatformRepository {
  establishments: EstablishmentRepository;
  publicPages: PublicPageRepository;
  managers: PlatformManagerDirectory;
}
