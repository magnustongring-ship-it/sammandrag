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
import {
  DEFAULT_MATCHUP,
  type SavedClassSettings,
  type ScheduleForm,
} from "@/lib/schedule-settings";
import type { Json } from "@/lib/database.types";
import { headers } from "next/headers";
import { notifyRefereeChanges, refereeSnapshot } from "@/lib/referee-notify";

export type ScheduleState =
  { error?: string; message?: string; warnings?: string[] } | undefined;

const MISSING_TABLES =
  "Spelschemat är inte aktiverat i databasen ännu. Kör migreringen supabase/migrations/20261006000000_schedule.sql i Supabase → SQL Editor.";

function scheduleError(
  error: { code?: string; message: string },
  context: string,
) {
  // Tabell saknas (migreringen inte körd)
  if (error.code === "42P01" || error.code === "PGRST205")
    return MISSING_TABLES;
  return friendlyError(error, context);
}

function parseForm(raw: FormDataEntryValue | null): ScheduleForm | null {
  try {
    const v = JSON.parse(String(raw ?? ""));
    if (typeof v !== "object" || !v) return null;
    return {
      startTime: String(v.startTime ?? ""),
      courts: String(v.courts ?? ""),
      // minRestMinutes: namnet i äldre versioner av formuläret
      courtGapMinutes: String(v.courtGapMinutes ?? v.minRestMinutes ?? ""),
      matchups: typeof v.matchups === "object" && v.matchups ? v.matchups : {},
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
  const courtGap = Number(form.courtGapMinutes);
  if (!Number.isInteger(courtGap) || courtGap < 0 || courtGap > 240) {
    return {
      error:
        "Tid mellan matcherna måste vara mellan 0 och 240 minuter.",
    };
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organizer_org_id, end_time, event_classes(*, age_groups(name, sort_order), registrations(id, team_name, status, created_at, organizations(name)))",
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

  // Matchreglerna (spelform, perioder, paus) kommer från klassen själv;
  // formuläret bestämmer bara vilka som möts.
  const classSettings: Record<string, SavedClassSettings> = {};
  const classes: ScheduleClass[] = [];
  for (const c of sortedClasses) {
    const label = `${c.age_groups?.name ?? "?"} ${genderLabel[c.gender].toLowerCase()}`;
    const chosen = form.matchups[c.id] ?? DEFAULT_MATCHUP;
    const matchup = chosen.matchup === "antal" ? "antal" : "alla";
    const matchesPerTeam = Number(chosen.matchesPerTeam);
    if (
      matchup === "antal" &&
      (!Number.isInteger(matchesPerTeam) ||
        matchesPerTeam < 1 ||
        matchesPerTeam > 20)
    ) {
      return {
        error: `${label}: antal matcher per lag måste vara mellan 1 och 20.`,
      };
    }
    classSettings[c.id] = {
      matchup,
      matchesPerTeam: matchup === "antal" ? matchesPerTeam : undefined,
    };

    const teams = c.registrations
      .filter((r) => r.status === "anmald")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({
        id: r.id,
        name: r.team_name,
        club: r.organizations?.name ?? null,
      }));
    if (
      !c.game_format ||
      !c.periods ||
      !c.period_minutes ||
      c.break_minutes == null
    ) {
      if (teams.length >= 2) {
        return {
          error: `${label} saknar matchregler. Ange spelform och speltid för klassen under Redigera sammandrag.`,
        };
      }
      // Färre än två lag: klassen hoppas ändå över i schemat.
    }
    const settings: MatchSettings = {
      gameFormat: c.game_format ?? "",
      periods: c.periods ?? 1,
      periodMinutes: c.period_minutes ?? 1,
      breakMinutes: c.break_minutes ?? 0,
      matchup,
      matchesPerTeam: Number.isInteger(matchesPerTeam) ? matchesPerTeam : 3,
    };
    classes.push({ id: c.id, label, teams, settings });
  }

  const result = buildSchedule({
    startMinutes: toMinutes(form.startTime),
    courts,
    courtGapMinutes: courtGap,
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
        "Schemat skulle sluta efter midnatt. Lägg till fler planer, korta tiden mellan matcherna eller minska antalet matcher per lag.",
    };
  }

  const { error: saveError } = await supabase.from("event_schedules").upsert({
    event_id: eventId,
    start_time: form.startTime,
    courts,
    // Kolumnen heter min_rest_minutes men är tiden mellan matcher på en plan.
    min_rest_minutes: courtGap,
    class_settings: classSettings as unknown as Json,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (saveError)
    return {
      error: scheduleError(saveError, "Kunde inte spara inställningarna"),
    };

  // Tillsatta domare försvinner när matcherna ersätts; de meddelas nedan.
  const refsBefore = await refereeSnapshot(supabase, eventId);

  const { error: deleteError } = await supabase
    .from("schedule_matches")
    .delete()
    .eq("event_id", eventId);
  if (deleteError)
    return { error: scheduleError(deleteError, "Kunde inte ersätta schemat") };

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
  if (insertError)
    return { error: scheduleError(insertError, "Kunde inte spara matcherna") };

  const warnings = result.skipped.map(
    (s) => `${s.label}: ${s.reason.toLowerCase()}, inga matcher.`,
  );
  if (refsBefore.matches.some((m) => m.refereeIds.length > 0)) {
    warnings.push("Domartillsättningen nollställdes. Fördela domarna på nytt under Domare.");
    await notifyRefereeChanges(
      supabase,
      eventId,
      refsBefore,
      await refereeSnapshot(supabase, eventId),
      (await headers()).get("origin") ?? "",
    );
  }
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

  // Vid publicering får varje tillsatt domare sina matcher.
  if (published) {
    const current = await refereeSnapshot(supabase, eventId);
    const empty = {
      contacts: current.contacts,
      matches: current.matches.map((m) => ({ ...m, refereeIds: [] })),
    };
    await notifyRefereeChanges(
      supabase,
      eventId,
      empty,
      current,
      (await headers()).get("origin") ?? "",
    );
  }

  revalidatePath(`/arrangor/${eventId}/schema`);
  revalidatePath(`/sammandrag/${eventId}`);
  revalidatePath(`/arrangor/${eventId}/domare`);
  return {};
}

/** Tar bort schemat och alla matcher. */
export async function deleteSchedule(
  eventId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await requireOwnEvent(eventId);
  if (!ok) return { error: "Sammandraget hittades inte." };
  const { error: matchError } = await supabase
    .from("schedule_matches")
    .delete()
    .eq("event_id", eventId);
  if (matchError)
    return { error: scheduleError(matchError, "Kunde inte ta bort schemat") };
  const { error } = await supabase
    .from("event_schedules")
    .delete()
    .eq("event_id", eventId);
  if (error)
    return { error: scheduleError(error, "Kunde inte ta bort schemat") };

  revalidatePath(`/arrangor/${eventId}/schema`);
  revalidatePath(`/sammandrag/${eventId}`);
  return {};
}
