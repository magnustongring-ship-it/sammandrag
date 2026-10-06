"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { genderLabel } from "@/lib/calendar";
import {
  buildSchedule,
  fromMinutes,
  toMinutes,
  type MatchSettings,
  type ScheduleClass,
} from "@/lib/scheduler";
import { parseMatchSettings, type ScheduleForm } from "@/lib/schedule-settings";
import type { Json } from "@/lib/database.types";

export type ScheduleState =
  | { error?: string; message?: string; warnings?: string[] }
  | undefined;

const MISSING_TABLES =
  "Spelschemat är inte aktiverat i databasen ännu. Kör migreringen supabase/migrations/20261006000000_schedule.sql i Supabase → SQL Editor.";

function scheduleError(error: { code?: string; message: string }, context: string) {
  // Tabell saknas (migreringen inte körd)
  if (error.code === "42P01" || error.code === "PGRST205") return MISSING_TABLES;
  return friendlyError(error, context);
}

function parseForm(raw: FormDataEntryValue | null): ScheduleForm | null {
  try {
    const v = JSON.parse(String(raw ?? ""));
    if (typeof v !== "object" || !v || typeof v.defaults !== "object") return null;
    return {
      startTime: String(v.startTime ?? ""),
      courts: String(v.courts ?? ""),
      minRestMinutes: String(v.minRestMinutes ?? ""),
      defaults: v.defaults,
      overrides: typeof v.overrides === "object" && v.overrides ? v.overrides : {},
    };
  } catch {
    return null;
  }
}

/** Sparar inställningarna och skapar ett nytt schema från anmälda lag. */
export async function generateSchedule(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const session = await requireOrganizer();
  const eventId = String(formData.get("event_id") ?? "");
  const form = parseForm(formData.get("settings"));
  if (!form) return { error: "Formuläret kunde inte läsas. Ladda om sidan." };

  if (!/^\d{2}:\d{2}$/.test(form.startTime)) return { error: "Ange starttid." };
  const courts = Number(form.courts);
  if (!Number.isInteger(courts) || courts < 1 || courts > 20) {
    return { error: "Antal planer måste vara ett heltal mellan 1 och 20." };
  }
  const minRest = Number(form.minRestMinutes);
  if (!Number.isInteger(minRest) || minRest < 0 || minRest > 240) {
    return { error: "Minsta tid mellan två matcher måste vara mellan 0 och 240 minuter." };
  }
  const defaults = parseMatchSettings(form.defaults, "");
  if (typeof defaults === "string") return { error: defaults };

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organizer_org_id, end_time, event_classes(id, gender, age_groups(name, sort_order), registrations(id, team_name, status, created_at, organizations(name)))",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.organizer_org_id !== session.organization.id) {
    return { error: "Sammandraget hittades inte." };
  }

  const sortedClasses = [...event.event_classes].sort(
    (a, b) =>
      (a.age_groups?.sort_order ?? 0) - (b.age_groups?.sort_order ?? 0) ||
      a.gender.localeCompare(b.gender),
  );

  const classSettings: Record<string, MatchSettings> = {};
  const classes: ScheduleClass[] = [];
  for (const c of sortedClasses) {
    const label = `${c.age_groups?.name ?? "?"} ${genderLabel[c.gender].toLowerCase()}`;
    let settings = defaults;
    const override = form.overrides[c.id];
    if (override) {
      const parsed = parseMatchSettings(override, `${label}: `);
      if (typeof parsed === "string") return { error: parsed };
      settings = parsed;
      classSettings[c.id] = parsed;
    }
    const teams = c.registrations
      .filter((r) => r.status === "anmald")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({ id: r.id, name: r.team_name, club: r.organizations?.name ?? null }));
    classes.push({ id: c.id, label, teams, settings });
  }

  const result = buildSchedule({
    startMinutes: toMinutes(form.startTime),
    courts,
    minRestMinutes: minRest,
    classes,
  });

  if (result.matches.length === 0) {
    return {
      error:
        "Det finns inga matcher att schemalägga. Varje klass behöver minst två anmälda lag.",
    };
  }
  if (result.endMinutes! >= 24 * 60) {
    return {
      error:
        "Schemat skulle sluta efter midnatt. Lägg till fler planer, korta perioderna eller minska antalet matcher per lag.",
    };
  }

  const { error: saveError } = await supabase.from("event_schedules").upsert({
    event_id: eventId,
    start_time: form.startTime,
    courts,
    min_rest_minutes: minRest,
    game_format: defaults.gameFormat,
    periods: defaults.periods,
    period_minutes: defaults.periodMinutes,
    break_minutes: defaults.breakMinutes,
    matchup: defaults.matchup,
    matches_per_team: defaults.matchesPerTeam,
    class_settings: classSettings as unknown as Json,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (saveError) return { error: scheduleError(saveError, "Kunde inte spara inställningarna") };

  const { error: deleteError } = await supabase
    .from("schedule_matches")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) return { error: scheduleError(deleteError, "Kunde inte ersätta schemat") };

  const { error: insertError } = await supabase.from("schedule_matches").insert(
    result.matches.map((m) => ({
      event_id: eventId,
      event_class_id: m.classId,
      court: m.court,
      starts_at: fromMinutes(m.start),
      ends_at: fromMinutes(m.end),
      game_format: m.gameFormat,
      home_registration_id: m.home.id,
      away_registration_id: m.away.id,
      home_team: m.home.name,
      home_club: m.home.club,
      away_team: m.away.name,
      away_club: m.away.club,
    })),
  );
  if (insertError) return { error: scheduleError(insertError, "Kunde inte spara matcherna") };

  const warnings = result.skipped.map((s) => `${s.label}: ${s.reason.toLowerCase()}, inga matcher.`);
  const end = fromMinutes(result.endMinutes!);
  if (event.end_time && result.endMinutes! > toMinutes(event.end_time)) {
    warnings.push(
      `Schemat slutar ${end}, efter sammandragets sluttid ${event.end_time.slice(0, 5)}.`,
    );
  }

  revalidatePath(`/arrangor/${eventId}/schema`);
  revalidatePath(`/sammandrag/${eventId}`);
  return {
    message: `Schemat är klart: ${result.matches.length} matcher, slutar ${end}.`,
    warnings,
  };
}

async function requireOwnEvent(eventId: string) {
  const session = await requireOrganizer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("organizer_org_id")
    .eq("id", eventId)
    .maybeSingle();
  return { supabase, ok: data?.organizer_org_id === session.organization.id };
}

/** Publicera eller dölj schemat på sammandragets sida. */
export async function setSchedulePublished(
  eventId: string,
  published: boolean,
): Promise<{ error?: string }> {
  const { supabase, ok } = await requireOwnEvent(eventId);
  if (!ok) return { error: "Sammandraget hittades inte." };
  const { data, error } = await supabase
    .from("event_schedules")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .select("event_id");
  if (error) return { error: scheduleError(error, "Kunde inte ändra schemat") };
  if (!data?.length) return { error: "Skapa ett schema först." };

  revalidatePath(`/arrangor/${eventId}/schema`);
  revalidatePath(`/sammandrag/${eventId}`);
  return {};
}

/** Tar bort schemat och alla matcher. */
export async function deleteSchedule(eventId: string): Promise<{ error?: string }> {
  const { supabase, ok } = await requireOwnEvent(eventId);
  if (!ok) return { error: "Sammandraget hittades inte." };
  const { error: matchError } = await supabase
    .from("schedule_matches")
    .delete()
    .eq("event_id", eventId);
  if (matchError) return { error: scheduleError(matchError, "Kunde inte ta bort schemat") };
  const { error } = await supabase.from("event_schedules").delete().eq("event_id", eventId);
  if (error) return { error: scheduleError(error, "Kunde inte ta bort schemat") };

  revalidatePath(`/arrangor/${eventId}/schema`);
  revalidatePath(`/sammandrag/${eventId}`);
  return {};
}
