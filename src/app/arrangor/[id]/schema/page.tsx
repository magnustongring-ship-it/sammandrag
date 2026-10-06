import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { genderLabel, TIME_ZONE } from "@/lib/calendar";
import { getScheduleMatches } from "@/lib/schedule";
import { deleteSchedule, setSchedulePublished } from "@/lib/actions/schedule";
import {
  DEFAULT_MATCHUP,
  type ClassMatchup,
  type SavedClassSettings,
} from "@/lib/schedule-settings";
import { ConfirmButton } from "@/components/confirm-button";
import { ScheduleView } from "@/components/schedule-view";
import { Badge } from "@/components/ui/badge";
import { ScheduleForm } from "./schedule-form";

export const metadata = { title: "Spelschema" };

const timestamp = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export default async function SchedulePage({
  params,
}: PageProps<"/arrangor/[id]/schema">) {
  const session = await requireOrganizer();
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, status, start_time, event_classes(*, age_groups(*), registrations(id, status))",
    )
    .eq("id", id)
    .eq("organizer_org_id", session.organization.id)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: schedule, error: scheduleError }, { matches }] =
    await Promise.all([
      supabase
        .from("event_schedules")
        .select("*")
        .eq("event_id", id)
        .maybeSingle(),
      getScheduleMatches(supabase, id),
    ]);
  const tablesMissing =
    scheduleError?.code === "42P01" || scheduleError?.code === "PGRST205";

  const classes = [...event.event_classes]
    .sort(
      (a, b) =>
        (a.age_groups?.sort_order ?? 0) - (b.age_groups?.sort_order ?? 0) ||
        a.gender.localeCompare(b.gender),
    )
    .map((c) => ({
      id: c.id,
      label: `${c.age_groups?.name ?? "?"} ${genderLabel[c.gender].toLowerCase()}`,
      teamIds: c.registrations
        .filter((r) => r.status === "anmald")
        .map((r) => r.id),
      level: c.age_groups?.level ?? null,
      rules: c.game_format
        ? {
            gameFormat: c.game_format,
            periods: c.periods ?? 1,
            periodMinutes: c.period_minutes ?? 1,
            breakMinutes: c.break_minutes ?? 0,
          }
        : null,
    }));

  // Har anmälningarna ändrats sedan schemat skapades?
  const scheduled = new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
  const current = new Set(
    classes.filter((c) => c.teamIds.length >= 2).flatMap((c) => c.teamIds),
  );
  const stale =
    matches.length > 0 &&
    ([...current].some((r) => !scheduled.has(r)) ||
      [...scheduled].some((r) => r && !current.has(r)));

  // Vilka som möts per klass, från det sparade schemat om det finns.
  const saved = (schedule?.class_settings ?? {}) as Record<
    string,
    SavedClassSettings
  >;
  const matchups: Record<string, ClassMatchup> = {};
  for (const c of classes) {
    const sv = saved[c.id];
    matchups[c.id] = sv?.matchup
      ? {
          matchup: sv.matchup,
          matchesPerTeam: String(
            sv.matchesPerTeam ?? DEFAULT_MATCHUP.matchesPerTeam,
          ),
        }
      : DEFAULT_MATCHUP;
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8">
      <div className="grid gap-1">
        <Link
          href={`/arrangor/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {event.title}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold uppercase">Spelschema</h1>
          <Link
            href={`/arrangor/${id}/domare`}
            className="ml-auto text-sm font-medium text-primary underline"
          >
            Tillsätt domare →
          </Link>
          {schedule &&
            (schedule.published ? (
              <Badge>Publicerat</Badge>
            ) : (
              <Badge variant="secondary">Inte publicerat</Badge>
            ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Fyll i inställningarna så skapas ett schema utifrån de anmälda lagen.
          Lag på väntelistan kommer inte med.
        </p>
      </div>

      {tablesMissing && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Spelschemat är inte aktiverat i databasen ännu. Kör migreringen
          supabase/migrations/20261006000000_schedule.sql i Supabase → SQL
          Editor.
        </p>
      )}

      {event.status === "utkast" && (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Sammandraget är ett utkast. Publicera det först så att lag kan anmäla
          sig.
        </p>
      )}

      <ScheduleForm
        eventId={id}
        hasSchedule={matches.length > 0}
        classes={classes.map((c) => ({
          id: c.id,
          label: c.label,
          teams: c.teamIds.length,
          level: c.level,
          rules: c.rules,
        }))}
        initial={{
          startTime: (
            schedule?.start_time ??
            event.start_time ??
            "09:00"
          ).slice(0, 5),
          courts: String(schedule?.courts ?? 1),
          minRestMinutes: String(schedule?.min_rest_minutes ?? 20),
          matchups,
        }}
      />

      {matches.length > 0 && schedule && (
        <section className="grid gap-4 border-t pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">
                Schema ({matches.length} matcher)
              </h2>
              {schedule.generated_at && (
                <p className="text-sm text-muted-foreground">
                  Skapat {timestamp.format(new Date(schedule.generated_at))}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {schedule.published ? (
                <ConfirmButton
                  action={setSchedulePublished.bind(null, id, false)}
                  label="Dölj schemat"
                  confirmLabel="Ja, dölj"
                  question="Schemat försvinner från sammandragets sida tills du publicerar det igen."
                />
              ) : (
                <ConfirmButton
                  action={setSchedulePublished.bind(null, id, true)}
                  label="Publicera schemat"
                  confirmLabel="Ja, publicera"
                  question="Schemat visas för alla på sammandragets sida."
                />
              )}
              <ConfirmButton
                action={deleteSchedule.bind(null, id)}
                label="Ta bort schemat"
                confirmLabel="Ja, ta bort"
                question="Alla matcher och inställningar tas bort."
                variant="destructive"
              />
            </div>
          </div>

          {stale && (
            <p className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              Anmälningarna har ändrats sedan schemat skapades. Skapa schemat på
              nytt så att alla anmälda lag kommer med.
            </p>
          )}
          {schedule.published && (
            <p className="text-sm text-muted-foreground">
              Schemat är publicerat. Skapar du det på nytt syns ändringarna
              direkt.
            </p>
          )}

          <ScheduleView matches={matches} />
        </section>
      )}
    </main>
  );
}
