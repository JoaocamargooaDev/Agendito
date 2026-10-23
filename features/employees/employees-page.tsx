"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CalendarOff, Check, ImagePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, useConfirmation } from "@/components/ui";
import { isActiveAppointmentStatus, listAppointments } from "@/features/agenda";
import { useAuth } from "@/features/auth";
import { hashPlatformPassword, isAccountEmailAvailable, listAllEstablishments, listAllUsers, savePlatformUser, type StoredPlatformUser } from "@/features/platform";
import { listServices } from "@/features/services";
import { addDays, isoForLocalTime } from "@/features/booking/rules";
import { listEmployees, listSchedules, createEmployee, createEmployeeBlock, activateEmployee, deactivateEmployeeWithFuturePolicy, futureEmployeeAppointments, employeeBlockedPeriods, removeEmployeeBlock, updateEmployee, updateEmployeeSchedule } from "./index";
import type { BlockedPeriod, Employee, Service, TimeRange } from "@/types";
import { formatCurrency } from "@/lib/utils";

const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const emptySchedule = () => Object.fromEntries(days.map((_, index) => [index, [] as TimeRange[]])) as Record<number, TimeRange[]>;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Avatar({ employee }: { employee: Employee }) { return employee.photoUrl ? <span className="employee-avatar" role="img" aria-label={`Foto de ${employee.displayName}`} style={{ backgroundImage: `url(${employee.photoUrl})` }} /> : <span className="employee-avatar avatar-fallback" aria-hidden>{employee.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>; }

function EmployeeServicePicker({ services, selectedIds, onChange }: { services: Service[]; selectedIds: string[]; onChange: (serviceIds: string[]) => void }) {
  return (
    <fieldset className="employee-service-picker">
      <legend className="field-label">Serviços realizados</legend>
      {services.length ? (
        <>
          <p className="employee-service-hint">Selecione todos os serviços que este profissional realiza.</p>
          <div className="employee-service-options">
            {services.map((service) => {
              const checked = selectedIds.includes(service.id);
              return (
                <label key={service.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked ? [...selectedIds, service.id] : selectedIds.filter((id) => id !== service.id))}
                  />
                  <span><strong>{service.name}</strong><small>{service.durationMinutes} min</small></span>
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <div className="employee-services-empty">
          <div>
            <strong>Nenhum serviço ativo cadastrado.</strong>
            <p>Você pode salvar o funcionário agora e associar os serviços depois.</p>
          </div>
          <GlassButton asChild variant="quiet" size="sm"><Link href="/services">Cadastrar serviço</Link></GlassButton>
        </div>
      )}
    </fieldset>
  );
}

function blockedPeriodLabel(period: BlockedPeriod, timezone: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone });
  const recurring = period.recurrence?.frequency === "WEEKLY" ? " · repetição semanal" : "";
  return `${formatter.format(new Date(period.startsAt))} até ${formatter.format(new Date(period.endsAt))}${recurring}`;
}

function EmployeeAvailabilityManager({ employee, timezone }: { employee: Employee; timezone: string }) {
  const [blocks, setBlocks] = useState(() => employeeBlockedPeriods(employee).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  const [form, setForm] = useState({ date: "", start: "09:00", end: "18:00", reason: "", fullDay: true, weekly: false, until: "" });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const refresh = () => setBlocks(employeeBlockedPeriods(employee).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));

  function saveBlock() {
    setFeedback("");
    setError("");
    if (!form.date) return setError("Escolha a data da ausência.");
    if (!form.reason.trim()) return setError("Informe o motivo interno da indisponibilidade.");
    if (form.weekly && form.until && form.until < form.date) return setError("A data final da recorrência deve ser igual ou posterior ao início.");
    const startsAt = isoForLocalTime(form.date, form.fullDay ? "00:00" : form.start, timezone);
    const endsAt = form.fullDay
      ? isoForLocalTime(addDays(form.date, 1), "00:00", timezone)
      : isoForLocalTime(form.date, form.end, timezone);
    const result = createEmployeeBlock(employee, { startsAt, endsAt, reason: form.reason.trim(), recurrence: form.weekly ? { frequency: "WEEKLY", until: form.until || undefined } : undefined });
    if (!result.ok) return setError(result.reason);
    refresh();
    setForm({ date: "", start: "09:00", end: "18:00", reason: "", fullDay: true, weekly: false, until: "" });
    setFeedback("Indisponibilidade registrada. Esses horários não aparecerão para o cliente.");
  }

  function removeBlock(id: string) {
    setFeedback("");
    setError("");
    const result = removeEmployeeBlock(employee, id);
    if (!result.ok) return setError(result.reason);
    refresh();
    setFeedback("Indisponibilidade removida e horários liberados novamente.");
  }

  return <GlassSurface material="frosted" className="employee-detail-section employee-availability-manager">
    <div className="employee-availability-heading">
      <div><span className="eyebrow">Agenda do profissional</span><h2>Ausências e indisponibilidades</h2></div>
      <CalendarOff size={20} aria-hidden />
    </div>
    <p className="employee-availability-note">O cliente verá somente que o horário está indisponível. O motivo informado abaixo permanece interno no sistema.</p>
    <div className="employee-absence-form">
      <GlassInput label="Data" type="date" min={today} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
      <label className="employee-full-day"><input type="checkbox" checked={form.fullDay} onChange={(event) => setForm((current) => ({ ...current, fullDay: event.target.checked }))} /><span>Profissional indisponível durante todo o dia</span></label>
      {!form.fullDay && <><GlassInput label="Horário inicial" type="time" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /><GlassInput label="Horário final" type="time" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></>}
      <label className="employee-full-day"><input type="checkbox" checked={form.weekly} onChange={(event) => setForm((current) => ({ ...current, weekly: event.target.checked }))} /><span>Repetir semanalmente</span></label>
      {form.weekly && <GlassInput label="Repetir até (opcional)" type="date" min={form.date} value={form.until} onChange={(event) => setForm((current) => ({ ...current, until: event.target.value }))} hint="Deixe vazio para manter sem data final." />}
      <GlassInput label="Motivo interno" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ex.: folga, consulta médica ou férias" />
      <GlassButton variant="primary" onClick={saveBlock}><CalendarOff size={15} />Bloquear período</GlassButton>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
    <div className="employee-absence-list">
      <h3>Períodos cadastrados</h3>
      {blocks.length ? blocks.map((period) => <article key={period.id} className="employee-absence-row"><div><strong>{period.reason}</strong><span>{blockedPeriodLabel(period, timezone)}</span></div><GlassButton variant="quiet" size="icon" onClick={() => removeBlock(period.id)} aria-label={`Remover indisponibilidade: ${period.reason}`}><Trash2 size={15} /></GlassButton></article>) : <p>Nenhuma indisponibilidade individual cadastrada.</p>}
    </div>
  </GlassSurface>;
}

export function EmployeesPage({ detailId }: { detailId?: string }) {
  const confirm = useConfirmation();
  const { user, status } = useAuth();
  const establishment = listAllEstablishments().find((item) => item.id === user?.establishmentId);
  const [items, setItems] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", title: "Profissional", bio: "", commission: "0", photoUrl: "", serviceIds: [] as string[], active: true, password: "" });
  const [schedule, setSchedule] = useState<Record<number, TimeRange[]>>(emptySchedule);
  const [pendingDeactivation, setPendingDeactivation] = useState<Employee | null>(null);
  const [deactivationChoice, setDeactivationChoice] = useState<"KEEP_HISTORY" | "TRANSFER" | "CANCEL_FUTURE">("KEEP_HISTORY");
  const [transferTarget, setTransferTarget] = useState("");
  const establishmentId = user?.establishmentId;
  const refresh = () => setItems(establishmentId ? listEmployees(establishmentId) : []);
  useEffect(() => { const update = () => setItems(establishmentId ? listEmployees(establishmentId) : []); const timer = window.setTimeout(update, 0); window.addEventListener("agendito:employees-updated", update); window.addEventListener("agendito:services-updated", update); return () => { window.clearTimeout(timer); window.removeEventListener("agendito:employees-updated", update); window.removeEventListener("agendito:services-updated", update); }; }, [establishmentId]);
  const detailEmployee = detailId ? items.find((item) => item.id === detailId) ?? null : null;
  const filtered = useMemo(() => { const normalized = normalize(query); return items.filter((employee) => { const matchesFilter = filter === "all" || (filter === "active" ? employee.active : filter === "inactive" ? !employee.active : employee.serviceIds.includes(filter)); const matchesQuery = !normalized || normalize(`${employee.displayName} ${employee.title ?? ""} ${listAllUsers().find((item) => item.id === employee.userId)?.email ?? ""}`).includes(normalized); return matchesFilter && matchesQuery; }); }, [filter, items, query]);
  const activeCount = items.filter((item) => item.active).length;
  const activeServices = establishment ? listServices(establishment.id).filter((service) => service.active) : [];
  const todayWeekday = new Date().getDay();
  const workingToday = items.filter((item) => listSchedules(establishment?.id).some((entry) => entry.employeeId === item.id && entry.weekday === todayWeekday && entry.active)).length;
  const openCreate = () => { setEditing(null); setForm({ name: "", email: "", phone: "", title: "Profissional", bio: "", commission: "0", photoUrl: "", serviceIds: [], active: true, password: "" }); setSchedule(emptySchedule()); setError(""); setOpenForm(true); };
  const openEdit = (employee: Employee) => { setEditing(employee); const linkedUser = listAllUsers().find((item) => item.id === employee.userId); const current = Object.fromEntries(days.map((_, day) => [day, listSchedules(establishment?.id).find((entry) => entry.employeeId === employee.id && entry.weekday === day)?.workingHours ?? []])) as Record<number, TimeRange[]>; setForm({ name: employee.displayName, email: linkedUser?.email ?? "", phone: employee.phone ?? linkedUser?.phone ?? "", title: employee.title ?? "Profissional", bio: employee.bio ?? "", commission: String(employee.commissionPercent ?? 0), photoUrl: employee.photoUrl ?? "", serviceIds: employee.serviceIds, active: employee.active, password: "" }); setSchedule(current); setError(""); setOpenForm(true); };
  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_500_000) return setError("Escolha uma foto válida de até 1,5 MB.");
    const reader = new FileReader();
    reader.onload = () => { setForm((current) => ({ ...current, photoUrl: String(reader.result) })); setError(""); };
    reader.onerror = () => setError("Não foi possível ler a foto selecionada.");
    reader.readAsDataURL(file);
  };
  const updateShift = (day: number, index: number, key: keyof TimeRange, value: string) => setSchedule((current) => ({ ...current, [day]: (current[day] ?? []).map((range, rangeIndex) => rangeIndex === index ? { ...range, [key]: value } : range) }));
  const addShift = (day: number) => setSchedule((current) => {
    const existing = current[day] ?? [];
    if (!existing.length) return { ...current, [day]: [{ start: "09:00", end: "18:00" }] };
    if (existing.length >= 3) return current;
    if (existing.length === 1) {
      const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
      const fromMinutes = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
      const start = toMinutes(existing[0].start); const end = toMinutes(existing[0].end); const middle = Math.floor((start + end) / 2 / 60) * 60;
      if (middle - start < 60 || end - middle < 60) return current;
      return { ...current, [day]: [{ start: existing[0].start, end: fromMinutes(middle) }, { start: fromMinutes(middle + 60), end: existing[0].end }] };
    }
    return { ...current, [day]: [...existing, { start: "18:00", end: "20:00" }] };
  });
  const save = async () => {
    if (!establishment) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (name.length < 2) return setError("Informe o nome completo.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Informe um e-mail válido.");
    if (!editing && !/^(?=.*[A-Z])(?=.*\d).{10,}$/.test(form.password)) return setError("Defina uma senha inicial com ao menos 10 caracteres, uma letra maiúscula e um número.");
    const invalidSchedule = Object.values(schedule).some((ranges) => ranges.some((range) => range.start >= range.end) || [...ranges].sort((a, b) => a.start.localeCompare(b.start)).some((range, index, ordered) => index > 0 && ordered[index - 1].end > range.start));
    if (invalidSchedule) return setError("Confira os períodos: início antes do fim e sem sobreposição.");
    const commission = Number(form.commission);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) return setError("A comissão deve ficar entre 0% e 100%.");
    const id = editing?.id ?? "emp-" + crypto.randomUUID();
    const userId = editing?.userId ?? "usr-" + id;
    if (!isAccountEmailAvailable(email, userId)) return setError("Este e-mail já pertence a outra conta.");
    const linkedUser = listAllUsers().find((item) => item.id === userId);
    const passwordHash = linkedUser && "passwordHash" in linkedUser ? String(linkedUser.passwordHash) : await hashPlatformPassword(form.password);
    const account: StoredPlatformUser = { ...linkedUser, id: userId, name, email, role: "EMPLOYEE", createdAt: linkedUser?.createdAt ?? new Date().toISOString(), establishmentId: establishment.id, passwordHash };
    if (!savePlatformUser(account)) return setError("Não foi possível salvar o acesso do profissional neste navegador.");
    const payload = { displayName: name, title: form.title.trim() || "Profissional", bio: form.bio.trim(), commissionPercent: commission, phone: form.phone.trim(), photoUrl: form.photoUrl || undefined, serviceIds: form.serviceIds, active: form.active };
    const saved = editing ? updateEmployee(editing.id, payload, establishment.id) : createEmployee({ id, userId, establishmentId: establishment.id, ...payload });
    if (!saved) return setError("Não foi possível salvar o profissional neste navegador.");
    if (!updateEmployeeSchedule(id, establishment.id, schedule)) return setError("O profissional foi salvo, mas não foi possível registrar o expediente.");
    setOpenForm(false);
    setEditing(null);
    refresh();
  };
  const toggleStatus = async (employee: Employee) => { if (!establishment) return; if (!employee.active) { if (await confirm({ title: `Reativar ${employee.displayName}?`, description: "O profissional poderá voltar a receber novas reservas.", confirmLabel: "Reativar" })) activateEmployee(employee.id, establishment.id); refresh(); return; } const future = futureEmployeeAppointments(employee); if (future.length) { setPendingDeactivation(employee); setDeactivationChoice("KEEP_HISTORY"); setTransferTarget(""); setError(""); return; } if (await confirm({ title: `Desativar ${employee.displayName}?`, description: "O histórico será preservado e o profissional deixará de receber novas reservas.", destructive: true, confirmLabel: "Desativar" })) { const result = deactivateEmployeeWithFuturePolicy(employee, "KEEP_HISTORY"); if (!result.ok) setError(result.reason); refresh(); } };
  const confirmDeactivation = async () => { if (!pendingDeactivation) return; if (deactivationChoice === "CANCEL_FUTURE" && !await confirm({ title: "Cancelar reservas futuras?", description: `${futureEmployeeAppointments(pendingDeactivation).length} agendamento(s) futuro(s) serão cancelados. Esta ação não pode ser desfeita automaticamente.`, destructive: true, confirmLabel: "Cancelar reservas" })) return; const result = deactivateEmployeeWithFuturePolicy(pendingDeactivation, deactivationChoice, transferTarget || undefined); if (!result.ok) { setError(result.reason); return; } setPendingDeactivation(null); setError(""); refresh(); };

  if (status === "loading") return <AdminPageContainer><div className="dashboard-loading">Carregando equipe…</div></AdminPageContainer>;
  if (!establishment) return <AdminPageContainer><AdminPageHeader title="Equipe" description="Estabelecimento indisponível." /><GlassSurface material="frosted" className="dashboard-empty">Não foi possível carregar a equipe desta sessão.</GlassSurface></AdminPageContainer>;
  const employeeFormModal = <GlassModal open={openForm} onClose={() => setOpenForm(false)} title={editing ? "Editar funcionário" : "Novo funcionário"} description={editing ? "Atualize os dados do profissional." : "Defina os dados de acesso e o expediente do profissional."} footer={<><GlassButton variant="quiet" onClick={() => setOpenForm(false)}>Cancelar</GlassButton><GlassButton variant="primary" onClick={save}>Salvar funcionário</GlassButton></>}><div className="employee-form"><div className="employee-photo-editor"><div className="employee-photo-preview" style={form.photoUrl ? { backgroundImage: `url(${form.photoUrl})` } : undefined}>{!form.photoUrl && <ImagePlus size={24} aria-hidden />}</div><div><span className="field-label">Foto do profissional</span><p>JPG, PNG ou WebP · até 1,5 MB.</p><div className="employee-photo-actions"><label className="employee-photo-picker">Escolher foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>{form.photoUrl && <button type="button" onClick={() => setForm((current) => ({ ...current, photoUrl: "" }))}>Remover</button>}</div></div></div><GlassInput label="Nome completo" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><GlassInput label="E-mail de acesso do profissional" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /><GlassInput label="Telefone / WhatsApp" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /><GlassInput label="Função" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><GlassInput label="Descrição profissional" value={form.bio} maxLength={300} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Especialidades e apresentação ao cliente" /><GlassInput label="Comissão simulada (%)" type="number" min={0} max={100} step={0.5} value={form.commission} onChange={(event) => setForm((current) => ({ ...current, commission: event.target.value }))} />{!editing && <GlassInput label="Senha inicial" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} hint="Use ao menos 10 caracteres, uma letra maiúscula e um número." />}<EmployeeServicePicker services={activeServices} selectedIds={form.serviceIds} onChange={(serviceIds) => setForm((current) => ({ ...current, serviceIds }))} /><div className="employee-schedule-editor"><span className="field-label">Expediente semanal · adicione períodos para configurar pausas</span>{days.map((day, index) => <div className="schedule-edit-day" key={day}><b>{day}</b>{(schedule[index] ?? []).map((range, rangeIndex) => <div className="schedule-edit-row" key={`${day}-${rangeIndex}`}><input type="time" value={range.start} onChange={(event) => updateShift(index, rangeIndex, "start", event.target.value)} aria-label={`${day}, período ${rangeIndex + 1}, início`} /><span>até</span><input type="time" value={range.end} onChange={(event) => updateShift(index, rangeIndex, "end", event.target.value)} aria-label={`${day}, período ${rangeIndex + 1}, fim`} />{rangeIndex > 0 && <button type="button" onClick={() => setSchedule((current) => ({ ...current, [index]: current[index].filter((_, itemIndex) => itemIndex !== rangeIndex) }))}>Remover período</button>}</div>)}<button type="button" className="employee-add-shift" onClick={() => addShift(index)} disabled={(schedule[index]?.length ?? 0) >= 3}>Adicionar período / pausa</button></div>)}</div>{error && <p className="field-message">{error}</p>}</div></GlassModal>
  const pendingFuture = pendingDeactivation ? futureEmployeeAppointments(pendingDeactivation) : [];
  const deactivationModal = pendingDeactivation ? <GlassModal open onClose={() => setPendingDeactivation(null)} title={`Desativar ${pendingDeactivation.displayName}`} description={`${pendingFuture.length} agendamento(s) futuro(s) encontrado(s). Escolha como tratar as reservas; o histórico nunca será apagado.`} footer={<><GlassButton variant="quiet" onClick={() => setPendingDeactivation(null)}>Abortar desativação</GlassButton><GlassButton variant="primary" onClick={confirmDeactivation} disabled={deactivationChoice === "TRANSFER" && !transferTarget}>Confirmar desativação</GlassButton></>}><div className="employee-deactivation-options"><label><input type="radio" name="deactivation-policy" checked={deactivationChoice === "KEEP_HISTORY"} onChange={() => setDeactivationChoice("KEEP_HISTORY")} /><span><strong>Manter reservas registradas</strong><small>Preserva as reservas futuras e todo o histórico; o profissional deixa de receber novas reservas.</small></span></label><label><input type="radio" name="deactivation-policy" checked={deactivationChoice === "TRANSFER"} onChange={() => setDeactivationChoice("TRANSFER")} /><span><strong>Transferir reservas futuras</strong><small>Cada transferência será validada na escala, nos serviços e nos conflitos do destino.</small></span></label>{deactivationChoice === "TRANSFER" && <GlassSelect label="Transferir para" value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} options={[{ value: "", label: "Selecione um profissional" }, ...items.filter((item) => item.active && item.id !== pendingDeactivation.id).map((item) => ({ value: item.id, label: item.displayName }))]} />}{deactivationChoice === "TRANSFER" && !items.some((item) => item.active && item.id !== pendingDeactivation.id) && <p className="form-error">Não há outro profissional ativo para receber os agendamentos.</p>}<label><input type="radio" name="deactivation-policy" checked={deactivationChoice === "CANCEL_FUTURE"} onChange={() => setDeactivationChoice("CANCEL_FUTURE")} /><span><strong>Cancelar reservas futuras</strong><small>Os clientes precisarão escolher outro horário. A confirmação pedirá uma segunda confirmação.</small></span></label></div>{error && <p className="form-error" role="alert">{error}</p>}</GlassModal> : null;
  if (detailId && detailEmployee) return <><EmployeeDetail employee={detailEmployee} establishmentId={establishment.id} onBack={() => window.history.back()} onEdit={() => openEdit(detailEmployee)} />{employeeFormModal}{deactivationModal}</>;
  return <AdminPageContainer><AdminPageHeader eyebrow={establishment.name} title="Equipe" description="Profissionais, serviços e disponibilidade do seu estabelecimento." />
    <section className="employee-summary"><span><b>{items.length}</b> profissionais</span><span><b>{activeCount}</b> ativos</span><span><b>{workingToday}</b> com expediente hoje</span></section>
    <GlassButton className="employee-create-button" variant="primary" onClick={openCreate}><Plus size={16} />Novo funcionário</GlassButton>
    {error && <div className="agenda-feedback" role="alert"><X size={16} />{error}</div>}
    <GlassSurface material="frosted" className="employee-list-panel"><div className="employee-filters"><GlassInput label="Pesquisar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, função ou e-mail" leadingIcon={<Search size={16} />} /><GlassSelect label="Status ou serviço" value={filter} onChange={(event) => setFilter(event.target.value)} options={[{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "inactive", label: "Inativos" }, ...listServices(establishment.id).filter((service) => service.active).map((service) => ({ value: service.id, label: service.name }))]} /></div>{filtered.length ? <div className="employee-list">{filtered.map((employee) => <article className="employee-row" key={employee.id}><Avatar employee={employee} /><div className="employee-main"><strong>{employee.displayName}</strong><span>{employee.title ?? "Profissional"} · {listAllUsers().find((item) => item.id === employee.userId)?.email ?? "Convite pendente"}</span><small>{employee.serviceIds.length} serviço{employee.serviceIds.length === 1 ? "" : "s"} associado{employee.serviceIds.length === 1 ? "" : "s"}</small></div><span className={`employee-status ${employee.active ? "is-active" : "is-inactive"}`}>{employee.active ? "Ativo" : "Inativo"}</span><div className="employee-actions"><GlassButton asChild variant="quiet" size="sm"><Link href={`/employees/${employee.id}`}>Perfil <ArrowRight size={14} /></Link></GlassButton><GlassButton variant="quiet" size="icon" onClick={() => openEdit(employee)} aria-label={`Editar ${employee.displayName}`}><Pencil size={15} /></GlassButton><GlassButton variant="quiet" size="icon" onClick={() => toggleStatus(employee)} aria-label={employee.active ? `Desativar ${employee.displayName}` : `Ativar ${employee.displayName}`}>{employee.active ? <X size={15} /> : <Check size={15} />}</GlassButton></div></article>)}</div> : <div className="dashboard-empty"><p>Nenhum profissional corresponde aos filtros atuais.</p><GlassButton variant="ghost" onClick={() => { setQuery(""); setFilter("all"); }}>Limpar filtros</GlassButton></div>}</GlassSurface>
    {employeeFormModal}{deactivationModal}
  </AdminPageContainer>;
}

function EmployeeDetail({ employee, establishmentId, onBack, onEdit }: { employee: Employee; establishmentId: string; onBack: () => void; onEdit: () => void }) {
  const linkedUser = listAllUsers().find((item) => item.id === employee.userId);
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  const employeeAppointments = listAppointments().filter((item) => item.establishmentId === establishmentId && item.employeeId === employee.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const employeeServices = listServices(establishmentId).filter((item) => employee.serviceIds.includes(item.id));
  const employeeSchedules = listSchedules(establishmentId).filter((item) => item.employeeId === employee.id);
  const completedAppointments = employeeAppointments.filter((item) => item.status === "COMPLETED");
  const futureAppointments = employeeAppointments.filter((item) => item.startsAt > new Date().toISOString() && isActiveAppointmentStatus(item.status));
  const commissionAmount = completedAppointments.reduce((total, item) => total + item.priceInCentsSnapshot, 0) * (employee.commissionPercent ?? 0) / 100;
  return <AdminPageContainer>
    <AdminPageHeader eyebrow="Equipe" title={employee.displayName} description={`${employee.title ?? "Profissional"} · ${employee.active ? "Ativo" : "Inativo"}`} action={<div className="employee-detail-actions"><GlassButton variant="quiet" onClick={onBack}>Voltar</GlassButton><GlassButton variant="secondary" onClick={onEdit}><Pencil size={15} />Editar</GlassButton><GlassButton asChild variant="primary"><Link href={`/agenda?employee=${employee.id}`}><CalendarDays size={15} />Ver agenda</Link></GlassButton></div>} />
    <div className="employee-detail-grid">
      <GlassSurface material="frosted" className="employee-detail-identity"><Avatar employee={employee} /><h2>{employee.displayName}</h2><p>{employee.title ?? "Profissional"}</p>{employee.bio && <p>{employee.bio}</p>}<p>{linkedUser?.email ?? "Convite pendente"}</p><p>{employee.phone ?? "Telefone não informado"}</p><span className={`employee-status ${employee.active ? "is-active" : "is-inactive"}`}>{employee.active ? "Ativo" : "Inativo"}</span></GlassSurface>
      <GlassSurface material="frosted" className="employee-detail-section employee-indicators"><h2>Indicadores e comissão</h2><div className="employee-indicator-grid"><div><span>Concluídos</span><strong>{completedAppointments.length}</strong></div><div><span>Futuros</span><strong>{futureAppointments.length}</strong></div><div><span>Comissão simulada</span><strong>{employee.commissionPercent ?? 0}%</strong></div><div><span>Estimativa sobre concluídos</span><strong>{formatCurrency(commissionAmount)}</strong></div></div></GlassSurface>
      <GlassSurface material="frosted" className="employee-detail-section"><h2>Serviços realizados</h2>{employeeServices.length ? <ul>{employeeServices.map((service) => <li key={service.id}>{service.name}<span>{service.durationMinutes} min · R$ {(service.priceInCents / 100).toFixed(2).replace(".", ",")}</span></li>)}</ul> : <p>Nenhum serviço associado.</p>}</GlassSurface>
      <GlassSurface material="frosted" className="employee-detail-section"><h2>Expediente</h2>{employeeSchedules.length ? <ul>{employeeSchedules.sort((a, b) => a.weekday - b.weekday).map((entry) => <li key={entry.id}>{days[entry.weekday]}<span>{entry.workingHours.map((range) => `${range.start}–${range.end}`).join(" · ")}</span></li>)}</ul> : <p>Nenhum expediente configurado.</p>}</GlassSurface>
      <GlassSurface material="frosted" className="employee-detail-section"><h2>Atendimentos</h2>{employeeAppointments.length ? <ul>{employeeAppointments.slice(0, 8).map((item) => <li key={item.id}>{new Date(item.startsAt).toLocaleDateString("pt-BR")} · {item.serviceNameSnapshot}<span>{item.status === "COMPLETED" ? "Concluído" : item.status === "CANCELLED" ? "Cancelado" : item.status === "NO_SHOW" ? "Não compareceu" : "Agendado"}</span></li>)}</ul> : <p>Nenhum atendimento relacionado.</p>}</GlassSurface>
      <EmployeeAvailabilityManager employee={employee} timezone={establishment?.timezone ?? "America/Sao_Paulo"} />
    </div>
  </AdminPageContainer>;
}

