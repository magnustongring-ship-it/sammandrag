"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveEvent } from "@/lib/actions/events";
import { genderLabel, genders } from "@/lib/calendar";
import { MAX_TEAMS_LIMIT, type ClassRow, type EventFormValues } from "@/lib/event-form";
import type { EventStatus } from "@/lib/database.types";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const emptyClass = (key: string): ClassRow => ({
  key,
  ageGroupId: "",
  gender: "",
  maxTeams: "8",
});

type TextField = Exclude<keyof EventFormValues, "classes">;

export function EventForm({
  eventId,
  status,
  initial,
  ageGroups,
  teamCounts = {},
  minDate,
}: {
  eventId: string | null;
  status: EventStatus;
  initial: EventFormValues;
  ageGroups: { id: number; name: string }[];
  /** Antal anmälda lag (inkl. väntelista) per sparad klass */
  teamCounts?: Record<string, number>;
  minDate?: string;
}) {
  const [state, action, pending] = useActionState(
    saveEvent.bind(null, eventId),
    undefined,
  );
  const [values, setValues] = useState<EventFormValues>(() =>
    initial.classes.length > 0 ? initial : { ...initial, classes: [emptyClass("ny-0")] },
  );
  // Nycklar för nya rader; deterministiska så att server och klient matchar.
  const keyCounter = useRef(1);
  const [removed, setRemoved] = useState<ClassRow[]>([]);

  const set = (field: TextField) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const updateClass = (key: string, patch: Partial<ClassRow>) =>
    setValues((v) => ({
      ...v,
      classes: v.classes.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    }));

  const removeClass = (row: ClassRow) => {
    setValues((v) => ({ ...v, classes: v.classes.filter((c) => c.key !== row.key) }));
    if (row.id && (teamCounts[row.id] ?? 0) > 0) setRemoved((r) => [...r, row]);
  };

  const undoRemove = (row: ClassRow) => {
    setRemoved((r) => r.filter((c) => c.key !== row.key));
    setValues((v) => ({ ...v, classes: [...v.classes, row] }));
  };

  const ageName = (id: string) => ageGroups.find((g) => String(g.id) === id)?.name;

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="values" value={JSON.stringify(values)} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-medium">Uppgifter</legend>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="title">Titel</Label>
          <Input
            id="title"
            value={values.title}
            onChange={set("title")}
            placeholder="t.ex. Höstsammandrag U12"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="eventDate">Datum</Label>
          <Input
            id="eventDate"
            type="date"
            value={values.eventDate}
            min={minDate}
            onChange={set("eventDate")}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="startTime">Start</Label>
            <Input
              id="startTime"
              type="time"
              value={values.startTime}
              onChange={set("startTime")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endTime">Slut</Label>
            <Input
              id="endTime"
              type="time"
              value={values.endTime}
              onChange={set("endTime")}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="venueName">Hall</Label>
          <Input
            id="venueName"
            value={values.venueName}
            onChange={set("venueName")}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">Ort</Label>
          <Input id="city" value={values.city} onChange={set("city")} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="address">Adress</Label>
          <Input id="address" value={values.address} onChange={set("address")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="registrationDeadline">Sista anmälningsdag</Label>
          <Input
            id="registrationDeadline"
            type="date"
            value={values.registrationDeadline}
            max={values.eventDate || undefined}
            onChange={set("registrationDeadline")}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">Beskrivning</Label>
          <Textarea
            id="description"
            rows={4}
            value={values.description}
            onChange={set("description")}
            placeholder="Information till deltagande lag, t.ex. matchlängd, parkering, kiosk."
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-medium">Klasser</legend>
        {values.classes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Inga klasser ännu. Lägg till minst en innan du publicerar.
          </p>
        )}
        {values.classes.map((row, i) => {
          const teams = row.id ? (teamCounts[row.id] ?? 0) : 0;
          return (
            <div
              key={row.key}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_5.5rem_auto]"
            >
              <div className="grid gap-1.5">
                <Label htmlFor={`age-${row.key}`} className="text-xs">
                  Åldersgrupp
                </Label>
                <select
                  id={`age-${row.key}`}
                  value={row.ageGroupId}
                  onChange={(e) => updateClass(row.key, { ageGroupId: e.target.value })}
                  className={selectClass}
                  required
                >
                  <option value="" disabled>
                    Välj…
                  </option>
                  {ageGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`gender-${row.key}`} className="text-xs">
                  Kön
                </Label>
                <select
                  id={`gender-${row.key}`}
                  value={row.gender}
                  onChange={(e) =>
                    updateClass(row.key, { gender: e.target.value as ClassRow["gender"] })
                  }
                  className={selectClass}
                  required
                >
                  <option value="" disabled>
                    Välj…
                  </option>
                  {genders.map((g) => (
                    <option key={g} value={g}>
                      {genderLabel[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`max-${row.key}`} className="text-xs">
                  Max lag
                </Label>
                <Input
                  id={`max-${row.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TEAMS_LIMIT}
                  value={row.maxTeams}
                  onChange={(e) => updateClass(row.key, { maxTeams: e.target.value })}
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Ta bort klass ${i + 1}`}
                className="justify-self-end"
                onClick={() => removeClass(row)}
              >
                <Trash2 />
              </Button>
              {teams > 0 && (
                <p className="col-span-full text-xs text-muted-foreground">
                  {teams} {teams === 1 ? "lag anmält" : "lag anmälda"} (inklusive väntelista)
                </p>
              )}
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setValues((v) => ({
                ...v,
                classes: [...v.classes, emptyClass(`ny-${keyCounter.current++}`)],
              }))
            }
          >
            <Plus /> Lägg till klass
          </Button>
        </div>

        {removed.length > 0 && (
          <div className="grid gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-medium">Varning: klasser med anmälda lag tas bort</p>
            <ul className="grid gap-1">
              {removed.map((row) => (
                <li key={row.key} className="flex flex-wrap items-center gap-2">
                  {ageName(row.ageGroupId)}{" "}
                  {row.gender && genderLabel[row.gender].toLowerCase()} –{" "}
                  {teamCounts[row.id!]} lag
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => undoRemove(row)}
                  >
                    Ångra
                  </Button>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="confirm_remove" value="1" className="mt-1" />
              Jag förstår att anmälningarna i dessa klasser tas bort.
            </label>
          </div>
        )}
      </fieldset>

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        {status === "utkast" ? (
          <>
            <Button type="submit" name="intent" value="publicera" disabled={pending}>
              {pending ? "Sparar…" : "Publicera"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="utkast"
              variant="outline"
              disabled={pending}
            >
              Spara som utkast
            </Button>
          </>
        ) : (
          <Button type="submit" name="intent" value="spara" disabled={pending}>
            {pending ? "Sparar…" : "Spara ändringar"}
          </Button>
        )}
      </div>
    </form>
  );
}
