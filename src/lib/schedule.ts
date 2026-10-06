import "server-only";
import { createClient } from "@/lib/supabase/server";
import { genderLabel } from "@/lib/calendar";
import type { ScheduleMatch } from "@/components/schedule-view";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Matcherna i ett schema, sorterade på tid och plan. RLS styr vem som ser dem. */
export async function getScheduleMatches(
  supabase: Supabase,
  eventId: string,
): Promise<{
  matches: (ScheduleMatch & { homeId: string | null; awayId: string | null })[];
  error: { code?: string; message: string } | null;
}> {
  const { data, error } = await supabase
    .from("schedule_matches")
    .select(
      "id, court, starts_at, ends_at, game_format, home_team, home_club, away_team, away_club, home_registration_id, away_registration_id, event_classes(gender, age_groups(name))",
    )
    .eq("event_id", eventId)
    .order("starts_at")
    .order("court");
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
    })),
  };
}
