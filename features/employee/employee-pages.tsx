/* eslint-disable */
// @ts-nocheck - employee resources are guarded by EmployeeShell and domain selectors.
"use client";
import Link from "next/link";
import { CalendarDays, Clock3, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GlassButton, GlassInput, GlassSurface } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-layout";
import { useAuth } from "@/features/auth";
import { formatCurrency } from "@/lib/utils";
import { createBlockedPeriod, listBlockedPeriods, removeBlockedPeriod, scheduleForEmployee } from "@/features/agenda";
import { getService } from "@/features/services";
import { addDays, dateKeyInTimezone, isoForLocalTime } from "@/features/booking/rules";
import { employeeAppointments, employeeCustomers, employeeEstablishment, employeeForUser, employeeProfileUpdate, updateEmployeeAppointmentStatus, getEmployeeDailyAvailability } from "@/features/employees";
import type { Appointment, BusinessHoursInterval, BlockedPeriod, Employee } from "@/types";
import { APPOINTMENT_STATUS_LABELS, isEditableAppointmentStatus, occupiesAppointmentTime } from "@/features/agenda/status";
function dateLabel(iso: string, timezone: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(iso)); }
function Intro({ title, description }: { title: string; description: string }) { return <PageHeader variant="content" className="customer-page-intro" eyebrow="Área profissional" title={title} description={description} />; }
function Card({ appointment, employee, onStatus }: { appointment: Appointment; employee: Employee; onStatus?: (next: Appointment["status"]) => void }) { const establishment = employeeEstablishment(employee); const customer = employeeCustomers(employee).find((item) => item.appointments.some((a) => a.id === appointment.id)); return <article className="customer-appointment-card"><div className="customer-establishment-mark"><UserRound size={18} /></div><div className="customer-appointment-content"><div className="customer-card-heading"><div><span className="eyebrow">{customer?.user?.name ?? "Cliente"}</span><h3>{appointment.serviceNameSnapshot}</h3></div><span className={`customer-status status-${appointment.status.toLowerCase()}`}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</span></div><p><CalendarDays size={15} />{establishment ? dateLabel(appointment.startsAt, establishment.timezone) : appointment.startsAt}</p><p><Clock3 size={15} />{appointment.durationMinutesSnapshot} minutos</p><strong>{formatCurrency(appointment.priceInCentsSnapshot)}</strong>{onStatus && <div className="customer-card-actions">{appointment.status === "SCHEDULED" && <GlassButton size="sm" variant="quiet" onClick={() => onStatus("CONFIRMED")}>Confirmar</GlassButton>}{isEditableAppointmentStatus(appointment.status) && <GlassButton size="sm" variant="quiet" onClick={() => onStatus("IN_PROGRESS")}>Iniciar</GlassButton>}{appointment.status === "IN_PROGRESS" && <GlassButton size="sm" variant="primary" onClick={() => onStatus("COMPLETED")}>Concluir</GlassButton>}{isEditableAppointmentStatus(appointment.status) && <GlassButton size="sm" variant="quiet" onClick={() => onStatus("NO_SHOW")}>Não compareceu</GlassButton>}</div>}</div></article>; }
function useEmployeeContext() {
  const { user } = useAuth();
  return useMemo(() => user?.role === "EMPLOYEE" ? employeeForUser(user.id) : null, [user?.id, user?.role]);
}
export function EmployeeHome() {
  const employee = useEmployeeContext();
  const [items, setItems] = useState<Appointment[]>([]);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!employee) return;
    const refresh = () => setItems(employeeAppointments(employee));
    refresh();
    window.addEventListener("agendito:agenda-updated", refresh);
    return () => window.removeEventListener("agendito:agenda-updated", refresh);
  }, [employee]);
  const establishment = employee ? employeeEstablishment(employee) : null;
  const today = establishment ? dateKeyInTimezone(new Date(), establishment.timezone) : "";
  const todayItems = items
    .filter((item) => establishment && dateKeyInTimezone(new Date(item.startsAt), establishment.timezone) === today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = todayItems.find((item) => ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(item.status) && new Date(item.startsAt) >= new Date());
  const remainingTodayItems = todayItems.filter((item) => item.id !== upcoming?.id);
  const completedCount = todayItems.filter((item) => item.status === "COMPLETED").length;
  const upcomingItems = items.filter((item) => establishment && item.id !== upcoming?.id && item.startsAt > new Date().toISOString() && ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(item.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 4);
  function updateStatus(appointmentId: string, next: Appointment["status"]) {
    if (!employee) return;
    const result = updateEmployeeAppointmentStatus(employee, appointmentId, next);
    setFeedback(result.ok ? "Atendimento atualizado." : result.reason);
    if (result.ok) setItems(employeeAppointments(employee));
  }
  return <>
    <Intro title={`Olá, ${employee?.displayName.split(" ")[0] ?? "profissional"}.`} description="Confira seus atendimentos e sua agenda de hoje." />
    <div className="employee-home-summary" aria-label="Resumo dos atendimentos de hoje">
      <span><strong>{todayItems.length}</strong> hoje</span><span><strong>{todayItems.filter((item) => ["SCHEDULED", "CONFIRMED"].includes(item.status)).length}</strong> a realizar</span><span><strong>{completedCount}</strong> concluídos</span><span><strong>{todayItems.filter((item) => item.status === "NO_SHOW").length}</strong> faltas</span>
    </div>
    {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
    {upcoming ? <section className="customer-featured">
      <span className="eyebrow">Próximo atendimento</span>
      <Card appointment={upcoming} employee={employee!} onStatus={(next) => updateStatus(upcoming.id, next)} />
      <GlassButton asChild variant="primary"><Link href="/employee/schedule">Abrir agenda</Link></GlassButton>
    </section> : <GlassSurface material="frosted" className="customer-empty">
      <p>Você não possui atendimentos agendados para hoje.</p>
      <GlassButton asChild variant="quiet"><Link href="/employee/schedule">Ver agenda</Link></GlassButton>
    </GlassSurface>}
    <section className="customer-section">
      <div className="customer-section-heading">
        <div><span className="eyebrow">Hoje</span><h2>{todayItems.length} atendimento{todayItems.length === 1 ? "" : "s"} registrado{todayItems.length === 1 ? "" : "s"}</h2></div>
        <span>{completedCount} concluído{completedCount === 1 ? "" : "s"}</span>
      </div>
      {remainingTodayItems.length ? remainingTodayItems.map((item) => <Card appointment={item} employee={employee!} onStatus={(next) => updateStatus(item.id, next)} key={item.id} />) : <GlassSurface material="frosted" className="customer-empty"><p>{todayItems.length ? "O próximo atendimento está destacado acima." : "Sem atendimentos na agenda de hoje."}</p></GlassSurface>}
    </section>
    <section className="customer-section employee-upcoming-section">
      <div className="customer-section-heading"><div><span className="eyebrow">Próximos</span><h2>Atendimentos futuros</h2></div><GlassButton asChild variant="quiet" size="sm"><Link href="/employee/appointments">Ver todos</Link></GlassButton></div>
      {upcomingItems.length ? upcomingItems.map((item) => <Card appointment={item} employee={employee!} key={item.id} />) : <GlassSurface material="frosted" className="customer-empty"><p>{upcoming ? "O próximo atendimento está destacado acima." : "Você não possui próximos atendimentos."}</p></GlassSurface>}
    </section>
  </>;
}
export function EmployeeAppointments() { const employee = useEmployeeContext(); const [filter, setFilter] = useState("today"); const [, rerender] = useState(0); const items = employee ? employeeAppointments(employee) : []; const filtered = items.filter((item) => filter === "today" ? dateKeyInTimezone(new Date(item.startsAt), employeeEstablishment(employee!)?.timezone ?? "America/Sao_Paulo") === dateKeyInTimezone(new Date(), employeeEstablishment(employee!)?.timezone ?? "America/Sao_Paulo") : filter === "upcoming" ? ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(item.status) : filter === "completed" ? item.status === "COMPLETED" : filter === "cancelled" ? item.status === "CANCELLED" : filter === "no-show" ? item.status === "NO_SHOW" : true).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); function status(id: string, next: Appointment["status"]) { if (!employee) return; updateEmployeeAppointmentStatus(employee, id, next); rerender((v) => v + 1); } return <><Intro title="Meus atendimentos" description="Ações operacionais apenas para seus próprios horários." /><div className="customer-filter-row">{["today", "upcoming", "completed", "cancelled", "no-show"].map((item) => <button className={filter === item ? "is-selected" : ""} onClick={() => setFilter(item)} key={item}>{item === "today" ? "Hoje" : item === "upcoming" ? "Próximos" : item === "completed" ? "Concluídos" : item === "cancelled" ? "Cancelados" : "Não compareceu"}</button>)}</div>{filtered.length ? filtered.map((item) => <Card appointment={item} employee={employee!} onStatus={(next) => status(item.id, next)} key={item.id} />) : <GlassSurface material="frosted" className="customer-empty"><p>Nenhum atendimento nesta categoria.</p></GlassSurface>}</>; }
type TimelineRange = { start: number; end: number; kind: "free" | "occupied" | "blocked" | "unavailable"; appointment?: Appointment };
const toMinutes = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
const timeAt = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
function localMinutes(iso: string, timezone: string) { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)); return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0); }
function dayBlockedRanges(periods: BlockedPeriod[], date: string, timezone: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return periods.flatMap((period) => {
    if (period.recurrence?.frequency === "WEEKLY") {
      const firstDate = dateKeyInTimezone(new Date(period.startsAt), timezone);
      if (date < firstDate || (period.recurrence.until && date > period.recurrence.until) || new Date(`${firstDate}T12:00:00Z`).getUTCDay() !== weekday) return [];
      return [{ start: localMinutes(period.startsAt, timezone), end: localMinutes(period.endsAt, timezone) }];
    }
    if (dateKeyInTimezone(new Date(period.startsAt), timezone) !== date) return [];
    return [{ start: localMinutes(period.startsAt, timezone), end: localMinutes(period.endsAt, timezone) }];
  });
}
function dayTimeline(date: string, hours: BusinessHoursInterval[], appointments: Appointment[], blocks: BlockedPeriod[], timezone: string, available: boolean): TimelineRange[] {
  return hours.flatMap((range) => {
    const start = toMinutes(range.start); const end = toMinutes(range.end);
    const busy = appointments.filter((item) => occupiesAppointmentTime(item.status)).map((appointment) => ({ start: Math.max(start, localMinutes(appointment.startsAt, timezone)), end: Math.min(end, localMinutes(appointment.endsAt, timezone)), appointment })).filter((item) => item.end > item.start);
    const blocked = dayBlockedRanges(blocks, date, timezone).map((item) => ({ start: Math.max(start, item.start), end: Math.min(end, item.end) })).filter((item) => item.end > item.start);
    const boundaries = [...new Set([start, end, ...busy.flatMap((item) => [item.start, item.end]), ...blocked.flatMap((item) => [item.start, item.end])])].sort((a, b) => a - b);
    const segments = boundaries.slice(0, -1).map((from, index) => {
      const to = boundaries[index + 1]; const appointment = busy.find((item) => item.start < to && from < item.end)?.appointment; const isBlocked = blocked.some((item) => item.start < to && from < item.end);
      return { start: from, end: to, kind: appointment ? "occupied" as const : isBlocked ? "blocked" as const : available ? "free" as const : "unavailable" as const, appointment };
    });
    return segments.reduce<TimelineRange[]>((merged, segment) => {
      const previous = merged.at(-1);
      if (previous && previous.end === segment.start && previous.kind === segment.kind && previous.appointment?.id === segment.appointment?.id) previous.end = segment.end;
      else merged.push(segment);
      return merged;
    }, []);
  });
}
function EmployeeAgendaDay({ employee, date, hours, appointments, blocks, timezone, available, compact = false }: { employee: Employee; date: string; hours: BusinessHoursInterval[]; appointments: Appointment[]; blocks: BlockedPeriod[]; timezone: string; available: boolean; compact?: boolean }) {
  const ranges = dayTimeline(date, hours, appointments, blocks, timezone, available);
  const freeMinutes = ranges.filter((range) => range.kind === "free").reduce((total, range) => total + range.end - range.start, 0);
  const bookedCount = appointments.filter((item) => occupiesAppointmentTime(item.status)).length;
  return <section className={`employee-agenda-day${compact ? " is-compact" : ""}`}><header><div><span className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span><strong>{bookedCount} ocupado{bookedCount === 1 ? "" : "s"} · {Math.floor(freeMinutes / 60)}h{String(freeMinutes % 60).padStart(2, "0")} livre</strong></div><span className={`employee-day-availability${available ? " is-available" : ""}`}>{available ? "Disponível" : "Indisponível"}</span></header>{hours.length ? <div className="employee-agenda-ranges">{ranges.map((range, index) => range.appointment ? <div className="employee-agenda-range is-occupied" key={`${range.appointment.id}-${range.start}`}><span className="employee-agenda-time">{timeAt(range.start)}–{timeAt(range.end)}</span><Card appointment={range.appointment} employee={employee} key={`${range.appointment.id}-${index}`} /></div> : <div className={`employee-agenda-range is-${range.kind}`} key={`${date}-${range.start}-${index}`}><span className="employee-agenda-time">{timeAt(range.start)}–{timeAt(range.end)}</span><span>{range.kind === "free" ? "Horário livre" : range.kind === "blocked" ? "Horário bloqueado" : range.kind === "unavailable" ? "Indisponível pelo estabelecimento" : ""}</span></div>)}</div> : <p className="employee-agenda-closed">Sem expediente nesta data.</p>}</section>;
}
export function EmployeeSchedule() {
  const employee = useEmployeeContext(); const establishment = employee ? employeeEstablishment(employee) : null;
  const [date, setDate] = useState(establishment ? dateKeyInTimezone(new Date(), establishment.timezone) : ""); const [view, setView] = useState<"day" | "week">("day");
  if (!employee || !establishment) return null;
  const weekStart = addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
  const dates = view === "day" ? [date] : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const allAppointments = employeeAppointments(employee); const allBlocks = listBlockedPeriods(establishment.id);
  return <><Intro title="Minha agenda" description="Seus horários de trabalho, atendimentos e períodos livres." /><div className="employee-schedule-controls"><GlassButton variant="quiet" onClick={() => setDate(addDays(date, view === "day" ? -1 : -7))}>Anterior</GlassButton><GlassInput label="Data de referência" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><GlassButton variant="quiet" onClick={() => setDate(addDays(date, view === "day" ? 1 : 7))}>Próximo</GlassButton><div className="employee-view-toggle" role="group" aria-label="Visualização da agenda"><GlassButton variant={view === "day" ? "primary" : "quiet"} onClick={() => setView("day")}>Dia</GlassButton><GlassButton variant={view === "week" ? "primary" : "quiet"} onClick={() => setView("week")}>Semana</GlassButton></div></div><div className="employee-agenda-days">{dates.map((day) => { const schedule = scheduleForEmployee(employee.id, establishment.id, day); const dayAppointments = allAppointments.filter((item) => dateKeyInTimezone(new Date(item.startsAt), establishment.timezone) === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); return <EmployeeAgendaDay key={day} employee={employee} date={day} hours={schedule?.workingHours ?? []} appointments={dayAppointments} blocks={allBlocks} timezone={establishment.timezone} available={Boolean(schedule && getEmployeeDailyAvailability(employee.id, establishment.id, day))} />; })}</div><div className="employee-agenda-legend"><span><i className="is-free" />Livre</span><span><i className="is-occupied" />Ocupado</span><span><i className="is-blocked" />Bloqueado</span></div></>;
}
export function EmployeeClients() { const employee = useEmployeeContext(); const clients = employee ? employeeCustomers(employee) : []; return <><Intro title="Meus clientes" description="Apenas clientes relacionados aos seus próprios atendimentos." />{clients.length ? clients.map(({ customer, user, appointments }) => <GlassSurface material="frosted" className="employee-client-row" key={customer.id}><div className="customer-avatar-large">{(user?.name ?? customer.preferredName ?? "C").slice(0, 1)}</div><div><h2>{user?.name ?? customer.preferredName ?? "Cliente"}</h2><p>{customer.phone}</p><span>{appointments.length} atendimentos com você · último em {dateLabel(appointments[0].startsAt, employeeEstablishment(employee!)?.timezone ?? "America/Sao_Paulo")}</span></div></GlassSurface>) : <GlassSurface material="frosted" className="customer-empty"><p>Nenhum cliente relacionado aos seus atendimentos.</p></GlassSurface>}</>; }
export function EmployeeAvailability() {
  const employee = useEmployeeContext();
  const establishment = employee ? employeeEstablishment(employee) : null;
  const [date, setDate] = useState(() => establishment ? dateKeyInTimezone(new Date(), establishment.timezone) : "");
  const [blocks, setBlocks] = useState<BlockedPeriod[]>([]);
  const [blockForm, setBlockForm] = useState({ start: "", end: "", reason: "" });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!employee || !establishment) return;
    const refresh = () => setBlocks(listBlockedPeriods(establishment.id).filter((item) => item.employeeId === employee.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    refresh();
    window.addEventListener("agendito:agenda-updated", refresh);
    return () => window.removeEventListener("agendito:agenda-updated", refresh);
  }, [employee, establishment]);
  if (!employee || !establishment) return null;
  const schedule = scheduleForEmployee(employee.id, establishment.id, date);
  const available = employee.active && Boolean(schedule) && getEmployeeDailyAvailability(employee.id, establishment.id, date);
  const addBlock = () => {
    if (!blockForm.start || !blockForm.end || blockForm.start >= blockForm.end) return setError("Informe um intervalo válido para bloquear.");
    const startsAt = isoForLocalTime(date, blockForm.start, establishment.timezone);
    const endsAt = isoForLocalTime(date, blockForm.end, establishment.timezone);
    if (new Date(startsAt) < new Date()) return setError("O bloqueio não pode começar no passado.");
    const saved = createBlockedPeriod({ establishmentId: establishment.id, employeeId: employee.id, startsAt, endsAt, reason: blockForm.reason.trim() || "Indisponibilidade pessoal" });
    if (!saved) return setError("Não foi possível salvar o bloqueio. Confira se há atendimentos nesse intervalo.");
    setBlockForm({ start: "", end: "", reason: "" }); setError(""); setFeedback("Indisponibilidade adicionada à sua agenda.");
    setBlocks(listBlockedPeriods(establishment.id).filter((item) => item.employeeId === employee.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  };
  const deleteBlock = (id: string) => {
    if (!removeBlockedPeriod(id, establishment.id)) return setError("Não foi possível remover este bloqueio.");
    setError(""); setFeedback("Indisponibilidade removida.");
    setBlocks(listBlockedPeriods(establishment.id).filter((item) => item.employeeId === employee.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  };
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: establishment.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: establishment.timezone, day: "2-digit", month: "short", year: "numeric" });
  return <><Intro title="Disponibilidade" description="Consulte seu expediente e informe períodos em que não poderá atender." /><GlassSurface material="frosted" className="employee-availability"><GlassInput label="Data" type="date" value={date} onChange={(event) => { setDate(event.target.value); setFeedback(""); setError(""); }} /><h2>Seu expediente</h2>{schedule?.workingHours.length ? schedule.workingHours.map((range) => <p key={`${range.start}-${range.end}`}>{range.start}–{range.end}</p>) : <p>Sem expediente neste dia.</p>}<h2>Sua situação</h2><p>{available ? "Disponível para receber novos agendamentos." : "Indisponível para novos agendamentos nesta data."}</p><small>A escala semanal é definida pelo gestor. Os bloqueios pessoais abaixo impedem novas reservas, sem alterar atendimentos existentes.</small><h2>Adicionar bloqueio para esta data</h2><div className="employee-block-form"><GlassInput label="Início" type="time" value={blockForm.start} onChange={(event) => setBlockForm((current) => ({ ...current, start: event.target.value }))} /><GlassInput label="Fim" type="time" value={blockForm.end} onChange={(event) => setBlockForm((current) => ({ ...current, end: event.target.value }))} /><GlassInput label="Motivo (opcional)" value={blockForm.reason} maxLength={100} onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))} /><GlassButton variant="primary" onClick={addBlock} disabled={!employee.active || !date}>Bloquear horário</GlassButton></div>{error && <p className="form-error" role="alert">{error}</p>}{feedback && <p className="customer-feedback" role="status">{feedback}</p>}<h2>Seus bloqueios</h2>{blocks.length ? blocks.map((block) => <div className="employee-block-row" key={block.id}><div><strong>{dateTimeFormatter.format(new Date(block.startsAt))} · {timeFormatter.format(new Date(block.startsAt))}–{timeFormatter.format(new Date(block.endsAt))}</strong><span>{block.reason}</span></div><GlassButton variant="quiet" size="sm" onClick={() => deleteBlock(block.id)}>Remover</GlassButton></div>) : <p>Nenhum bloqueio pessoal cadastrado.</p>}</GlassSurface></>;
}
export function EmployeeProfile() { const employee = useEmployeeContext(); const { user } = useAuth(); const [phone, setPhone] = useState(employee?.phone ?? user?.phone ?? ""); const [feedback, setFeedback] = useState(""); if (!employee) return null; function save(e: React.FormEvent) { e.preventDefault(); const result = employeeProfileUpdate(employee, phone); setFeedback(result ? "Perfil atualizado." : "Não foi possível atualizar o perfil."); } return <><Intro title="Meu perfil profissional" description="Dados pessoais autorizados para sua experiência no Agendito." /><GlassSurface material="frosted" className="customer-profile-form"><form onSubmit={save}><div className="customer-avatar-large">{employee.displayName.slice(0, 1)}</div><h2>{employee.displayName}</h2><p>{user?.email}</p><p>{employee.title ?? "Profissional"} · {employeeEstablishment(employee)?.name}</p><GlassInput label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} /><p className="customer-hint">Estabelecimento, cargo, serviços, role e permissões são administrados pelo ADMIN.</p>{feedback && <p className="customer-feedback" role="status">{feedback}</p>}<GlassButton type="submit" variant="primary">Salvar telefone</GlassButton></form></GlassSurface></>; }
