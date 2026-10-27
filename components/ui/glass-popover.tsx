"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const [rendered, setRendered] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const closeTimerRef = useRef<number | null>(null);

  const positionPanel = useCallback(() => {
    const triggerElement = triggerRef.current;
    const panel = panelRef.current;
    if (!triggerElement || !panel) return;
    const triggerBounds = triggerElement.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(
      align === "end" ? triggerBounds.right - panelBounds.width : triggerBounds.left,
      window.innerWidth - panelBounds.width - margin,
    ));
    const below = triggerBounds.bottom + margin;
    const top = below + panelBounds.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, triggerBounds.top - panelBounds.height - margin);
    setPosition({ position: "fixed", left, top, right: "auto", bottom: "auto" });
  }, [align]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const openPanel = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setRendered(true);
    setOpen(true);
  };

  useEffect(() => {
    if (open || !rendered) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setRendered(false);
    }, 180);
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    };
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      positionPanel();
      panelRef.current?.querySelector<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex='0']")?.focus({ preventScroll: true });
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab" && panelRef.current) {
        const elements = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']"));
        if (!elements.length) { event.preventDefault(); panelRef.current.focus(); return; }
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, positionPanel, close]);

  const updatePointerLight = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--glass-pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty("--glass-pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };

  return <>
    <div className="popover-root" ref={rootRef}>
      <button ref={triggerRef} className="popover-trigger" type="button" aria-expanded={open} aria-haspopup="dialog" aria-controls={rendered ? panelId : undefined} onClick={() => open ? close() : openPanel()}>{trigger}</button>
    </div>
    {rendered && typeof document !== "undefined" && createPortal(
      <div
        ref={panelRef}
        id={panelId}
        className={cn("glass-popover", "glass-popover-portal", `popover-${align}`, panelClassName)}
        data-state={open ? "open" : "closing"}
        role="dialog"
        aria-label={label}
        aria-modal="false"
        tabIndex={-1}
        aria-hidden={!open}
        inert={!open}
        style={position}
        onPointerMove={updatePointerLight}
        onClickCapture={(event) => { if ((event.target as HTMLElement).closest("a[href]")) close(false); }}
      >{children}</div>,
      document.body,
    )}
  </>;
}
