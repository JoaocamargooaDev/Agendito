"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Copy, UserRound } from "lucide-react";
import { GlassButton, GlassInput, GlassSurface } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { createAppointment, getAppointment, isActiveAppointmentStatus, listAppointments, listBlockedPeriods, updateAppointment } from "@/features/agenda";
import { getAvailableSlots, validateSlot } from "@/features/agenda/availability";
import { listEmployees } from "@/features/employees";
import { listServices } from "@/features/services";
import { addDays, dateKeyInTimezone, isoForLocalTime } from "./rules";
import { getEstablishmentSettings } from "@/features/settings";
import type { Establishment } from "@/types";
import { getPageConfig } from "@/features/platform/storage";
import { getPublicBookingBlockReason, isFeatureEnabled } from "@/features/platform/policies";
import { createWaitlistEntry } from "@/features/advanced/repository";
import { getPublishedPageContent } from "@/features/platform/public-page-builder";
import { removeGuestCustomer, saveGuestCustomer } from "./guest-repository";
import { canCancelAppointment, canRescheduleAppointment } from "@/features/customer/repository";
import { serviceIsActive, serviceSetTotals } from "@/features/services/domain";
import { getPublicThemeTokens, isPublicThemeDark } from "@/features/public-establishment/theme";

type Step = "service" | "professional" | "date" | "time" | "details" | "review" | "confirmation";
type AuthMode = "login" | "register" | "guest";
const labels: Record<Step, string> = { service: "Serviço", professional: "Profissional", date: "Data", time: "Horário", details: "Seus dados", review: "Revisão", confirmation: "Comprovante" };
function initials(value: string) { return value.split(" ").map((part) => part[0]).join("").slice(0, 2); }
function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function readableDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(`${value}T12:00:00`)); }

export function PublicBookingPage({ establishment, serviceParam, employeeParam }: { establishment: Establishment; serviceParam?: string; employeeParam?: string }) {
  const auth = useAuth();
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState(serviceParam ?? "");
  const [additionalServiceIds, setAdditionalServiceIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState(employeeParam ?? "any");
  const [dateKey, setDateKey] = useState("");
  const [time, setTime] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [reschedulingId, setReschedulingId] = useState("");
  const [receiptStatus, setReceiptStatus] = useState<"confirmed" | "updated" | "cancelled">("confirmed");
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false); const [createdId, setCreatedId] = useState(""); const [shareMessage, setShareMessage] = useState("");
  const [showWaitlist, setShowWaitlist] = useState(false); const [waitlistFeedback, setWaitlistFeedback] = useState("");
  const [waitlistDays, setWaitlistDays] = useState<number[]>([]); const [waitlistStart, setWaitlistStart] = useState(""); const [waitlistEnd, setWaitlistEnd] = useState("");
  const [localAppointments, setLocalAppointments] = useState(() => listAppointments(establishment.id));
  const pageContent = useMemo(() => getPublishedPageContent(getPageConfig(establishment.id)), [establishment.id]);
  const tenantPageStyle = {
    ...getPublicThemeTokens(pageContent),
    fontFamily: pageContent?.typography === "editorial" ? 'Georgia, "Times New Roman", serif' : pageContent?.typography === "rounded" ? 'ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif' : undefined,
  } as CSSProperties;
  const services = useMemo(() => listServices(establishment.id).filter((item) => serviceIsActive(item) && item.publicVisible !== false).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)), [establishment.id]);
  const config = useMemo(() => getEstablishmentSettings(establishment.id), [establishment.id]);
  const employees = useMemo(() => listEmployees(establishment.id).filter((item) => item.active), [establishment.id]);
  const service = services.find((item) => item.id === serviceId) ?? null;
  const additionalServices = useMemo(() => service ? (service.complementaryServiceIds ?? []).map((id) => services.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item && additionalServiceIds.includes(item.id))) : [], [additionalServiceIds, service, services]);
  const chosenServices = useMemo(() => service ? [service, ...additionalServices] : [], [additionalServices, service]);
  const eligibleEmployees = useMemo(() => chosenServices.length ? employees.filter((item) => chosenServices.every((selected) => item.serviceIds.includes(selected.id))) : [], [employees, chosenServices]);
  const today = dateKeyInTimezone(new Date(), establishment.timezone);
  const maxDate = addDays(today, config.booking.maximumDaysAhead);
  const orderedCandidates = useMemo(() => {
    if (employeeId !== "any") return eligibleEmployees.filter((item) => item.id === employeeId);
    const candidates = [...eligibleEmployees];
    const strategy = config.booking.anyEmployeeStrategy ?? "FIRST_AVAILABLE";
    return candidates.sort((a, b) => {
      if (strategy === "BALANCED") {
        const countFor = (employeeId: string) => localAppointments.filter((item) => item.employeeId === employeeId && item.establishmentId === establishment.id && isActiveAppointmentStatus(item.status) && dateKeyInTimezone(new Date(item.startsAt), establishment.timezone) === dateKey).length;
        const loadDifference = countFor(a.id) - countFor(b.id);
        if (loadDifference) return loadDifference;
      }
      return a.id.localeCompare(b.id);
    });
  }, [dateKey, eligibleEmployees, employeeId, localAppointments, config.booking.anyEmployeeStrategy, establishment.id, establishment.timezone]);
  useEffect(() => {
    const refresh = () => setLocalAppointments(listAppointments(establishment.id));
    refresh();
    window.addEventListener("agendito:agenda-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("agendito:agenda-updated", refresh); window.removeEventListener("storage", refresh); };
  }, [establishment.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const receiptId = new URLSearchParams(window.location.search).get("comprovante");
      if (!receiptId) return;
      const appointment = getAppointment(receiptId, establishment.id);
      if (!appointment) return;
      const matchedService = listServices(establishment.id).find((item) => item.id === appointment.serviceId);
      if (!matchedService) return;
      setCreatedId(appointment.id); setServiceId(matchedService.id); setEmployeeId(appointment.employeeId);
      setAdditionalServiceIds((appointment.serviceSnapshots ?? []).map((snapshot) => snapshot.id).filter((id) => id !== appointment.serviceId));
      setDateKey(dateKeyInTimezone(new Date(appointment.startsAt), establishment.timezone));
      setTime(new Intl.DateTimeFormat("en-GB", { timeZone: establishment.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(appointment.startsAt)));
      setReceiptStatus(appointment.status === "CANCELLED" ? "cancelled" : "confirmed");
      setStep("confirmation");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [establishment.id, establishment.timezone]);
  const slots = useMemo(() => {
    if (!service || !dateKey) return [] as Array<{ start: string; end: string; employeeId: string }>;
    const appointments = localAppointments; const blockedPeriods = listBlockedPeriods(establishment.id);
    const candidateIds = orderedCandidates.map((item) => item.id);
    const map = new Map<string, { start: string; end: string; employeeId: string }>();
    for (const id of candidateIds) for (const slot of getAvailableSlots({ establishmentId: establishment.id, employeeId: id, service, services: chosenServices, dateKey, timezone: establishment.timezone, appointments, blockedPeriods, source: "public" }, config.booking.slotStepMinutes)) if (!map.has(slot.start)) map.set(slot.start, { ...slot, employeeId: id });
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [dateKey, orderedCandidates, establishment, service, chosenServices, config, localAppointments]);
  const selectedSlot = slots.find((item) => item.start === time) ?? null;
  const selectedEmployee = employees.find((item) => item.id === (selectedSlot?.employeeId ?? employeeId)) ?? null;
  const bookingTotals = useMemo(() => serviceSetTotals(chosenServices, selectedEmployee?.id ?? (employeeId === "any" ? "" : employeeId)), [chosenServices, employeeId, selectedEmployee?.id]);
  const joinWaitlist = () => {
    if (!service || !dateKey) return setWaitlistFeedback("Selecione primeiro um serviço e uma data.");
    const customer = auth.user?.role === "CUSTOMER" ? auth.user : null;
    const customerName = customer?.name ?? name.trim(); const customerPhone = customer?.phone || phone.trim();
    const weekdays = waitlistDays.length ? waitlistDays : [new Date(`${dateKey}T12:00:00Z`).getUTCDay()];
    const created = createWaitlistEntry({ establishmentId: establishment.id, customerId: customer?.customer?.id, customerName, phone: customerPhone, serviceId: service.id, employeeId: employeeId === "any" ? undefined : employeeId, weekdays, preferredStart: waitlistStart || undefined, preferredEnd: waitlistEnd || undefined });
    setWaitlistFeedback(created ? "Solicitação registrada. Avisaremos neste sistema quando surgir uma oportunidade." : "Informe nome e telefone ou verifique se já existe uma solicitação igual.");
    if (created) setShowWaitlist(false);
  };
  const progressSteps = (pageContent?.allowProfessionalChoice === false ? ["service", "date", "time", "details", "review"] : ["service", "professional", "date", "time", "details", "review"]) as Step[];
  const configuredFields = pageContent?.bookingFields;
  const guestAllowed = pageContent?.allowGuestBooking === true;
  const guestHasContact = configuredFields?.email === false && configuredFields?.phone === false || Boolean(email.trim() || phone.trim());
  const guestValid = Boolean(name.trim()) && guestHasContact && (configuredFields?.email === false || !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim())) && (configuredFields?.phone === false || !phone.trim() || phone.trim().length >= 8);
  const canContinue = step === "service" ? Boolean(service) : step === "professional" ? Boolean(employeeId && eligibleEmployees.length && (employeeId !== "any" || config.booking.allowAnyEmployee)) : step === "date" ? Boolean(dateKey) : step === "time" ? Boolean(selectedSlot) : step === "details" ? (auth.user?.role === "CUSTOMER" || (authMode === "guest" ? guestAllowed && guestValid : Boolean(email.trim() && password))) : true;

  function moveNext() {
    setError("");
    if (step === "service") setStep(pageContent?.allowProfessionalChoice === false ? "date" : "professional");
    else if (step === "professional") setStep("date");
    else if (step === "date") setStep("time");
    else if (step === "time") setStep("details");
    else if (step === "details") setStep("review");
  }
  function back() {
    setError("");
    if (step === "professional") setStep("service");
    else if (step === "date") setStep(pageContent?.allowProfessionalChoice === false ? "service" : "professional");
    else if (step === "time") setStep("date");
    else if (step === "details") setStep("time");
    else if (step === "review") setStep("details");
  }
  async function authenticate() {
    setError(""); setSubmitting(true);
    const result = authMode === "login"
      ? await auth.login(email.trim(), password, "CUSTOMER", true)
      : await auth.registerCustomer({ name: configuredFields?.name === false ? name.trim() || "Cliente" : name.trim(), phone: configuredFields?.phone === false ? "" : phone.trim(), email: email.trim(), password }, true);
    setSubmitting(false);
    if (!result.ok) { setError(result.message); return; }
    setStep("review");
  }
  function confirm() {
    if (!service || !selectedSlot || !selectedEmployee) return;
    const isGuest = auth.user?.role !== "CUSTOMER";
    if (!isGuest && !auth.user?.customer?.id) { setError("Não foi possível identificar sua conta. Entre novamente e tente outra vez."); setStep("details"); return; }
    if (isGuest && (authMode !== "guest" || !guestAllowed || !guestValid)) { setStep("details"); setError("Confira seus dados para continuar."); return; }
    const blockedReason = getPublicBookingBlockReason(establishment, getPageConfig(establishment.id));
    if (blockedReason) { setError(blockedReason); return; }
    const startsAt = isoForLocalTime(dateKey, selectedSlot.start, establishment.timezone);
    const endsAt = isoForLocalTime(dateKey, selectedSlot.end, establishment.timezone);
    const check = validateSlot({ establishmentId: establishment.id, employeeId: selectedEmployee.id, service, services: chosenServices, dateKey, timezone: establishment.timezone, appointments: listAppointments(establishment.id), blockedPeriods: listBlockedPeriods(establishment.id), source: "public" }, startsAt, endsAt, reschedulingId || undefined);
    if (!check.ok) { setError(check.reason ?? "Este horário não está mais disponível."); setTime(""); setStep("time"); return; }
    setError(""); setSubmitting(true);
    if (reschedulingId) {
      const existing = getAppointment(reschedulingId, establishment.id);
      const permission = existing ? canRescheduleAppointment(existing) : { ok: false, reason: "Este agendamento não está mais disponível para alteração." };
      if (!permission.ok) { setSubmitting(false); setError(permission.reason ?? "Não foi possível reagendar este horário."); setReschedulingId(""); setStep("confirmation"); return; }
      const updated = updateAppointment(reschedulingId, { startsAt, endsAt }, establishment.id, "public", auth.user?.role === "CUSTOMER" ? "CUSTOMER" : "PUBLIC");
      setSubmitting(false);
      if (!updated) { setError("Esse horário acabou de ficar indisponível. Escolha outra opção."); setTime(""); setStep("time"); return; }
      setReceiptStatus("updated"); setReschedulingId(""); window.history.replaceState(null, "", `${window.location.pathname}?comprovante=${encodeURIComponent(createdId)}`); setStep("confirmation"); return;
    }
    const guestId = isGuest ? `guest-${establishment.id}-${Date.now()}` : "";
    if (isGuest && !saveGuestCustomer({ id: guestId, establishmentId: establishment.id, name: name.trim(), email: configuredFields?.email === false ? undefined : email.trim() || undefined, phone: configuredFields?.phone === false ? undefined : phone.trim() || undefined, createdAt: new Date().toISOString() })) { setSubmitting(false); setError("Não foi possível salvar seus dados neste navegador. Tente novamente."); return; }
    const serviceSnapshots = bookingTotals.services.map((item) => ({ id: item.id, name: item.name, durationMinutes: item.durationMinutes, priceInCents: item.priceInCents, groupCapacity: item.groupCapacity, preparationMinutes: item.preparationMinutes, cleanupMinutes: item.cleanupMinutes, availableWeekdays: item.availableWeekdays, availabilityWindows: item.availabilityWindows }));
    const appointment = createAppointment({ id: `apt-public-${Date.now()}`, establishmentId: establishment.id, employeeId: selectedEmployee.id, customerId: isGuest ? guestId : auth.user!.customer!.id, serviceId: service.id, startsAt, endsAt, status: "SCHEDULED", serviceNameSnapshot: serviceSnapshots.map((item) => item.name).join(" + "), serviceSnapshots, durationMinutesSnapshot: bookingTotals.durationMinutes, priceInCentsSnapshot: bookingTotals.priceInCents, notes: configuredFields?.notes ? notes.trim() : undefined, createdAt: new Date().toISOString() }, "public");
    setSubmitting(false);
    if (!appointment) { if (guestId) removeGuestCustomer(guestId, establishment.id); setError("Esse horário acabou de ficar indisponível. Escolha uma nova opção."); setTime(""); setStep("time"); return; }
    setCreatedId(appointment.id); window.history.replaceState(null, "", `${window.location.pathname}?comprovante=${encodeURIComponent(appointment.id)}`); setStep("confirmation");
  }
  async function shareReceipt() {
    const details = `${establishment.name}\n${service?.name ?? "Agendamento"}\n${readableDate(dateKey)} às ${time}\nComprovante: ${createdId}\n${window.location.href}`;
    try {
      if (navigator.share) await navigator.share({ title: "Meu agendamento", text: details });
      else { await navigator.clipboard.writeText(details); setShareMessage("Comprovante copiado."); }
    } catch { setShareMessage("Não foi possível compartilhar agora. Você ainda pode consultar este comprovante nesta tela."); }
  }
  const alternateSlots = useMemo(() => {
    if (!service || !dateKey || slots.length) return [] as Array<{ date: string; time: string; employeeId: string }>;
    const alternatives: Array<{ date: string; time: string; employeeId: string }> = [];
    const candidateIds = orderedCandidates.map((item) => item.id);
    for (let offset = 1; offset <= 7 && addDays(dateKey, offset) <= maxDate && alternatives.length < 3; offset += 1) {
      const alternativeDate = addDays(dateKey, offset);
      for (const id of candidateIds) {
        const first = getAvailableSlots({ establishmentId: establishment.id, employeeId: id, service, services: chosenServices, dateKey: alternativeDate, timezone: establishment.timezone, appointments: localAppointments, blockedPeriods: listBlockedPeriods(establishment.id), source: "public" }, config.booking.slotStepMinutes)[0];
        if (first) { alternatives.push({ date: alternativeDate, time: first.start, employeeId: id }); break; }
      }
    }
    return alternatives;
  }, [localAppointments, config, dateKey, orderedCandidates, establishment, maxDate, service, chosenServices, slots.length]);

  if (step === "confirmation") {
    const receipt = createdId ? getAppointment(createdId, establishment.id) : null;
    const cancellation = receipt ? canCancelAppointment(receipt) : { ok: false, reason: "" };
    const rescheduling = receipt ? canRescheduleAppointment(receipt) : { ok: false, reason: "" };
    return <main className="booking-page public-tenant-page" data-public-tone={isPublicThemeDark(pageContent) ? "dark" : "light"} data-public-template={pageContent?.template ?? "essential"} data-public-palette={pageContent?.palette ?? "moss"} style={tenantPageStyle}><div className="booking-shell"><Link className="booking-back" href={`/e/${establishment.slug}`}><ArrowLeft size={16} /> {establishment.name}</Link><GlassSurface material="frosted" className="booking-confirmation"><span className="booking-confirmation-icon">{receiptStatus === "cancelled" ? <CalendarDays size={24} /> : <Check size={24} />}</span><span className="eyebrow">{receiptStatus === "cancelled" ? "Agendamento cancelado" : receiptStatus === "updated" ? "Agendamento atualizado" : "Agendamento confirmado"}</span><h1>{receiptStatus === "cancelled" ? "A reserva foi cancelada." : "Seu horário está reservado."}</h1><p>Guarde os detalhes abaixo. O pagamento é realizado diretamente no estabelecimento.</p><div className="booking-summary"><strong>{establishment.name}</strong>{(receipt?.serviceSnapshots?.length ? receipt.serviceSnapshots : bookingTotals.services).map((item) => <span key={item.id}>{item.name}</span>)}<span><CalendarDays size={15} />{readableDate(dateKey)} às {time}</span>{pageContent?.allowProfessionalChoice !== false && <span><UserRound size={15} />{selectedEmployee?.displayName}</span>}{pageContent?.showDurations !== false && <span><Clock3 size={15} />{receipt?.durationMinutesSnapshot ?? bookingTotals.durationMinutes} minutos</span>}{pageContent?.showPrices !== false && <span>{money(receipt?.priceInCentsSnapshot ?? bookingTotals.priceInCents)}</span>}<span>Código: {createdId}</span>{auth.user?.role !== "CUSTOMER" && <span>Reserva feita como convidado · {name}</span>}</div><div className="booking-actions"><GlassButton variant="primary" onClick={shareReceipt}><Copy size={16} /> Compartilhar comprovante</GlassButton>{auth.user?.role !== "CUSTOMER" && receiptStatus !== "cancelled" && rescheduling.ok && <GlassButton variant="quiet" onClick={() => { setReschedulingId(createdId); setDateKey(""); setTime(""); setError(""); setStep("date"); }}>Reagendar</GlassButton>}{auth.user?.role !== "CUSTOMER" && receiptStatus !== "cancelled" && cancellation.ok && <GlassButton variant="quiet" onClick={() => { const current = getAppointment(createdId, establishment.id); const permission = current ? canCancelAppointment(current) : { ok: false, reason: "Este agendamento não foi encontrado." }; if (!permission.ok) { setShareMessage(permission.reason ?? "Não foi possível cancelar agora."); return; } const result = updateAppointment(createdId, { status: "CANCELLED" }, establishment.id, "public"); if (result) setReceiptStatus("cancelled"); else setShareMessage("Não foi possível cancelar agora. Tente novamente."); }}>Cancelar reserva</GlassButton>}<GlassButton asChild variant="quiet"><Link href={`/e/${establishment.slug}`}>Voltar à página pública</Link></GlassButton>{auth.user?.role === "CUSTOMER" && <GlassButton asChild variant="quiet"><Link href="/customer">Ver meus agendamentos</Link></GlassButton>}</div>{receiptStatus !== "cancelled" && receipt && !cancellation.ok && <p className="booking-hint">{cancellation.reason}</p>}{receiptStatus !== "cancelled" && receipt && !rescheduling.ok && <p className="booking-hint">{rescheduling.reason}</p>}{error && <p className="form-error" role="alert">{error}</p>}{shareMessage && <p role="status" className="booking-hint">{shareMessage}</p>}</GlassSurface></div></main>;
  }

  return <main className="booking-page public-tenant-page" data-public-tone={isPublicThemeDark(pageContent) ? "dark" : "light"} data-public-template={pageContent?.template ?? "essential"} data-public-palette={pageContent?.palette ?? "moss"} style={tenantPageStyle}><div className="booking-shell"><Link className="booking-back" href={`/e/${establishment.slug}`}><ArrowLeft size={16} /> {establishment.name}</Link><div className="booking-heading"><span className="eyebrow">Agendamento público</span><h1>Escolha como deseja ser atendido.</h1><p>Consulte os horários e informe seus dados para concluir a reserva.</p></div><nav className="booking-progress" aria-label="Etapas do agendamento">{progressSteps.map((item, index) => <span className={step === item ? "is-current" : ""} key={item} aria-current={step === item ? "step" : undefined}><b>{index + 1}</b>{labels[item]}</span>)}</nav><GlassSurface material="frosted" className="booking-panel">
    {step === "service" && <section><span className="eyebrow">1 · Serviço</span><h2>O que você deseja agendar?</h2><div className="booking-option-grid">{services.length === 0 && <p className="booking-empty">Este estabelecimento ainda não cadastrou serviços para agendamento.</p>}{services.map((item) => <button type="button" className={`booking-option booking-service-option ${serviceId === item.id ? "is-selected" : ""}`} onClick={() => { setServiceId(item.id); setAdditionalServiceIds([]); setTime(""); }} key={item.id}><span><strong>{item.name}</strong><small>{item.description}</small></span><span>{pageContent?.showDurations !== false && `${item.durationMinutes} min`}{pageContent?.showDurations !== false && pageContent?.showPrices !== false && " · "}{pageContent?.showPrices !== false && money(item.priceInCents)}</span></button>)}</div>{service && (service.complementaryServiceIds ?? []).some((id) => services.some((item) => item.id === id)) && <div className="booking-complements"><h3>Adicionar serviços complementares</h3>{services.filter((item) => service.complementaryServiceIds?.includes(item.id)).map((item) => <label key={item.id}><input type="checkbox" checked={additionalServiceIds.includes(item.id)} onChange={(event) => { setAdditionalServiceIds((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id)); setTime(""); setEmployeeId("any"); }} /><span>{item.name}</span><small>{pageContent?.showDurations !== false && `${item.durationMinutes} min`}{pageContent?.showDurations !== false && pageContent?.showPrices !== false && " · "}{pageContent?.showPrices !== false && money(item.priceInCents)}</small></label>)}</div>}{chosenServices.length > 1 && <p className="booking-hint">Total combinado: {pageContent?.showDurations !== false && `${bookingTotals.durationMinutes} min`}{pageContent?.showDurations !== false && pageContent?.showPrices !== false && " · "}{pageContent?.showPrices !== false && money(bookingTotals.priceInCents)}</p>}</section>}
    {step === "professional" && <section><span className="eyebrow">2 · Profissional</span><h2>Com quem você gostaria de ser atendido?</h2><div className="booking-option-grid">{config.booking.allowAnyEmployee && <button type="button" className={`booking-option ${employeeId === "any" ? "is-selected" : ""}`} onClick={() => setEmployeeId("any")}><span><strong>Qualquer profissional</strong><small>Mostramos o primeiro horário elegível.</small></span><UserRound size={18} /></button>}{eligibleEmployees.length === 0 && <p className="booking-empty">Nenhum profissional está vinculado a este serviço.</p>}{eligibleEmployees.map((item) => <button type="button" className={`booking-option ${employeeId === item.id ? "is-selected" : ""}`} onClick={() => setEmployeeId(item.id)} key={item.id}><span><strong>{item.displayName}</strong><small>{item.title || "Profissional"}</small></span><span className="booking-avatar">{initials(item.displayName)}</span></button>)}</div></section>}
    {step === "date" && <section><span className="eyebrow">3 · Data</span><h2>Qual dia funciona melhor?</h2><GlassInput label="Data do atendimento" type="date" min={today} max={maxDate} value={dateKey} onChange={(event) => { setDateKey(event.target.value); setTime(""); }} /><p className="booking-hint">Consulte disponibilidade para os próximos {config.booking.maximumDaysAhead} dias.</p></section>}
    {step === "time" && <section><span className="eyebrow">4 · Horário</span><h2>Horários disponíveis em {readableDate(dateKey)}.</h2>{slots.length ? <div className="booking-time-grid">{slots.map((slot) => <button type="button" className={`booking-time ${time === slot.start ? "is-selected" : ""}`} onClick={() => setTime(slot.start)} key={`${slot.start}-${slot.employeeId}`}><Clock3 size={15} />{slot.start}</button>)}</div> : <div className="booking-empty"><CalendarDays size={18} /><p>Nenhum horário disponível para este dia.</p></div>}{alternateSlots.length > 0 && <div className="booking-alternatives"><strong>Próximos horários disponíveis</strong>{alternateSlots.map((alternative) => <button type="button" key={alternative.date} onClick={() => { setDateKey(alternative.date); setEmployeeId(alternative.employeeId); setTime(alternative.time); }}>{new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${alternative.date}T12:00:00`))} · {alternative.time}</button>)}</div>}{!slots.length && service && isFeatureEnabled(establishment, "waitlist") && <div className="booking-waitlist"><strong>Não encontrou um horário?</strong><p>Entre na lista de espera para este serviço. Avisaremos quando surgir uma oportunidade.</p>{showWaitlist ? <div className="booking-waitlist-form">{auth.user?.role !== "CUSTOMER" && <GlassInput label="Seu nome" value={name} onChange={(event) => setName(event.target.value)} />}{(!auth.user || auth.user.role !== "CUSTOMER" || !auth.user.phone) && <GlassInput label="Telefone / WhatsApp" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />}<fieldset className="booking-waitlist-days"><legend>Dias preferidos</legend>{[{ day: 0, label: "Dom" }, { day: 1, label: "Seg" }, { day: 2, label: "Ter" }, { day: 3, label: "Qua" }, { day: 4, label: "Qui" }, { day: 5, label: "Sex" }, { day: 6, label: "Sáb" }].map((item) => { const preferredDay = new Date(`${dateKey}T12:00:00Z`).getUTCDay(); const checked = (waitlistDays.length ? waitlistDays : [preferredDay]).includes(item.day); return <label key={item.day}><input type="checkbox" checked={checked} onChange={(event) => setWaitlistDays((current) => { const days = current.length ? current : [preferredDay]; return event.target.checked ? [...new Set([...days, item.day])] : days.filter((day) => day !== item.day); })} />{item.label}</label>; })}</fieldset><div className="booking-waitlist-times"><GlassInput label="A partir de (opcional)" type="time" value={waitlistStart} onChange={(event) => setWaitlistStart(event.target.value)} /><GlassInput label="Até (opcional)" type="time" value={waitlistEnd} onChange={(event) => setWaitlistEnd(event.target.value)} /></div><div className="booking-actions"><GlassButton variant="primary" onClick={joinWaitlist}>Entrar na lista</GlassButton><GlassButton variant="quiet" onClick={() => setShowWaitlist(false)}>Cancelar</GlassButton></div></div> : <GlassButton variant="secondary" onClick={() => { setShowWaitlist(true); setWaitlistDays([new Date(`${dateKey}T12:00:00Z`).getUTCDay()]); setWaitlistFeedback(""); }}>Entrar na lista de espera</GlassButton>}{waitlistFeedback && <p className="booking-hint" role="status">{waitlistFeedback}</p>}</div>}</section>}
    {step === "details" && <section><span className="eyebrow">5 · Seus dados</span><h2>{auth.user?.role === "CUSTOMER" ? "Confira seus dados de contato." : "Como podemos confirmar sua reserva?"}</h2>{auth.user?.role === "CUSTOMER" ? <div className="booking-summary"><strong>{auth.user.name}</strong><span>{auth.user.email}</span>{auth.user.phone && <span>{auth.user.phone}</span>}</div> : <>{guestAllowed && <div className="booking-auth-switch"><button type="button" className={authMode === "guest" ? "is-selected" : ""} onClick={() => { setAuthMode("guest"); setError(""); }}>Reservar sem conta</button><button type="button" className={authMode !== "guest" ? "is-selected" : ""} onClick={() => { setAuthMode("login"); setError(""); }}>Entrar ou criar conta</button></div>}{authMode === "guest" && guestAllowed ? <div className="booking-auth"><GlassInput label="Nome" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />{configuredFields?.email !== false && <GlassInput label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />}{configuredFields?.phone !== false && <GlassInput label="Telefone / WhatsApp" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />}{configuredFields?.notes && <GlassInput label="Observação (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />}<p className="booking-hint">Informe seu nome e ao menos um contato válido para receber as informações do agendamento.</p><p className="booking-hint">Seus dados serão usados apenas para identificar este agendamento neste navegador.</p></div> : <div className="booking-auth"><div className="booking-auth-switch"><button type="button" className={authMode === "login" ? "is-selected" : ""} onClick={() => setAuthMode("login")}>Já tenho conta</button><button type="button" className={authMode === "register" ? "is-selected" : ""} onClick={() => setAuthMode("register")}>Criar conta</button></div>{authMode === "register" && <><GlassInput label="Nome" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />{configuredFields?.phone !== false && <GlassInput label="Telefone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />}</>}<GlassInput label="E-mail da conta" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /><GlassInput label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} /></div>}</>}{auth.user?.role === "CUSTOMER" && configuredFields?.notes && <GlassInput label="Observação (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />}{error && <p className="form-error" role="alert">{error}</p>}</section>}
    {step === "review" && service && selectedSlot && selectedEmployee && <section><span className="eyebrow">{progressSteps.length} · Revisão</span><h2>Confira os detalhes antes de confirmar.</h2><div className="booking-summary">{bookingTotals.services.map((item) => <strong key={item.id}>{item.name}</strong>)}<span><CalendarDays size={15} />{readableDate(dateKey)} às {selectedSlot.start}</span>{pageContent?.allowProfessionalChoice !== false && <span><UserRound size={15} />{selectedEmployee.displayName}</span>}{pageContent?.showDurations !== false && <span><Clock3 size={15} />{bookingTotals.durationMinutes} minutos no total</span>}{pageContent?.showPrices !== false && <span>{money(bookingTotals.priceInCents)}</span>}{auth.user?.role === "CUSTOMER" ? <span>Cliente: {auth.user.name}</span> : <span>Cliente: {name.trim()}{email && ` · ${email}`}{phone && ` · ${phone}`}</span>}</div>{configuredFields?.notes && notes.trim() && <p className="booking-note">Observação: {notes.trim()}</p>}<p className="booking-note">Pagamento realizado diretamente no estabelecimento. Nenhum pagamento online é processado.</p></section>}
    {error && step !== "details" && <p className="form-error" role="alert">{error}</p>}
    <div className="booking-actions">{["professional", "date", "time", "details", "review"].includes(step) && <GlassButton variant="quiet" onClick={back}>Voltar</GlassButton>}{step === "review" ? <GlassButton variant="primary" onClick={confirm} loading={submitting}>Confirmar agendamento <ArrowRight size={16} /></GlassButton> : step === "details" && auth.user?.role !== "CUSTOMER" && authMode !== "guest" ? <GlassButton variant="primary" onClick={authenticate} loading={submitting} disabled={!email.trim() || !password}>Continuar <ArrowRight size={16} /></GlassButton> : step === "details" ? <GlassButton variant="primary" onClick={moveNext} disabled={!canContinue}>Revisar agendamento <ArrowRight size={16} /></GlassButton> : <GlassButton variant="primary" onClick={moveNext} disabled={!canContinue}>Continuar <ArrowRight size={16} /></GlassButton>}</div>
  </GlassSurface></div></main>;
}
