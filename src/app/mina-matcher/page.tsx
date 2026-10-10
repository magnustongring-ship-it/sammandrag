import Link from "next/link";
import { Flag } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDate,
  formatTimeRange,
  genderLabel,
  todayInStockholm,
} from "@/lib/calendar";
import { friendlyError } from "@/lib/errors";
import { refereeLevelLabel } from "@/lib/referees";
import type { Database } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Mina matcher" };

type Fns = Database["public"]["Functions"];
type Match = Fns["my_referee_matches"]["Returns"][number];
type Application = Fns["my_referee_applications"]["Returns"][number];

// Inloggad domare: tillsatta matcher, grupperade per sammandrag. Kopplingen
// görs via den bekräftade e-postadressen som domaren anmälde sig med.
export default async function MyMatchesPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const [matches, applications] = await Promise.all([
    supabase.rpc("my_referee_matches"),
    supabase.rpc("my_referee_applications"),
  ]);

  const error = matches.error ?? applications.error;
  const today = todayInStockholm();

  const byEvent = new Map<string, { first: Match; rows: Match[] }>();
  for (const m of matches.data ?? []) {
    const group = byEvent.get(m.event_id) ?? { first: m, rows: [] };
    group.rows.push(m);
    byEvent.set(m.event_id, group);
  }
  const groups = [...byEvent.values()];
  const upcoming = groups.filter((g) => g.first.event_date >= today);
  const past = groups.filter((g) => g.first.event_date < today).reverse();

  // Anmälningar utan tillsatta matcher än, för sammandrag som inte har varit.
  const waiting: Application[] = (applications.data ?? []).filter(
    (a) => a.assigned_matches === 0 && a.event_date >= today,
  );

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold uppercase">
          <Flag className="size-7 text-ball" aria-hidden="true" />
          Mina matcher
        </h1>
        <p className="text-sm text-muted-foreground">
          Matcher du är tillsatt att döma, med den e-postadress du anmälde dig med
          ({session.email}).
        </p>
      </div>

      {!session.organization && (
        <p className="rounded-md border bg-card px-3 py-2 text-sm">
          Är du lagledare? Be din förenings FöreningsAdmin om en inbjudan. Vill du
          registrera en ny förening?{" "}
          <Link href="/registrera/forening" className="font-medium underline">
            Registrera förening
          </Link>
          .
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {friendlyError(error, "Kunde inte hämta dina matcher")}
        </p>
      )}

      {!error && groups.length === 0 && waiting.length === 0 && (
        <div className="grid gap-3 rounded-xl border border-dashed bg-card p-6 text-sm">
          <p>
            Du har inga domaruppdrag ännu. Uppdragen visas här så fort en arrangör har
            tillsatt dig på matcher. Det går bara om du anmält dig som domare med
            exakt den e-postadress du loggat in med.
          </p>
          <div>
            <Button asChild>
              <Link href="/domare">Anmäl intresse som domare</Link>
            </Button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="grid gap-4">
          <h2 className="font-display text-2xl font-bold uppercase">Kommande</h2>
          {upcoming.map((g) => (
            <EventMatches key={g.first.event_id} first={g.first} rows={g.rows} />
          ))}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-xl font-bold uppercase">Anmälda, inte tillsatta än</h2>
          <ul className="grid gap-2">
            {waiting.map((a) => (
              <li key={a.application_id} className="rounded-xl border bg-card p-3 text-sm">
                <Link href={`/sammandrag/${a.event_id}`} className="font-medium underline">
                  {a.event_title}
                </Link>
                <p className="text-muted-foreground">
                  {formatDate(a.event_date)} · {[a.venue_name, a.city].filter(Boolean).join(", ")} ·{" "}
                  {refereeLevelLabel[a.level]}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <details className="grid gap-4">
          <summary className="cursor-pointer font-display text-xl font-bold uppercase">
            Tidigare ({past.length})
          </summary>
          <div className="mt-4 grid gap-4">
            {past.map((g) => (
              <EventMatches key={g.first.event_id} first={g.first} rows={g.rows} />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}

function EventMatches({ first, rows }: { first: Match; rows: Match[] }) {
  const cancelled = first.event_status === "avbokad";
  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="grid gap-1 border-b bg-secondary px-4 py-3 text-secondary-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">
            <Link href={`/sammandrag/${first.event_id}`} className="hover:underline">
              {first.event_title}
            </Link>
          </h3>
          {cancelled && <Badge variant="secondary">Avbokat</Badge>}
        </div>
        <p className="text-sm">
          {formatDate(first.event_date, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
          {[first.venue_name, first.city].filter(Boolean).join(", ")} · {first.organizer_name}
        </p>
      </header>
      <ul className={cancelled ? "divide-y opacity-60" : "divide-y"}>
        {rows.map((m) => (
          <li
            key={`${m.match_id}-${m.referee_slot}`}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[6.5rem_1fr] sm:gap-3"
          >
            <div className="font-medium tabular-nums">
              {formatTimeRange(m.starts_at, m.ends_at)}
              <span className="block text-sm font-normal text-muted-foreground">Plan {m.court}</span>
            </div>
            <div className="min-w-0">
              <p className="font-medium">
                {m.home_team} – {m.away_team}
              </p>
              <p className="text-sm text-muted-foreground">
                {m.age_group} {genderLabel[m.gender].toLowerCase()} · {m.game_format} · Domare{" "}
                {m.referee_slot}
                {m.partner_name && ` (med ${m.partner_name})`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
