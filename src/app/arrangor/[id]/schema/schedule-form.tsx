"use client";

import { useActionState, useState } from "react";
import { CalendarClock } from "lucide-react";
import { generateSchedule } from "@/lib/actions/schedule";
import {
  GAME_FORMATS,
  type MatchSettingsForm,
  type ScheduleForm as ScheduleFormValues,
} from "@/lib/schedule-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export type ScheduleFormClass = { id: string; label: string; teams: number };

export function ScheduleForm({
  eventId,
  classes,
  initial,
  hasSchedule,
}: {
  eventId: string;
  classes: ScheduleFormClass[];
  initial: ScheduleFormValues;
  hasSchedule: boolean;
}) {
  const [state, action, pending] = useActionState(generateSchedule, undefined);
  const [values, setValues] = useState<ScheduleFormValues>(initial);

  const setTop = (field: "startTime" | "courts" | "minRestMinutes") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const toggleOverride = (classId: string, on: boolean) =>
    setValues((v) => {
      const overrides = { ...v.overrides };
      if (on) overrides[classId] = { ...v.defaults };
      else delete overrides[classId];
      return { ...v, overrides };
    });

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="settings" value={JSON.stringify(values)} />

      <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="font-display text-xl font-bold uppercase">Dag och planer</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Starttid" id="startTime" hint="Från sammandragets starttid.">
            <Input
              id="startTime"
              type="time"
              value={values.startTime}
              onChange={setTop("startTime")}
              required
            />
          </Field>
          <Field label="Antal planer" id="courts" hint="Matcher som kan spelas samtidigt.">
            <Input
              id="courts"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={values.courts}
              onChange={setTop("courts")}
              required
            />
          </Field>
          <Field
            label="Minst tid mellan två matcher"
            id="minRestMinutes"
            hint="Minuter som ett lag vilar mellan sina matcher."
          >
            <Input
              id="minRestMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={values.minRestMinutes}
              onChange={setTop("minRestMinutes")}
              required
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="font-display text-xl font-bold uppercase">Matcher</h2>
          <p className="text-sm text-muted-foreground">
            Gäller alla klasser, om du inte väljer egna inställningar för en klass nedan.
          </p>
        </div>
        <MatchFields
          idPrefix="gemensam"
          value={values.defaults}
          onChange={(defaults) => setValues((v) => ({ ...v, defaults }))}
        />
      </section>

      <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="font-display text-xl font-bold uppercase">Klasser</h2>
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">Sammandraget har inga klasser.</p>
        )}
        <ul className="grid gap-3">
          {classes.map((c) => {
            const override = values.overrides[c.id];
            return (
              <li key={c.id} className="grid gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{c.label}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {c.teams} {c.teams === 1 ? "anmält lag" : "anmälda lag"}
                      {c.teams < 2 && " – får inga matcher"}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(override)}
                      onChange={(e) => toggleOverride(c.id, e.target.checked)}
                    />
                    Egna inställningar
                  </label>
                </div>
                {override && (
                  <MatchFields
                    idPrefix={c.id}
                    value={override}
                    onChange={(next) =>
                      setValues((v) => ({
                        ...v,
                        overrides: { ...v.overrides, [c.id]: next },
                      }))
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {state?.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state?.message && (
        <div
          role="status"
          className="grid gap-1 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <p className="font-medium">{state.message}</p>
          {state.warnings?.map((w) => (
            <p key={w} className="text-amber-800 dark:text-amber-300">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          <CalendarClock />
          {pending ? "Skapar schema…" : hasSchedule ? "Skapa schemat på nytt" : "Skapa schema"}
        </Button>
        {hasSchedule && (
          <p className="text-sm text-muted-foreground">
            Det nuvarande schemat ersätts.
          </p>
        )}
      </div>
    </form>
  );
}

function MatchFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: MatchSettingsForm;
  onChange: (v: MatchSettingsForm) => void;
}) {
  const set = (field: keyof MatchSettingsForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [field]: e.target.value });
  const id = (f: string) => `${idPrefix}-${f}`;
  const periods = Number(value.periods) || 0;
  const duration =
    periods * (Number(value.periodMinutes) || 0) +
    Math.max(0, periods - 1) * (Number(value.breakMinutes) || 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Spelform" id={id("format")}>
          <select
            id={id("format")}
            value={value.gameFormat}
            onChange={set("gameFormat")}
            className={selectClass}
          >
            {GAME_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Antal perioder" id={id("periods")}>
          <Input
            id={id("periods")}
            type="number"
            inputMode="numeric"
            min={1}
            max={8}
            value={value.periods}
            onChange={set("periods")}
            required
          />
        </Field>
        <Field label="Minuter per period" id={id("periodMinutes")}>
          <Input
            id={id("periodMinutes")}
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={value.periodMinutes}
            onChange={set("periodMinutes")}
            required
          />
        </Field>
        <Field label="Paus mellan perioder" id={id("breakMinutes")} hint="Minuter.">
          <Input
            id={id("breakMinutes")}
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            value={value.breakMinutes}
            onChange={set("breakMinutes")}
            required
          />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Vilka möts?</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={id("matchup")}
            className="mt-1"
            checked={value.matchup === "alla"}
            onChange={() => onChange({ ...value, matchup: "alla" })}
          />
          Alla möter alla i klassen
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="radio"
            name={id("matchup")}
            checked={value.matchup === "antal"}
            onChange={() => onChange({ ...value, matchup: "antal" })}
          />
          Varje lag spelar
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            aria-label="Matcher per lag"
            className="h-8 w-16"
            value={value.matchesPerTeam}
            onChange={set("matchesPerTeam")}
            disabled={value.matchup !== "antal"}
          />
          matcher
        </label>
      </fieldset>

      <p className="text-sm text-muted-foreground">
        En match tar {duration} minuter
        {periods > 1 && ` (${periods} × ${value.periodMinutes} min + ${periods - 1} paus)`}.
      </p>
    </div>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
