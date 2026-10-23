"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mockAuthService } from "./mock-auth-service";
import type { AuthContext as AuthFlowContext, AuthResult, AuthStatus, AuthUser, PasswordChangeResult, RegistrationInput } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string, context: AuthFlowContext, remember: boolean) => Promise<AuthResult>;
  registerCustomer: (input: RegistrationInput, remember: boolean) => Promise<AuthResult>;
  requestPasswordReset: (email: string, context: AuthFlowContext) => Promise<{ ok: boolean; message: string }>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<PasswordChangeResult>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  useEffect(() => { mockAuthService.restoreSession().then((restored) => { setUser(restored); setStatus(restored ? "authenticated" : "ready"); }); }, []);
  const login = useCallback(async (...args: Parameters<AuthContextValue["login"]>) => { const result = await mockAuthService.login(...args); if (result.ok) { setUser(result.user); setStatus("authenticated"); } return result; }, []);
  const registerCustomer = useCallback(async (...args: Parameters<AuthContextValue["registerCustomer"]>) => { const result = await mockAuthService.registerCustomer(...args); if (result.ok) { setUser(result.user); setStatus("authenticated"); } return result; }, []);
  const requestPasswordReset = useCallback((...args: Parameters<AuthContextValue["requestPasswordReset"]>) => mockAuthService.requestPasswordReset(...args), []);
  const changeAdminPassword = useCallback((currentPassword: string, newPassword: string) => user ? mockAuthService.changeAdminPassword(user.id, currentPassword, newPassword) : Promise.resolve({ ok: false as const, message: "Entre na sua conta para alterar a senha." }), [user]);
  const logout = useCallback(() => { mockAuthService.logout(); setUser(null); setStatus("ready"); }, []);
  const refresh = useCallback(async () => { const restored = await mockAuthService.restoreSession(); setUser(restored); setStatus(restored ? "authenticated" : "ready"); }, []);
  const value = useMemo(() => ({ user, status, login, registerCustomer, requestPasswordReset, changeAdminPassword, logout, refresh }), [user, status, login, registerCustomer, requestPasswordReset, changeAdminPassword, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
