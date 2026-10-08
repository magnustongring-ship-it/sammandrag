// Datumhjälpare för kalendern. Datum hanteras som strängar "YYYY-MM-DD"
// (Postgres `date`) och räknas i UTC så att tidszonen aldrig flyttar en dag.
// "Idag" bestäms i Europe/Stockholm.

import type { Gender } from "@/lib/database.types";

export const TIME_ZONE = "Europe/Stockholm";

export const genderLabel: Record<Gender, string> = {
  pojkar: "Pojkar",
  flickor: "Flickor",
  mixed: "Mixed",
};

export const genders = Object.keys(genderLabel) as Gender[];

export const weekdayLabels = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];

export function todayInStockholm(): string {
  // en-CA ger formatet YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(),
  );
}

/** Datum och minuter efter midnatt just nu i svensk tid. */
export function nowInStockholm(now: Date = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Måndag = 0 … söndag = 6 */
export function weekdayIndex(date: string): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

/** Tolkar "YYYY-MM"; returnerar null om ogiltig. */
export function parseMonth(value: string | undefined): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return fromUtc(d).slice(0, 7);
}

export function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtc(`${month}-01`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Alla dagar i månadsrutnätet, hela veckor måndag–söndag. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayIndex(first));
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const end = addDays(last, 6 - weekdayIndex(last));
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  },
): string {
  return new Intl.DateTimeFormat("sv-SE", { ...options, timeZone: "UTC" }).format(
    toUtc(date),
  );
}

/** "09:00:00" → "09:00" */
export function formatTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

export function formatTimeRange(
  start: string | null,
  end: string | null,
): string | null {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s && e) return `${s}–${e}`;
  return s ?? e;
}
