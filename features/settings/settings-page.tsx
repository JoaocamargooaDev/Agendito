"use client";

import Link from "next/link";
import { CalendarOff, Check, Copy, ExternalLink, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { GlassButton, GlassInput, GlassSelect, GlassSurface } from "@/components/ui";
import { AdminHeaderActionSlot } from "@/components/admin/admin-header-actions";
import { useAuth } from "@/features/auth";
import type { BlockedPeriod, BusinessHoursDay, Establishment, EstablishmentSettings } from "@/types";
import {
  createEstablishmentClosure,
  getEstablishmentSettings,
  getPersistedEstablishment,
  listEstablishmentClosures,
  removeEstablishmentClosure,
  updateBookingRules,
  updateBusinessHours,
  updateCustomerPolicies,
  updateEstablishmentInfo,
} from "./repository";

const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const tabs = [
  ["general", "Informações gerais"],
  ["branding", "Identidade visual"],
  ["hours", "Funcionamento"],
  ["closures", "Feriados e pausas"],
  ["rules", "Regras de agendamento"],
  ["policies", "Cancelamento e reagendamento"],
] as const;

function fileToDataUrl(file: File, setter: (value: string) => void, setError: (value: string) => void) {
  if (!file.type.startsWith("image/") || file.size > 1_500_000) {
    setError("Escolha uma imagem válida de até 1,5 MB.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => setter(String(reader.result));
  reader.onerror = () => setError("Não foi possível ler esta imagem.");
  reader.readAsDataURL(file);
}

function formatClosureRange(period: BlockedPeriod, timezone: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric" });
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const start = formatter.format(new Date(period.startsAt));
  const inclusiveEnd = formatter.format(new Date(new Date(period.endsAt).getTime() - 1));
  const startTime = timeFormatter.format(new Date(period.startsAt));
  const endTime = timeFormatter.format(new Date(period.endsAt));
  if (startTime === "00:00" && endTime === "00:00") return start === inclusiveEnd ? start : `${start} até ${inclusiveEnd}`;
  const endDate = formatter.format(new Date(period.endsAt));
  return start === endDate ? `${start} · ${startTime}–${endTime}` : `${start} ${startTime} até ${endDate} ${endTime}`;
}

export function EstablishmentSettingsPage() {
  const { user } = useAuth();
  const establishmentId = user?.role === "ADMIN" ? user.establishmentId : undefined;
  const initial = establishmentId ? getPersistedEstablishment(establishmentId) : null;
  const initialRules = establishmentId ? getEstablishmentSettings(establishmentId) : null;
  const [establishment, setEstablishment] = useState<Establishment | null>(initial);
  const [settings, setSettings] = useState<EstablishmentSettings | null>(initialRules);
  const [closures, setClosures] = useState<BlockedPeriod[]>(establishmentId ? listEstablishmentClosures(establishmentId) : []);
  const [closureForm, setClosureForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("general");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [hoursDirty, setHoursDirty] = useState(false);
  const [hoursFeedback, setHoursFeedback] = useState("");
  const [hoursError, setHoursError] = useState("");

  useEffect(() => {
    if (!establishmentId) return;
    const refreshSettings = () => {
      setEstablishment(getPersistedEstablishment(establishmentId));
      setSettings(getEstablishmentSettings(establishmentId));
    };
    const refreshClosures = () => setClosures(listEstablishmentClosures(establishmentId));
    window.addEventListener("agendito:settings-updated", refreshSettings);
    window.addEventListener("agendito:agenda-updated", refreshClosures);
    return () => {
      window.removeEventListener("agendito:settings-updated", refreshSettings);
      window.removeEventListener("agendito:agenda-updated", refreshClosures);
    };
  }, [establishmentId]);

  if (!establishment || !settings || !establishmentId) {
    return <GlassSurface material="frosted" className="settings-empty">Estabelecimento administrativo não encontrado.</GlassSurface>;
  }

  const update = (patch: Partial<Establishment>) => {
    setEstablishment((current) => current ? { ...current, ...patch } : current);
    setDirty(true); setFeedback(""); setError("");
  };
  const updateRules = (patch: Partial<EstablishmentSettings>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
    setDirty(true); setFeedback(""); setError("");
  };
  const updateDay = (index: number, patch: Partial<BusinessHoursDay>) => {
    setSettings((current) => current ? { ...current, businessHours: current.businessHours.map((day, i) => i === index ? { ...day, ...patch } : day) } : current);
    setHoursDirty(true);
    setHoursFeedback("");
    setHoursError("");
  };
  const finishSave = (message: string) => { setFeedback(message); setError(""); setDirty(false); };

  const saveInfo = () => {
    const result = updateEstablishmentInfo(establishmentId, { name: establishment.name.trim(), description: establishment.description.trim(), phone: establishment.phone.trim(), instagram: establishment.instagram?.trim(), address: establishment.address });
    if (!result.ok) setError(result.reason); else finishSave("Informações salvas.");
  };
  const saveBranding = () => {
    const result = updateEstablishmentInfo(establishmentId, { logoUrl: establishment.logoUrl, coverUrl: establishment.coverUrl });
    if (!result.ok) setError(result.reason); else finishSave("Identidade visual salva.");
  };
  const saveHours = () => {
    setHoursFeedback("");
    setHoursError("");
    const result = updateBusinessHours(establishmentId, settings.businessHours);
    if (!result.ok) {
      setHoursError(result.reason);
      return;
    }
    setHoursDirty(false);
    setHoursFeedback(hoursDirty ? "Funcionamento salvo." : "O funcionamento já estava salvo.");
  };
  const saveRules = () => {
    const result = updateBookingRules(establishmentId, settings.booking);
    if (!result.ok) setError(result.reason); else finishSave("Regras de agendamento salvas.");
  };
  const savePolicies = () => {
    const result = updateCustomerPolicies(establishmentId, settings.cancellation, settings.rescheduling);
    if (!result.ok) setError(result.reason); else finishSave("Políticas salvas.");
  };
  const addClosure = () => {
    const result = createEstablishmentClosure(establishmentId, establishment.timezone, closureForm);
    if (!result.ok) return setError(result.reason);
    setClosureForm({ startDate: "", endDate: "", reason: "" });
    setClosures(listEstablishmentClosures(establishmentId));
    finishSave("Fechamento adicionado à disponibilidade pública.");
  };
  const deleteClosure = (periodId: string) => {
    const result = removeEstablishmentClosure(establishmentId, periodId);
    if (!result.ok) return setError(result.reason);
    setClosures(listEstablishmentClosures(establishmentId));
    finishSave("Fechamento removido.");
  };
  const publicUrl = `/e/${establishment.slug}`;
  const copyLink = () => { void navigator.clipboard?.writeText(`${window.location.origin}${publicUrl}`); setFeedback("Link público copiado."); };

  return <div className="settings-page">
    <AdminHeaderActionSlot><div className="settings-public-actions"><GlassButton variant="quiet" onClick={copyLink}><Copy size={15} />Copiar link</GlassButton><GlassButton asChild variant="primary"><Link href={publicUrl} target="_blank"><ExternalLink size={15} />Abrir página pública</Link></GlassButton></div></AdminHeaderActionSlot>
    <div className="settings-tabs" role="tablist" aria-label="Seções das configurações">{tabs.map(([key, label]) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => { setTab(key); setError(""); setFeedback(""); }} key={key}>{label}</button>)}</div>
    {feedback && <p className="customer-feedback" role="status"><Check size={15} />{feedback}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}

    {tab === "general" && <GlassSurface material="frosted" className="settings-panel"><h2>Informações gerais</h2><p className="settings-muted">Dados exibidos ao cliente na página do estabelecimento.</p><div className="settings-form-grid"><GlassInput label="Nome comercial" value={establishment.name} onChange={(event) => update({ name: event.target.value })} /><GlassInput label="Telefone" value={establishment.phone} onChange={(event) => update({ phone: event.target.value })} /><GlassInput label="Instagram" placeholder="@seuperfil ou https://instagram.com/..." value={establishment.instagram ?? ""} onChange={(event) => update({ instagram: event.target.value })} /><label className="glass-field"><span>Descrição</span><textarea value={establishment.description} onChange={(event) => update({ description: event.target.value })} rows={4} /></label><h3>Endereço</h3><GlassInput label="Rua" value={establishment.address.street} onChange={(event) => update({ address: { ...establishment.address, street: event.target.value } })} /><GlassInput label="Número" value={establishment.address.number} onChange={(event) => update({ address: { ...establishment.address, number: event.target.value } })} /><GlassInput label="Bairro" value={establishment.address.district} onChange={(event) => update({ address: { ...establishment.address, district: event.target.value } })} /><GlassInput label="Cidade" value={establishment.address.city} onChange={(event) => update({ address: { ...establishment.address, city: event.target.value } })} /><GlassInput label="Estado" value={establishment.address.state} onChange={(event) => update({ address: { ...establishment.address, state: event.target.value } })} /><GlassInput label="CEP" value={establishment.address.postalCode} onChange={(event) => update({ address: { ...establishment.address, postalCode: event.target.value } })} /></div><div className="settings-save"><GlassButton variant="primary" onClick={saveInfo} disabled={!dirty}>Salvar informações</GlassButton></div></GlassSurface>}

    {tab === "branding" && <GlassSurface material="frosted" className="settings-panel"><h2>Foto de perfil e capa</h2><p className="settings-muted">A foto de perfil identifica o estabelecimento; a capa ocupa a área principal da página pública.</p><div className="settings-upload-grid"><label className="settings-upload"><span>Foto de perfil / logo</span><div className="settings-logo-preview">{establishment.logoUrl ? <img src={establishment.logoUrl} alt="Prévia da foto de perfil" /> : <ImagePlus size={22} />}</div><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => event.target.files?.[0] && fileToDataUrl(event.target.files[0], (value) => update({ logoUrl: value }), setError)} /><small>PNG, JPG, WebP ou SVG · até 1,5 MB</small>{establishment.logoUrl && <button type="button" onClick={() => update({ logoUrl: undefined })}>Remover</button>}</label><label className="settings-upload"><span>Foto de capa pública</span><div className="settings-cover-preview" style={establishment.coverUrl ? { backgroundImage: `url(${establishment.coverUrl})` } : undefined}>{!establishment.coverUrl && <ImagePlus size={22} />}</div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && fileToDataUrl(event.target.files[0], (value) => update({ coverUrl: value }), setError)} /><small>Imagem horizontal · até 1,5 MB</small>{establishment.coverUrl && <button type="button" onClick={() => update({ coverUrl: undefined })}>Remover</button>}</label></div><div className="settings-save"><GlassButton variant="primary" onClick={saveBranding} disabled={!dirty}>Salvar identidade</GlassButton></div></GlassSurface>}

    {tab === "hours" && <GlassSurface material="frosted" className="settings-panel"><h2>Funcionamento geral</h2><p className="settings-muted">O horário geral limita a disponibilidade pública. O expediente individual continua sendo editado em Equipe.</p><div className="business-hours-list">{settings.businessHours.map((day, index) => <div className="business-hours-day" key={day.weekday}><label><input type="checkbox" checked={day.open} onChange={(event) => updateDay(index, { open: event.target.checked })} /><strong>{days[day.weekday]}</strong></label>{day.open ? <div className="business-intervals">{day.intervals.map((range, rangeIndex) => <div className="business-interval" key={`${day.weekday}-${rangeIndex}`}><GlassInput label="Início" type="time" value={range.start} onChange={(event) => updateDay(index, { intervals: day.intervals.map((item, i) => i === rangeIndex ? { ...item, start: event.target.value } : item) })} /><GlassInput label="Fim" type="time" value={range.end} onChange={(event) => updateDay(index, { intervals: day.intervals.map((item, i) => i === rangeIndex ? { ...item, end: event.target.value } : item) })} /><button type="button" aria-label={`Remover intervalo de ${days[day.weekday]}`} onClick={() => updateDay(index, { intervals: day.intervals.filter((_, i) => i !== rangeIndex) })}><Trash2 size={16} /></button></div>)}<button className="settings-add-interval" type="button" onClick={() => updateDay(index, { intervals: [...day.intervals, { start: "09:00", end: "18:00" }] })}><Plus size={14} />Adicionar intervalo</button></div> : <span className="settings-muted">Fechado</span>}</div>)}</div><div className="settings-save"><GlassButton variant="primary" onClick={saveHours}>Salvar funcionamento</GlassButton>{hoursError && <p className="form-error" role="alert">{hoursError}</p>}{hoursFeedback && <p className="customer-feedback" role="status">{hoursFeedback}</p>}</div></GlassSurface>}

    {tab === "closures" && <GlassSurface material="frosted" className="settings-panel"><h2>Feriados e fechamentos</h2><p className="settings-muted">Os dias cadastrados ficam indisponíveis para todos os profissionais e para novos agendamentos públicos.</p><div className="closure-form"><GlassInput label="Data inicial" type="date" value={closureForm.startDate} onChange={(event) => setClosureForm((current) => ({ ...current, startDate: event.target.value, endDate: current.endDate || event.target.value }))} /><GlassInput label="Data final" type="date" min={closureForm.startDate || undefined} value={closureForm.endDate} onChange={(event) => setClosureForm((current) => ({ ...current, endDate: event.target.value }))} /><GlassInput label="Motivo" placeholder="Ex.: Natal, manutenção ou recesso" value={closureForm.reason} onChange={(event) => setClosureForm((current) => ({ ...current, reason: event.target.value }))} /><GlassButton variant="primary" onClick={addClosure}><Plus size={15} />Adicionar fechamento</GlassButton></div><div className="closure-list" aria-live="polite">{closures.length ? closures.map((period) => <article className="closure-row" key={period.id}><span className="closure-icon" aria-hidden><CalendarOff size={18} /></span><div><strong>{period.reason}</strong><span>{formatClosureRange(period, establishment.timezone)}</span></div><GlassButton variant="quiet" size="icon" aria-label={`Remover fechamento ${period.reason}`} onClick={() => deleteClosure(period.id)}><Trash2 size={16} /></GlassButton></article>) : <div className="settings-inline-empty"><CalendarOff size={20} aria-hidden /><div><strong>Nenhum fechamento cadastrado</strong><span>O funcionamento semanal será usado normalmente.</span></div></div>}</div></GlassSurface>}

    {tab === "rules" && <GlassSurface material="frosted" className="settings-panel"><h2>Regras de agendamento</h2><div className="settings-form-grid"><GlassSelect label="Antecedência mínima" value={String(settings.booking.minimumLeadMinutes)} onChange={(event) => updateRules({ booking: { ...settings.booking, minimumLeadMinutes: Number(event.target.value) } })} options={[{ value: "0", label: "Sem antecedência adicional" }, { value: "30", label: "30 minutos" }, { value: "60", label: "1 hora" }, { value: "120", label: "2 horas" }, { value: "240", label: "4 horas" }]} /><GlassSelect label="Janela máxima" value={String(settings.booking.maximumDaysAhead)} onChange={(event) => updateRules({ booking: { ...settings.booking, maximumDaysAhead: Number(event.target.value) } })} options={[7, 15, 30, 60, 90].map((value) => ({ value: String(value), label: `${value} dias` }))} /><GlassSelect label="Intervalo entre horários" value={String(settings.booking.slotStepMinutes)} onChange={(event) => updateRules({ booking: { ...settings.booking, slotStepMinutes: Number(event.target.value) } })} options={[5, 10, 15, 30].map((value) => ({ value: String(value), label: `${value} minutos` }))} /></div><label className="settings-check"><input type="checkbox" checked={settings.booking.allowAnyEmployee} onChange={(event) => updateRules({ booking: { ...settings.booking, allowAnyEmployee: event.target.checked } })} /> Permitir que o cliente escolha qualquer profissional disponível</label><p className="settings-muted">Fuso horário: <strong>{establishment.timezone}</strong>.</p><div className="settings-save"><GlassButton variant="primary" onClick={saveRules} disabled={!dirty}>Salvar regras</GlassButton></div></GlassSurface>}

    {tab === "policies" && <GlassSurface material="frosted" className="settings-panel"><h2>Cancelamento e reagendamento</h2><div className="settings-form-grid"><label className="settings-check"><input type="checkbox" checked={settings.cancellation.customerCanCancel} onChange={(event) => updateRules({ cancellation: { ...settings.cancellation, customerCanCancel: event.target.checked } })} /> Permitir cancelamento pelo cliente</label><GlassSelect label="Antecedência para cancelar" value={String(settings.cancellation.minimumLeadMinutes)} onChange={(event) => updateRules({ cancellation: { ...settings.cancellation, minimumLeadMinutes: Number(event.target.value) } })} options={[60, 120, 240, 1440].map((value) => ({ value: String(value), label: value === 1440 ? "24 horas" : `${value / 60} hora(s)` }))} /><label className="settings-check"><input type="checkbox" checked={settings.rescheduling.customerCanReschedule} onChange={(event) => updateRules({ rescheduling: { ...settings.rescheduling, customerCanReschedule: event.target.checked } })} /> Permitir reagendamento pelo cliente</label><GlassSelect label="Antecedência para reagendar" value={String(settings.rescheduling.minimumLeadMinutes)} onChange={(event) => updateRules({ rescheduling: { ...settings.rescheduling, minimumLeadMinutes: Number(event.target.value) } })} options={[60, 120, 240, 1440].map((value) => ({ value: String(value), label: value === 1440 ? "24 horas" : `${value / 60} hora(s)` }))} /></div><div className="settings-save"><GlassButton variant="primary" onClick={savePolicies} disabled={!dirty}>Salvar políticas</GlassButton></div></GlassSurface>}
  </div>;
}
