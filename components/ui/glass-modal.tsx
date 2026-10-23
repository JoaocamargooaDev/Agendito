"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { GlassButton } from "./glass-button";

let modalScrollLocks = 0;
let bodyOverflowBeforeModal = "";

function lockPageScroll() {
  if (modalScrollLocks === 0) {
    bodyOverflowBeforeModal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  modalScrollLocks += 1;
}

function unlockPageScroll() {
  modalScrollLocks = Math.max(0, modalScrollLocks - 1);
  if (modalScrollLocks === 0) document.body.style.overflow = bodyOverflowBeforeModal;
}

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function GlassModal({ open, onClose, title, description, children, footer, size = "md", closeOnBackdrop = true, closeOnEscape = true }: GlassModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closingFromPropsRef = useRef(false);
  const scrollLockOwnedRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      lockPageScroll();
      scrollLockOwnedRef.current = true;
      dialog.showModal();
      requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>("[data-modal-autofocus]")?.focus();
      });
    } else if (!open && dialog.open) {
      closingFromPropsRef.current = true;
      dialog.close();
    }
  }, [open]);

  function handleNativeClose() {
    if (scrollLockOwnedRef.current) {
      scrollLockOwnedRef.current = false;
      unlockPageScroll();
    }
    if (openerRef.current?.isConnected) openerRef.current.focus();
    if (closingFromPropsRef.current) {
      closingFromPropsRef.current = false;
      return;
    }
    onClose();
  }

  useEffect(() => () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    if (scrollLockOwnedRef.current) {
      scrollLockOwnedRef.current = false;
      unlockPageScroll();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="glass-modal"
      data-size={size}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); if (closeOnEscape) onClose(); }}
      onClose={handleNativeClose}
      onClick={(event) => { if (closeOnBackdrop && event.target === dialogRef.current) onClose(); }}
    >
      <div className="modal-content">
        <header className="modal-header">
          <div><h2 id={titleId} tabIndex={-1} data-modal-autofocus>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
          <GlassButton size="icon" variant="quiet" onClick={onClose} aria-label="Fechar janela"><X size={18} /></GlassButton>
        </header>
        {children && <div className="modal-body">{children}</div>}
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
