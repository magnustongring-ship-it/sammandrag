import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageEvent, requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE } from "@/lib/calendar";
import { getScheduleMatches } from "@/lib/schedule";
import { deleteReferee } from "@/lib/actions/referees";
import { refereeConflicts, refereeLevelLabel, refereeLevelRank } from "@/lib/referees";
import { toMinutes } from "@/lib/scheduler";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { AssignmentForm, AutoAssignForm } from "./assign-forms";

export const metadata = { title: "Domare" };

const timestamp = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export default async function RefereesPage({ params }: PageProps<"/arrangor/[id]/domare">) {
  const session = await requireOrganizer();
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, status, organizer_org_id")
    .eq("id", id)
    .maybeSingle();
  if (!event || !canManageEvent(session, event.organizer_org_id)) notFound();

  const [{ data: refData, error: refError }, { matches }] = await Promise.all([
    supabase.from("referee_applications").select("*").eq("event_id", id),
    getScheduleMatches(supabase, id),
  ]);
  const missing =
    refError?.code === "42P01" || refError?.code === "PGRST205";
  const referees = [...(refData ?? [])].sort(
    (a, b) =>
      refereeLevelRank[b.level] - refereeLevelRank[a.level] || a.name.localeCompare(b.name, "sv"),
  );
  const names = new Map(referees.map((r) => [r.id, r.name]));
  const load = new Map<string, number>();
  for (const m of matches) {
    for (const r of m.refereeIds) if (r) load.set(r, (load.get(r) ?? 0) + 1);
  }

  const timed = matches.map((m) => ({
    ...m,
    startMin: toMinutes(m.start),
    endMin: toMinutes(m.end),
    ids: m.refereeIds.filter((r): r is string => Boolean(r)),
  }));
  const conflicts = refereeConflicts(
    timed.map((m) => ({
      id: m.id,
      start: m.startMin,
      end: m.endMin,
      label: `${m.start} plan ${m.court}`,
      referees: m.ids,
    })),
    names,
  );
  const conflictIds = new Set(
    timed
      .filter((a) =>
        timed.some(
          (b) =>
            a !== b &&
            a.startMin < b.endMin &&
            b.startMin < a.endMin &&
            a.ids.some((r) => b.ids.includes(r)),
        ),
      )
      .map((m) => m.id),
  );
  const unassigned = matches.filter((m) => !m.refereeIds[0]).length;

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8">
      <div className="grid gap-1">
        <Link href={`/arrangor/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {event.title}
        </Link>
        <h1 className="text-3xl font-bold uppercase">Domare</h1>
        <p className="text-sm text-muted-foreground">
          Domare anmäler intresse på{" "}
          <Link href={`/sammandrag/${id}#domare`} className="underline">
            sammandragets sida
          </Link>
          , utan att logga in. Skicka gärna länken till domare ni vill fråga.
        </p>
      </div>

      {missing && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Domarfunktionen är inte aktiverad i databasen ännu. Kör migreringen
          supabase/migrations/20261008000000_referees.sql i Supabase → SQL Editor.
        </p>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase">
            Intresseanmälningar ({referees.length})
          </h2>
          {referees.length > 0 && (
            <CopyButton
              text={referees.map((r) => r.email).join(", ")}
              label={`Kopiera e-postadresser (${referees.length})`}
            />
          )}
        </div>
        {referees.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Inga domare har anmält intresse ännu.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-sm">
            {referees.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {refereeLevelLabel[r.level]}
                    </span>
                    {matches.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {load.get(r.id) ?? 0} matcher
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <a href={`mailto:${r.email}`} className="underline">
                      {r.email}
                    </a>
                    {" · "}
                    <a href={`tel:${r.phone.replace(/[ -]/g, "")}`}>{r.phone}</a>
                    {" · anmäld "}
                    {timestamp.format(new Date(r.created_at))}
                  </p>
                </div>
                <ConfirmButton
                  action={deleteReferee.bind(null, id, r.id)}
                  label="Ta bort"
                  confirmLabel="Ja, ta bort"
                  question={`Ta bort ${r.name}? Domaren tas också bort från matcherna.`}
                  variant="destructive"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 border-t pt-6">
        <h2 className="font-display text-2xl font-bold uppercase">Tillsättning</h2>
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Skapa ett{" "}
            <Link href={`/arrangor/${id}/schema`} className="font-medium text-foreground underline">
              spelschema
            </Link>{" "}
            först, så kan du tillsätta domare på matcherna.
          </p>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <AutoAssignForm
                eventId={id}
                hasAssignments={matches.some((m) => m.refereeIds[0])}
              />
            </div>

            {unassigned > 0 && (
              <p className="text-sm text-muted-foreground">
                {unassigned} av {matches.length} matcher saknar domare.
              </p>
            )}
            {conflicts.length > 0 && (
              <div className="grid gap-1 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                {conflicts.map((c) => (
                  <p key={c}>{c}</p>
                ))}
              </div>
            )}

            <AssignmentForm
              eventId={id}
              referees={referees.map((r) => ({
                id: r.id,
                label: `${r.name} (${refereeLevelLabel[r.level]})`,
              }))}
              rows={matches.map((m) => ({
                id: m.id,
                time: m.start,
                court: m.court,
                classLabel: `${m.classLabel} · ${m.gameFormat}`,
                teams: `${m.home} – ${m.away}`,
                referee1: m.refereeIds[0],
                referee2: m.refereeIds[1],
                conflict: conflictIds.has(m.id),
              }))}
            />
          </>
        )}
      </section>
    </main>
  );
}
