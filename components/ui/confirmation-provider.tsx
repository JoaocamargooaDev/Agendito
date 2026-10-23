"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { GlassButton } from "./glass-button";
import { GlassModal } from "./glass-modal";

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};
type ConfirmationRequest = ConfirmationOptions & { resolve: (confirmed: boolean) => void };
type ConfirmationContextValue = (options: ConfirmationOptions) => Promise<boolean>;
const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ConfirmationRequest | null>(null);
  const queue = useRef<ConfirmationRequest[]>([]);

  const requestConfirmation = useCallback((options: ConfirmationOptions) => new Promise<boolean>((resolve) => {
    const request = { ...options, resolve };
    if (active) queue.current.push(request);
    else setActive(request);
  }), [active]);

  const finish = (confirmed: boolean) => {
    active?.resolve(confirmed);
    const next = queue.current.shift() ?? null;
    setActive(next);
  };

  return <ConfirmationContext.Provider value={requestConfirmation}>
    {children}
    <GlassModal open={Boolean(active)} onClose={() => finish(false)} title={active?.title ?? "Confirmar ação"} description={active?.description} size="sm" closeOnBackdrop={false} footer={<><GlassButton variant="secondary" onClick={() => finish(false)}>{active?.cancelLabel ?? "Cancelar"}</GlassButton><GlassButton variant={active?.destructive ? "destructive" : "primary"} onClick={() => finish(true)}>{active?.confirmLabel ?? "Confirmar"}</GlassButton></>} />
  </ConfirmationContext.Provider>;
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error("useConfirmation deve ser usado dentro de ConfirmationProvider.");
  return context;
}
