export interface AdminNotification { id: string; title: string; description: string; time: string; unread?: boolean }

export const adminNotifications: AdminNotification[] = [];
