import { createClient } from "@/lib/supabase/server";
import { cancelRegistration } from "@/lib/actions/registrations";
import { TIME_ZONE } from "@/lib/calendar";
import type { RegistrationStatus } from "@/lib/database.types";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";

export type ParticipantClass = { id: string; label: string; max: number };

type Registration = {
  id: string;
  event_class_id: string;
  team_name: string;
  contact_email: string;
  contact_phone: string;
  status: RegistrationStatus;
  created_at: string;
  organizations: { name: string } | null;
};

const timestamp = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

// Deltagarlista per klass för arrangören. RLS (registrations_read) ger
// arrangörens förening läsrätt till alla anmälningar i egna sammandrag.
export async function Participants({
  eventId,
  classes,
}: {
  eventId: string;
  classes: ParticipantClass[];
}) {
  if (classes.length === 0) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, event_class_id, team_name, contact_email, contact_phone, status, created_at, organizations(name)",
    )
    .in(
      "event_class_id",
      classes.map((c) => c.id),
    )
    .order("created_at")
    .order("id");

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {friendlyError(error, "Kunde inte hämta deltagarlistan")}
      </p>
    );
  }

  const regs: Registration[] = data ?? [];
  const active = regs.filter((r) => r.status !== "avanmald");
  const emails = [...new Set(active.map((r) => r.contact_email))];
  const total = regs.filter((r) => r.status === "anmald").length;
  const capacity = classes.reduce((s, c) => s + c.max, 0);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Deltagare</h2>
          <p className="text-sm text-muted-foreground">
            {total} av {capacity} platser fyllda
            {active.length > total && `, ${active.length - total} på väntelista`}
          </p>
        </div>
        {regs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CopyButton
              text={emails.join(", ")}
              label={`Kopiera e-postadresser (${emails.length})`}
            />
            <Button asChild variant="outline" size="sm">
              <a href={`/arrangor/${eventId}/deltagare.csv`} download>
                <Download /> Exportera CSV
              </a>
            </Button>
          </div>
        )}
      </div>

      {classes.map((c) => {
        const inClass = regs.filter((r) => r.event_class_id === c.id);
        const registered = inClass.filter((r) => r.status === "anmald");
        const waiting = inClass.filter((r) => r.status === "vantelista");
        const cancelled = inClass.filter((r) => r.status === "avanmald");
        return (
          <div key={c.id} className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted px-3 py-2">
              <h3 className="font-medium">{c.label}</h3>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  registered.length >= c.max && "font-medium text-red-700 dark:text-red-400",
                )}
              >
                {registered.length} av {c.max}
                {waiting.length > 0 && ` · ${waiting.length} på väntelista`}
              </span>
            </div>
            {inClass.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Inga anmälda lag ännu.</p>
            ) : (
              <>
                <TeamTable rows={registered} />
                {waiting.length > 0 && (
                  <>
                    <p className="border-t px-3 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Väntelista
                    </p>
                    <TeamTable rows={waiting} />
                  </>
                )}
                {cancelled.length > 0 && (
                  <details className="border-t px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Avanmälda ({cancelled.length})
                    </summary>
                    <ul className="mt-2 grid gap-1 text-muted-foreground">
                      {cancelled.map((r) => (
                        <li key={r.id}>
                          <span className="line-through">{r.team_name}</span>
                          {r.organizations && ` · ${r.organizations.name}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

function TeamTable({ rows }: { rows: Registration[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Plats</th>
            <th>Lag</th>
            <th>Kontakt</th>
            <th className="hidden sm:table-cell">Anmäld</th>
            <th>Åtgärd</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={r.id} className="align-top">
              <td className="w-8 py-2 pl-3 tabular-nums text-muted-foreground">{i + 1}.</td>
              <td className="py-2 pr-3">
                <div className="font-medium">{r.team_name}</div>
                <div className="text-muted-foreground">{r.organizations?.name ?? "–"}</div>
              </td>
              <td className="py-2 pr-3">
                <a href={`mailto:${r.contact_email}`} className="block underline">
                  {r.contact_email}
                </a>
                <a href={`tel:${r.contact_phone.replace(/[ -]/g, "")}`} className="block">
                  {r.contact_phone}
                </a>
              </td>
              <td className="hidden whitespace-nowrap py-2 pr-3 text-muted-foreground sm:table-cell">
                {timestamp.format(new Date(r.created_at))}
              </td>
              <td className="py-2 pr-3 text-right">
                <ConfirmButton
                  action={cancelRegistration.bind(null, r.id)}
                  label="Avanmäl"
                  confirmLabel="Ja, avanmäl"
                  question={`Avanmäla ${r.team_name}? Föreningen får inget meddelande automatiskt.${r.status === "anmald" ? " Platsen går till nästa lag på väntelistan." : ""}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
