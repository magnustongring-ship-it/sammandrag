// Delad typ och validering för formuläret "Nytt/redigera sammandrag".
// Används både i klientkomponenten och i server action.

import type { Gender } from "@/lib/database.types";
import { genders } from "@/lib/calendar";
import { GAME_FORMATS } from "@/lib/schedule-settings";

export type ClassRow = {
  /** Finns för klasser som redan är sparade */
  id?: string;
  /** Lokal nyckel för React */
  key: string;
  ageGroupId: string;
  gender: Gender | "";
  maxTeams: string;
  /** Matchregler; tom spelform = inga egna regler för klassen */
  gameFormat: string;
  periods: string;
  periodMinutes: string;
  breakMinutes: string;
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
  gameFormat: string | null;
  periods: number | null;
  periodMinutes: number | null;
  breakMinutes: number | null;
};

/** Standardregler för en åldersgrupp, t.ex. från Easy Basket */
export type AgeGroupRules = {
  id: number;
  name: string;
  level: string | null;
  game_format: string | null;
  periods: number | null;
  period_minutes: number | null;
  break_minutes: number | null;
  court_note: string | null;
};

/** Klassens regelfält förifyllda från åldersgruppen. */
export function rulesFromAgeGroup(
  g: AgeGroupRules | undefined,
): Pick<ClassRow, "gameFormat" | "periods" | "periodMinutes" | "breakMinutes"> {
  if (!g?.game_format) {
    return { gameFormat: "", periods: "", periodMinutes: "", breakMinutes: "" };
  }
  return {
    gameFormat: g.game_format,
    periods: String(g.periods ?? ""),
    periodMinutes: String(g.period_minutes ?? ""),
    breakMinutes: String(g.break_minutes ?? ""),
  };
}

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

    let rules: Pick<ValidClass, "gameFormat" | "periods" | "periodMinutes" | "breakMinutes"> = {
      gameFormat: null,
      periods: null,
      periodMinutes: null,
      breakMinutes: null,
    };
    if (row.gameFormat) {
      if (!GAME_FORMATS.includes(row.gameFormat as (typeof GAME_FORMATS)[number])) {
        return { ok: false, error: `Klass ${n}: välj spelform.` };
      }
      const periods = Number(row.periods);
      const periodMinutes = Number(row.periodMinutes);
      const breakMinutes = Number(row.breakMinutes);
      if (!Number.isInteger(periods) || periods < 1 || periods > 12) {
        return { ok: false, error: `Klass ${n}: antal perioder måste vara mellan 1 och 12.` };
      }
      if (!Number.isInteger(periodMinutes) || periodMinutes < 1 || periodMinutes > 60) {
        return { ok: false, error: `Klass ${n}: minuter per period måste vara mellan 1 och 60.` };
      }
      if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 30) {
        return { ok: false, error: `Klass ${n}: paus måste vara mellan 0 och 30 minuter.` };
      }
      rules = { gameFormat: row.gameFormat, periods, periodMinutes, breakMinutes };
    }
    classes.push({ id: row.id, ageGroupId, gender: row.gender as Gender, maxTeams, ...rules });
  }

  if (options.publishing && classes.length === 0) {
    return { ok: false, error: "Lägg till minst en klass innan du publicerar." };
  }

  return { ok: true, classes };
}
