"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { GlassButton } from "./glass-button";

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function GlassModal({ open, onClose, title, description, children, footer }: GlassModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => dialog.querySelector<HTMLElement>("[data-modal-autofocus]")?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="glass-modal" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
          <GlassButton data-modal-autofocus size="icon" variant="quiet" onClick={onClose} aria-label="Fechar modal"><X size={18} /></GlassButton>
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </dialog>
  );
}
