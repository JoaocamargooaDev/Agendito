"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleAlert, Clock3, Copy, Download, ExternalLink, Link2, Users, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageContainer, SectionHeader } from "@/components/admin";
import { ActionCard, ContentGrid, EmptyCard, GlassButton, GlassSurface, StatCard } from "@/components/ui";
import { profileForCustomer } from "@/features/customer/repository";
import { useAuth } from "@/features/auth";
import { listAllEstablishments } from "@/features/platform";
import { listEmployees } from "@/features/employees";
import { listServices } from "@/features/services";
import { formatShortDate, formatTime, getDashboardSnapshot } from "./selectors";
import { appointmentsToCsv, defaultDashboardFilters, getEstablishmentAnalytics, type DashboardFilters } from "./analytics";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { formatCurrency } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";

const statusLabels: Record<AppointmentStatus, string> = { SCHEDULED: "Agendado", CONFIRMED: "Confirmado", IN_PROGRESS: "Em atendimento", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };
const statusIcons: Record<AppointmentStatus, typeof Check> = { SCHEDULED: Clock3, CONFIRMED: Check, IN_PROGRESS: Clock3, COMPLETED: Check, CANCELLED: X, NO_SHOW: CircleAlert };

function greeting(now: Date, timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}
function StatusBadge({ status }: { status: AppointmentStatus }) {
  const Icon = statusIcons[status];
  return <span className={`status-badge status-${status.toLowerCase()}`}><Icon size={13} aria-hidden />{statusLabels[status]}</span>;
}
function Metric({ label, value, detail, tone = "quiet" }: { label: string; value: string; detail: string; tone?: "accent" | "quiet" | "warning" }) {
  return <StatCard className={`dashboard-metric metric-${tone}`} label={label} value={value} detail={detail} tone={tone === "quiet" ? "neutral" : tone} />;
}

export function AdminDashboard() {
  const { user, status } = useAuth();
  const establishment = listAllEstablishments().find((item) => item.id === user?.establishmentId);
  const timezone = establishment?.timezone ?? "America/Sao_Paulo";
  const [, setRevision] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters);
  useEffect(() => {
    const events = ["agendito:agenda-updated", "agendito:employees-updated", "agendito:services-updated", "agendito:settings-updated", "agendito:customer-profile-updated"];
    const refresh = () => setRevision((value) => value + 1);
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  const snapshot = useMemo(() => establishment ? getDashboardSnapshot(establishment.id, timezone) : null, [establishment, timezone]);
  const analytics = useMemo(() => establishment ? getEstablishmentAnalytics(establishment.id, timezone, filters) : null, [establishment, timezone, filters]);
  const employeeNames = useMemo(() => new Map(listEmployees(establishment?.id).map((employee) => [employee.id, employee.displayName])), [establishment]);

  if (status === "loading") return <AdminPageContainer><div className="dashboard-loading" aria-live="polite">Carregando visão geral…</div></AdminPageContainer>;
  if (!establishment || !snapshot || !analytics) return <AdminPageContainer><header className="admin-page-header"><span className="eyebrow">Visão geral</span><h1>Estabelecimento indisponível</h1><p>Não foi possível carregar os dados administrativos desta sessão.</p></header><EmptyCard className="dashboard-empty" icon={<CircleAlert size={20} />} title="Não foi possível carregar" description="Verifique a sessão e tente novamente." /></AdminPageContainer>;

  const customerName = (customerId: string) => profileForCustomer(customerId)?.user.name ?? "Cliente";
  const employeeName = (employeeId: string) => employeeNames.get(employeeId) ?? "Profissional";
  const publicPath = `/e/${establishment.slug}`;
  const copyPublicLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`); setCopyFeedback("Link copiado."); }
    catch { setCopyFeedback("Não foi possível copiar automaticamente. Selecione o endereço exibido."); }
  };
  const exportCsv = () => {
    const csv = appointmentsToCsv(analytics.appointments, { customer: customerName, employee: (id) => employeeName(id), establishment: () => establishment.name });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `agendito-${establishment.slug}-relatorio.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const employeeOptions = listEmployees(establishment.id).filter((item) => item.active).map((item) => ({ id: item.id, label: item.displayName }));
  const serviceOptions = listServices(establishment.id).filter((item) => item.active && item.status !== "ARCHIVED").map((item) => ({ id: item.id, label: item.name }));
  const trendMax = Math.max(1, ...analytics.trend.map((point) => point.appointments));

  return <AdminPageContainer>
    <section className="admin-page-header dashboard-welcome"><div><span className="eyebrow">{establishment.name || "Configuração inicial"}</span><h1>{`${greeting(snapshot.date.now, timezone)}, ${user?.name?.split(" ")[0] ?? "administrador"}.`}</h1><p>{formatShortDate(snapshot.date.now, timezone)} · {snapshot.metrics.total} agendamento{snapshot.metrics.total === 1 ? "" : "s"} hoje.</p></div><GlassButton asChild variant="primary"><Link href="/agenda">Abrir agenda <ArrowRight size={16} /></Link></GlassButton></section>

    {establishment.name.trim() && <GlassSurface material="regular" className="dashboard-public-link"><span className="dashboard-public-link-icon" aria-hidden><Link2 size={19} /></span><div className="dashboard-public-link-copy"><span className="eyebrow">Link público para clientes</span><strong>Compartilhe sua página de agendamento</strong><code>{publicPath}</code><p>Por este endereço o cliente conhece o estabelecimento e agenda um horário.</p>{copyFeedback && <span className="dashboard-link-feedback" role="status">{copyFeedback}</span>}</div><div className="dashboard-public-link-actions"><GlassButton variant="secondary" size="sm" onClick={copyPublicLink}><Copy size={15} />Copiar link</GlassButton><GlassButton asChild variant="quiet" size="sm"><Link href={publicPath} target="_blank" rel="noreferrer"><ExternalLink size={15} />Abrir página</Link></GlassButton></div></GlassSurface>}

    <DashboardFilterBar filters={filters} onChange={setFilters} employees={employeeOptions} services={serviceOptions} actions={<GlassButton variant="secondary" size="sm" onClick={exportCsv}><Download size={15} />Exportar CSV</GlassButton>} />

    <ContentGrid as="section" className="dashboard-metric-grid dashboard-analytics-metrics" aria-label="Indicadores do período selecionado">
      <Metric label="Agendamentos" value={String(analytics.metrics.total)} detail={`${analytics.range.startDate} a ${analytics.range.endDate}`} tone="accent" />
      <Metric label="Agendados" value={String(analytics.metrics.scheduled)} detail="Aguardando confirmação" />
      <Metric label="Confirmados" value={String(analytics.metrics.confirmed)} detail="Horários confirmados" />
      <Metric label="Em atendimento" value={String(analytics.metrics.inProgress)} detail="Atendimentos em andamento" />
      <Metric label="Concluídos" value={String(analytics.metrics.completed)} detail="Atendimentos realizados" />
      <Metric label="Cancelamentos" value={String(analytics.metrics.cancelled)} detail="Reservas canceladas" tone="warning" />
      <Metric label="Faltas" value={String(analytics.metrics.noShow)} detail="Não compareceram" tone="warning" />
      <Metric label="Receita prevista" value={formatCurrency(analytics.metrics.projectedRevenueInCents)} detail="Agendados, confirmados e em atendimento" tone="accent" />
      <Metric label="Receita recebida" value={formatCurrency(analytics.metrics.receivedRevenueInCents)} detail="Atendimentos concluídos" />
      <Metric label="Ocupação" value={analytics.occupancy.percent === null ? "—" : `${analytics.occupancy.percent}%`} detail={analytics.occupancy.availableMinutes ? `${Math.round(analytics.occupancy.bookedMinutes)} de ${Math.round(analytics.occupancy.availableMinutes)} min disponíveis` : "Sem expediente disponível no período"} />
    </ContentGrid>

    <ContentGrid as="section" className="dashboard-insights-grid" aria-label="Análise da operação">
      <GlassSurface material="frosted" className="dashboard-section analytics-trend-panel"><SectionHeader className="dashboard-section-header"><div><span className="eyebrow">Tendência por período</span><h2>Agendamentos e concluídos</h2></div><span className="dashboard-subtle">{analytics.appointments.length} registros</span></SectionHeader>
        {analytics.metrics.total ? <div className="analytics-trend" style={{ gridTemplateColumns: `repeat(${analytics.trend.length}, minmax(28px, 1fr))` }}>{analytics.trend.map((point) => <div className="analytics-trend-point" key={point.key} title={`${point.label}: ${point.appointments} agendamentos, ${point.completed} concluídos`}><strong>{point.appointments}</strong><span className="analytics-trend-track"><i style={{ height: `${point.appointments ? Math.max(8, point.appointments / trendMax * 100) : 0}%` }} /><i className="is-completed" style={{ height: `${point.completed ? Math.max(5, point.completed / trendMax * 100) : 0}%` }} /></span><small>{point.label}</small></div>)}</div> : <p className="dashboard-empty-copy">Sem agendamentos no período e filtros selecionados.</p>}
      </GlassSurface>
      <GlassSurface material="frosted" className="dashboard-section"><SectionHeader className="dashboard-section-header"><div><span className="eyebrow">Demanda</span><h2>Serviços mais procurados</h2></div></SectionHeader>{analytics.topServices.length ? <ol className="analytics-rank-list">{analytics.topServices.map((item) => <li key={item.id}><span>{item.name}</span><strong>{item.count}</strong></li>)}</ol> : <p className="dashboard-empty-copy">Sem serviços agendados no período.</p>}</GlassSurface>
      <GlassSurface material="frosted" className="dashboard-section"><SectionHeader className="dashboard-section-header"><div><span className="eyebrow">Equipe</span><h2>Profissionais mais agendados</h2></div></SectionHeader>{analytics.topEmployees.length ? <ol className="analytics-rank-list">{analytics.topEmployees.map(({ employee, count }) => <li key={employee.id}><span>{employee.displayName}</span><strong>{count}</strong></li>)}</ol> : <p className="dashboard-empty-copy">Sem atendimentos de profissionais ativos no período.</p>}<p className="analytics-note">Clientes recorrentes: <strong>{analytics.recurringCustomers}</strong> com dois ou mais atendimentos concluídos no período.</p></GlassSurface>
    </ContentGrid>

    <GlassSurface material="frosted" className="dashboard-section analytics-appointments"><SectionHeader className="dashboard-section-header"><div><span className="eyebrow">Registros</span><h2>Agendamentos do período</h2></div><span className="dashboard-subtle">{analytics.appointments.length} no filtro · exibindo até 8</span></SectionHeader>
      {analytics.appointments.length ? <div className="today-appointments" role="list">{analytics.appointments.slice(0, 8).map((appointment) => <article className={`today-appointment ${snapshot.nextAppointment?.id === appointment.id ? "is-next" : ""}`} key={appointment.id} role="listitem"><time className="appointment-time" dateTime={appointment.startsAt}>{formatTime(appointment.startsAt, timezone)}</time><div className="appointment-main"><strong>{customerName(appointment.customerId)}</strong><span>{appointment.serviceNameSnapshot} · {employeeName(appointment.employeeId)}</span><span className="appointment-meta">{formatShortDate(new Date(appointment.startsAt), timezone)} · {appointment.durationMinutesSnapshot} min · {formatCurrency(appointment.priceInCentsSnapshot)}</span></div><StatusBadge status={appointment.status} /></article>)}</div> : <div className="dashboard-empty-copy">Não há agendamentos que correspondam aos filtros.</div>}
    </GlassSurface>
    <ContentGrid className="dashboard-quick-actions"><ActionCard href="/agenda" icon={<CalendarDays size={18} />} title="Agenda" description="Consulte e organize os horários." /><ActionCard href="/customers" icon={<UserRound size={18} />} title="Clientes" description="Acesse o relacionamento com clientes." /><ActionCard href="/employees" icon={<Users size={18} />} title="Equipe" description="Gerencie profissionais e disponibilidade." /><ActionCard href="/services" icon={<Clock3 size={18} />} title="Serviços" description="Organize o catálogo de serviços." /></ContentGrid>
  </AdminPageContainer>;
}
