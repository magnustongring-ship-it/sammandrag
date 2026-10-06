// Formulärvärden och validering för schemainställningar. Delas mellan
// klientformuläret och server action.

import type { MatchSettings, Matchup } from "@/lib/scheduler";

export const GAME_FORMATS = ["3-mot-3", "4-mot-4", "5-mot-5"] as const;

/** Matchinställningar som formulärsträngar */
export type MatchSettingsForm = {
  gameFormat: string;
  periods: string;
  periodMinutes: string;
  breakMinutes: string;
  matchup: Matchup;
  matchesPerTeam: string;
};

export type ScheduleForm = {
  startTime: string;
  courts: string;
  minRestMinutes: string;
  defaults: MatchSettingsForm;
  /** Egna inställningar per klass-id; saknas = använd gemensamma */
  overrides: Record<string, MatchSettingsForm>;
};

export const DEFAULT_MATCH_SETTINGS: MatchSettingsForm = {
  gameFormat: "5-mot-5",
  periods: "2",
  periodMinutes: "10",
  breakMinutes: "2",
  matchup: "alla",
  matchesPerTeam: "3",
};

function int(value: string, label: string, min: number, max: number): number | string {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return `${label} måste vara ett heltal mellan ${min} och ${max}.`;
  }
  return n;
}

export function parseMatchSettings(
  f: MatchSettingsForm,
  prefix: string,
): MatchSettings | string {
  if (!GAME_FORMATS.includes(f.gameFormat as (typeof GAME_FORMATS)[number])) {
    return `${prefix}Välj spelform.`;
  }
  if (f.matchup !== "alla" && f.matchup !== "antal") return `${prefix}Välj matchupplägg.`;
  const periods = int(f.periods, `${prefix}Antal perioder`, 1, 8);
  if (typeof periods === "string") return periods;
  const periodMinutes = int(f.periodMinutes, `${prefix}Periodlängd`, 1, 60);
  if (typeof periodMinutes === "string") return periodMinutes;
  const breakMinutes = int(f.breakMinutes, `${prefix}Paus mellan perioder`, 0, 30);
  if (typeof breakMinutes === "string") return breakMinutes;
  const matchesPerTeam = int(f.matchesPerTeam, `${prefix}Matcher per lag`, 1, 20);
  if (typeof matchesPerTeam === "string") return matchesPerTeam;
  return {
    gameFormat: f.gameFormat,
    periods,
    periodMinutes,
    breakMinutes,
    matchup: f.matchup,
    matchesPerTeam,
  };
}

export function toMatchSettingsForm(s: {
  game_format?: string;
  gameFormat?: string;
  periods: number;
  period_minutes?: number;
  periodMinutes?: number;
  break_minutes?: number;
  breakMinutes?: number;
  matchup: Matchup;
  matches_per_team?: number;
  matchesPerTeam?: number;
}): MatchSettingsForm {
  return {
    gameFormat: s.game_format ?? s.gameFormat ?? DEFAULT_MATCH_SETTINGS.gameFormat,
    periods: String(s.periods),
    periodMinutes: String(s.period_minutes ?? s.periodMinutes),
    breakMinutes: String(s.break_minutes ?? s.breakMinutes),
    matchup: s.matchup,
    matchesPerTeam: String(s.matches_per_team ?? s.matchesPerTeam),
  };
}
