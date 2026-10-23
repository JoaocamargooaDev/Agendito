import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { GlassSurface, type GlassSurfaceProps } from "./glass-surface";
import { cn } from "@/lib/utils";

export function SurfaceCard({ className, ...props }: GlassSurfaceProps) {
  return <GlassSurface {...props} className={className} />;
}

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "success";
  className?: string;
};

export function StatCard({ label, value, detail, icon, tone = "neutral", className }: StatCardProps) {
  return <SurfaceCard className={cn("stat-card", `stat-card-${tone}`, className)}>
    <span className="stat-card-label">{label}</span>
    <strong className="stat-card-value">{value}</strong>
    {detail && <span className="stat-card-detail">{detail}</span>}
    {icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}
  </SurfaceCard>;
}

type ActionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  href?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  className?: string;
  children?: ReactNode;
};

export function ActionCard({ title, description, icon, href, onClick, className, children }: ActionCardProps) {
  const content = <><span className="action-card-icon" aria-hidden="true">{icon}</span><span className="action-card-copy"><strong className="card-title">{title}</strong>{description && <span className="text-secondary">{description}</span>}{children}</span></>;
  const classes = cn("action-card", className);
  if (href) return <Link href={href} className={classes}>{content}</Link>;
  if (onClick) return <button type="button" className={classes} onClick={onClick}>{content}</button>;
  return <article className={classes}>{content}</article>;
}

type EmptyCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyCard({ title, description, icon, action, className }: EmptyCardProps) {
  return <SurfaceCard className={cn("empty-card", className)}>
    {icon && <span className="empty-card-icon" aria-hidden="true">{icon}</span>}
    <div className="empty-card-copy"><strong className="card-title">{title}</strong>{description && <p className="text-secondary">{description}</p>}</div>
    {action && <div className="empty-card-action">{action}</div>}
  </SurfaceCard>;
}

export function ContentGrid({ as = "div", className, ...props }: HTMLAttributes<HTMLDivElement> & { as?: "div" | "section" }) {
  const Element = as;
  return <Element {...props} className={cn("content-grid", className)} />;
}
