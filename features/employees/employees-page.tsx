"use client";

import Link from "next/link";
import { CalendarDays, Check, ImagePlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, SwitchField, useConfirmation } from "@/components/ui";
import { isActiveAppointmentStatus, listAppointments, scheduleForEmployee } from "@/features/agenda";
import { useAuth } from "@/features/auth";
import { hashPlatformPassword, isAccountEmailAvailable, listAllEstablishments, listAllUsers, savePlatformUser, type StoredPlatformUser } from "@/features/platform";
import { listServices } from "@/features/services";
import { dateKeyInTimezone } from "@/features/booking/rules";
import { listEmployees, createEmployee, activateEmployee, deactivateEmployeeWithFuturePolicy, futureEmployeeAppointments, updateEmployee, removeEmployee, getEmployeeDailyAvailability, setEmployeeDailyAvailability, getEmployeeSchedule, saveEmployeeSchedules } from "./index";
import { getEstablishmentSettings } from "@/features/settings/repository";
import type { Employee, Schedule, Service, TimeRange } from "@/types";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const weekDays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

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
  const [form, setForm] = useState({ name: "", email: "", phone: "", title: "Profissional", bio: "", photoUrl: "", serviceIds: [] as string[], active: true, password: "" });
  const [dailyDate, setDailyDate] = useState(() => dateKeyInTimezone(new Date(), establishment?.timezone ?? "America/Sao_Paulo"));
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
  const availableCount = establishment ? items.filter((item) => item.active && Boolean(scheduleForEmployee(item.id, establishment.id, dailyDate)) && getEmployeeDailyAvailability(item.id, establishment.id, dailyDate)).length : 0;
  const openCreate = () => { setEditing(null); setForm({ name: "", email: "", phone: "", title: "Profissional", bio: "", photoUrl: "", serviceIds: [], active: true, password: "" }); setError(""); setOpenForm(true); };
  const openEdit = (employee: Employee) => { setEditing(employee); const linkedUser = listAllUsers().find((item) => item.id === employee.userId); setForm({ name: employee.displayName, email: linkedUser?.email ?? "", phone: employee.phone ?? linkedUser?.phone ?? "", title: employee.title ?? "Profissional", bio: employee.bio ?? "", photoUrl: employee.photoUrl ?? "", serviceIds: employee.serviceIds, active: employee.active, password: "" }); setError(""); setOpenForm(true); };
  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 1_500_000) return setError("Escolha uma foto válida de até 1,5 MB.");
    const reader = new FileReader();
    reader.onload = () => { setForm((current) => ({ ...current, photoUrl: String(reader.result) })); setError(""); };
    reader.onerror = () => setError("Não foi possível ler a foto selecionada.");
    reader.readAsDataURL(file);
  };
  const save = async () => {
    if (!establishment) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (name.length < 2) return setError("Informe o nome completo.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Informe um e-mail válido.");
    if (!editing && !/^(?=.*[A-Z])(?=.*\d).{10,}$/.test(form.password)) return setError("Defina uma senha inicial com ao menos 10 caracteres, uma letra maiúscula e um número.");
    const id = editing?.id ?? "emp-" + crypto.randomUUID();
    const userId = editing?.userId ?? "usr-" + id;
    if (!isAccountEmailAvailable(email, userId)) return setError("Este e-mail já pertence a outra conta.");
    const linkedUser = listAllUsers().find((item) => item.id === userId);
    const passwordHash = linkedUser && "passwordHash" in linkedUser ? String(linkedUser.passwordHash) : await hashPlatformPassword(form.password);
    const account: StoredPlatformUser = { ...linkedUser, id: userId, name, email, role: "EMPLOYEE", createdAt: linkedUser?.createdAt ?? new Date().toISOString(), establishmentId: establishment.id, passwordHash };
    if (!savePlatformUser(account)) return setError("Não foi possível salvar o acesso do profissional neste navegador.");
    const payload = { displayName: name, title: form.title.trim() || "Profissional", bio: form.bio.trim(), phone: form.phone.trim(), photoUrl: form.photoUrl || undefined, serviceIds: form.serviceIds, active: form.active };
    const saved = editing ? updateEmployee(editing.id, payload, establishment.id) : createEmployee({ id, userId, establishmentId: establishment.id, ...payload });
    if (!saved) return setError("Não foi possível salvar o profissional neste navegador.");
    setOpenForm(false);
    setEditing(null);
    refresh();
  };
  const toggleStatus = async (employee: Employee) => { if (!establishment) return; if (!employee.active) { if (await confirm({ title: `Reativar ${employee.displayName}?`, description: "O profissional poderá voltar a receber novas reservas.", confirmLabel: "Reativar" })) activateEmployee(employee.id, establishment.id); refresh(); return; } const future = futureEmployeeAppointments(employee); if (future.length) { setPendingDeactivation(employee); setDeactivationChoice("KEEP_HISTORY"); setTransferTarget(""); setError(""); return; } if (await confirm({ title: `Desativar ${employee.displayName}?`, description: "O histórico será preservado e o profissional deixará de receber novas reservas.", destructive: true, confirmLabel: "Desativar" })) { const result = deactivateEmployeeWithFuturePolicy(employee, "KEEP_HISTORY"); if (!result.ok) setError(result.reason); refresh(); } };
  const confirmDeactivation = async () => { if (!pendingDeactivation) return; if (deactivationChoice === "CANCEL_FUTURE" && !await confirm({ title: "Cancelar reservas futuras?", description: `${futureEmployeeAppointments(pendingDeactivation).length} agendamento(s) futuro(s) serão cancelados. Esta ação não pode ser desfeita automaticamente.`, destructive: true, confirmLabel: "Cancelar reservas" })) return; const result = deactivateEmployeeWithFuturePolicy(pendingDeactivation, deactivationChoice, transferTarget || undefined); if (!result.ok) { setError(result.reason); return; } setPendingDeactivation(null); setError(""); refresh(); };
  const toggleDailyAvailability = async (employee: Employee, available: boolean) => {
    if (!establishment) return;
    if (!available) {
      const existingAppointments = listAppointments(establishment.id).filter((appointment) => appointment.employeeId === employee.id && isActiveAppointmentStatus(appointment.status) && dateKeyInTimezone(new Date(appointment.startsAt), establishment.timezone) === dailyDate);
      const description = existingAppointments.length
        ? `Há ${existingAppointments.length} agendamento(s) neste dia. Eles serão mantidos sem alterações, mas novos clientes não poderão reservar este profissional nesta data. Deseja continuar?`
        : `Novos clientes não poderão reservar ${employee.displayName} nesta data. Agendamentos existentes serão preservados.`;
      if (!await confirm({ title: `Marcar ${employee.displayName} como indisponível?`, description, destructive: true, confirmLabel: "Marcar indisponível" })) return;
    }
    if (!setEmployeeDailyAvailability(employee.id, establishment.id, dailyDate, available)) setError("Não foi possível salvar a disponibilidade deste dia.");
    else setError("");
    refresh();
  };
  const remove = async (employee: Employee) => {
    if (!establishment) return;
    const appointments = listAppointments(establishment.id).filter((item) => item.employeeId === employee.id);
    if (appointments.length) return setError(`${employee.displayName} possui ${appointments.length} agendamento(s) no histórico. Desative o profissional para manter os registros vinculados.`);
    if (!await confirm({ title: `Remover ${employee.displayName}?`, description: "O cadastro e o acesso deste profissional serão removidos. Esta ação não pode ser desfeita.", destructive: true, confirmLabel: "Remover profissional" })) return;
    const result = removeEmployee(employee.id, establishment.id);
    if (!result.ok) { setError(result.reason); return; }
    setError("");
    refresh();
  };

  if (status === "loading") return <AdminPageContainer><div className="dashboard-loading">Carregando equipe…</div></AdminPageContainer>;
  if (!establishment) return <AdminPageContainer><AdminPageHeader title="Equipe" description="Estabelecimento indisponível." /><GlassSurface material="frosted" className="dashboard-empty">Não foi possível carregar a equipe desta sessão.</GlassSurface></AdminPageContainer>;
  const employeeFormModal = <GlassModal open={openForm} onClose={() => setOpenForm(false)} title={editing ? "Editar funcionário" : "Novo funcionário"} description={editing ? "Atualize os dados do profissional." : "Informe os dados básicos e os serviços realizados."} footer={<><GlassButton variant="quiet" onClick={() => setOpenForm(false)}>Cancelar</GlassButton><GlassButton variant="primary" onClick={save}>Salvar funcionário</GlassButton></>}><div className="employee-form"><div className="employee-photo-editor"><div className="employee-photo-preview" style={form.photoUrl ? { backgroundImage: `url(${form.photoUrl})` } : undefined}>{!form.photoUrl && <ImagePlus size={24} aria-hidden />}</div><div><span className="field-label">Foto do profissional</span><p>JPG, PNG ou WebP · até 1,5 MB.</p><div className="employee-photo-actions"><label className="employee-photo-picker">Escolher foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>{form.photoUrl && <button type="button" onClick={() => setForm((current) => ({ ...current, photoUrl: "" }))}>Remover</button>}</div></div></div><GlassInput label="Nome completo" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><GlassInput label="E-mail de acesso do profissional" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /><GlassInput label="Telefone / WhatsApp" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /><GlassInput label="Função" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><GlassInput label="Descrição profissional" value={form.bio} maxLength={300} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} placeholder="Especialidades e apresentação ao cliente" />{!editing && <GlassInput label="Senha inicial" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} hint="Use ao menos 10 caracteres, uma letra maiúscula e um número." />}<EmployeeServicePicker services={activeServices} selectedIds={form.serviceIds} onChange={(serviceIds) => setForm((current) => ({ ...current, serviceIds }))} />{error && <p className="field-message">{error}</p>}</div></GlassModal>
  const pendingFuture = pendingDeactivation ? futureEmployeeAppointments(pendingDeactivation) : [];
  const deactivationModal = pendingDeactivation ? <GlassModal open onClose={() => setPendingDeactivation(null)} title={`Desativar ${pendingDeactivation.displayName}`} description={`${pendingFuture.length} agendamento(s) futuro(s) encontrado(s). Escolha como tratar as reservas; o histórico nunca será apagado.`} footer={<><GlassButton variant="quiet" onClick={() => setPendingDeactivation(null)}>Abortar desativação</GlassButton><GlassButton variant="primary" onClick={confirmDeactivation} disabled={deactivationChoice === "TRANSFER" && !transferTarget}>Confirmar desativação</GlassButton></>}><div className="employee-deactivation-options"><label><input type="radio" name="deactivation-policy" checked={deactivationChoice === "KEEP_HISTORY"} onChange={() => setDeactivationChoice("KEEP_HISTORY")} /><span><strong>Manter reservas registradas</strong><small>Preserva as reservas futuras e todo o histórico; o profissional deixa de receber novas reservas.</small></span></label><label><input type="radio" name="deactivation-policy" checked={deactivationChoice === "TRANSFER"} onChange={() => setDeactivationChoice("TRANSFER")} /><span><strong>Transferir reservas futuras</strong><small>Cada transferência será validada na escala, nos serviços e nos conflitos do destino.</small></span></label>{deactivationChoice === "TRANSFER" && <GlassSelect label="Transferir para" value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} options={[{ value: "", label: "Selecione um profissional" }, ...items.filter((item) => item.active && item.id !== pendingDeactivation.id).map((item) => ({ value: item.id, label: item.displayName }))]} />}{deactivationChoice === "TRANSFER" && !items.some((item) => item.active && item.id !== pendingDeactivation.id) && <p className="form-error">Não há outro profissional ativo para receber os agendamentos.</p>}<label><input type="radio" name="deactivation-policy" checked={deactivationChoice === "CANCEL_FUTURE"} onChange={() => setDeactivationChoice("CANCEL_FUTURE")} /><span><strong>Cancelar reservas futuras</strong><small>Os clientes precisarão escolher outro horário. A confirmação pedirá uma segunda confirmação.</small></span></label></div>{error && <p className="form-error" role="alert">{error}</p>}</GlassModal> : null;
  if (detailId && detailEmployee) return <><EmployeeDetail employee={detailEmployee} establishmentId={establishment.id} onBack={() => window.history.back()} onEdit={() => openEdit(detailEmployee)} />{employeeFormModal}{deactivationModal}</>;
  return <AdminPageContainer><AdminPageHeader eyebrow={establishment.name} title="Equipe" description="Profissionais, serviços e disponibilidade do seu estabelecimento." />
    <section className="employee-summary"><span><b>{items.length}</b> profissionais</span><span><b>{activeCount}</b> ativos</span><span><b>{availableCount}</b> disponíveis na data</span></section>
    <div className="employee-toolbar"><div className="employee-daily-date"><GlassInput label="Disponibilidade para a data" type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} /></div><GlassButton className="employee-create-button" variant="primary" onClick={openCreate}><Plus size={16} />Novo funcionário</GlassButton></div>
    {error && <div className="agenda-feedback" role="alert"><X size={16} />{error}</div>}
    <GlassSurface material="frosted" className="employee-list-panel"><div className="employee-filters"><GlassInput label="Pesquisar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, função ou e-mail" leadingIcon={<Search size={16} />} /><GlassSelect label="Status ou serviço" value={filter} onChange={(event) => setFilter(event.target.value)} options={[{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "inactive", label: "Inativos" }, ...listServices(establishment.id).filter((service) => service.active).map((service) => ({ value: service.id, label: service.name }))]} /></div>{filtered.length ? <div className="employee-list">{filtered.map((employee) => {
      const available = employee.active && Boolean(scheduleForEmployee(employee.id, establishment.id, dailyDate)) && getEmployeeDailyAvailability(employee.id, establishment.id, dailyDate);
      const serviceNames = listServices(establishment.id).filter((service) => employee.serviceIds.includes(service.id)).map((service) => service.name);
      return <article className="employee-row" key={employee.id}><Avatar employee={employee} /><div className="employee-main"><strong>{employee.displayName}</strong><span>{employee.title ?? "Profissional"} · {listAllUsers().find((item) => item.id === employee.userId)?.email ?? "Convite pendente"}</span><small>{serviceNames.length ? serviceNames.join(" · ") : "Nenhum serviço associado"}</small></div><span className={`employee-status ${employee.active ? "is-active" : "is-inactive"}`}>{employee.active ? "Ativo" : "Inativo"}</span><SwitchField className="employee-daily-switch" label={available ? "Disponível" : "Indisponível"} description={dailyDate} checked={available} disabled={!employee.active} onChange={(event) => void toggleDailyAvailability(employee, event.target.checked)} aria-label={`Disponibilidade de ${employee.displayName} em ${dailyDate}`} /><div className="employee-actions"><GlassButton asChild variant="quiet" size="sm"><Link href={`/agenda?employee=${employee.id}`}><CalendarDays size={14} />Agenda</Link></GlassButton><GlassButton variant="quiet" size="icon" onClick={() => openEdit(employee)} aria-label={`Editar ${employee.displayName}`}><Pencil size={15} /></GlassButton><GlassButton variant="quiet" size="icon" onClick={() => toggleStatus(employee)} aria-label={employee.active ? `Desativar ${employee.displayName}` : `Ativar ${employee.displayName}`}>{employee.active ? <X size={15} /> : <Check size={15} />}</GlassButton><GlassButton variant="quiet" size="icon" onClick={() => void remove(employee)} aria-label={`Remover ${employee.displayName}`}><Trash2 size={15} /></GlassButton></div></article>;
    })}</div> : <div className="dashboard-empty"><p>Nenhum profissional corresponde aos filtros atuais.</p><GlassButton variant="ghost" onClick={() => { setQuery(""); setFilter("all"); }}>Limpar filtros</GlassButton></div>}</GlassSurface>
    {employeeFormModal}{deactivationModal}
  </AdminPageContainer>;
}

function EmployeeDetail({ employee, establishmentId, onBack, onEdit }: { employee: Employee; establishmentId: string; onBack: () => void; onEdit: () => void }) {
  const linkedUser = listAllUsers().find((item) => item.id === employee.userId);
  const establishment = listAllEstablishments().find((item) => item.id === establishmentId);
  const employeeAppointments = listAppointments().filter((item) => item.establishmentId === establishmentId && item.employeeId === employee.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const employeeServices = listServices(establishmentId).filter((item) => employee.serviceIds.includes(item.id));
  const today = establishment ? dateKeyInTimezone(new Date(), establishment.timezone) : dateKeyInTimezone(new Date(), "America/Sao_Paulo");
  const availableToday = Boolean(scheduleForEmployee(employee.id, establishmentId, today)) && getEmployeeDailyAvailability(employee.id, establishmentId, today);
  return <AdminPageContainer>
    <AdminPageHeader eyebrow="Equipe" title={employee.displayName} description={`${employee.title ?? "Profissional"} · ${employee.active ? "Ativo" : "Inativo"}`} action={<div className="employee-detail-actions"><GlassButton variant="quiet" onClick={onBack}>Voltar</GlassButton><GlassButton variant="secondary" onClick={onEdit}><Pencil size={15} />Editar</GlassButton><GlassButton asChild variant="primary"><Link href={`/agenda?employee=${employee.id}`}><CalendarDays size={15} />Ver agenda</Link></GlassButton></div>} />
    <div className="employee-detail-grid">
      <GlassSurface material="frosted" className="employee-detail-identity"><Avatar employee={employee} /><h2>{employee.displayName}</h2><p>{employee.title ?? "Profissional"}</p>{employee.bio && <p>{employee.bio}</p>}<p>{linkedUser?.email ?? "Convite pendente"}</p><p>{employee.phone ?? "Telefone não informado"}</p><span className={`employee-status ${employee.active ? "is-active" : "is-inactive"}`}>{employee.active ? "Ativo" : "Inativo"}</span></GlassSurface>
      <GlassSurface material="frosted" className="employee-detail-section"><h2>Serviços realizados</h2>{employeeServices.length ? <ul>{employeeServices.map((service) => <li key={service.id}>{service.name}<span>{service.durationMinutes} min · R$ {(service.priceInCents / 100).toFixed(2).replace(".", ",")}</span></li>)}</ul> : <p>Nenhum serviço associado.</p>}</GlassSurface>
      <EmployeeWeeklySchedule employee={employee} establishmentId={establishmentId} />
      <GlassSurface material="frosted" className="employee-detail-section"><h2>Disponibilidade diária</h2><p>Hoje: {availableToday && employee.active ? "Disponível para novos agendamentos" : "Indisponível para novos agendamentos"}.</p></GlassSurface>
      <GlassSurface material="frosted" className="employee-detail-section"><h2>Atendimentos</h2>{employeeAppointments.length ? <ul>{employeeAppointments.slice(0, 8).map((item) => <li key={item.id}>{new Date(item.startsAt).toLocaleDateString("pt-BR")} · {item.serviceNameSnapshot}<span>{item.status === "COMPLETED" ? "Concluído" : item.status === "CANCELLED" ? "Cancelado" : item.status === "NO_SHOW" ? "Não compareceu" : "Agendado"}</span></li>)}</ul> : <p>Nenhum atendimento relacionado.</p>}</GlassSurface>
    </div>
  </AdminPageContainer>;
}

function EmployeeWeeklySchedule({ employee, establishmentId }: { employee: Employee; establishmentId: string }) {
  const settings = getEstablishmentSettings(establishmentId);
  const [weekly, setWeekly] = useState(() => weekDays.map((_, weekday) => {
    const saved = getEmployeeSchedule(employee.id, establishmentId, weekday as Schedule["weekday"]);
    const businessDay = settings.businessHours.find((item) => item.weekday === weekday);
    return { weekday: weekday as Schedule["weekday"], active: saved?.active ?? Boolean(businessDay?.open), workingHours: (saved?.workingHours ?? (businessDay?.open ? businessDay.intervals : [])).map((range) => ({ ...range })) };
  }));
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const changeDay = (weekday: number, patch: Partial<(typeof weekly)[number]>) => {
    setWeekly((current) => current.map((item) => item.weekday === weekday ? { ...item, ...patch } : item));
    setDirty(true); setFeedback(""); setError("");
  };
  const changeRange = (weekday: number, index: number, patch: Partial<TimeRange>) => {
    const day = weekly.find((item) => item.weekday === weekday);
    if (!day) return;
    changeDay(weekday, { workingHours: day.workingHours.map((range, rangeIndex) => rangeIndex === index ? { ...range, ...patch } : range) });
  };
  const addRange = (weekday: number) => {
    const day = weekly.find((item) => item.weekday === weekday);
    if (!day) return;
    changeDay(weekday, { active: true, workingHours: [...day.workingHours, { start: "", end: "" }] });
  };
  const save = () => {
    const result = saveEmployeeSchedules(employee.id, establishmentId, weekly);
    if (!result.ok) { setError(result.reason); setFeedback(""); return; }
    setDirty(false); setError(""); setFeedback("Expediente semanal salvo.");
  };
  return <GlassSurface material="frosted" className="employee-detail-section employee-weekly-schedule"><h2>Expediente semanal</h2><p>Horários individuais dentro do funcionamento geral. Reservas existentes são preservadas.</p><div className="employee-schedule-editor">{weekly.map((day) => <section className="schedule-edit-day" key={day.weekday}><label><input type="checkbox" checked={day.active} onChange={(event) => { const enabled = event.target.checked; changeDay(day.weekday, { active: enabled, workingHours: enabled ? day.workingHours.length ? day.workingHours : (settings.businessHours.find((item) => item.weekday === day.weekday)?.intervals ?? []).map((range) => ({ ...range })) : [] }); }} /><strong>{weekDays[day.weekday]}</strong></label>{day.active ? <>{day.workingHours.map((range, index) => <div className="schedule-edit-row" key={`${day.weekday}-${index}`}><GlassInput label="Início" type="time" value={range.start} onChange={(event) => changeRange(day.weekday, index, { start: event.target.value })} /><span>até</span><GlassInput label="Fim" type="time" value={range.end} onChange={(event) => changeRange(day.weekday, index, { end: event.target.value })} /><GlassButton type="button" variant="quiet" size="icon" aria-label={`Remover intervalo de ${weekDays[day.weekday]}`} onClick={() => changeDay(day.weekday, { workingHours: day.workingHours.filter((_, rangeIndex) => rangeIndex !== index) })}><Trash2 size={15} /></GlassButton></div>)}<button className="employee-add-shift" type="button" onClick={() => addRange(day.weekday)}><Plus size={14} />Adicionar intervalo</button></> : <span>Folga</span>}</section>)}</div>{error && <p className="form-error" role="alert">{error}</p>}{feedback && <p className="customer-feedback" role="status">{feedback}</p>}<div className="settings-save"><GlassButton variant="primary" onClick={save} disabled={!dirty}>Salvar expediente</GlassButton></div></GlassSurface>;
}

