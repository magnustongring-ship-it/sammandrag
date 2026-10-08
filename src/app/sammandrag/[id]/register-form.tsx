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

export function RegisterForm({
  eventId,
  classes,
  defaults,
}: {
  eventId: string;
  classes: RegisterClassOption[];
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
      <div className="grid gap-2">
        <Label htmlFor="team_name">Lagnamn</Label>
        <Input
          id="team_name"
          name="team_name"
          value={values.teamName}
          onChange={set("teamName")}
          maxLength={100}
          placeholder="t.ex. Borlänge Basket"
          required
        />
        {selected && values.teamName.trim() ? (
          <p className="text-xs text-muted-foreground">
            Sparas som:{" "}
            <span className="font-semibold text-foreground">
              {teamNameWithClass(values.teamName, selected.suffix)}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Klassens förkortning läggs till efter namnet, t.ex. PU8 för pojkar U8.
          </p>
        )}
      </div>
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
          {pending ? "Anmäler…" : "Anmäl lag"}
        </Button>
      </div>
    </form>
  );
}
