import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const FrostedPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FrostedPanel(
  { className, ...props }, ref,
) {
  return <div ref={ref} className={cn("frosted-panel", "glass-material-frosted", className)} {...props} />;
});
