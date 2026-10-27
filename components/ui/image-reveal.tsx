import type { ReactNode } from "react";

export function ImageReveal({
  className,
  children,
  delayMs = 0,
}: {
  className: string;
  children: ReactNode;
  delayMs?: number;
}) {
  return <figure className={className} data-content-reveal data-reveal-delay={delayMs}>{children}</figure>;
}
