"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleAlert, Clock3, Copy, ExternalLink, Link2, Users, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin";
import { GlassButton, GlassSurface } from "@/components/ui";
import { profileForCustomer } from "@/features/customer/repository";
import { useAuth } from "@/features/auth";
import { listAllEstablishments } from "@/features/platform";
import { formatShortDate, formatTime, getDashboardSnapshot } from "./selectors";
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
  return <div className={`dashboard-metric metric-${tone}`}><span className="token-label">{label}</span><strong>{value}</strong><span>{detail}</span></div>;
}

export function AdminDashboard() {
  const { user, status } = useAuth();
  const establishment = listAllEstablishments().find((item) => item.id === user?.establishmentId);
  const timezone = establishment?.timezone ?? "America/Sao_Paulo";
  const [revision, setRevision] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState("");
  useEffect(() => { const handler = () => setRevision((value) => value + 1); window.addEventListener("agendito:agenda-updated", handler); return () => window.removeEventListener("agendito:agenda-updated", handler); }, []);
  const snapshot = useMemo(() => { if (revision < 0) return null; return establishment ? getDashboardSnapshot(establishment.id, timezone) : null; }, [establishment, timezone, revision]);
  const employeeNames = useMemo(() => new Map(snapshot?.staffToday.map(({ employee }) => [employee.id, employee.displayName]) ?? []), [snapshot]);

  if (status === "loading") return <AdminPageContainer><div className="dashboard-loading" aria-live="polite">Carregando visão geral…</div></AdminPageContainer>;
  if (!establishment || !snapshot) return <AdminPageContainer><AdminPageHeader eyebrow="Visão geral" title="Estabelecimento indisponível" description="Não foi possível carregar os dados administrativos desta sessão." /><GlassSurface material="frosted" className="dashboard-empty">Verifique a sessão e tente novamente.</GlassSurface></AdminPageContainer>;

  const customerName = (customerId: string) => profileForCustomer(customerId)?.user.name ?? "Cliente";
  const employeeName = (employeeId: string) => employeeNames.get(employeeId) ?? "Profissional";
  const maxWeekly = Math.max(...snapshot.weekly.map((day) => day.total), 1);
  const publicPath = `/e/${establishment.slug}`;
  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      setCopyFeedback("Link copiado. Agora você pode enviá-lo ao cliente.");
    } catch {
      setCopyFeedback("Não foi possível copiar automaticamente. Selecione o endereço exibido.");
    }
  };

  return <AdminPageContainer>
    <section className="admin-page-header dashboard-welcome"><div><span className="eyebrow">{establishment.name || "Configuração inicial"}</span><h1>{`${greeting(snapshot.date.now, timezone)}, ${user?.name?.split(" ")[0] ?? "administrador"}.`}</h1><p>{establishment.name ? `${formatShortDate(snapshot.date.now, timezone)} · ${snapshot.metrics.total} agendamento${snapshot.metrics.total === 1 ? "" : "s"} registrado${snapshot.metrics.total === 1 ? "" : "s"} hoje.` : "Comece cadastrando as informações reais do seu estabelecimento."}</p></div><GlassButton asChild variant="primary"><Link href={establishment.name ? "/agenda" : "/settings"}>{establishment.name ? "Abrir agenda" : "Configurar estabelecimento"} <ArrowRight size={16} /></Link></GlassButton></section>

    {establishment.name.trim() && <GlassSurface material="regular" className="dashboard-public-link">
      <span className="dashboard-public-link-icon" aria-hidden><Link2 size={19} /></span>
      <div className="dashboard-public-link-copy">
        <span className="eyebrow">Link público para clientes</span>
        <strong>Compartilhe sua página de agendamento</strong>
        <code>{publicPath}</code>
        <p>Por este endereço o cliente conhece o estabelecimento, cria sua conta e agenda um horário.</p>
        {copyFeedback && <span className="dashboard-link-feedback" role="status">{copyFeedback}</span>}
      </div>
      <div className="dashboard-public-link-actions">
        <GlassButton variant="secondary" size="sm" onClick={copyPublicLink}><Copy size={15} />Copiar link</GlassButton>
        <GlassButton asChild variant="quiet" size="sm"><Link href={publicPath} target="_blank" rel="noreferrer"><ExternalLink size={15} />Abrir página</Link></GlassButton>
      </div>
    </GlassSurface>}

    <section className="dashboard-metric-grid" aria-label="Indicadores de hoje">
      <Metric label="Hoje" value={String(snapshot.metrics.total)} detail="agendamentos registrados" tone="accent" />
      <Metric label="Pendentes" value={String(snapshot.metrics.pending)} detail="agendados ou confirmados" />
      <Metric label="Concluídos" value={String(snapshot.metrics.completed)} detail={formatCurrency(snapshot.metrics.completedValueInCents) + " em serviços realizados"} />
      <Metric label="Em atendimento" value={String(snapshot.metrics.inProgress)} detail="atendimentos em andamento" />
      <Metric label="Cancelamentos" value={String(snapshot.metrics.cancelled)} detail="não entram nos valores ativos" tone="warning" />
      <Metric label="Valor previsto" value={formatCurrency(snapshot.metrics.projectedValueInCents)} detail="agendamentos ativos de hoje" tone="accent" />
    </section>

    <div className="dashboard-grid">
      <section className="dashboard-primary">
        <GlassSurface material="frosted" className="dashboard-section">
          <div className="dashboard-section-header"><div><span className="eyebrow">Operação de hoje</span><h2>Agenda do dia</h2></div><span className="dashboard-subtle">{snapshot.todayAppointments.length} registros</span></div>
          {snapshot.todayAppointments.length === 0 ? <div className="dashboard-empty"><p>Nenhum agendamento para hoje.</p><GlassButton asChild variant="ghost" size="sm"><Link href="/agenda">Ver agenda <ArrowRight size={14} /></Link></GlassButton></div> : <div className="today-appointments" role="list">{snapshot.todayAppointments.map((appointment) => <article className={`today-appointment ${snapshot.nextAppointment?.id === appointment.id ? "is-next" : ""}`} key={appointment.id} role="listitem"><time className="appointment-time" dateTime={appointment.startsAt}>{formatTime(appointment.startsAt, timezone)}</time><div className="appointment-main"><strong>{customerName(appointment.customerId)}</strong><span>{appointment.serviceNameSnapshot} · {employeeName(appointment.employeeId)}</span><span className="appointment-meta">{appointment.durationMinutesSnapshot} min · {formatCurrency(appointment.priceInCentsSnapshot)}</span></div><StatusBadge status={appointment.status} /></article>)}</div>}
        </GlassSurface>
        <GlassSurface material="frosted" className="dashboard-section"><div className="dashboard-section-header"><div><span className="eyebrow">Ritmo da semana</span><h2>Resumo semanal</h2></div><span className="dashboard-subtle">agendamentos não cancelados</span></div><div className="weekly-chart" aria-label="Agendamentos por dia">{snapshot.weekly.map((day) => <div className="weekly-column" key={day.dateKey}><span className="weekly-value">{day.total}</span><div className="weekly-bar-track"><div className="weekly-bar" style={{ height: `${Math.max(day.total / maxWeekly * 100, day.total ? 12 : 0)}%` }} /></div><span>{day.label}</span></div>)}</div><ul className="sr-only">{snapshot.weekly.map((day) => <li key={day.dateKey}>{day.label}: {day.total} agendamentos, {day.completed} concluídos, {day.cancelled} cancelados e {day.noShow} faltas.</li>)}</ul></GlassSurface>
        <section className="dashboard-section quick-actions-section"><div className="dashboard-section-header"><div><span className="eyebrow">Atalhos</span><h2>Ações rápidas</h2></div></div><div className="quick-actions"><GlassButton asChild variant="secondary"><Link href="/agenda"><CalendarDays size={16} />Agenda</Link></GlassButton><GlassButton asChild variant="secondary"><Link href="/customers"><UserRound size={16} />Clientes</Link></GlassButton><GlassButton asChild variant="secondary"><Link href="/employees"><Users size={16} />Equipe</Link></GlassButton><GlassButton asChild variant="secondary"><Link href="/services"><Clock3 size={16} />Serviços</Link></GlassButton></div></section>
      </section>
      <aside className="dashboard-rail">
        <GlassSurface material="thick" className="next-appointment"><span className="eyebrow">Próximo atendimento</span>{snapshot.nextAppointment ? <><time dateTime={snapshot.nextAppointment.startsAt}>{formatTime(snapshot.nextAppointment.startsAt, timezone)}</time><h2>{customerName(snapshot.nextAppointment.customerId)}</h2><p>{snapshot.nextAppointment.serviceNameSnapshot} com {employeeName(snapshot.nextAppointment.employeeId)}</p><StatusBadge status={snapshot.nextAppointment.status} /></> : <p className="dashboard-empty-copy">Nenhum atendimento previsto para o restante do dia.</p>}</GlassSurface>
        <GlassSurface material="frosted" className="dashboard-section"><div className="dashboard-section-header"><div><span className="eyebrow">Equipe</span><h2>Profissionais do dia</h2></div><Users size={18} aria-hidden /></div>{snapshot.staffToday.length ? <div className="staff-list">{snapshot.staffToday.map(({ employee, schedule, appointmentCount, completedCount, blocked }) => <div className="staff-row" key={employee.id}><span className="avatar-fallback" aria-hidden>{employee.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>{employee.displayName}</strong><span>{schedule?.workingHours.map((range) => `${range.start}–${range.end}`).join(" · ")}</span></div><small>{blocked ? "Bloqueado" : `${completedCount}/${appointmentCount} concluídos`}</small></div>)}</div> : <div className="dashboard-empty-copy">Nenhum profissional com expediente hoje.</div>}</GlassSurface>
        <GlassSurface material="frosted" className="dashboard-section"><div className="dashboard-section-header"><div><span className="eyebrow">Leituras rápidas</span><h2>Operação</h2></div><CircleAlert size={18} aria-hidden /></div><ul className="insight-list"><li><b>Serviço mais agendado</b><span>{snapshot.topService ? `${snapshot.topService.name} · ${snapshot.topService.count} registros` : "Sem dados suficientes"}</span></li><li><b>Dia mais movimentado</b><span>{snapshot.busiestDay ? `${snapshot.busiestDay.label} · ${snapshot.busiestDay.count} registros` : "Sem movimentação"}</span></li><li><b>Clientes relacionados</b><span>{snapshot.relatedCustomerCount} no período</span></li></ul></GlassSurface>
      </aside>
    </div>
  </AdminPageContainer>;
}
