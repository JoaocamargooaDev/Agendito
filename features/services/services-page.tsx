"use client";

import { Archive, ArrowDown, ArrowRight, ArrowUp, Check, Clock3, ImagePlus, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassSurface, useConfirmation } from "@/components/ui";
import { LoadingStatus } from "@/components/ui/loading-status";
import { listAllEstablishments } from "@/features/platform";
import { isFeatureEnabled } from "@/features/platform/policies";
import { useAuth } from "@/features/auth";
import { archiveService, activateService, createService, deactivateService, deleteService, getServiceEmployees, listServices, reorderServices, updateService } from "./index";
import { listEmployees } from "@/features/employees";
import { isActiveAppointmentStatus, listAppointments } from "@/features/agenda";
import { formatCurrency } from "@/lib/utils";
import type { Service } from "@/types";
import { serviceIsActive } from "./domain";

const weekdays = [{ value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" }];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function durationLabel(minutes: number) { return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`; }
function serviceStatus(service: Service) { return service.status === "ARCHIVED" ? "Arquivado" : serviceIsActive(service) ? "Ativo" : "Inativo"; }
function parseMoney(value: string) { const normalized = value.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", "."); const amount = Number(normalized); return Number.isFinite(amount) ? Math.round(amount * 100) : NaN; }

type ServiceForm = {
  name: string; category: string; description: string; imageUrl: string; duration: string; price: string;
  preparation: string; cleanup: string; employeeIds: string[];
  employeeOverrides: Record<string, { priceInCents?: number; durationMinutes?: number }>;
  availableWeekdays: number[]; availabilityStart: string; availabilityEnd: string;
  complementaryServiceIds: string[]; packageSessions: string; packageDiscount: string; groupCapacity: string;
  displayOrder: string; publicVisible: boolean; active: boolean;
};
function emptyForm(order = 0): ServiceForm { return { name: "", category: "Geral", description: "", imageUrl: "", duration: "60", price: "0,00", preparation: "0", cleanup: "0", employeeIds: [], employeeOverrides: {}, availableWeekdays: [], availabilityStart: "", availabilityEnd: "", complementaryServiceIds: [], packageSessions: "", packageDiscount: "0", groupCapacity: "1", displayOrder: String(order), publicVisible: true, active: true }; }

function ServiceDetails({ service, establishmentId, onClose, onEdit, onDelete }: { service: Service; establishmentId: string; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const people = getServiceEmployees(service.id, establishmentId);
  const related = listServices(establishmentId).filter((item) => service.complementaryServiceIds?.includes(item.id));
  const futureBookings = listAppointments(establishmentId).filter((item) => item.serviceId === service.id && item.startsAt > new Date().toISOString() && isActiveAppointmentStatus(item.status)).length;
  return <GlassModal open onClose={onClose} title={service.name} description={service.description || "Sem descrição cadastrada."} footer={<><GlassButton variant="destructive" onClick={onDelete}><Trash2 size={15} />Excluir</GlassButton><GlassButton variant="quiet" onClick={onClose}>Fechar</GlassButton><GlassButton variant="primary" onClick={onEdit}><Pencil size={15} />Editar</GlassButton></>}>
    <div className="service-details"><div><span className="token-label">Categoria</span><strong>{service.category || "Geral"}</strong></div><div><span className="token-label">Preço base</span><strong>{formatCurrency(service.priceInCents)}</strong></div><div><span className="token-label">Duração</span><strong>{durationLabel(service.durationMinutes)}</strong></div><div><span className="token-label">Status</span><strong>{serviceStatus(service)}</strong></div><div><span className="token-label">Profissionais</span><strong>{people.length ? people.map((person) => person.displayName).join(", ") : "Nenhum associado"}</strong></div><div><span className="token-label">Agendamentos futuros</span><strong>{futureBookings} · histórico preservado</strong></div><div><span className="token-label">Preparação / finalização</span><strong>{service.preparationMinutes ?? 0} / {service.cleanupMinutes ?? 0} min</strong></div>{service.groupCapacity && service.groupCapacity > 1 && <div><span className="token-label">Capacidade por horário</span><strong>{service.groupCapacity} pessoas</strong></div>}{service.packageOffer && <div><span className="token-label">Pacote</span><strong>{service.packageOffer.sessions} sessões · {service.packageOffer.discountPercent}% de desconto</strong></div>}{related.length > 0 && <div><span className="token-label">Complementares</span><strong>{related.map((item) => item.name).join(", ")}</strong></div>}</div>
  </GlassModal>;
}

export function ServicesPage() {
  const confirm = useConfirmation();
  const { user, status } = useAuth();
  const establishment = listAllEstablishments().find((item) => item.id === user?.establishmentId);
  const [items, setItems] = useState<Service[]>([]); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [categoryFilter, setCategoryFilter] = useState("all"); const [sort, setSort] = useState("manual");
  const [selected, setSelected] = useState<Service | null>(null); const [editing, setEditing] = useState<Service | null>(null); const [openForm, setOpenForm] = useState(false); const [error, setError] = useState("");
  const [newServiceId, setNewServiceId] = useState("");
  const establishmentId = user?.establishmentId;
  const hasPackages = Boolean(establishment && isFeatureEnabled(establishment, "packages"));
  const refresh = () => setItems(establishmentId ? listServices(establishmentId) : []);
  useEffect(() => { const update = () => setItems(establishmentId ? listServices(establishmentId) : []); const timer = window.setTimeout(update, 0); window.addEventListener("agendito:services-updated", update); window.addEventListener("agendito:employees-updated", update); return () => { window.clearTimeout(timer); window.removeEventListener("agendito:services-updated", update); window.removeEventListener("agendito:employees-updated", update); }; }, [establishmentId]);
  const people = listEmployees(establishment?.id).filter((employee) => employee.active);
  const categories = useMemo(() => [...new Set(items.map((item) => item.category?.trim() || "Geral"))].sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);
  const filtered = useMemo(() => {
    const text = normalize(query);
    const matches = items.filter((service) => {
      const isArchived = service.status === "ARCHIVED";
      const matchesStatus = filter === "all" || (filter === "active" ? serviceIsActive(service) : filter === "inactive" ? !serviceIsActive(service) && !isArchived : filter === "archived" ? isArchived : filter === "unassigned" ? !getServiceEmployees(service.id, establishmentId ?? "").length : getServiceEmployees(service.id, establishmentId ?? "").some((employee) => employee.id === filter));
      const matchesText = !text || normalize(`${service.name} ${service.description} ${service.category ?? ""}`).includes(text);
      return matchesStatus && matchesText && (categoryFilter === "all" || (service.category || "Geral") === categoryFilter);
    });
    return matches.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "pt-BR") : sort === "price" ? a.priceInCents - b.priceInCents : sort === "duration" ? a.durationMinutes - b.durationMinutes : (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [categoryFilter, establishmentId, filter, items, query, sort]);
  const [form, setForm] = useState<ServiceForm>(emptyForm());
  const openCreate = () => { setEditing(null); setSelected(null); setNewServiceId(`srv-${crypto.randomUUID()}`); setForm(emptyForm(items.length)); setError(""); setOpenForm(true); };
  const openEdit = (service: Service) => {
    setSelected(null); setEditing(service);
    const schedule = service.availabilityWindows?.[0];
    setForm({ ...emptyForm(service.displayOrder ?? 0), name: service.name, category: service.category || "Geral", description: service.description, imageUrl: service.imageUrl ?? "", duration: String(service.durationMinutes), price: (service.priceInCents / 100).toFixed(2).replace(".", ","), preparation: String(service.preparationMinutes ?? 0), cleanup: String(service.cleanupMinutes ?? 0), employeeIds: getServiceEmployees(service.id, establishment?.id ?? "").filter((employee) => employee.active).map((employee) => employee.id), employeeOverrides: service.employeeOverrides ?? {}, availableWeekdays: service.availableWeekdays ?? [], availabilityStart: schedule?.start ?? "", availabilityEnd: schedule?.end ?? "", complementaryServiceIds: service.complementaryServiceIds ?? [], packageSessions: String(service.packageOffer?.sessions ?? ""), packageDiscount: String(service.packageOffer?.discountPercent ?? 0), groupCapacity: String(service.groupCapacity ?? 1), publicVisible: service.publicVisible !== false, active: serviceIsActive(service) });
    setError(""); setOpenForm(true);
  };
  const save = async () => {
    if (!establishment) return;
    const duration = Number(form.duration); const price = parseMoney(form.price); const preparation = Number(form.preparation); const cleanup = Number(form.cleanup); const capacity = Number(form.groupCapacity);
    if (!form.name.trim()) return setError("Informe o nome do serviço.");
    if (!Number.isInteger(duration) || duration < 5 || duration > 720) return setError("A duração deve estar entre 5 e 720 minutos.");
    if (!Number.isInteger(price) || price < 0) return setError("Informe um preço válido.");
    if (![preparation, cleanup].every((value) => Number.isInteger(value) && value >= 0 && value <= 180)) return setError("Os intervalos devem ficar entre 0 e 180 minutos.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) return setError("A capacidade deve ficar entre 1 e 100 pessoas.");
    if (Boolean(form.availabilityStart) !== Boolean(form.availabilityEnd) || form.availabilityStart && form.availabilityStart >= form.availabilityEnd) return setError("Informe um intervalo de disponibilidade válido.");
    const packageOffer = hasPackages && Number(form.packageSessions) > 1 ? { sessions: Number(form.packageSessions), discountPercent: Number(form.packageDiscount) } : undefined;
    if (hasPackages && form.packageSessions && !packageOffer) return setError("Pacotes precisam ter no mínimo 2 sessões.");
    const employeeOverrides = Object.fromEntries(form.employeeIds.map((employeeId) => [employeeId, form.employeeOverrides[employeeId] ?? {}]));
    if (Object.values(employeeOverrides).some((override) => override.priceInCents !== undefined && override.priceInCents < 0 || override.durationMinutes !== undefined && (override.durationMinutes < 5 || override.durationMinutes > 720))) return setError("Confira os preços e durações específicos da equipe.");
    const payload = { name: form.name.trim(), category: form.category.trim() || "Geral", description: form.description.trim(), imageUrl: form.imageUrl.trim() || undefined, durationMinutes: duration, priceInCents: price, preparationMinutes: preparation, cleanupMinutes: cleanup, employeeOverrides, availableWeekdays: form.availableWeekdays.length ? form.availableWeekdays as Service["availableWeekdays"] : undefined, availabilityWindows: form.availabilityStart ? [{ start: form.availabilityStart, end: form.availabilityEnd }] : undefined, complementaryServiceIds: form.complementaryServiceIds, packageOffer, groupCapacity: capacity, displayOrder: Number(form.displayOrder) || 0, publicVisible: form.publicVisible, active: form.active, status: form.active ? "ACTIVE" as const : editing?.status === "ARCHIVED" ? "ARCHIVED" as const : "INACTIVE" as const };
    const futureBookings = editing ? listAppointments(establishment.id).filter((item) => item.serviceId === editing.id && item.startsAt > new Date().toISOString() && isActiveAppointmentStatus(item.status)).length : 0;
    const hasCommercialChange = editing && (editing.priceInCents !== price || editing.durationMinutes !== duration || JSON.stringify(editing.employeeOverrides ?? {}) !== JSON.stringify(employeeOverrides));
    if (futureBookings && hasCommercialChange && !await confirm({ title: "Salvar novas condições?", description: `${futureBookings} agendamento(s) futuro(s) já usam o preço e a duração registrados originalmente. As novas condições valerão somente para reservas futuras.` })) return;
    const saved = editing ? updateService(editing.id, payload, establishment.id, form.employeeIds) : createService({ id: newServiceId, establishmentId: establishment.id, ...payload }, form.employeeIds);
    if (!saved) return setError("Não foi possível salvar. Verifique nome, profissionais, pacote e valores.");
    setOpenForm(false); refresh();
  };
  const toggle = async (service: Service) => {
    if (!establishment) return;
    const future = listAppointments(establishment.id).filter((item) => item.serviceId === service.id && item.startsAt > new Date().toISOString() && isActiveAppointmentStatus(item.status)).length;
    const nextActive = !serviceIsActive(service);
    const message = nextActive ? `Reativar “${service.name}” para novas reservas?` : `Desativar “${service.name}” para novas reservas?${future ? ` Os ${future} agendamento(s) existente(s) serão mantidos.` : ""}`;
    if (!await confirm({ title: nextActive ? "Reativar serviço?" : "Desativar serviço?", description: message })) return;
    const result = nextActive ? activateService(service.id, establishment.id) : deactivateService(service.id, establishment.id);
    if (!result) setError("Não foi possível atualizar o serviço."); else { setError(""); refresh(); }
  };
  const archive = async (service: Service) => {
    if (!establishment || !await confirm({ title: `Arquivar “${service.name}”?`, description: "O serviço sai de novas reservas, mas histórico e agendamentos já existentes serão preservados.", destructive: true, confirmLabel: "Arquivar serviço" })) return;
    if (!archiveService(service.id, establishment.id)) setError("Não foi possível arquivar este serviço."); else refresh();
  };
  const remove = async (service: Service) => {
    if (!establishment) return;
    const historyCount = listAppointments(establishment.id).filter((item) => item.serviceId === service.id || item.serviceSnapshots?.some((snapshot) => snapshot.id === service.id)).length;
    if (historyCount) {
      if (!await confirm({ title: "Preservar o histórico deste serviço?", description: `Existem ${historyCount} agendamento(s) associado(s). O serviço será arquivado e deixará de aceitar novas reservas, mas seus registros serão preservados.`, destructive: true, confirmLabel: "Arquivar serviço" })) return;
      if (!archiveService(service.id, establishment.id)) { setError("Não foi possível arquivar este serviço."); return; }
      setSelected(null); setError(""); refresh(); return;
    }
    if (!await confirm({ title: `Excluir “${service.name}”?`, description: "Este serviço não possui agendamentos associados. A exclusão remove também seus vínculos com profissionais e serviços complementares.", destructive: true, confirmLabel: "Excluir serviço" })) return;
    if (!deleteService(service.id, establishment.id)) {
      const nowHasHistory = listAppointments(establishment.id).some((item) => item.serviceId === service.id || item.serviceSnapshots?.some((snapshot) => snapshot.id === service.id));
      setError(nowHasHistory ? "Este serviço recebeu um agendamento e foi preservado. Arquive-o para impedir novas reservas." : "Não foi possível excluir o serviço.");
      refresh(); return;
    }
    setSelected(null); setError(""); refresh();
  };
  const move = (service: Service, direction: -1 | 1) => {
    if (!establishment) return;
    const ordered = [...items].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)); const index = ordered.findIndex((item) => item.id === service.id); const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    if (reorderServices(establishment.id, ordered.map((item) => item.id))) refresh();
  };
  if (status === "loading") return <AdminPageContainer><LoadingStatus className="dashboard-loading">Carregando serviços…</LoadingStatus></AdminPageContainer>;
  if (!establishment) return <AdminPageContainer><AdminPageHeader title="Serviços" description="Estabelecimento indisponível." /><GlassSurface material="frosted" className="dashboard-empty">Não foi possível carregar o catálogo.</GlassSurface></AdminPageContainer>;

  const formModal = <GlassModal open={openForm} onClose={() => setOpenForm(false)} title={editing ? "Editar serviço" : "Novo serviço"} description="Condições comerciais novas valem para reservas futuras; os registros existentes preservam seus valores originais." footer={<><GlassButton variant="quiet" onClick={() => setOpenForm(false)}>Cancelar</GlassButton><GlassButton variant="primary" onClick={save}>Salvar serviço</GlassButton></>}>
    <div className="service-form">
      <GlassInput label="Nome do serviço" value={form.name} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      <GlassInput label="Categoria" value={form.category} maxLength={50} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: Corte, Consulta, Estética" />
      <GlassInput label="Descrição (opcional)" value={form.description} maxLength={240} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
      <GlassInput label="URL da imagem (opcional)" type="url" value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://..." leadingIcon={<ImagePlus size={16} />} />
      <GlassInput label="Preço base (R$)" inputMode="decimal" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="65,00" />
      <GlassInput label="Duração base (minutos)" type="number" min={5} max={720} step={5} value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} />
      <div className="service-form-pair"><GlassInput label="Preparação (min)" type="number" min={0} max={180} value={form.preparation} onChange={(event) => setForm((current) => ({ ...current, preparation: event.target.value }))} /><GlassInput label="Finalização (min)" type="number" min={0} max={180} value={form.cleanup} onChange={(event) => setForm((current) => ({ ...current, cleanup: event.target.value }))} /></div>
      <fieldset className="service-people-picker"><legend className="field-label">Profissionais habilitados</legend>{people.length ? people.map((person) => <div className="service-employee-config" key={person.id}><label><input type="checkbox" checked={form.employeeIds.includes(person.id)} onChange={(event) => setForm((current) => ({ ...current, employeeIds: event.target.checked ? [...current.employeeIds, person.id] : current.employeeIds.filter((id) => id !== person.id) }))} />{person.displayName} · {person.title ?? "Profissional"}</label>{form.employeeIds.includes(person.id) && <div className="service-form-pair"><GlassInput label="Preço específico (R$)" inputMode="decimal" value={form.employeeOverrides[person.id]?.priceInCents === undefined ? "" : (form.employeeOverrides[person.id].priceInCents! / 100).toFixed(2).replace(".", ",")} placeholder={form.price} onChange={(event) => setForm((current) => { const cents = event.target.value.trim() ? parseMoney(event.target.value) : undefined; return { ...current, employeeOverrides: { ...current.employeeOverrides, [person.id]: { ...current.employeeOverrides[person.id], priceInCents: cents } } }; })} /><GlassInput label="Duração específica (min)" type="number" min={5} max={720} value={form.employeeOverrides[person.id]?.durationMinutes ?? ""} placeholder={form.duration} onChange={(event) => setForm((current) => ({ ...current, employeeOverrides: { ...current.employeeOverrides, [person.id]: { ...current.employeeOverrides[person.id], durationMinutes: event.target.value ? Number(event.target.value) : undefined } } }))} /></div>}</div>) : <span>Nenhum profissional ativo cadastrado. Vincule profissionais pela aba Equipe.</span>}</fieldset>
      <fieldset className="service-people-picker"><legend className="field-label">Dias disponíveis</legend><div className="service-weekdays">{weekdays.map((day) => <label key={day.value}><input type="checkbox" checked={!form.availableWeekdays.length || form.availableWeekdays.includes(day.value)} onChange={(event) => setForm((current) => { const currentDays = current.availableWeekdays.length ? current.availableWeekdays : weekdays.map((item) => item.value); const nextDays = event.target.checked ? [...new Set([...currentDays, day.value])] : currentDays.filter((value) => value !== day.value); return { ...current, availableWeekdays: nextDays.length === weekdays.length ? [] : nextDays }; })} />{day.label}</label>)}</div><div className="service-form-pair"><GlassInput label="Disponível a partir de" type="time" value={form.availabilityStart} onChange={(event) => setForm((current) => ({ ...current, availabilityStart: event.target.value }))} /><GlassInput label="Disponível até" type="time" value={form.availabilityEnd} onChange={(event) => setForm((current) => ({ ...current, availabilityEnd: event.target.value }))} /></div><small>Deixe todos os dias selecionados e os horários vazios para usar o expediente normal.</small></fieldset>
      <GlassInput label="Capacidade por horário (1 = individual)" type="number" min={1} max={100} value={form.groupCapacity} onChange={(event) => setForm((current) => ({ ...current, groupCapacity: event.target.value }))} />
      <fieldset className="service-people-picker"><legend className="field-label">Serviços complementares</legend>{items.filter((item) => item.id !== editing?.id && item.status !== "ARCHIVED").map((item) => <label key={item.id}><input type="checkbox" checked={form.complementaryServiceIds.includes(item.id)} onChange={(event) => setForm((current) => ({ ...current, complementaryServiceIds: event.target.checked ? [...current.complementaryServiceIds, item.id] : current.complementaryServiceIds.filter((id) => id !== item.id) }))} />{item.name}</label>)}{!items.some((item) => item.id !== editing?.id && item.status !== "ARCHIVED") && <small>Cadastre outro serviço para oferecer complementos.</small>}</fieldset>
      {hasPackages ? <div className="service-form-pair"><GlassInput label="Sessões do pacote (opcional)" type="number" min={2} max={100} value={form.packageSessions} onChange={(event) => setForm((current) => ({ ...current, packageSessions: event.target.value }))} placeholder="Ex.: 10" /><GlassInput label="Desconto do pacote (%)" type="number" min={0} max={90} value={form.packageDiscount} onChange={(event) => setForm((current) => ({ ...current, packageDiscount: event.target.value }))} /></div> : editing?.packageOffer && <p className="booking-hint">O pacote existente será preservado. A edição de pacotes está desabilitada neste estabelecimento.</p>}
      <div className="page-builder-toggle-list"><label><input type="checkbox" checked={form.publicVisible} onChange={(event) => setForm((current) => ({ ...current, publicVisible: event.target.checked }))} />Mostrar na página pública</label><label><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Aceitar novas reservas para este serviço</label></div>
      <GlassInput label="Ordem de exibição" type="number" min={0} value={form.displayOrder} onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))} />
      {error && <p className="field-message" role="alert">{error}</p>}
    </div>
  </GlassModal>;

  return <AdminPageContainer><AdminPageHeader eyebrow={establishment.name} title="Serviços" description="Organize o catálogo, as condições comerciais e a equipe por categoria." />
    <div className="service-toolbar"><section className="service-summary"><span><b>{items.length}</b> serviços</span><span><b>{items.filter(serviceIsActive).length}</b> ativos</span><span><b>{items.filter((item) => item.status === "ARCHIVED").length}</b> arquivados</span><span><b>{items.filter((item) => !getServiceEmployees(item.id, establishment.id).length).length}</b> sem profissional</span></section><GlassButton className="service-create-button" variant="primary" onClick={openCreate}><Plus size={16} />Novo serviço</GlassButton></div>{error && !openForm && <div className="agenda-feedback" role="alert"><X size={16} />{error}</div>}
    <GlassSurface material="frosted" className="service-list-panel"><div className="service-filters"><GlassInput label="Pesquisar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, categoria ou descrição" leadingIcon={<Search size={16} />} /><GlassSelect label="Status" value={filter} onChange={(event) => setFilter(event.target.value)} options={[{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "inactive", label: "Inativos" }, { value: "archived", label: "Arquivados" }, { value: "unassigned", label: "Sem profissional" }, ...people.map((person) => ({ value: person.id, label: person.displayName }))]} /><GlassSelect label="Categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} options={[{ value: "all", label: "Todas as categorias" }, ...categories.map((category) => ({ value: category, label: category }))]} /><GlassSelect label="Ordenar por" value={sort} onChange={(event) => setSort(event.target.value)} options={[{ value: "manual", label: "Ordem personalizada" }, { value: "name", label: "Nome" }, { value: "price", label: "Preço" }, { value: "duration", label: "Duração" }]} /></div>
      {filtered.length ? <div className="service-categories">{[...new Set(filtered.map((item) => item.category || "Geral"))].map((category) => <section className="service-category" key={category}><h2>{category}</h2><div className="service-list">{filtered.filter((service) => (service.category || "Geral") === category).map((service) => { const servicePeople = getServiceEmployees(service.id, establishment.id); const futureBookings = listAppointments(establishment.id).filter((item) => item.serviceId === service.id && item.startsAt > new Date().toISOString() && ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(item.status)).length; return <article className={`service-row${service.status === "ARCHIVED" ? " is-archived" : ""}`} key={service.id}>{service.imageUrl && <div className="service-row-image" style={{ backgroundImage: `url(${service.imageUrl})` }} role="img" aria-label={service.name} />}<div className="service-main"><strong>{service.name}</strong><span>{service.description || "Sem descrição cadastrada."}</span><small><Clock3 size={13} />{durationLabel(service.durationMinutes)} <Users size={13} />{servicePeople.length} profissional{servicePeople.length === 1 ? "" : "is"}{futureBookings > 0 && <> · {futureBookings} reserva{futureBookings === 1 ? "" : "s"} futura{futureBookings === 1 ? "" : "s"}</>}</small></div><strong className="service-price">{formatCurrency(service.priceInCents)}</strong><span className={`employee-status ${serviceIsActive(service) ? "is-active" : "is-inactive"}`}>{serviceStatus(service)}{service.publicVisible === false && " · Oculto"}</span><div className="service-actions"><GlassButton variant="quiet" size="sm" onClick={() => setSelected(service)}>Detalhes <ArrowRight size={14} /></GlassButton><GlassButton variant="quiet" size="icon" onClick={() => openEdit(service)} aria-label={`Editar ${service.name}`}><Pencil size={15} /></GlassButton>{sort === "manual" && <><GlassButton variant="quiet" size="icon" onClick={() => move(service, -1)} aria-label={`Mover ${service.name} para cima`}><ArrowUp size={15} /></GlassButton><GlassButton variant="quiet" size="icon" onClick={() => move(service, 1)} aria-label={`Mover ${service.name} para baixo`}><ArrowDown size={15} /></GlassButton></>}{service.status === "ARCHIVED" ? <GlassButton variant="quiet" size="icon" onClick={() => toggle(service)} aria-label={`Reativar ${service.name}`}><Check size={15} /></GlassButton> : <><GlassButton variant="quiet" size="icon" onClick={() => toggle(service)} aria-label={serviceIsActive(service) ? `Desativar ${service.name}` : `Ativar ${service.name}`}>{serviceIsActive(service) ? <X size={15} /> : <Check size={15} />}</GlassButton><GlassButton variant="quiet" size="icon" onClick={() => archive(service)} aria-label={`Arquivar ${service.name}`}><Archive size={15} /></GlassButton></>}</div></article>; })}</div></section>)}</div> : <div className="dashboard-empty"><p>{items.length ? "Nenhum serviço corresponde aos filtros atuais." : "Você ainda não cadastrou serviços."}</p><GlassButton variant="ghost" onClick={() => { setQuery(""); setFilter("all"); setCategoryFilter("all"); }}>{items.length ? "Limpar filtros" : "Cadastrar primeiro serviço"}</GlassButton></div>}
    </GlassSurface>{selected && <ServiceDetails service={selected} establishmentId={establishment.id} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onDelete={() => void remove(selected)} />}{formModal}</AdminPageContainer>;
}
