import type { Customer, User, UserRole } from "@/types";

export type AuthContext = "UNIFIED" | "PLATFORM" | "ADMIN" | "CUSTOMER";
export type AuthStatus = "loading" | "ready" | "authenticated";
export type AuthErrorCode = "INVALID_CREDENTIALS" | "CUSTOMER_ON_ADMIN_LOGIN" | "ADMIN_ON_CUSTOMER_LOGIN" | "EMAIL_ALREADY_REGISTERED" | "STORAGE_ERROR" | "INVALID_RETURN_PATH";

export interface SessionReference {
  userId: string;
  role: UserRole;
  issuedAt: string;
}

export interface AuthUser extends User {
  customer?: Customer;
  establishmentId?: string;
}

export interface AuthFailure {
  ok: false;
  code: AuthErrorCode;
  message: string;
}

export interface AuthSuccess {
  ok: true;
  user: AuthUser;
}

export type AuthResult = AuthSuccess | AuthFailure;

export interface RegistrationInput {
  name: string;
  phone: string;
  email: string;
  password: string;
}

export type PasswordResetResult = { ok: true; message: string } | { ok: false; message: string };

export type PasswordChangeResult = { ok: true } | { ok: false; message: string };

export interface AuthRepository {
  login(email: string, password: string, context: AuthContext, remember: boolean): Promise<AuthResult>;
  registerCustomer(input: RegistrationInput, remember: boolean): Promise<AuthResult>;
  logout(): void;
  restoreSession(): Promise<AuthUser | null>;
  requestPasswordReset(email: string, context: AuthContext): Promise<PasswordResetResult>;
  changeAdminPassword(userId: string, currentPassword: string, newPassword: string): Promise<PasswordChangeResult>;
}
