"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth";
import { listAppointments } from "@/features/agenda";
import { listAllEstablishments } from "@/features/platform";
import { employeeForUser } from "@/features/employees";
import { isEstablishmentOperational } from "@/features/platform/domain";
import { isFeatureEnabled } from "@/features/platform/policies";
import { emitReminder, getNotificationPreferences, reminderOffsets } from "./repository";

/** Reminder simulation runs only while an authenticated app session is open. */
export function NotificationRuntime() {
  const { user, status } = useAuth();
  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    // Platform owners receive lifecycle/publication notices only, never operational reminders.
    if (user.role === "PLATFORM_ADMIN") return;
    const run = () => {
      const employee = user.role === "EMPLOYEE" ? employeeForUser(user.id) : null;
      const employeeEstablishmentId = employee?.establishmentId;
      const allowedEstablishments = new Set(user.establishmentId || employeeEstablishmentId ? [user.establishmentId ?? employeeEstablishmentId!] : []);
      const operationalEstablishments = new Map(listAllEstablishments().map((item) => [item.id, item]));
      for (const appointment of listAppointments()) {
        if (!["SCHEDULED", "CONFIRMED"].includes(appointment.status)) continue;
        if (user.role === "CUSTOMER" && appointment.customerId !== user.customer?.id) continue;
        if (user.role === "EMPLOYEE" && (!employee || appointment.employeeId !== employee.id)) continue;
        if (user.role !== "CUSTOMER" && !allowedEstablishments.has(appointment.establishmentId)) continue;
        const currentEstablishment = operationalEstablishments.get(appointment.establishmentId);
        if (!currentEstablishment || !isEstablishmentOperational(currentEstablishment) || !isFeatureEnabled(currentEstablishment, "notifications")) continue;
        const remainingMinutes = (new Date(appointment.startsAt).getTime() - Date.now()) / 60000;
        const preferences = getNotificationPreferences(appointment.establishmentId);
        for (const [type, targetMinutes] of reminderOffsets(preferences)) {
          // The one-minute window avoids late reminders after a closed/suspended tab wakes up.
          if (remainingMinutes > 0 && remainingMinutes <= targetMinutes && remainingMinutes > targetMinutes - 1.5) emitReminder(appointment, type);
        }
      }
    };
    run();
    const timer = window.setInterval(run, 60_000);
    return () => window.clearInterval(timer);
  }, [status, user]);
  return null;
}
