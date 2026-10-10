"use client";

import { useActionState, useState } from "react";
import { registerTeam, type RegisterValues } from "@/lib/actions/registrations";
import { FormMessage } from "@/components/form-message";
import { teamNameWithClass } from "@/lib/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export type RegisterClassOption = {
  id: string;
  label: string;
  /** Klassens förkortning som läggs efter lagnamnet, t.ex. "PU8" */
  suffix: string;
  /** null om antalet inte är känt */
  free: number | null;
};

export type RegisterTeamOption = { id: string; name: string };

export function RegisterForm({
  eventId,
  classes,
  teams,
  defaults,
}: {
  eventId: string;
  classes: RegisterClassOption[];
  /** Lagen som användaren får anmäla */
  teams: RegisterTeamOption[];
  defaults: RegisterValues;
}) {
  const [state, action, pending] = useActionState(registerTeam, undefined);
  // Kontrollerade fält, så att inget töms när servern svarar med ett fel.
  const [values, setValues] = useState<RegisterValues>(defaults);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state) setValues(state.values);
  }

  const set = (field: keyof RegisterValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const selected = classes.find((c) => c.id === values.classId);
  const allChosen = teams.every((t) => values.teamIds.includes(t.id));
  const toggleTeam = (id: string) =>
    setValues((v) => ({
      ...v,
      teamIds: v.teamIds.includes(id) ? v.teamIds.filter((t) => t !== id) : [...v.teamIds, id],
    }));

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid gap-2">
        <Label htmlFor="class_id">Klass</Label>
        <select
          id="class_id"
          name="class_id"
          value={values.classId}
          onChange={set("classId")}
          className={selectClass}
          required
        >
          <option value="" disabled>
            Välj klass…
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.free === 0 ? " – fullt, väntelista" : ""}
            </option>
          ))}
        </select>
        {selected?.free === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Klassen är full. Laget hamnar på väntelistan och flyttas upp
            automatiskt om en plats blir ledig.
          </p>
        )}
      </div>
      <fieldset className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">{teams.length === 1 ? "Lag" : "Lag att anmäla"}</legend>
          {teams.length > 1 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                setValues((v) => ({ ...v, teamIds: allChosen ? [] : teams.map((t) => t.id) }))
              }
            >
              {allChosen ? "Avmarkera alla" : "Markera alla"}
            </Button>
          )}
        </div>
        <ul className="grid gap-1 rounded-md border p-2">
          {teams.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  name="team_id"
                  value={t.id}
                  checked={values.teamIds.includes(t.id)}
                  onChange={() => toggleTeam(t.id)}
                  className="size-4 accent-primary"
                />
                <span>
                  {t.name}
                  {selected && (
                    <span className="text-muted-foreground">
                      {" "}
                      → {teamNameWithClass(t.name, selected.suffix)}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Klassens förkortning läggs till efter lagnamnet, t.ex. PU8 för pojkar U8.
        </p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="contact_email">Kontaktpersonens e-post</Label>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            autoComplete="email"
            value={values.contactEmail}
            onChange={set("contactEmail")}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact_phone">Kontaktpersonens telefon</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            autoComplete="tel"
            placeholder="070-123 45 67"
            value={values.contactPhone}
            onChange={set("contactPhone")}
            required
          />
        </div>
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Anmäler…"
            : values.teamIds.length > 1
              ? `Anmäl ${values.teamIds.length} lag`
              : "Anmäl lag"}
        </Button>
      </div>
    </form>
  );
}
