import type { HTMLAttributes, ReactNode } from "react";

type PageShellProps = HTMLAttributes<HTMLElement> & {
  as?: "main" | "div";
  children: ReactNode;
};

export function PageShell({ as = "div", className = "", children, ...props }: PageShellProps) {
  const Element = as;
  return <Element className={`page-shell ${className}`.trim()} {...props}><PageContent>{children}</PageContent></Element>;
}

export function PageContent({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`page-content ${className}`.trim()} {...props}>{children}</div>;
}

export function PageSection({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`page-section ${className}`.trim()} {...props}>{children}</section>;
}

export function SectionHeader({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`section-header ${className}`.trim()} {...props}>{children}</div>;
}

type PageHeaderProps = {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  breadcrumbs?: ReactNode;
  leading?: ReactNode;
  pageActions?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  className?: string;
  compact?: boolean;
  variant?: "admin" | "content";
};

export function PageHeader({ title, eyebrow, description, breadcrumbs, leading, pageActions, actions, actionsClassName, className = "", compact = false, variant = "admin" }: PageHeaderProps) {
  if (variant === "content") return <header className={`page-header ${className}`.trim()}>
    <div className="page-header-content">
      {breadcrumbs && <nav className="page-header-breadcrumbs" aria-label="Navegação estrutural">{breadcrumbs}</nav>}
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className={actionsClassName ?? "page-header-actions"}>{actions}</div>}
  </header>;

  return <header className={`page-header${compact ? " admin-header-compact" : ""} ${className}`.trim()}>
    <div className="admin-header-title page-header-main">
      {leading}
      <div>
        {breadcrumbs && <nav className="page-header-breadcrumbs" aria-label="Navegação estrutural">{breadcrumbs}</nav>}
        {eyebrow && <span className="header-context">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p className="page-header-description">{description}</p>}
      </div>
    </div>
    {pageActions && <div className="admin-header-page-actions">{pageActions}</div>}
    {actions && <div className={actionsClassName ?? "admin-header-actions"}>{actions}</div>}
  </header>;
}
