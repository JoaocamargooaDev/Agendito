export type ID = string;
export type EstablishmentId = ID;

/** Every operational record belongs to exactly one establishment. */
export interface TenantScopedRecord {
  id: ID;
  establishmentId: EstablishmentId;
}

/** DRAFT is retained for records saved by earlier versions of the local app. */
export type EstablishmentStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
export type SimulatedContractStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type PublicPageStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export type UserRole = "PLATFORM_ADMIN" | "ADMIN" | "EMPLOYEE" | "CUSTOMER";

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface User {
  id: ID;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
}

export interface Establishment {
  id: ID;
  /** Legacy compatibility: status takes precedence when present. */
  status?: EstablishmentStatus;
  /** Optional platform-level metadata; absence is valid for legacy records. */
  segment?: string;
  simulatedPlan?: string;
  /** Administrative simulation only; absence means no contract state was recorded. */
  simulatedContractStatus?: SimulatedContractStatus;
  createdAt?: string;
  archivedAt?: string;
  /** Prior public slugs kept as local aliases after an owner-confirmed rename. */
  publicSlugAliases?: string[];
  statusBeforeArchive?: Exclude<EstablishmentStatus, "ARCHIVED">;
  suspensionReason?: string;
  enabledFeatures?: string[];
  featureConfigVersion?: number;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  coverUrl?: string;
  phone: string;
  address: { street: string; number: string; district: string; city: string; state: string; postalCode: string };
  timezone: string;
  adminUserIds: ID[];
  active?: boolean;
  instagram?: string;
  settings?: EstablishmentSettings;
}

export interface BusinessHoursInterval { start: string; end: string }
export interface BusinessHoursDay { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; open: boolean; intervals: BusinessHoursInterval[] }
export interface EstablishmentSettings {
  businessHours: BusinessHoursDay[];
  booking: { minimumLeadMinutes: number; maximumDaysAhead: number; slotStepMinutes: number; allowAnyEmployee: boolean; anyEmployeeStrategy?: "FIRST_AVAILABLE" | "BALANCED"; bufferBeforeMinutes?: number; bufferAfterMinutes?: number; requiresApproval?: boolean };
  cancellation: { customerCanCancel: boolean; minimumLeadMinutes: number };
  rescheduling: { customerCanReschedule: boolean; minimumLeadMinutes: number };
}

/** The first six values are retained so pages already saved in local storage keep rendering. */
export type PublicTemplateId = "editorial" | "atelier" | "barber" | "minimal" | "studio" | "heritage" | "essential" | "premium" | "professionals" | "services" | "clinic";
export type PublicPaletteId = "moss" | "copper" | "sand" | "ink" | "sage";
export type PublicSectionId = "hero" | "about" | "services" | "professionals" | "gallery" | "hours" | "location" | "contact" | "faq" | "policies" | "booking" | "footer";
export interface PublicPageSection {
  id: PublicSectionId;
  visible: boolean;
  title: string;
  description: string;
  layout: "default" | "cards" | "wide";
}
/** Presentation owned exclusively by the platform page-design editor. */
export interface PageDesignConfig extends PublicPageCustomization {
  publicName?: string;
  buttonColor?: string;
  cardStyle?: "glass" | "solid" | "outline";
  typography?: "modern" | "editorial" | "rounded";
  cornerRadius?: number;
  buttonCornerRadius?: number;
  sectionSpacing?: "compact" | "comfortable" | "airy";
  sections?: PublicPageSection[];
  galleryImages?: string[];
  showPrices?: boolean;
  showDurations?: boolean;
  bookingButtonLabel?: string;
  faq?: Array<{ question: string; answer: string }>;
}

/** Page-facing operational data and booking policies remain establishment-owned. */
export interface EstablishmentPageOperationalData {
  serviceIds?: string[];
  employeeIds?: string[];
  allowProfessionalChoice?: boolean;
  bookingFields?: { name: boolean; email: boolean; phone: boolean; notes: boolean };
  allowGuestBooking?: boolean;
  allowCustomerCancel?: boolean;
  allowCustomerReschedule?: boolean;
  policies?: string;
}

/** Legacy/public runtime shape. Persisted records remain readable while ownership is split. */
export type PublicPageContent = PageDesignConfig & EstablishmentPageOperationalData;

export type PublicServiceData = Pick<Service, "id" | "name" | "description" | "durationMinutes" | "priceInCents" | "imageUrl" | "displayOrder">;
export type PublicProfessionalData = Pick<Employee, "id" | "displayName" | "bio" | "title" | "photoUrl" | "serviceIds">;

/** Public-only projection composed for rendering; excludes internal tenant and staff fields. */
export interface EstablishmentOperationalData {
  services: PublicServiceData[];
  professionals: PublicProfessionalData[];
  businessHours: BusinessHoursDay[];
  policies?: string;
}

export interface PublicPageCustomization {
  template: PublicTemplateId;
  palette: PublicPaletteId;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  backgroundColor: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundImageUrl?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  coverUrl?: string;
}

export interface PublicPageConfig extends PublicPageContent {
  establishmentId: EstablishmentId;
  /** Missing values are inferred from the linked establishment's legacy active flag. */
  status?: PublicPageStatus;
  /** Immutable content currently shown to visitors; editor changes remain in the top-level draft. */
  publishedSnapshot?: PublicPageContent;
  publishedAt?: string;
  versions?: PublicPageVersion[];
  updatedAt: string;
}

export interface PublicPageVersion {
  id: string;
  publishedAt: string;
  content: PublicPageContent;
}

export interface Employee extends TenantScopedRecord {
  id: ID;
  userId: ID;
  displayName: string;
  bio: string;
  serviceIds: ID[];
  active: boolean;
  title?: string;
  phone?: string;
  photoUrl?: string;
  commissionPercent?: number;
}

export interface Customer {
  id: ID;
  userId: ID;
  phone: string;
  preferredName?: string;
  notes?: string;
}

export interface Service extends TenantScopedRecord {
  id: ID;
  name: string;
  description: string;
  durationMinutes: number;
  priceInCents: number;
  active: boolean;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  archivedAt?: string;
  category?: string;
  imageUrl?: string;
  preparationMinutes?: number;
  cleanupMinutes?: number;
  employeeOverrides?: Record<string, { priceInCents?: number; durationMinutes?: number }>;
  availableWeekdays?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
  availabilityWindows?: TimeRange[];
  displayOrder?: number;
  publicVisible?: boolean;
  complementaryServiceIds?: string[];
  packageOffer?: { sessions: number; discountPercent: number };
  groupCapacity?: number;
}

export interface AppointmentServiceSnapshot {
  id: ID;
  name: string;
  durationMinutes: number;
  priceInCents: number;
  groupCapacity?: number;
  preparationMinutes?: number;
  cleanupMinutes?: number;
  availableWeekdays?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
  availabilityWindows?: TimeRange[];
}

/** The current tenant-wide catalog consists of these two resource families. */
export type EstablishmentResource = Employee | Service;

export interface Appointment extends TenantScopedRecord {
  id: ID;
  employeeId: ID;
  customerId: ID;
  serviceId: ID;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  serviceNameSnapshot: string;
  serviceSnapshots?: AppointmentServiceSnapshot[];
  durationMinutesSnapshot: number;
  priceInCentsSnapshot: number;
  notes?: string;
  createdAt: string;
  history?: AppointmentHistoryEvent[];
}

export type AppointmentEventOrigin = "PUBLIC" | "CUSTOMER" | "EMPLOYEE" | "ADMIN" | "SYSTEM";
export interface AppointmentHistoryEvent {
  id: string;
  type: "CREATED" | "STATUS_CHANGED" | "RESCHEDULED" | "CUSTOMER_MERGED";
  at: string;
  origin: AppointmentEventOrigin;
  fromStatus?: AppointmentStatus;
  toStatus?: AppointmentStatus;
  previousStartsAt?: string;
  previousEndsAt?: string;
  startsAt?: string;
  endsAt?: string;
  previousCustomerId?: ID;
  customerId?: ID;
}

export interface TimeRange { start: string; end: string }

export interface Schedule extends TenantScopedRecord {
  id: ID;
  employeeId?: ID;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  workingHours: TimeRange[];
  active: boolean;
}

export interface Availability extends TenantScopedRecord {
  id: ID;
  employeeId: ID;
  date: string;
  slots: TimeRange[];
  source: "SCHEDULE" | "OVERRIDE";
}

export interface BlockedPeriod extends TenantScopedRecord {
  id: ID;
  employeeId?: ID;
  startsAt: string;
  endsAt: string;
  reason: string;
  recurrence?: { frequency: "WEEKLY"; until?: string };
}
