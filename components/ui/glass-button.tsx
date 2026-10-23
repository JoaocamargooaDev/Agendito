"use client";

import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type MouseEvent, type ReactElement } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "quiet" | "danger" | "destructive" | "ghost" | "icon-only";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  asChild?: boolean;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { className, variant = "secondary", size = "md", loading = false, asChild, children, disabled, ...props }, ref,
) {
  const normalizedVariant = variant === "danger" ? "destructive" : variant;
  const normalizedSize = variant === "icon-only" ? "icon" : size;
  const classes = cn("glass-button", `button-${normalizedVariant}`, `button-${normalizedSize}`, className);
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; "aria-disabled"?: boolean; tabIndex?: number; onClick?: (event: MouseEvent) => void }>;
    const childOnClick = child.props.onClick;
    return cloneElement(child, {
      className: cn(classes, child.props.className),
      "aria-disabled": disabled || loading,
      tabIndex: disabled || loading ? -1 : child.props.tabIndex,
      onClick: (event: MouseEvent) => {
        if (disabled || loading) { event.preventDefault(); event.stopPropagation(); return; }
        childOnClick?.(event);
      },
    });
  }
  return (
    <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <LoaderCircle className="button-spinner" size={16} aria-hidden />}
      {children}
    </button>
  );
});
