"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GlassPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  align?: "start" | "end";
  panelClassName?: string;
}

export function GlassPopover({ trigger, children, label, align = "start", panelClassName }: GlassPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const updatePointerLight = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--glass-pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty("--glass-pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <div className="popover-root" ref={rootRef}>
      <button className="popover-trigger" type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>{trigger}</button>
      {open && <div className={cn("glass-popover", `popover-${align}`, panelClassName)} role="dialog" aria-label={label} onPointerMove={updatePointerLight} onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a[href]")) setOpen(false);
      }}>{children}</div>}
    </div>
  );
}
