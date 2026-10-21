export const bookingRules = {
  slotStepMinutes: 30,
  maxDaysAhead: 30,
  minimumLeadMinutes: 0,
} as const;

export function dateKeyInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function isoForLocalTime(dateKey: string, time: string, timezone: string) {
  const offset = timezone === "America/Sao_Paulo" ? "-03:00" : "Z";
  return new Date(`${dateKey}T${time}:00${offset}`).toISOString();
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
