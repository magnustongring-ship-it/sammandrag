import Link from "next/link";
import { requireApprovedOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelRegistration } from "@/lib/actions/registrations";
import { formatDate, genderLabel, todayInStockholm } from "@/lib/calendar";
import { isRegistrationOpen } from "@/lib/registration";
import { ConfirmButton } from "@/components/confirm-button";
import { EventStatusBadge } from "@/components/event-status-badge";
import { RegistrationStatusBadge } from "@/components/registration-status-badge";
import { friendlyError } from "@/lib/errors";

export const metadata = { title: "Mina anmälningar" };

export default async function MyRegistrationsPage() {
  const session = await requireApprovedOrg();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, team_name, status, contact_email, contact_phone, event_classes(gender, age_groups(name), events(id, title, event_date, status, registration_deadline, venue_name, city))",
    )
    .eq("organization_id", session.organization.id)
    .neq("status", "avanmald")
    .order("created_at");

  const today = todayInStockholm();
  const rows = (data ?? [])
    .flatMap((r) => {
      const event = r.event_classes?.events;
      return event && r.event_classes ? [{ ...r, cls: r.event_classes, event }] : [];
    })
    .sort((a, b) => a.event.event_date.localeCompare(b.event.event_date));
  const upcoming = rows.filter((r) => r.event.event_date >= today);
  const past = rows.filter((r) => r.event.event_date < today).reverse();

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Mina anmälningar</h1>
        <p className="text-sm text-muted-foreground">{session.organization.name}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {friendlyError(error, "Kunde inte hämta anmälningar")}
        </p>
      )}

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Kommande</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Ni har inga anmälda lag.{" "}
            <Link href="/" className="font-medium text-foreground underline">
              Hitta sammandrag i kalendern
            </Link>
            .
          </p>
        ) : (
          <List rows={upcoming} today={today} />
        )}
      </section>

      {past.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-medium">Tidigare</h2>
          <List rows={past} today={today} />
        </section>
      )}
    </main>
  );
}

type Row = {
  id: string;
  team_name: string;
  status: "anmald" | "vantelista" | "avanmald";
  cls: { gender: "pojkar" | "flickor" | "mixed"; age_groups: { name: string } | null };
  event: {
    id: string;
    title: string;
    event_date: string;
    status: "utkast" | "publicerad" | "avbokad";
    registration_deadline: string | null;
    venue_name: string;
    city: string | null;
  };
};

function List({ rows, today }: { rows: Row[]; today: string }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.team_name}</span>
              <RegistrationStatusBadge status={r.status} />
              {r.event.status === "avbokad" && <EventStatusBadge status="avbokad" />}
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/sammandrag/${r.event.id}`} className="underline">
                {r.event.title}
              </Link>
              {" · "}
              {formatDate(r.event.event_date)} ·{" "}
              {[r.event.venue_name, r.event.city].filter(Boolean).join(", ")} ·{" "}
              {r.cls.age_groups?.name} {genderLabel[r.cls.gender].toLowerCase()}
            </p>
          </div>
          {isRegistrationOpen(r.event, today) && (
            <ConfirmButton
              action={cancelRegistration.bind(null, r.id)}
              label="Avanmäl"
              confirmLabel="Ja, avanmäl"
              question={`Avanmäla ${r.team_name}? Platsen går till nästa lag på väntelistan.`}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
