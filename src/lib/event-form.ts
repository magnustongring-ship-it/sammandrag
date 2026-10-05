// Delad typ och validering för formuläret "Nytt/redigera sammandrag".
// Används både i klientkomponenten och i server action.

import type { Gender } from "@/lib/database.types";
import { genders } from "@/lib/calendar";

export type ClassRow = {
  /** Finns för klasser som redan är sparade */
  id?: string;
  /** Lokal nyckel för React */
  key: string;
  ageGroupId: string;
  gender: Gender | "";
  maxTeams: string;
};

export type EventFormValues = {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  address: string;
  city: string;
  description: string;
  registrationDeadline: string;
  classes: ClassRow[];
};

export type ValidClass = {
  id?: string;
  ageGroupId: number;
  gender: Gender;
  maxTeams: number;
};

export const MAX_TEAMS_LIMIT = 200;

export type ValidationResult =
  | { ok: true; classes: ValidClass[] }
  | { ok: false; error: string };

export function validateEventForm(
  v: EventFormValues,
  options: { publishing: boolean; today: string; isNew: boolean },
): ValidationResult {
  if (!v.title.trim()) return { ok: false, error: "Ange en titel." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.eventDate)) {
    return { ok: false, error: "Ange ett datum." };
  }
  if (options.isNew && v.eventDate < options.today) {
    return { ok: false, error: "Datumet har redan passerat." };
  }
  if (!v.venueName.trim()) return { ok: false, error: "Ange hall." };
  if (v.startTime && v.endTime && v.endTime <= v.startTime) {
    return { ok: false, error: "Sluttiden måste vara efter starttiden." };
  }
  if (v.registrationDeadline && v.registrationDeadline > v.eventDate) {
    return {
      ok: false,
      error: "Sista anmälningsdag får inte vara efter sammandragets datum.",
    };
  }

  const classes: ValidClass[] = [];
  const seen = new Set<string>();
  for (const [i, row] of v.classes.entries()) {
    const n = i + 1;
    const ageGroupId = Number(row.ageGroupId);
    const maxTeams = Number(row.maxTeams);
    if (!row.ageGroupId || !Number.isInteger(ageGroupId)) {
      return { ok: false, error: `Klass ${n}: välj åldersgrupp.` };
    }
    if (!genders.includes(row.gender as Gender)) {
      return { ok: false, error: `Klass ${n}: välj kön.` };
    }
    if (!Number.isInteger(maxTeams) || maxTeams < 1 || maxTeams > MAX_TEAMS_LIMIT) {
      return {
        ok: false,
        error: `Klass ${n}: max antal lag måste vara ett heltal mellan 1 och ${MAX_TEAMS_LIMIT}.`,
      };
    }
    const k = `${ageGroupId}:${row.gender}`;
    if (seen.has(k)) {
      return {
        ok: false,
        error: `Klass ${n}: samma åldersgrupp och kön finns redan.`,
      };
    }
    seen.add(k);
    classes.push({ id: row.id, ageGroupId, gender: row.gender as Gender, maxTeams });
  }

  if (options.publishing && classes.length === 0) {
    return { ok: false, error: "Lägg till minst en klass innan du publicerar." };
  }

  return { ok: true, classes };
}
