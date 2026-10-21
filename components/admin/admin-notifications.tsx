"use client";

import { useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { GlassButton, GlassPopover } from "@/components/ui";
import { adminNotifications } from "@/features/admin";

export function AdminNotifications() {
  const [notifications, setNotifications] = useState(adminNotifications);
  const unread = notifications.filter((item) => item.unread).length;
  return <GlassPopover label="Notificações" align="end" panelClassName="admin-notifications-popover" trigger={<span className="icon-trigger"><Bell size={18} /><span className="sr-only">Notificações</span>{unread > 0 && <i aria-label={`${unread} não lidas`} />}</span>}><div className="notification-heading"><strong>Notificações</strong><GlassButton variant="quiet" size="sm" className="notification-clear-button" onClick={() => setNotifications([])} disabled={notifications.length === 0} aria-label="Limpar notificações"><Trash2 size={14} aria-hidden /><span>Limpar notificações</span></GlassButton></div><div className="notification-list">{notifications.length > 0 ? notifications.map((notification) => <div className={`notification-item ${notification.unread ? "notification-unread" : ""}`} key={notification.id}><span className="notification-dot" /><div><strong>{notification.title}</strong><p>{notification.description}</p><small>{notification.time}</small></div></div>) : <p className="notification-empty">Nenhuma notificação.</p>}</div></GlassPopover>;
}
