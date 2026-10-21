import type { ReactNode } from "react";
import { GlassButton, type GlassButtonProps } from "./glass-button";
import { GlassModal, type GlassModalProps } from "./glass-modal";
import { GlassNavigation, type GlassNavigationProps } from "./glass-navigation";
import { GlassSurface, type GlassSurfaceProps } from "./glass-surface";

/** Shared surface material with opt-in Liquid Glass intensity and tone variants. */
export function LiquidGlassSurface(props: GlassSurfaceProps) {
  return <GlassSurface {...props} />;
}

/** A raised material for content cards that need more separation than a panel. */
export function LiquidGlassCard({ children, className, ...props }: GlassSurfaceProps & { children?: ReactNode }) {
  return <GlassSurface {...props} material={props.material ?? "floating"} depth={props.depth ?? "raised"} className={className ? `liquid-glass__card ${className}` : "liquid-glass__card"}>{children}</GlassSurface>;
}

/** Backwards-compatible interactive control with loading and variant support. */
export function LiquidGlassButton(props: GlassButtonProps) {
  return <GlassButton {...props} />;
}

export function LiquidGlassNavigation(props: GlassNavigationProps) {
  return <GlassNavigation {...props} />;
}

export function LiquidGlassModal(props: GlassModalProps) {
  return <GlassModal {...props} />;
}
