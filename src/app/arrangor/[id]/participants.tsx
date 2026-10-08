import { createClient } from "@/lib/supabase/server";
import type { RegistrationStatus } from "@/lib/database.types";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ParticipantBoard } from "./participant-board";
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

// Deltagarlista per klass för arrangören. RLS (registrations_read) ger
// arrangörens förening läsrätt till alla anmälningar i egna sammandrag.
export async function Participants({
  eventId,
  classes,
  canMove,
}: {
  eventId: string;
  classes: ParticipantClass[];
  /** Anmälan har stängt, så lag får flyttas mellan klasser. */
  canMove: boolean;
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

      <ParticipantBoard
        classes={classes}
        canMove={canMove}
        regs={regs.map(({ organizations, ...r }) => ({
          ...r,
          organizationName: organizations?.name ?? null,
        }))}
      />
    </section>
  );
}
