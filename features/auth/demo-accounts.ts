import { createEmployee, listEmployees } from "@/features/employees/repository";
import { createService, listServices, updateService } from "@/features/services/repository";
import { getEstablishmentSettings, updateEstablishmentSettings } from "@/features/settings/repository";
import { REGISTERED_CUSTOMERS_KEY } from "@/features/auth/constants";
import { ensureDemoAccountMigration, findEstablishmentForDemoSetup, listAllUsersForAuthentication, saveEstablishment, savePlatformUser, type StoredPlatformUser } from "@/features/platform/storage";
import type { Establishment } from "@/types";
import { runLocalAccountBootstrap } from "./capabilities";
export { DEMO_ACCOUNT_CREDENTIALS } from "./demo-account-profiles";

const DEMO_SEED_KEY = "agendito.mock.demo-accounts.v1";
const DEMO_SEED_VERSION = "four-profiles-local-v1";
const DEMO_BARBER_SERVICE_SEED_KEY = "agendito.mock.demo-barber-service.v1";
const DEMO_BARBER_SERVICE_ID = "srv-agendito-access-barba";
const DEMO_ESTABLISHMENT_ID = "est-agendito-access-demo";
const DEMO_MANAGER_ID = "usr-agendito-access-manager";
const DEMO_EMPLOYEE_ID = "usr-agendito-access-employee";
const DEMO_EMPLOYEE_RECORD_ID = "emp-agendito-access-employee";
const DEMO_CUSTOMER_ID = "cus-agendito-access-customer";
const DEMO_CUSTOMER_USER_ID = "usr-agendito-access-customer";

const demoUsers: Array<StoredPlatformUser> = [
  { id: "usr-agendito-admin", name: "Dono do Agendito", email: "joao@gmail.com", role: "PLATFORM_ADMIN", createdAt: "2026-10-21T00:00:00.000Z", passwordHash: "4df1410680017a9dac9eccfa8356b0153784eb94a37bcdcc739fc9baaf0f5b46" },
  { id: DEMO_MANAGER_ID, name: "Gestor Agendito", email: "gestor@agendito.test", role: "ADMIN", establishmentId: DEMO_ESTABLISHMENT_ID, createdAt: "2026-10-22T00:00:00.000Z", passwordHash: "1698c72b796548b57b1ef7fd86ee87e57de33bc02787e00b2ee1bbeb1ee8b203" },
  { id: DEMO_EMPLOYEE_ID, name: "Funcionário Agendito", email: "funcionario@agendito.test", role: "EMPLOYEE", establishmentId: DEMO_ESTABLISHMENT_ID, createdAt: "2026-10-22T00:00:00.000Z", passwordHash: "83f66ea25ef0575d543396dbb8b6898634623e8fb5e62086d2d897e5cafdff41" },
];
const demoCustomer = { id: DEMO_CUSTOMER_ID, userId: DEMO_CUSTOMER_USER_ID, phone: "", preferredName: "Cliente Agendito", email: "cliente@agendito.test", passwordHash: "0e197b406debf93024ab4439f3b539f34b22d58437cac6165971f43535525fdf" };

function saveJsonArray<T extends { id?: string; userId?: string; email?: string }>(key: string, item: T, identity: (candidate: T) => boolean) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    const values = Array.isArray(parsed) ? parsed as T[] : [];
    const saved = [...values.filter((candidate) => !identity(candidate)), item];
    localStorage.setItem(key, JSON.stringify(saved));
    return true;
  } catch { return false; }
}

/** Adds the requested service to the seeded demo establishment without touching other tenants. */
function ensureDemoBarberService() {
  if (localStorage.getItem(DEMO_BARBER_SERVICE_SEED_KEY) === "v1") return;
  const establishmentId = DEMO_ESTABLISHMENT_ID;
  const employee = listEmployees(establishmentId).find((item) => item.id === DEMO_EMPLOYEE_RECORD_ID && item.active);
  if (!employee) return;

  const allDay = { start: "00:00", end: "23:59" };
  const everyDay = [0, 1, 2, 3, 4, 5, 6] as const;
  const settings = getEstablishmentSettings(establishmentId);
  const businessHours = everyDay.map((weekday) => ({ weekday, open: true, intervals: [allDay] }));
  if (!updateEstablishmentSettings(establishmentId, { ...settings, businessHours })) return;

  const existing = listServices(establishmentId).find((item) => item.id === DEMO_BARBER_SERVICE_ID)
    ?? listServices(establishmentId).find((item) => item.name.trim().toLowerCase() === "serviço de barba");
  const service = existing
    ? updateService(existing.id, {
      name: "Serviço de barba",
      description: "Atendimento de barba com horário disponível todos os dias.",
      category: "Barba",
      durationMinutes: 30,
      priceInCents: 5000,
      active: true,
      status: "ACTIVE",
      availableWeekdays: [...everyDay],
      availabilityWindows: undefined,
      publicVisible: true,
    }, establishmentId, [employee.id])
    : createService({
      id: DEMO_BARBER_SERVICE_ID,
      establishmentId,
      name: "Serviço de barba",
      description: "Atendimento de barba com horário disponível todos os dias.",
      category: "Barba",
      durationMinutes: 30,
      priceInCents: 5000,
      active: true,
      status: "ACTIVE",
      availableWeekdays: [...everyDay],
      publicVisible: true,
      displayOrder: listServices(establishmentId).length,
    }, [employee.id]);
  if (!service) return;

  // The blank service-specific time window means the service uses the
  // establishment's configured business hours.
  localStorage.setItem(DEMO_BARBER_SERVICE_SEED_KEY, "v1");
}

/** Recreates a small, repeatable local access set on every origin without clearing user data. */
export function ensureDemoAccounts() {
  if (typeof window === "undefined") return;
  return runLocalAccountBootstrap(() => {
  try {
    ensureDemoAccountMigration();
    if (localStorage.getItem(DEMO_SEED_KEY) === DEMO_SEED_VERSION) {
      ensureDemoBarberService();
      return;
    }

    const now = new Date().toISOString();
    const existingEstablishment = findEstablishmentForDemoSetup(DEMO_ESTABLISHMENT_ID);
    const establishment: Establishment = existingEstablishment ?? {
      id: DEMO_ESTABLISHMENT_ID,
      status: "ACTIVE",
      active: true,
      name: "Barbearia Agendito Demo",
      slug: "barbearia-agendito-demo",
      segment: "Barbearia",
      simulatedPlan: "Essencial",
      description: "Atendimento e organização da agenda.",
      phone: "",
      address: { street: "", number: "", district: "", city: "Brasília", state: "DF", postalCode: "" },
      timezone: "America/Sao_Paulo",
      adminUserIds: [DEMO_MANAGER_ID],
      createdAt: now,
    };
    const updatedEstablishment = {
      ...establishment,
      name: establishment.name.trim() ? establishment.name : "Barbearia Agendito Demo",
      status: establishment.status ?? "ACTIVE",
      active: establishment.status ? establishment.status === "ACTIVE" : establishment.active ?? true,
      adminUserIds: [...new Set([...establishment.adminUserIds, DEMO_MANAGER_ID])],
    };
    if (!saveEstablishment(updatedEstablishment)) return;

    const existingUsers = listAllUsersForAuthentication();
    for (const demoUser of demoUsers) {
      const existing = existingUsers.find((user) => user.id === demoUser.id);
      const userToSave = { ...existing, ...demoUser, ...(demoUser.id === DEMO_MANAGER_ID || demoUser.id === DEMO_EMPLOYEE_ID ? { establishmentId: establishment.id } : {}) } as StoredPlatformUser;
      if (!savePlatformUser(userToSave)) return;
    }

    if (!listEmployees(establishment.id).some((employee) => employee.id === DEMO_EMPLOYEE_RECORD_ID)) {
      const employee = createEmployee({ id: DEMO_EMPLOYEE_RECORD_ID, userId: DEMO_EMPLOYEE_ID, establishmentId: establishment.id, displayName: "Funcionário Agendito", title: "Profissional", bio: "Atendimento e organização da agenda.", serviceIds: [], active: true });
      if (!employee) return;
    }

    if (!saveJsonArray(REGISTERED_CUSTOMERS_KEY, demoCustomer, (candidate) => candidate.id === DEMO_CUSTOMER_ID || candidate.email?.toLowerCase() === demoCustomer.email)) return;
    localStorage.setItem(DEMO_SEED_KEY, DEMO_SEED_VERSION);
    ensureDemoBarberService();
  } catch { /* Retry during the next login if local storage is unavailable. */ }
  });
}
