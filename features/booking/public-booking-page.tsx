"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassButton, GlassInput, GlassSurface } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { createAppointment, listAppointments, listBlockedPeriods } from "@/features/agenda";
import { getAvailableSlots, validateSlot } from "@/features/agenda/availability";
import { listEmployees } from "@/features/employees";
import { listServices } from "@/features/services";
import { addDays, dateKeyInTimezone, isoForLocalTime } from "./rules";
import { getEstablishmentSettings } from "@/features/settings";
import type { Establishment } from "@/types";

type Step = "service" | "professional" | "date" | "time" | "review" | "auth" | "confirmation";
const labels: Record<Step, string> = { service: "Serviço", professional: "Profissional", date: "Data", time: "Horário", review: "Revisão", auth: "Acesso", confirmation: "Confirmado" };

function initials(value: string) { return value.split(" ").map((part) => part[0]).join("").slice(0, 2); }
function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function readableDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(`${value}T12:00:00`)); }

export function PublicBookingPage({ establishment, serviceParam, employeeParam }: { establishment: Establishment; serviceParam?: string; employeeParam?: string }) {
  const auth = useAuth();
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState(serviceParam ?? "");
  const [employeeId, setEmployeeId] = useState(employeeParam ?? "any");
  const [dateKey, setDateKey] = useState("");
  const [time, setTime] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false); const [, setCreatedId] = useState("");
  const services = useMemo(() => listServices(establishment.id).filter((item) => item.active), [establishment.id]);
  const config = useMemo(() => getEstablishmentSettings(establishment.id), [establishment.id]);
  const employees = useMemo(() => listEmployees(establishment.id).filter((item) => item.active), [establishment.id]);
  const service = services.find((item) => item.id === serviceId) ?? null;
  const eligibleEmployees = useMemo(() => service ? employees.filter((item) => item.serviceIds.includes(service.id)) : [], [employees, service]);
  const today = dateKeyInTimezone(new Date(), establishment.timezone);
  const maxDate = addDays(today, config.booking.maximumDaysAhead);
  const slots = useMemo(() => {
    if (!service || !dateKey) return [] as Array<{ start: string; end: string; employeeId: string }>;
    const appointments = listAppointments(); const blockedPeriods = listBlockedPeriods();
    const candidateIds = employeeId === "any" ? eligibleEmployees.map((item) => item.id) : [employeeId];
    const map = new Map<string, { start: string; end: string; employeeId: string }>();
    for (const id of candidateIds) for (const slot of getAvailableSlots({ establishmentId: establishment.id, employeeId: id, service, dateKey, timezone: establishment.timezone, appointments, blockedPeriods }, config.booking.slotStepMinutes)) if (!map.has(slot.start)) map.set(slot.start, { ...slot, employeeId: id });
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [dateKey, eligibleEmployees, employeeId, establishment, service, config]);
  const selectedEmployee = employees.find((item) => item.id === (slots.find((item) => item.start === time)?.employeeId ?? employeeId)) ?? null;
  const selectedSlot = slots.find((item) => item.start === time) ?? null;
  const canContinue = step === "service" ? Boolean(service) : step === "professional" ? Boolean(employeeId && eligibleEmployees.length) : step === "date" ? Boolean(dateKey) : step === "time" ? Boolean(selectedSlot) : true;

  function next() { setError(""); if (step === "service") setStep("professional"); else if (step === "professional") setStep("date"); else if (step === "date") setStep("time"); else if (step === "time") setStep("review"); else if (step === "review") setStep(auth.user?.role === "CUSTOMER" ? "confirmation" : "auth"); }
  function back() { setError(""); if (step === "professional") setStep("service"); else if (step === "date") setStep("professional"); else if (step === "time") setStep("date"); else if (step === "review") setStep("time"); else if (step === "auth") setStep("review"); }
  async function authenticate() { setError(""); setSubmitting(true); const result = authMode === "login" ? await auth.login(email, password, "CUSTOMER", true) : await auth.registerCustomer({ name, phone, email, password }, true); setSubmitting(false); if (!result.ok) { setError(result.message); return; } setStep("review"); }
  function confirm() { if (!service || !selectedSlot || !selectedEmployee || auth.user?.role !== "CUSTOMER" || !auth.user.customer) return; setError(""); setSubmitting(true); const startsAt = isoForLocalTime(dateKey, selectedSlot.start, establishment.timezone); const endsAt = isoForLocalTime(dateKey, selectedSlot.end, establishment.timezone); const check = validateSlot({ establishmentId: establishment.id, employeeId: selectedEmployee.id, service, dateKey, timezone: establishment.timezone, appointments: listAppointments(), blockedPeriods: listBlockedPeriods() }, startsAt, endsAt); if (!check.ok) { setError(check.reason ?? "Este horário não está mais disponível."); setSubmitting(false); return; } const appointment = createAppointment({ id: `apt-public-${Date.now()}`, establishmentId: establishment.id, employeeId: selectedEmployee.id, customerId: auth.user.customer.id, serviceId: service.id, startsAt, endsAt, status: "SCHEDULED", serviceNameSnapshot: service.name, durationMinutesSnapshot: service.durationMinutes, priceInCentsSnapshot: service.priceInCents, createdAt: new Date().toISOString() }); setSubmitting(false); if (!appointment) { setError("Não foi possível concluir o agendamento. Tente novamente."); return; } setCreatedId(appointment.id); setStep("confirmation"); }

  if (step === "confirmation") return <main className="booking-page"><div className="booking-shell"><Link className="booking-back" href={`/e/${establishment.slug}`}><ArrowLeft size={16} /> Voltar para {establishment.name}</Link><GlassSurface material="frosted" className="booking-confirmation"><span className="booking-confirmation-icon"><Check size={24} /></span><span className="eyebrow">Agendamento criado</span><h1>Seu horário está reservado.</h1><p>Apresente-se no estabelecimento no horário combinado. O pagamento é realizado diretamente no local.</p><div className="booking-summary"><strong>{service?.name}</strong><span>{readableDate(dateKey)} às {time}</span><span>{selectedEmployee?.displayName} · {service?.durationMinutes} minutos · {service ? money(service.priceInCents) : ""}</span></div><div className="booking-actions"><GlassButton asChild variant="primary"><Link href={`/e/${establishment.slug}`}>Voltar à página pública</Link></GlassButton><GlassButton asChild variant="quiet"><Link href="/customer">Ver meus agendamentos</Link></GlassButton></div></GlassSurface></div></main>;

  return <main className="booking-page"><div className="booking-shell"><Link className="booking-back" href={`/e/${establishment.slug}`}><ArrowLeft size={16} /> {establishment.name}</Link><div className="booking-heading"><span className="eyebrow">Agendamento público</span><h1>Escolha como deseja ser atendido.</h1><p>Você pode consultar horários sem criar uma conta. O acesso é solicitado apenas no momento da confirmação.</p></div><nav className="booking-progress" aria-label="Etapas do agendamento">{(["service", "professional", "date", "time", "review"] as Step[]).map((item, index) => <span className={step === item ? "is-current" : ""} key={item}><b>{index + 1}</b>{labels[item]}</span>)}</nav><GlassSurface material="frosted" className="booking-panel">
    {step === "service" && <section><span className="eyebrow">1 · Serviço</span><h2>O que você deseja agendar?</h2><div className="booking-option-grid">{services.length === 0 && <p className="booking-empty">Este estabelecimento ainda não cadastrou serviços para agendamento.</p>}{services.map((item) => <button type="button" className={`booking-option booking-service-option ${serviceId === item.id ? "is-selected" : ""}`} onClick={() => { setServiceId(item.id); setTime(""); }} key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small></span><span>{item.durationMinutes} min · {money(item.priceInCents)}</span></button>)}</div></section>}
    {step === "professional" && <section><span className="eyebrow">2 · Profissional</span><h2>Com quem você gostaria de ser atendido?</h2><div className="booking-option-grid"><button type="button" className={`booking-option ${employeeId === "any" ? "is-selected" : ""}`} onClick={() => setEmployeeId("any")}><span><strong>Qualquer profissional</strong><small>Mostramos o primeiro horário elegível.</small></span><UserRound size={18} /></button>{eligibleEmployees.length === 0 && <p className="booking-empty">Nenhum profissional está vinculado a este serviço.</p>}{eligibleEmployees.map((item) => <button type="button" className={`booking-option ${employeeId === item.id ? "is-selected" : ""}`} onClick={() => setEmployeeId(item.id)} key={item.id}><span><strong>{item.displayName}</strong><small>{item.title || "Profissional"}</small></span><span className="booking-avatar">{initials(item.displayName)}</span></button>)}</div></section>}
    {step === "date" && <section><span className="eyebrow">3 · Data</span><h2>Qual dia funciona melhor?</h2><GlassInput label="Data do atendimento" type="date" min={today} max={maxDate} value={dateKey} onChange={(event) => { setDateKey(event.target.value); setTime(""); }} /><p className="booking-hint">Consulte disponibilidade para os próximos {config.booking.maximumDaysAhead} dias.</p></section>}
    {step === "time" && <section><span className="eyebrow">4 · Horário</span><h2>Horários disponíveis em {readableDate(dateKey)}.</h2>{slots.length ? <div className="booking-time-grid">{slots.map((slot) => <button type="button" className={`booking-time ${time === slot.start ? "is-selected" : ""}`} onClick={() => setTime(slot.start)} key={slot.start}><Clock3 size={15} />{slot.start}</button>)}</div> : <div className="booking-empty"><CalendarDays size={18} /><p>Nenhum horário disponível para este dia. Volte e escolha outra data.</p></div>}</section>}
    {step === "review" && service && selectedSlot && selectedEmployee && <section><span className="eyebrow">5 · Revisão</span><h2>Confira os detalhes antes de continuar.</h2><div className="booking-summary"><strong>{service.name}</strong><span><CalendarDays size={15} />{readableDate(dateKey)} às {selectedSlot.start}</span><span><UserRound size={15} />{selectedEmployee.displayName}</span><span><Clock3 size={15} />{service.durationMinutes} minutos · {money(service.priceInCents)}</span></div><p className="booking-note">Pagamento realizado diretamente no estabelecimento. Nenhum pagamento online é processado pelo Agendito.</p></section>}
    {step === "auth" && <section className="booking-auth"><span className="eyebrow">Confirmação</span><h2>Entre ou crie sua conta de cliente.</h2><p>Precisamos de uma conta CUSTOMER para vincular este agendamento ao seu histórico.</p><div className="booking-auth-switch"><button type="button" className={authMode === "login" ? "is-selected" : ""} onClick={() => setAuthMode("login")}>Já tenho conta</button><button type="button" className={authMode === "register" ? "is-selected" : ""} onClick={() => setAuthMode("register")}>Criar conta</button></div>{authMode === "register" && <><GlassInput label="Nome" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /><GlassInput label="Telefone" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></>}<GlassInput label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /><GlassInput label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} />{error && <p className="form-error" role="alert">{error}</p>}</section>}
    {error && step !== "auth" && <p className="form-error" role="alert">{error}</p>}
    <div className="booking-actions">{["professional", "date", "time", "review", "auth"].includes(step) && <GlassButton variant="quiet" onClick={back}>Voltar</GlassButton>}{step === "review" ? <GlassButton variant="primary" onClick={() => auth.user?.role === "CUSTOMER" ? confirm() : next()} loading={submitting}>Confirmar agendamento <ArrowRight size={16} /></GlassButton> : step === "auth" ? <GlassButton variant="primary" onClick={authenticate} loading={submitting}>Continuar <ArrowRight size={16} /></GlassButton> : <GlassButton variant="primary" onClick={next} disabled={!canContinue}>Continuar <ArrowRight size={16} /></GlassButton>}</div>
  </GlassSurface></div></main>;
}
