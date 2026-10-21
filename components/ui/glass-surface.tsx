import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  material?: "clear" | "regular" | "thick" | "frosted" | "floating" | "interactive";
  depth?: "flat" | "raised" | "floating";
  tone?: "light" | "dark" | "neutral";
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassSurface(
  { className, material = "regular", depth = "flat", tone = "neutral", ...props }, ref,
) {
  return <div ref={ref} className={cn("glass-surface", "liquid-glass__surface", "liquid-glass__refractive", `glass-material-${material}`, `glass-${depth}`, `glass-${tone}`, className)} {...props} />;
});
