import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassButton } from "./glass-button";
import { GlassInput } from "./glass-input";

export function DataTable({ children, className, tableClassName, ...props }: HTMLAttributes<HTMLDivElement> & { tableClassName?: string }) {
  return <div {...props} className={cn("data-table-scroll", className)}><table className={cn("data-table", tableClassName)}>{children}</table></div>;
}

export function TableHeader({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead {...props}>{children}</thead>; }
export function TableRow({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr {...props}>{children}</tr>; }
export function TableCell({ children, ...props }: HTMLAttributes<HTMLTableCellElement>) { return <td {...props}>{children}</td>; }
export function TableActions({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("data-table-actions", className)}>{children}</div>; }

export function FilterToolbar({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("filter-toolbar", className)}>{children}</div>; }

export function SearchField(props: Omit<ComponentProps<typeof GlassInput>, "leadingIcon">) {
  return <GlassInput {...props} leadingIcon={<Search size={16} aria-hidden="true" />} />;
}

export function Pagination({ current, total, onChange, className }: { current: number; total: number; onChange: (page: number) => void; className?: string }) {
  return <nav className={cn("list-pagination", className)} aria-label="Paginação">
    <span aria-live="polite">Página {current} de {total}</span>
    <div><GlassButton size="sm" variant="quiet" disabled={current <= 1} onClick={() => onChange(Math.max(1, current - 1))}>Anterior</GlassButton>
      <GlassButton size="sm" variant="quiet" disabled={current >= total} onClick={() => onChange(Math.min(total, current + 1))}>Próxima</GlassButton></div>
  </nav>;
}

export function StatusBadge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral"; className?: string }) {
  return <span className={cn("status-badge", `status-badge-${tone}`, className)}>{children}</span>;
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return <div className={cn("list-empty-state", className)} role="status"><strong>{title}</strong>{description && <p>{description}</p>}{action}</div>;
}
