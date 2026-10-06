// Formulärvärden för spelschemat. Delas mellan klientformuläret och server
// action. Matchreglerna (spelform, perioder, paus) hör till varje klass och
// sätts i sammandraget; här väljs bara dagens upplägg och vilka som möts.

import type { Matchup } from "@/lib/scheduler";

export const GAME_FORMATS = ["3-mot-3", "4-mot-4", "5-mot-5"] as const;

/** Vilka som möts i en klass */
export type ClassMatchup = { matchup: Matchup; matchesPerTeam: string };

export type ScheduleForm = {
  startTime: string;
  courts: string;
  minRestMinutes: string;
  /** Per klass-id */
  matchups: Record<string, ClassMatchup>;
};

export const DEFAULT_MATCHUP: ClassMatchup = { matchup: "alla", matchesPerTeam: "3" };

/** Sparat i event_schedules.class_settings per klass-id */
export type SavedClassSettings = { matchup?: Matchup; matchesPerTeam?: number };
