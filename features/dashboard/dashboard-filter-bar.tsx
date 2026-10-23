"use client";

import type { ReactNode } from "react";
import type { AppointmentStatus } from "@/types";
import { appointmentStatusLabel, statusFilterOptions, type DashboardFilters } from "./analytics";

interface FilterOption { id: string; label: string }
interface DashboardFilterBarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  employees?: FilterOption[];
  services?: FilterOption[];
  actions?: ReactNode;
}

export function DashboardFilterBar({ filters, onChange, employees = [], services = [], actions }: DashboardFilterBarProps) {
  const update = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch });
  const statuses: Array<["all" | AppointmentStatus, string]> = [["all", "Todos os status"], ...statusFilterOptions().map((status) => [status, appointmentStatusLabel(status)] as [AppointmentStatus, string])];
  return <section className="dashboard-filter-bar" aria-label="Filtros do relatório">
    <label><span>Período</span><select value={filters.period} onChange={(event) => update({ period: event.target.value as DashboardFilters["period"] })}><option value="today">Hoje</option><option value="week">Semana</option><option value="month">Mês</option><option value="custom">Personalizado</option></select></label>
    {filters.period === "custom" && <>
      <label><span>De</span><input type="date" value={filters.startDate} onChange={(event) => update({ startDate: event.target.value })} /></label>
      <label><span>Até</span><input type="date" value={filters.endDate} onChange={(event) => update({ endDate: event.target.value })} /></label>
    </>}
    <label><span>Profissional</span><select value={filters.employeeId} onChange={(event) => update({ employeeId: event.target.value })}><option value="all">Todos</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label><span>Serviço</span><select value={filters.serviceId} onChange={(event) => update({ serviceId: event.target.value })}><option value="all">Todos</option>{services.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label><span>Status</span><select value={filters.status} onChange={(event) => update({ status: event.target.value as DashboardFilters["status"] })}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {actions && <div className="dashboard-filter-actions">{actions}</div>}
  </section>;
}
