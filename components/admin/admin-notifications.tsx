"use client";

import type { Establishment } from "@/types";
import { NotificationCenter } from "./notification-center";

export function AdminNotifications({ establishment }: { establishment?: Establishment }) {
  return <NotificationCenter context="ESTABLISHMENT" contextId={establishment?.id ?? ""} establishmentId={establishment?.id} />;
}
