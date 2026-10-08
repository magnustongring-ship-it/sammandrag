import type { EventStatus, Gender } from "@/lib/database.types";

/** Sista dag för anmälan och avanmälan (samma regel som i databasen). */
export function lastRegistrationDay(event: {
  event_date: string;
  registration_deadline: string | null;
}): string {
  return event.registration_deadline ?? event.event_date;
}

export function isRegistrationOpen(
  event: { status: EventStatus; event_date: string; registration_deadline: string | null },
  today: string,
): boolean {
  return event.status === "publicerad" && today <= lastRegistrationDay(event);
}

/** Bokstav för kön i klassens förkortning: P = pojkar, F = flickor, M = mixed */
export const genderPrefix: Record<Gender, string> = {
  pojkar: "P",
  flickor: "F",
  mixed: "M",
};

/** Klassens förkortning, t.ex. pojkar + U8 → "PU8". */
export function classSuffix(gender: Gender, ageGroupName: string): string {
  const name = ageGroupName.trim();
  // "U8" skrivs ihop ("PU8"), andra namn med mellanslag ("P Senior").
  return /^u\d+$/i.test(name)
    ? `${genderPrefix[gender]}${name.toUpperCase()}`
    : `${genderPrefix[gender]} ${name}`;
}

/** Lagnamn med klassens förkortning sist, utan att lägga till den två gånger. */
export function teamNameWithClass(teamName: string, suffix: string): string {
  const name = teamName.trim().replace(/\s+/g, " ");
  if (!name) return "";
  const lower = name.toLowerCase();
  const s = suffix.toLowerCase();
  if (lower === s || lower.endsWith(` ${s}`)) return name;
  return `${name} ${suffix}`;
}

/** Byt klassens förkortning sist i lagnamnet när laget flyttas till en annan klass. */
export function swapClassSuffix(
  teamName: string,
  oldSuffix: string,
  newSuffix: string,
): string {
  const name = teamName.trim().replace(/\s+/g, " ");
  const old = ` ${oldSuffix}`.toLowerCase();
  const base = name.toLowerCase().endsWith(old)
    ? name.slice(0, name.length - old.length)
    : name;
  return teamNameWithClass(base, newSuffix);
}

export type DeadlineStatus =
  | { kind: "open" }
  /** Sista dagen: anmälan stänger vid midnatt, mindre än 24 timmar kvar */
  | { kind: "soon"; hoursLeft: number }
  | { kind: "closed" };

/** Hur lång tid är det kvar att anmäla sig? `now` i svensk tid. */
export function deadlineStatus(
  lastDay: string,
  now: { date: string; minutes: number },
): DeadlineStatus {
  if (now.date > lastDay) return { kind: "closed" };
  if (now.date < lastDay) return { kind: "open" };
  // Avrunda nedåt så att det aldrig ser ut att finnas mer tid än det gör.
  return { kind: "soon", hoursLeft: Math.floor((24 * 60 - now.minutes) / 60) };
}

export const PHONE_PATTERN = /^\+?[0-9][0-9 \-]{5,19}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
