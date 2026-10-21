import type { ReactNode } from "react";

export function GlassTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="tooltip-root" tabIndex={0}>{children}<span className="glass-tooltip" role="tooltip">{label}</span></span>;
}
