"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type MobileNavigationDrawerProps = {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
};

export function MobileNavigationDrawer({ open, label, onClose, children }: MobileNavigationDrawerProps) {
  const [rendered, setRendered] = useState(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (open || !rendered) return;
    const timer = window.setTimeout(() => setRendered(false), 180);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open || !rendered) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled]), [tabindex='0']")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex='0']"));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, rendered]);

  if (!rendered) return null;
  return <div className="mobile-sidebar-backdrop" data-state={open ? "open" : "closing"} aria-hidden={!open} inert={!open} onPointerDown={(event) => { if (open && event.target === event.currentTarget) onCloseRef.current(); }}>
    <div ref={dialogRef} className="mobile-sidebar-drawer" role="dialog" aria-modal="true" aria-label={label} aria-hidden={!open} inert={!open} tabIndex={-1}>
      {children}
    </div>
  </div>;
}
