"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Copy, ExternalLink, Settings2, Trash2 } from "lucide-react";
import { GlassPopover, useConfirmation } from "@/components/ui";
import {
  clearNotifications, deleteNotification, getNotificationPreferences, listCommunicationHistory, listNotifications,
  markAllNotificationsRead, markNotificationRead, recordCommunication, saveNotificationPreferences,
  type LocalNotification, type NotificationContext, type NotificationPreferences, type NotificationType,
} from "@/features/notifications/repository";

const labels: Record<NotificationType, string> = {
  BOOKING_CREATED: "Novo agendamento", BOOKING_CANCELLED: "Cancelamento", BOOKING_RESCHEDULED: "Reagendamento",
  STATUS_CHANGED: "Status alterado", PAGE_PUBLISHED: "Página publicada", ESTABLISHMENT_SUSPENDED: "Suspensão",
  ESTABLISHMENT_REACTIVATED: "Reativação", REMINDER_24H: "Lembrete · 24 horas", REMINDER_2H: "Lembrete · 2 horas",
  REMINDER_CUSTOM: "Lembrete personalizado", WAITLIST_OPPORTUNITY: "Oportunidade na lista de espera", COMMUNICATION: "Comunicação simulada",
};
const editableTypes: NotificationType[] = ["BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED", "STATUS_CHANGED", "PAGE_PUBLISHED", "ESTABLISHMENT_SUSPENDED", "ESTABLISHMENT_REACTIVATED", "REMINDER_24H", "REMINDER_2H", "REMINDER_CUSTOM"];
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }

export function NotificationCenter({ context, contextId, establishmentId }: { context: NotificationContext; contextId: string; establishmentId?: string }) {
  const confirm = useConfirmation();
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => getNotificationPreferences(establishmentId));
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [templateType, setTemplateType] = useState<NotificationType>("BOOKING_CREATED");
  const [feedback, setFeedback] = useState("");
  const refresh = useCallback(() => setNotifications(listNotifications(context, contextId, establishmentId)), [context, contextId, establishmentId]);
  useEffect(() => { const initialLoad = window.setTimeout(() => { refresh(); setPreferences(getNotificationPreferences(establishmentId)); }, 0); window.addEventListener("agendito:notifications-updated", refresh); const syncStorage = () => { refresh(); setPreferences(getNotificationPreferences(establishmentId)); }; window.addEventListener("storage", syncStorage); return () => { window.clearTimeout(initialLoad); window.removeEventListener("agendito:notifications-updated", refresh); window.removeEventListener("storage", syncStorage); }; }, [refresh, establishmentId]);
  const visible = useMemo(() => notifications.filter((item) => (typeFilter === "all" || item.type === typeFilter) && (!dateFilter || item.createdAt.slice(0, 10) === dateFilter)), [notifications, typeFilter, dateFilter]);
  const unread = notifications.filter((item) => !item.readAt).length;
  const selectedTemplate = preferences.templates[templateType] ?? { title: labels[templateType], message: "" };
  const changeTemplate = (key: "title" | "message", value: string) => setPreferences((current) => ({ ...current, templates: { ...current.templates, [templateType]: { ...selectedTemplate, [key]: value } } }));
  const savePreferences = () => setFeedback(saveNotificationPreferences(establishmentId, preferences) ? "Preferências salvas neste contexto." : "Não foi possível salvar as preferências neste navegador.");
  const copyMessage = async (item: LocalNotification) => { try { await navigator.clipboard.writeText(item.message); if (item.establishmentId) recordCommunication(item.establishmentId, item.relatedId, "COPY", item.message); setFeedback("Mensagem copiada. Nenhum envio foi realizado."); } catch { setFeedback("Não foi possível copiar a mensagem neste navegador."); } };
  const openWhatsApp = (item: LocalNotification) => { window.open("https://wa.me/?text=" + encodeURIComponent(item.message), "_blank", "noopener,noreferrer"); if (item.establishmentId) recordCommunication(item.establishmentId, item.relatedId, "WHATSAPP", item.message); setFeedback("WhatsApp aberto com a mensagem preenchida. O envio depende da sua confirmação no aplicativo."); };
  const copyLink = async (item: LocalNotification) => { if (!item.link) return; try { await navigator.clipboard.writeText(new URL(item.link, window.location.origin).toString()); setFeedback("Link copiado."); } catch { setFeedback("Não foi possível copiar o link neste navegador."); } };
  const toggleType = (type: NotificationType) => setPreferences((current) => ({ ...current, enabledTypes: current.enabledTypes.includes(type) ? current.enabledTypes.filter((value) => value !== type) : [...current.enabledTypes, type] }));
  const history = establishmentId ? listCommunicationHistory(establishmentId).slice(0, 5) : [];
  return <GlassPopover label="Central de notificações" align="end" panelClassName="admin-notifications-popover notification-center-popover" trigger={<span className="icon-trigger"><Bell size={18} /><span className="sr-only">Notificações</span>{unread > 0 && <i className="notification-count" aria-label={unread + " não lidas"}>{unread > 9 ? "9+" : unread}</i>}</span>}>
    <div className="notification-heading"><div><strong>Notificações</strong><small>{unread} não lidas</small></div><div className="notification-heading-actions"><button type="button" className="notification-text-action" onClick={() => markAllNotificationsRead(context, contextId, establishmentId)} disabled={!unread}><CheckCheck size={14} />Marcar lidas</button><button type="button" className="notification-text-action" onClick={async () => { if (await confirm({ title: "Excluir notificações?", description: "Todas as notificações deste contexto serão removidas.", destructive: true, confirmLabel: "Excluir notificações" })) clearNotifications(context, contextId, establishmentId); }} disabled={!notifications.length}><Trash2 size={14} />Limpar</button></div></div>
    <div className="notification-filter-row"><select aria-label="Filtrar por tipo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Todos os tipos</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Filtrar por data" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div>
    <div className="notification-list">{visible.length ? visible.slice(0, 50).map((item) => <article className={"notification-item " + (!item.readAt ? "notification-unread" : "")} key={item.id}><span className="notification-dot" /><div className="notification-body"><button type="button" className="notification-open" onClick={() => !item.readAt && markNotificationRead(item.id)}><strong>{item.title}</strong><span className="notification-type-label">{labels[item.type]}</span><p>{item.message}</p><small>{dateTime(item.createdAt)}</small></button><div className="notification-item-actions"><button type="button" aria-label="Copiar mensagem" title="Copiar mensagem" onClick={() => void copyMessage(item)}><Copy size={13} /></button>{item.link && <button type="button" aria-label="Copiar link" title="Copiar link" onClick={() => void copyLink(item)}><ExternalLink size={13} /></button>}<button type="button" aria-label="Abrir WhatsApp com mensagem" title="Abrir WhatsApp com mensagem" onClick={() => openWhatsApp(item)}><span>WA</span></button><button type="button" aria-label="Excluir notificação" title="Excluir" onClick={() => deleteNotification(item.id)}><Trash2 size={13} /></button></div></div></article>) : <p className="notification-empty">Nenhuma notificação para este contexto e filtro.</p>}</div>
    {feedback && <p className="notification-feedback" role="status">{feedback}</p>}
    {context === "ESTABLISHMENT" && establishmentId && <details className="notification-settings"><summary><Settings2 size={14} />Preferências, lembretes e modelos</summary>
      <section><strong>Tipos ativos</strong>{editableTypes.map((type) => <label key={type}><input type="checkbox" checked={preferences.enabledTypes.includes(type)} onChange={() => toggleType(type)} />{labels[type]}</label>)}</section>
      <section><strong>Lembretes locais</strong><label><input type="checkbox" checked={preferences.reminders.hours24} onChange={(event) => setPreferences((current) => ({ ...current, reminders: { ...current.reminders, hours24: event.target.checked } }))} />24 horas antes</label><label><input type="checkbox" checked={preferences.reminders.hours2} onChange={(event) => setPreferences((current) => ({ ...current, reminders: { ...current.reminders, hours2: event.target.checked } }))} />2 horas antes</label><label><input type="checkbox" checked={preferences.reminders.custom} onChange={(event) => setPreferences((current) => ({ ...current, reminders: { ...current.reminders, custom: event.target.checked } }))} />Horário personalizado</label>{preferences.reminders.custom && <label>Minutos antes<input type="number" min={5} max={10080} value={preferences.reminders.customMinutes} onChange={(event) => setPreferences((current) => ({ ...current, reminders: { ...current.reminders, customMinutes: Number(event.target.value) || 5 } }))} /></label>}<small>Os lembretes são simulados enquanto a aplicação está aberta neste navegador.</small></section>
      <section><strong>Modelo de mensagem</strong><select aria-label="Tipo de modelo" value={templateType} onChange={(event) => setTemplateType(event.target.value as NotificationType)}>{editableTypes.map((type) => <option value={type} key={type}>{labels[type]}</option>)}</select><input aria-label="Título do modelo" value={selectedTemplate.title} onChange={(event) => changeTemplate("title", event.target.value)} /><textarea aria-label="Texto do modelo" rows={3} value={selectedTemplate.message} onChange={(event) => changeTemplate("message", event.target.value)} /><small>Variáveis: {"{customer}"}, {"{service}"}, {"{date}"}, {"{status}"}, {"{establishment}"}.</small></section>
      <button type="button" className="notification-save-preferences" onClick={savePreferences}>Salvar preferências</button>
      {history.length > 0 && <section><strong>Histórico de compartilhamentos preparados</strong>{history.map((item) => <small key={item.id}>{item.method === "COPY" ? "Mensagem copiada" : "WhatsApp aberto"} · {dateTime(item.at)}. Envio não confirmado pelo Agendito.</small>)}</section>}
    </details>}
  </GlassPopover>;
}
