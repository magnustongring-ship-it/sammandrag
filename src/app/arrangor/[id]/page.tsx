import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteDraft, setEventStatus } from "@/lib/actions/events";
import { ConfirmButton } from "@/components/confirm-button";
import { EventStatusBadge } from "@/components/event-status-badge";
import { Button } from "@/components/ui/button";
import { genderLabel } from "@/lib/calendar";
import { getAgeGroupsWithRules } from "@/lib/age-groups";
import { EventForm } from "../event-form";
import { Participants } from "./participants";

export const metadata = { title: "Redigera sammandrag" };

export default async function EditEventPage({
  params,
  searchParams,
}: PageProps<"/arrangor/[id]">) {
  const session = await requireOrganizer();
  const { id } = await params;
  const { sparat } = await searchParams;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, event_classes(*, age_groups(name, sort_order))")
    .eq("id", id)
    .eq("organizer_org_id", session.organization.id)
    .maybeSingle();
  if (!event) notFound();

  const [ageGroups, { data: counts }] = await Promise.all([
    getAgeGroupsWithRules(supabase),
    supabase.rpc("event_class_counts", { p_event_ids: [id] }),
  ]);
  const teamCounts = Object.fromEntries(
    (counts ?? []).map((c) => [c.event_class_id, c.registered + c.waitlisted]),
  );

  const sortedClasses = [...event.event_classes].sort(
    (a, b) =>
      (a.age_groups?.sort_order ?? 0) - (b.age_groups?.sort_order ?? 0) ||
      a.gender.localeCompare(b.gender),
  );
  const classes = sortedClasses.map((c) => ({
    id: c.id,
    key: c.id,
    ageGroupId: String(c.age_group_id),
    gender: c.gender,
    maxTeams: String(c.max_teams),
    gameFormat: c.game_format ?? "",
    periods: c.periods != null ? String(c.periods) : "",
    periodMinutes: c.period_minutes != null ? String(c.period_minutes) : "",
    breakMinutes: c.break_minutes != null ? String(c.break_minutes) : "",
  }));

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div className="grid gap-1">
        <Link href="/arrangor" className="text-sm text-muted-foreground hover:underline">
          ← Mina sammandrag
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold uppercase">{event.title}</h1>
          <EventStatusBadge status={event.status} />
          {event.status !== "utkast" && (
            <Button asChild className="ml-auto">
              <Link href={`/arrangor/${event.id}/schema`}>
                <CalendarClock /> Spelschema
              </Link>
            </Button>
          )}
        </div>
      </div>

      {sparat === "1" && (
        <p
          role="status"
          className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {event.status === "publicerad"
            ? "Sparat. Sammandraget är publicerat och syns i kalendern."
            : event.status === "utkast"
              ? "Sparat som utkast. Det syns inte i kalendern förrän du publicerar."
              : "Sparat."}
        </p>
      )}

      {event.status === "avbokad" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          Sammandraget är avbokat. Det visas som avbokat i kalendern och går inte
          att anmäla sig till.
        </p>
      )}

      {event.status !== "utkast" && (
        <Participants
          eventId={event.id}
          classes={sortedClasses.map((c) => ({
            id: c.id,
            label: `${c.age_groups?.name ?? "?"} ${genderLabel[c.gender].toLowerCase()}`,
            max: c.max_teams,
          }))}
        />
      )}

      <h2 className="border-t pt-6 text-lg font-medium">Uppgifter och klasser</h2>
      <EventForm
        eventId={event.id}
        status={event.status}
        ageGroups={ageGroups}
        teamCounts={teamCounts}
        initial={{
          title: event.title,
          eventDate: event.event_date,
          startTime: event.start_time?.slice(0, 5) ?? "",
          endTime: event.end_time?.slice(0, 5) ?? "",
          venueName: event.venue_name,
          address: event.address ?? "",
          city: event.city ?? "",
          description: event.description ?? "",
          registrationDeadline: event.registration_deadline ?? "",
          classes,
        }}
      />

      <section className="grid gap-3 border-t pt-6">
        <h2 className="text-lg font-medium">Status</h2>
        <div className="flex flex-wrap items-start gap-2">
          {event.status !== "utkast" && (
            <Button asChild variant="outline">
              <Link href={`/sammandrag/${event.id}`}>Visa i kalendern</Link>
            </Button>
          )}
          {event.status === "publicerad" && (
            <ConfirmButton
              action={setEventStatus.bind(null, event.id, "avbokad")}
              label="Avboka sammandrag"
              confirmLabel="Ja, avboka"
              question="Sammandraget visas som avbokat i kalendern och det går inte längre att anmäla lag. Anmälda lag får inget meddelande automatiskt."
              variant="destructive"
            />
          )}
          {event.status === "avbokad" && (
            <ConfirmButton
              action={setEventStatus.bind(null, event.id, "publicerad")}
              label="Återpublicera"
              confirmLabel="Ja, återpublicera"
              question="Sammandraget blir publicerat igen och öppet för anmälan."
            />
          )}
          {event.status === "utkast" && (
            <ConfirmButton
              action={deleteDraft.bind(null, event.id)}
              label="Ta bort utkast"
              confirmLabel="Ja, ta bort"
              question="Utkastet tas bort permanent."
              variant="destructive"
            />
          )}
        </div>
      </section>
    </main>
  );
}
