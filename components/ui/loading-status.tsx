import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LoadingStatus({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn("loading-status", className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      {...props}
    >
      <span className="loading-status-indicator" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
