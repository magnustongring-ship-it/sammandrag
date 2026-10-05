import type { EventStatus } from "@/lib/database.types";

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

export const PHONE_PATTERN = /^\+?[0-9][0-9 \-]{5,19}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
