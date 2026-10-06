"use client";

import { useActionState } from "react";
import { applyAsReferee } from "@/lib/actions/referees";
import { REFEREE_LEVELS } from "@/lib/referees";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

// Intresseanmälan för domare. Ingen inloggning krävs.
export function RefereeForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(applyAsReferee, undefined);

  if (state?.message) return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ref-name">Namn</Label>
          <Input id="ref-name" name="name" autoComplete="name" maxLength={100} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ref-level">Domarnivå</Label>
          <select id="ref-level" name="level" defaultValue="" className={selectClass} required>
            <option value="" disabled>
              Välj nivå…
            </option>
            {REFEREE_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ref-email">E-post</Label>
          <Input id="ref-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ref-phone">Telefon</Label>
          <Input
            id="ref-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="070-123 45 67"
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Uppgifterna visas bara för arrangören. Ditt namn visas i spelschemat om du blir
        tillsatt som domare.
      </p>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Skickar…" : "Anmäl intresse att döma"}
        </Button>
      </div>
    </form>
  );
}
