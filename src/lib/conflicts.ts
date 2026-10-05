// Dubbelbokningskontroll: samma hall samma dag med överlappande tider.

export type Conflict = {
  id: string;
  title: string;
  organizer: string | null;
  time: string | null;
};

type Slot = {
  venueName: string;
  city: string | null;
  startTime: string | null;
  endTime: string | null;
};

export function normalizeVenue(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** "HH:MM" eller "HH:MM:SS" → minuter. Saknad tid räknas som hela dagen. */
function minutes(t: string | null, fallback: number): number {
  if (!t) return fallback;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function overlaps(a: Slot, b: Slot): boolean {
  if (normalizeVenue(a.venueName) !== normalizeVenue(b.venueName)) return false;
  // Om båda har ort måste den också stämma (samma hallnamn i olika städer).
  if (a.city && b.city && normalizeVenue(a.city) !== normalizeVenue(b.city)) return false;
  const aStart = minutes(a.startTime, 0);
  const aEnd = minutes(a.endTime, 24 * 60);
  const bStart = minutes(b.startTime, 0);
  const bEnd = minutes(b.endTime, 24 * 60);
  return aStart < bEnd && bStart < aEnd;
}
