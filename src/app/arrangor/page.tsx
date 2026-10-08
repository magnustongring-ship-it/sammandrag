import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, todayInStockholm } from "@/lib/calendar";
import type { Tables } from "@/lib/database.types";
import { EventStatusBadge } from "@/components/event-status-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteDraft } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";

export const metadata = { title: "Mina sammandrag" };

type Row = Pick<
  Tables<"events">,
  "id" | "title" | "event_date" | "start_time" | "end_time" | "venue_name" | "city" | "status"
> & { event_classes: { id: string }[] };

export default async function OrganizerPage() {
  const session = await requireOrganizer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, event_date, start_time, end_time, venue_name, city, status, event_classes(id)",
    )
    .eq("organizer_org_id", session.organization.id)
    .order("event_date");

  const today = todayInStockholm();
  const events: Row[] = data ?? [];
  const { data: counts } = events.length
    ? await supabase.rpc("event_class_counts", { p_event_ids: events.map((e) => e.id) })
    : { data: [] };
  const teamsByClass = new Map(
    (counts ?? []).map((c) => [c.event_class_id, c.registered + c.waitlisted]),
  );
  const teamsFor = (e: Row) =>
    e.event_classes.reduce((sum, c) => sum + (teamsByClass.get(c.id) ?? 0), 0);
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today).reverse();

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold uppercase">Mina sammandrag</h1>
          <p className="text-sm text-muted-foreground">{session.organization.name}</p>
        </div>
        <Button asChild>
          <Link href="/arrangor/nytt">
            <Plus /> Nytt sammandrag
          </Link>
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {friendlyError(error, "Kunde inte hämta sammandrag")}
        </p>
      )}

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Kommande</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Ni har inga kommande sammandrag.{" "}
            <Link href="/arrangor/nytt" className="font-medium text-foreground underline">
              Skapa ett nytt
            </Link>
            .
          </p>
        ) : (
          <EventList events={upcoming} teamsFor={teamsFor} />
        )}
      </section>

      {past.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-medium">Tidigare</h2>
          <EventList events={past} teamsFor={teamsFor} />
        </section>
      )}
    </main>
  );
}

function EventList({
  events,
  teamsFor,
}: {
  events: Row[];
  teamsFor: (e: Row) => number;
}) {
  return (
    <ul className="divide-y rounded-xl border bg-card shadow-sm">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-2 pr-4 hover:bg-accent/60">
          <Link
            href={`/arrangor/${e.id}`}
            className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-muted-foreground">
                {[
                  formatDate(e.event_date),
                  formatTimeRange(e.start_time, e.end_time),
                  [e.venue_name, e.city].filter(Boolean).join(", "),
                  `${e.event_classes.length} ${e.event_classes.length === 1 ? "klass" : "klasser"}`,
                  e.status !== "utkast" && `${teamsFor(e)} anmälda lag`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <EventStatusBadge status={e.status} />
          </Link>
          {e.status === "utkast" && (
            <ConfirmButton
              action={deleteDraft.bind(null, e.id)}
              label="Radera"
              confirmLabel="Ja, radera"
              question={`Radera utkastet "${e.title}"? Det går inte att få tillbaka.`}
              variant="destructive"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
