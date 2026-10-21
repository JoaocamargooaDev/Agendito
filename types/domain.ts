export type ID = string;

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
  booking: { minimumLeadMinutes: number; maximumDaysAhead: number; slotStepMinutes: number; allowAnyEmployee: boolean };
  cancellation: { customerCanCancel: boolean; minimumLeadMinutes: number };
  rescheduling: { customerCanReschedule: boolean; minimumLeadMinutes: number };
}

export type PublicTemplateId = "editorial" | "atelier" | "barber" | "minimal" | "studio" | "heritage";
export type PublicPaletteId = "moss" | "copper" | "sand" | "ink" | "sage";

export interface PublicPageConfig {
  establishmentId: ID;
  template: PublicTemplateId;
  palette: PublicPaletteId;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  logoUrl?: string;
  coverUrl?: string;
  updatedAt: string;
}

export interface Employee {
  id: ID;
  userId: ID;
  establishmentId: ID;
  displayName: string;
  bio: string;
  serviceIds: ID[];
  active: boolean;
  title?: string;
  phone?: string;
  photoUrl?: string;
}

export interface Customer {
  id: ID;
  userId: ID;
  phone: string;
  preferredName?: string;
  notes?: string;
}

export interface Service {
  id: ID;
  establishmentId: ID;
  name: string;
  description: string;
  durationMinutes: number;
  priceInCents: number;
  active: boolean;
}

export interface Appointment {
  id: ID;
  establishmentId: ID;
  employeeId: ID;
  customerId: ID;
  serviceId: ID;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  serviceNameSnapshot: string;
  durationMinutesSnapshot: number;
  priceInCentsSnapshot: number;
  notes?: string;
  createdAt: string;
}

export interface TimeRange { start: string; end: string }

export interface Schedule {
  id: ID;
  establishmentId: ID;
  employeeId?: ID;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  workingHours: TimeRange[];
  active: boolean;
}

export interface Availability {
  id: ID;
  establishmentId: ID;
  employeeId: ID;
  date: string;
  slots: TimeRange[];
  source: "SCHEDULE" | "OVERRIDE";
}

export interface BlockedPeriod {
  id: ID;
  establishmentId: ID;
  employeeId?: ID;
  startsAt: string;
  endsAt: string;
  reason: string;
}
