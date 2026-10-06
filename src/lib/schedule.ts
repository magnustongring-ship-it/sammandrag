import "server-only";
import { createClient } from "@/lib/supabase/server";
import { genderLabel } from "@/lib/calendar";
import type { ScheduleMatch } from "@/components/schedule-view";
import type { Gender } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BASE_COLUMNS =
  "id, court, starts_at, ends_at, game_format, home_team, home_club, away_team, away_club, home_registration_id, away_registration_id, event_classes(gender, age_groups(name))";
const REFEREE_COLUMNS = "referee1_id, referee1_name, referee2_id, referee2_name";

type MatchRow = {
  id: string;
  court: number;
  starts_at: string;
  ends_at: string;
  game_format: string;
  home_team: string;
  home_club: string | null;
  away_team: string;
  away_club: string | null;
  home_registration_id: string | null;
  away_registration_id: string | null;
  event_classes: { gender: Gender; age_groups: { name: string } | null } | null;
  referee1_id?: string | null;
  referee1_name?: string | null;
  referee2_id?: string | null;
  referee2_name?: string | null;
};

/** Matcherna i ett schema, sorterade på tid och plan. RLS styr vem som ser dem. */
export async function getScheduleMatches(
  supabase: Supabase,
  eventId: string,
): Promise<{
  matches: (ScheduleMatch & {
    homeId: string | null;
    awayId: string | null;
    refereeIds: [string | null, string | null];
  })[];
  error: { code?: string; message: string } | null;
}> {
  const query = (columns: string) =>
    supabase
      .from("schedule_matches")
      .select(columns)
      .eq("event_id", eventId)
      .order("starts_at")
      .order("court")
      .overrideTypes<MatchRow[], { merge: false }>();
  // Domarkolumnerna finns först efter migreringen 20261008000000.
  let { data, error } = await query(`${BASE_COLUMNS}, ${REFEREE_COLUMNS}`);
  if (error) ({ data, error } = await query(BASE_COLUMNS));
  if (error) return { matches: [], error };

  return {
    error: null,
    matches: (data ?? []).map((m) => ({
      id: m.id,
      classLabel: `${m.event_classes?.age_groups?.name ?? "?"} ${
        m.event_classes ? genderLabel[m.event_classes.gender].toLowerCase() : ""
      }`.trim(),
      court: m.court,
      start: m.starts_at.slice(0, 5),
      end: m.ends_at.slice(0, 5),
      gameFormat: m.game_format,
      home: m.home_team,
      homeClub: m.home_club,
      away: m.away_team,
      awayClub: m.away_club,
      homeId: m.home_registration_id,
      awayId: m.away_registration_id,
      referees: [m.referee1_name, m.referee2_name].filter((r): r is string => Boolean(r)),
      refereeIds: [m.referee1_id ?? null, m.referee2_id ?? null],
    })),
  };
}
