"use client";

import { ChevronLeft, ChevronRight, Clock3, Filter, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSegmentedControl, GlassSurface } from "@/components/ui";
import { getRelatedCustomers } from "@/features/customers/selectors";
import { profileForCustomer } from "@/features/customer/repository";
import { useAuth } from "@/features/auth";
import { listAllEstablishments } from "@/features/platform";
import { dateKeyInTimezone, formatTime } from "@/features/dashboard/selectors";
import { formatCurrency } from "@/lib/utils";
import { createAppointment, getAvailableSlots, listAppointments, listBlockedPeriods, updateAppointment, updateAppointmentStatus, validateSlot } from "./index";
import { listEmployees } from "@/features/employees";
import { listServices } from "@/features/services";
import type { Appointment, AppointmentStatus } from "@/types";

const statusLabels: Record<AppointmentStatus, string> = { SCHEDULED: "Agendado", CONFIRMED: "Confirmado", IN_PROGRESS: "Em atendimento", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };
const transitions: Record<AppointmentStatus, AppointmentStatus[]> = { SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "NO_SHOW"], CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"], IN_PROGRESS: ["COMPLETED"], COMPLETED: [], CANCELLED: [], NO_SHOW: [] };
const timelineStart = 8 * 60;
const pixelsPerMinute = 1.35;
const dayMinutes = 12 * 60;

function addDays(key: string, days: number) { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function startWeek(key: string) { const day = new Date(`${key}T12:00:00Z`).getUTCDay(); return addDays(key, day === 0 ? -6 : 1 - day); }
function dateLabel(key: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) { return new Intl.DateTimeFormat("pt-BR", options).format(new Date(`${key}T12:00:00Z`)); }
function toIso(date: string, time: string, timezone: string) { const offset = timezone === "America/Sao_Paulo" ? "-03:00" : "Z"; return new Date(`${date}T${time}:00${offset}`).toISOString(); }
function customerName(id: string) { return profileForCustomer(id)?.user.name ?? "Cliente"; }
function employeeName(id: string) { return listEmployees().find((item) => item.id === id)?.displayName ?? "Profissional"; }
function statusClass(status: AppointmentStatus) { return `status-badge status-${status.toLowerCase()}`; }
function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) { return <span className={statusClass(status)}>{statusLabels[status]}</span>; }

function Timeline({ dateKey, timezone, establishmentId, selectedEmployeeId, data, onSelect }: { dateKey: string; timezone: string; establishmentId: string; selectedEmployeeId: string; data: Appointment[]; onSelect: (appointment: Appointment) => void }) {
  const visibleEmployees = listEmployees(establishmentId).filter((item) => item.active && (!selectedEmployeeId || item.id === selectedEmployeeId));
  const dayBlocks = listBlockedPeriods().filter((item) => item.establishmentId === establishmentId && new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(item.startsAt)) === dateKey);
  const hours = Array.from({ length: 13 }, (_, index) => 8 + index);
  const dayItems = data.filter((item) => dateKeyInTimezone(new Date(item.startsAt), timezone) === dateKey);
 return <div className="agenda-timeline" style={{ "--agenda-height": `${dayMinutes * pixelsPerMinute}px` } as React.CSSProperties}><div className="agenda-axis"><div className="agenda-axis-spacer" />{hours.map((hour) => <div className="agenda-axis-label" key={hour}>{String(hour).padStart(2, "0")}:00</div>)}</div><div className="agenda-columns">{visibleEmployees.length === 0 ? <div className="agenda-empty">Nenhum profissional disponível para este filtro.</div> : visibleEmployees.map((employee) => <div className="agenda-column" key={employee.id}><div className="agenda-column-header"><span className="avatar-fallback" aria-hidden>{employee.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><strong>{employee.displayName}</strong></div><div className="agenda-grid" role="list" aria-label={`Agenda de ${employee.displayName}`}>{hours.slice(0, -1).map((hour) => <div className="agenda-grid-line" style={{ top: `${(hour * 60 - timelineStart) * pixelsPerMinute}px` }} key={hour} />)}{dayBlocks.filter((block) => !block.employeeId || block.employeeId === employee.id).map((block) => { const start = new Date(block.startsAt); const end = new Date(block.endsAt); const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(start).split(":"); const startMinutes = Number(parts[0]) * 60 + Number(parts[1]); const duration = Math.max(20, (end.getTime() - start.getTime()) / 60000); return <div className="agenda-blocked" key={block.id} style={{ top: `${(startMinutes - timelineStart) * pixelsPerMinute}px`, height: `${duration * pixelsPerMinute}px` }} aria-label={`Bloqueio: ${block.reason}`}>Bloqueado · {block.reason}</div>; })}{dayItems.filter((item) => item.employeeId === employee.id).map((item) => { const start = new Date(item.startsAt); const end = new Date(item.endsAt); const startMinutes = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(start).split(":")[0]) * 60 + Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(start).split(":")[1]); const duration = Math.max(20, (end.getTime() - start.getTime()) / 60000); const top = (startMinutes - timelineStart) * pixelsPerMinute; return <button type="button" role="listitem" className={`agenda-event event-${item.status.toLowerCase()}`} style={{ top: `${top}px`, height: `${duration * pixelsPerMinute}px` }} onClick={() => onSelect(item)} aria-label={`${customerName(item.customerId)}, ${item.serviceNameSnapshot}, ${formatTime(item.startsAt, timezone)}, ${statusLabels[item.status]}`} key={item.id}><time>{formatTime(item.startsAt, timezone)}</time><strong>{customerName(item.customerId)}</strong><span>{item.serviceNameSnapshot}</span><small>{statusLabels[item.status]}</small></button>; })}</div></div>)}</div></div>;
}

function WeekView({ dateKey, timezone, selectedEmployeeId, data, onSelect, onSelectDay }: { dateKey: string; timezone: string; selectedEmployeeId: string; data: Appointment[]; onSelect: (appointment: Appointment) => void; onSelectDay: (key: string) => void }) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(startWeek(dateKey), index));
  return <div className="agenda-week-grid">{week.map((key) => { const items = data.filter((item) => dateKeyInTimezone(new Date(item.startsAt), timezone) === key && (!selectedEmployeeId || item.employeeId === selectedEmployeeId)); return <button type="button" className={`agenda-week-day ${key === dateKey ? "is-selected" : ""}`} key={key} onClick={() => onSelectDay(key)}><span>{dateLabel(key, { weekday: "short" })}</span><strong>{dateLabel(key, { day: "numeric", month: "short" })}</strong>{items.length ? <div>{items.slice(0, 4).map((item) => <span className="week-event" key={item.id} onClick={(event) => { event.stopPropagation(); onSelect(item); }}><b>{formatTime(item.startsAt, timezone)}</b>{customerName(item.customerId)}<small>{employeeName(item.employeeId)}</small></span>)}{items.length > 4 && <small>+{items.length - 4} atendimentos</small>}</div> : <em>Nenhum atendimento</em>}</button>; })}</div>;
}

export function AgendaPage() {
  const { user, status } = useAuth();
  const establishment = listAllEstablishments().find((item) => item.id === user?.establishmentId);
  const timezone = establishment?.timezone ?? "America/Sao_Paulo";
  const today = dateKeyInTimezone(new Date(), timezone);
  const [dateKey, setDateKey] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");
  const [employeeId, setEmployeeId] = useState("");
  const [data, setData] = useState<Appointment[]>(() => listAppointments());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({ customerId: "", serviceId: listServices(user?.establishmentId)[0]?.id ?? "", employeeId: "", date: today, time: "09:00", notes: "" });
  const refresh = useCallback(() => setData(listAppointments()), []);
  useEffect(() => { const handler = () => refresh(); window.addEventListener("agendito:agenda-updated", handler); return () => window.removeEventListener("agendito:agenda-updated", handler); }, [refresh]);
  const establishmentEmployees = useMemo(() => listEmployees(establishment?.id).filter((item) => item.active), [establishment?.id]);
  const establishmentServices = useMemo(() => listServices(establishment?.id).filter((item) => item.active), [establishment?.id]);
  const relatedCustomers = useMemo(() => establishment ? getRelatedCustomers(establishment.id) : [], [establishment]);
  const formService = establishmentServices.find((item) => item.id === form.serviceId) ?? establishmentServices[0];
  const compatibleEmployees = establishmentEmployees.filter((item) => formService?.id && item.serviceIds.includes(formService.id));
  const availableSlots = useMemo(() => formService && form.employeeId && establishment ? getAvailableSlots({ establishmentId: establishment.id, employeeId: form.employeeId, service: formService, dateKey: form.date, timezone, appointments: data, blockedPeriods: listBlockedPeriods() }) : [], [data, establishment, form.date, form.employeeId, formService, timezone]);
  const currentItems = data.filter((item) => item.establishmentId === establishment?.id && dateKeyInTimezone(new Date(item.startsAt), timezone) === dateKey);

  const openCreate = () => { setEditing(null); setForm({ customerId: relatedCustomers[0]?.id ?? "", serviceId: establishmentServices[0]?.id ?? "", employeeId: establishmentEmployees[0]?.id ?? "", date: dateKey, time: "09:00", notes: "" }); setFeedback(""); setEditorOpen(true); };
  const openEdit = (appointment: Appointment) => { setEditing(appointment); setForm({ customerId: appointment.customerId, serviceId: appointment.serviceId, employeeId: appointment.employeeId, date: dateKeyInTimezone(new Date(appointment.startsAt), timezone), time: formatTime(appointment.startsAt, timezone), notes: appointment.notes ?? "" }); setFeedback(""); setSelected(null); setEditorOpen(true); };
  const save = () => { if (!establishment || !formService) return; if (!form.customerId) return setFeedback("Selecione um cliente relacionado a este estabelecimento."); const startIso = toIso(form.date, form.time, timezone); const endIso = new Date(new Date(startIso).getTime() + formService.durationMinutes * 60000).toISOString(); const result = validateSlot({ establishmentId: establishment.id, employeeId: form.employeeId, service: formService, dateKey: form.date, timezone, appointments: data, blockedPeriods: listBlockedPeriods() }, startIso, endIso, editing?.id); if (!result.ok) { setFeedback(result.reason ?? "Horário indisponível."); return; } const payload = { customerId: form.customerId, serviceId: formService.id, employeeId: form.employeeId, startsAt: startIso, endsAt: endIso, serviceNameSnapshot: formService.name, durationMinutesSnapshot: formService.durationMinutes, priceInCentsSnapshot: formService.priceInCents, notes: form.notes || undefined }; const saved = editing ? updateAppointment(editing.id, payload) : createAppointment({ id: `apt-${Date.now()}`, establishmentId: establishment.id, status: "SCHEDULED", createdAt: new Date().toISOString(), ...payload }); if (!saved) { setFeedback("Não foi possível salvar a alteração local."); return; } setEditorOpen(false); refresh(); setDateKey(form.date); };
  const changeStatus = (next: AppointmentStatus) => { if (!selected || !transitions[selected.status].includes(next)) return; updateAppointmentStatus(selected.id, next); setSelected(null); refresh(); };

  if (status === "loading") return <AdminPageContainer><div className="dashboard-loading">Carregando agenda…</div></AdminPageContainer>;
  if (!establishment) return <AdminPageContainer><AdminPageHeader title="Agenda" description="Estabelecimento indisponível." /><GlassSurface material="frosted" className="dashboard-empty">Não foi possível carregar o estabelecimento atual.</GlassSurface></AdminPageContainer>;
  return <AdminPageContainer><AdminPageHeader eyebrow={establishment.name} title="Agenda" description={`${dateLabel(dateKey)} · horários, profissionais e atendimentos em um só lugar.`} />
    <GlassButton className="agenda-create-button" variant="primary" onClick={openCreate}><Plus size={16} />Novo agendamento</GlassButton>
    <GlassSurface material="frosted" className="agenda-toolbar">
      <div className="agenda-date-controls">
        <GlassButton variant="quiet" size="icon" onClick={() => setDateKey(addDays(dateKey, view === "week" ? -7 : -1))} aria-label={view === "week" ? "Semana anterior" : "Data anterior"}><ChevronLeft size={18} /></GlassButton>
        <GlassInput label="Data" type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} />
        <GlassButton variant="quiet" size="icon" onClick={() => setDateKey(addDays(dateKey, view === "week" ? 7 : 1))} aria-label={view === "week" ? "Próxima semana" : "Próxima data"}><ChevronRight size={18} /></GlassButton>
      </div>
      <div className="agenda-toolbar-controls">
        <GlassSelect label="Profissional" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} options={[{ value: "", label: "Todos os profissionais" }, ...establishmentEmployees.map((item) => ({ value: item.id, label: item.displayName }))]} />
        <GlassSegmentedControl label="Visualização" value={view} onChange={(value) => setView(value as "day" | "week")} options={[{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }]} />
      </div>
    </GlassSurface>
    {feedback && <div className="agenda-feedback" role="alert"><X size={16} />{feedback}</div>}
    {view === "day" ? <GlassSurface material="frosted" className="agenda-panel"><div className="agenda-panel-header"><div><span className="eyebrow">Visão diária</span><h2>{dateLabel(dateKey)}</h2></div><span className="dashboard-subtle">{currentItems.length} atendimento{currentItems.length === 1 ? "" : "s"}</span></div><Timeline dateKey={dateKey} timezone={timezone} establishmentId={establishment.id} selectedEmployeeId={employeeId} data={data} onSelect={setSelected} /></GlassSurface> : <GlassSurface material="frosted" className="agenda-panel"><div className="agenda-panel-header"><div><span className="eyebrow">Visão semanal</span><h2>Semana de {dateLabel(startWeek(dateKey), { day: "numeric", month: "long" })}</h2></div><Filter size={18} aria-hidden /></div><WeekView dateKey={dateKey} timezone={timezone} selectedEmployeeId={employeeId} data={data} onSelect={setSelected} onSelectDay={(key) => { setDateKey(key); setView("day"); }} /></GlassSurface>}
    <GlassModal open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalhes do agendamento" description={selected ? `${dateLabel(dateKey)} · ${formatTime(selected.startsAt, timezone)}` : undefined} footer={selected && <><GlassButton variant="quiet" onClick={() => openEdit(selected)}>Editar</GlassButton>{transitions[selected.status].map((next) => <GlassButton key={next} variant={next === "CANCELLED" ? "danger" : "primary"} onClick={() => changeStatus(next)}>{statusLabels[next]}</GlassButton>)}</>}>
      {selected && <div className="agenda-details"><div><span className="token-label">Cliente</span><strong>{customerName(selected.customerId)}</strong></div><div><span className="token-label">Serviço</span><strong>{selected.serviceNameSnapshot}</strong></div><div><span className="token-label">Profissional</span><strong>{employeeName(selected.employeeId)}</strong></div><div><span className="token-label">Horário</span><strong>{formatTime(selected.startsAt, timezone)}–{formatTime(selected.endsAt, timezone)} · {selected.durationMinutesSnapshot} min</strong></div><div><span className="token-label">Valor histórico</span><strong>{formatCurrency(selected.priceInCentsSnapshot)}</strong></div><div><span className="token-label">Status</span><AppointmentStatusBadge status={selected.status} /></div>{selected.notes && <div><span className="token-label">Observações</span><p>{selected.notes}</p></div>}</div>}
    </GlassModal>
    <GlassModal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? "Editar agendamento" : "Novo agendamento"} description="O horário será validado contra expediente, bloqueios e conflitos." footer={<><GlassButton variant="quiet" onClick={() => setEditorOpen(false)}>Cancelar</GlassButton><GlassButton variant="primary" onClick={save}>{editing ? "Salvar alterações" : "Criar agendamento"}</GlassButton></>}>
      <div className="agenda-form"><GlassSelect label="Cliente" value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} options={relatedCustomers.map((customer) => ({ value: customer.id, label: customerName(customer.id) }))} /><GlassSelect label="Serviço" value={form.serviceId} onChange={(event) => setForm((current) => ({ ...current, serviceId: event.target.value, employeeId: "" }))} options={establishmentServices.map((service) => ({ value: service.id, label: `${service.name} · ${service.durationMinutes} min · ${formatCurrency(service.priceInCents)}` }))} /><GlassSelect label="Profissional" value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} options={compatibleEmployees.map((employee) => ({ value: employee.id, label: employee.displayName }))} /><GlassInput label="Data" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /><GlassSelect label="Horário disponível" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} options={availableSlots.length ? availableSlots.map((slot) => ({ value: slot.start, label: `${slot.start}–${slot.end}` })) : [{ value: form.time, label: "Nenhum horário disponível" }]} /><GlassInput label="Observações" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Opcional" />{formService && <div className="agenda-form-summary"><Clock3 size={16} />{formService.durationMinutes} minutos · {formatCurrency(formService.priceInCents)} registrados como preço histórico</div>}{feedback && <p className="field-message">{feedback}</p>}</div>
    </GlassModal>
  </AdminPageContainer>;
}
