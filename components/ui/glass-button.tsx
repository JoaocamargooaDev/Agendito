"use client";

import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactElement } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  asChild?: boolean;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { className, variant = "secondary", size = "md", loading = false, asChild, children, disabled, ...props }, ref,
) {
  const classes = cn("glass-button", `button-${variant}`, `button-${size}`, className);
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; "aria-disabled"?: boolean }>;
    return cloneElement(child, { className: cn(classes, child.props.className), "aria-disabled": disabled || loading });
  }
  return (
    <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <LoaderCircle className="button-spinner" size={16} aria-hidden />}
      {children}
    </button>
  );
});
