"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

const HeaderActionsSetterContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);
const HeaderActionsContext = createContext<ReactNode>(null);

export function AdminHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  return <HeaderActionsSetterContext.Provider value={setActions}><HeaderActionsContext.Provider value={actions}>{children}</HeaderActionsContext.Provider></HeaderActionsSetterContext.Provider>;
}

export function AdminHeaderActionSlot({ children }: { children: ReactNode }) {
  const setActions = useContext(HeaderActionsSetterContext);
  useEffect(() => {
    if (!setActions) return;
    setActions(children);
    return () => setActions(null);
  }, [children, setActions]);
  return null;
}

export function useAdminHeaderActions() {
  return useContext(HeaderActionsContext);
}
