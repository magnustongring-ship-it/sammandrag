import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { AgeGroupRules } from "@/lib/event-form";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Åldersgrupper med standardregler. Faller tillbaka till bara namn om
 * regelkolumnerna saknas (migreringen 20261007000000 inte körd).
 */
export async function getAgeGroupsWithRules(supabase: Supabase): Promise<AgeGroupRules[]> {
  const { data, error } = await supabase
    .from("age_groups")
    .select("id, name, level, game_format, periods, period_minutes, break_minutes, court_note")
    .order("sort_order");
  if (!error) return data ?? [];

  const { data: basic } = await supabase.from("age_groups").select("id, name").order("sort_order");
  return (basic ?? []).map((g) => ({
    ...g,
    level: null,
    game_format: null,
    periods: null,
    period_minutes: null,
    break_minutes: null,
    court_note: null,
  }));
}
