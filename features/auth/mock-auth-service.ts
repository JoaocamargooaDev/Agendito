import { customers } from "@/mocks";
import { employeeAccountBinding } from "@/features/employees/repository";
import { ensureDemoAccountMigration, establishmentIdForAccount, listAllUsersForAuthentication, savePlatformUser, type StoredPlatformUser } from "@/features/platform";
import type { Customer, User } from "@/types";
import { REGISTERED_CUSTOMERS_KEY, REMEMBERED_SESSION_KEY, SESSION_STORAGE_KEY } from "./constants";
import type { AuthRepository, AuthUser, RegistrationInput, SessionReference } from "./types";
import { ensureDemoAccounts } from "./demo-accounts";
import { sha256Hex } from "@/lib/sha256";
const CUSTOMER_PROFILE_OVERRIDES_KEY = "agendito.mock.customer-profile-overrides.v1";
const INITIAL_OWNER_ID = "usr-agendito-admin";
// Mock-only verifier; replace with server-side authentication before production.
const INITIAL_OWNER_PASSWORD_HASH = "f673f9618c364eba3879d57169cc21cd1de7185404bf0d864a58d6c3f6553897";

interface StoredCustomer extends Customer { email: string; passwordHash: string }

const hashPassword = sha256Hex;

function readJson<T>(key: string): T | null {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : null; } catch { return null; }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

function getStoredCustomers(): StoredCustomer[] {
  ensureDemoAccountMigration();
  return readJson<StoredCustomer[]>(REGISTERED_CUSTOMERS_KEY) ?? [];
}

function publicCustomer(customer: StoredCustomer): Customer {
  return { id: customer.id, userId: customer.userId, phone: customer.phone, preferredName: customer.preferredName, notes: customer.notes };
}

function findUserById(userId: string, registered: StoredCustomer[]): AuthUser | null {
  const user = listAllUsersForAuthentication().find((candidate) => candidate.id === userId);
  if (user) return enrichUser(user);
  const registeredCustomer = registered.find((customer) => customer.userId === userId);
  if (!registeredCustomer) return null;
  const registeredUser: User = { id: registeredCustomer.userId, name: registeredCustomer.preferredName ?? "Cliente", email: registeredCustomer.email, role: "CUSTOMER", createdAt: new Date().toISOString() };
  return { ...registeredUser, customer: publicCustomer(registeredCustomer) };
}

function enrichUser(user: User): AuthUser {
  const customer = customers.find((candidate) => candidate.userId === user.id);
  let override: { name?: string; email?: string; phone?: string } | undefined;
  try { const overrides = JSON.parse(localStorage.getItem(CUSTOMER_PROFILE_OVERRIDES_KEY) ?? "{}"); override = customer ? overrides[customer.id] : undefined; } catch { /* storage may be unavailable */ }
  const employee = user.role === "EMPLOYEE" ? employeeAccountBinding(user.id) : null;
  const establishmentId = employee?.establishmentId ?? establishmentIdForAccount(user.id) ?? undefined;
  return { ...user, ...(override?.name ? { name: override.name } : {}), ...(override?.email ? { email: override.email } : {}), customer: customer ? { ...customer, ...(override?.phone ? { phone: override.phone } : {}) } : customer, establishmentId };
}

function accountEmailFor(user: User) { return user.email.trim().toLowerCase(); }

export const mockAuthService: AuthRepository = {
  async login(email, password, context, remember) {
    ensureDemoAccounts();
    const normalizedEmail = email.trim().toLowerCase();
    const registered = getStoredCustomers();
    const registeredCustomer = registered.find((customer) => customer.email.toLowerCase() === normalizedEmail);
    const localUsers = listAllUsersForAuthentication();
    const user = localUsers.find((candidate) => accountEmailFor(candidate) === normalizedEmail) ?? (registeredCustomer ? { id: registeredCustomer.userId, name: registeredCustomer.preferredName ?? "Cliente", email: registeredCustomer.email, role: "CUSTOMER" as const, createdAt: new Date().toISOString() } : null);
    if (!user) return { ok: false, code: "INVALID_CREDENTIALS", message: "Não foi possível entrar com esses dados." };
    if (context === "CUSTOMER" && user.role !== "CUSTOMER") return { ok: false, code: "ADMIN_ON_CUSTOMER_LOGIN", message: "Esta é uma conta profissional. Use o acesso administrativo." };
    if (context === "PLATFORM" && user.role !== "PLATFORM_ADMIN") return { ok: false, code: "INVALID_CREDENTIALS", message: "Esta conta não possui acesso ao painel do proprietário." };
    if (context === "ADMIN" && !["ADMIN", "EMPLOYEE"].includes(user.role)) return { ok: false, code: "CUSTOMER_ON_ADMIN_LOGIN", message: "Esta conta não possui acesso administrativo de estabelecimento." };
    const platformUser = localUsers.find((candidate): candidate is StoredPlatformUser => candidate.id === user.id && "passwordHash" in candidate);
    const isInitialOwner = user.id === INITIAL_OWNER_ID && user.role === "PLATFORM_ADMIN";
    const storedHash = registeredCustomer?.passwordHash ?? platformUser?.passwordHash ?? (isInitialOwner ? INITIAL_OWNER_PASSWORD_HASH : undefined);
    if (!storedHash || (await hashPassword(password)) !== storedHash) return { ok: false, code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." };
    const authUser = registeredCustomer ? findUserById(registeredCustomer.userId, registered) : enrichUser(user);
    if (!authUser || (["ADMIN", "EMPLOYEE"].includes(authUser.role) && !authUser.establishmentId) || (authUser.role === "EMPLOYEE" && !employeeAccountBinding(authUser.id)?.active)) return { ok: false, code: "INVALID_CREDENTIALS", message: "Esta conta não possui um estabelecimento ativo." };
    if (isInitialOwner && !platformUser?.passwordHash && !savePlatformUser({ ...user, passwordHash: storedHash })) {
      return { ok: false, code: "STORAGE_ERROR", message: "Não foi possível preparar a conta neste navegador." };
    }
    const session: SessionReference = { userId: authUser.id, role: authUser.role, issuedAt: new Date().toISOString() };
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(REMEMBERED_SESSION_KEY);
      const target = remember ? localStorage : sessionStorage;
      target.setItem(remember ? REMEMBERED_SESSION_KEY : SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch { return { ok: false, code: "STORAGE_ERROR", message: "Não foi possível salvar sua sessão neste navegador." }; }
    return { ok: true, user: authUser };
  },

  async registerCustomer(input: RegistrationInput, remember) {
    ensureDemoAccounts();
    const normalizedEmail = input.email.trim().toLowerCase();
    const duplicate = listAllUsersForAuthentication().some((user) => accountEmailFor(user) === normalizedEmail) || getStoredCustomers().some((customer) => customer.email.toLowerCase() === normalizedEmail);
    if (duplicate) return { ok: false, code: "EMAIL_ALREADY_REGISTERED", message: "Já existe uma conta com este e-mail." };
    const id = `usr-customer-${crypto.randomUUID()}`;
    const customerId = `cus-${crypto.randomUUID()}`;
    const customer: StoredCustomer = { id: customerId, userId: id, phone: input.phone, preferredName: input.name, email: normalizedEmail, passwordHash: await hashPassword(input.password) };
    const registered = [...getStoredCustomers(), customer];
    if (!writeJson(REGISTERED_CUSTOMERS_KEY, registered)) return { ok: false, code: "STORAGE_ERROR", message: "Não foi possível concluir o cadastro neste navegador." };
    const user: AuthUser = { id, name: input.name, email: normalizedEmail, role: "CUSTOMER", createdAt: new Date().toISOString(), customer: publicCustomer(customer), };
    const session: SessionReference = { userId: id, role: "CUSTOMER", issuedAt: new Date().toISOString() };
    try { (remember ? localStorage : sessionStorage).setItem(remember ? REMEMBERED_SESSION_KEY : SESSION_STORAGE_KEY, JSON.stringify(session)); } catch { return { ok: false, code: "STORAGE_ERROR", message: "Conta criada, mas não foi possível iniciar sua sessão." }; }
    return { ok: true, user };
  },

  logout() { try { sessionStorage.removeItem(SESSION_STORAGE_KEY); localStorage.removeItem(REMEMBERED_SESSION_KEY); } catch { /* storage may be blocked */ } },

  async restoreSession() {
    try {
      ensureDemoAccounts();
      const session = readJson<SessionReference>(REMEMBERED_SESSION_KEY) ?? readJson<SessionReference>(SESSION_STORAGE_KEY);
      if (!session) return null;
      const user = findUserById(session.userId, getStoredCustomers());
      if (!user || user.role !== session.role || (["ADMIN", "EMPLOYEE"].includes(user.role) && !user.establishmentId)) { this.logout(); return null; }
      return user;
    } catch { return null; }
  },

  async requestPasswordReset() { return { ok: false, message: "A recuperação de senha não está disponível no momento. Entre em contato com o administrador do estabelecimento." }; },

  async changeAdminPassword(userId, currentPassword, newPassword) {
    ensureDemoAccounts();
    const user = listAllUsersForAuthentication().find((candidate) => candidate.id === userId);
    if (!user || user.role !== "ADMIN") return { ok: false, message: "Conta administrativa não encontrada." };
    if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return { ok: false, message: "Use ao menos 10 caracteres, uma letra maiúscula e um número." };
    }
    const stored = "passwordHash" in user ? user as StoredPlatformUser : null;
    if (!stored?.passwordHash || await hashPassword(currentPassword) !== stored.passwordHash) return { ok: false, message: "A senha atual está incorreta." };
    if (currentPassword === newPassword) return { ok: false, message: "Escolha uma senha diferente da atual." };
    const establishmentId = establishmentIdForAccount(user.id);
    if (!establishmentId) return { ok: false, message: "Estabelecimento administrativo não encontrado." };
    const updated: StoredPlatformUser = { ...user, passwordHash: await hashPassword(newPassword), establishmentId };
    if (!savePlatformUser(updated)) return { ok: false, message: "Não foi possível salvar a nova senha neste navegador." };
    return { ok: true };
  },
};
