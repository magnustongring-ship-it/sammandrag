import Link from "next/link";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, todayInStockholm } from "@/lib/calendar";
import { friendlyError } from "@/lib/errors";
import { REFEREE_LEVELS } from "@/lib/referees";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Bli domare" };

// Publik sida: kommande sammandrag där domare kan anmäla intresse.
export default async function BecomeRefereePage() {
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, event_date, start_time, end_time, venue_name, city, organizations(name)")
    .eq("status", "publicerad")
    .gte("event_date", todayInStockholm())
    .order("event_date")
    .limit(100);

  return (
    <>
      <section className="bg-brand text-brand-foreground">
        <div className="mx-auto grid w-full max-w-4xl gap-2 px-4 py-8">
          <h1 className="flex items-center gap-3 text-4xl font-bold uppercase">
            <Flag className="size-8 text-ball" aria-hidden="true" />
            Bli domare
          </h1>
          <p className="max-w-2xl text-brand-foreground/80">
            Vill du döma på ett sammandrag? Välj ett sammandrag nedan och anmäl ditt intresse.
            Du behöver inget konto för att anmäla dig. Arrangören ser din anmälan och du får ett
            mejl om du blir tillsatt på matcher. Skapa ett konto med samma e-postadress så ser du
            alla dina matcher under Mina matcher.
          </p>
          <p className="text-sm text-brand-foreground/70">
            Nivåer: {REFEREE_LEVELS.map((l) => l.label).join(", ")}.
          </p>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-4xl gap-3 px-4 py-6">
        <h2 className="font-display text-2xl font-bold uppercase">Kommande sammandrag</h2>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {friendlyError(error, "Kunde inte hämta sammandrag")}
          </p>
        ) : !events?.length ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Det finns inga kommande sammandrag just nu.
          </p>
        ) : (
          <ul className="grid gap-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-l-ball bg-card p-4 shadow-xs"
              >
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {[formatDate(e.event_date), formatTimeRange(e.start_time, e.end_time)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-lg font-semibold">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[e.venue_name, e.city].filter(Boolean).join(", ")}
                    {e.organizations?.name && ` · ${e.organizations.name}`}
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/sammandrag/${e.id}#domare`}>Anmäl intresse</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
