"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { generateSchedule } from "@/lib/actions/schedule";
import {
  DEFAULT_MATCHUP,
  type ClassMatchup,
  type ScheduleForm as ScheduleFormValues,
} from "@/lib/schedule-settings";
import { LevelBadge } from "@/components/level-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ScheduleFormClass = {
  id: string;
  label: string;
  teams: number;
  level: string | null;
  /** Klassens matchregler, null om de inte är angivna */
  rules: {
    gameFormat: string;
    periods: number;
    periodMinutes: number;
    breakMinutes: number;
  } | null;
};

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
  // Säkerställ matchups även om tillståndet kommer från en äldre version av
  // formuläret (t.ex. en sida som var öppen när koden uppdaterades).
  const [rawValues, setValues] = useState<ScheduleFormValues>(initial);
  const values = { ...rawValues, matchups: rawValues.matchups ?? initial.matchups ?? {} };

  const setTop = (field: "startTime" | "courts" | "minRestMinutes") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const setMatchup = (classId: string, patch: Partial<ClassMatchup>) =>
    setValues((v) => ({
      ...v,
      matchups: {
        ...(v.matchups ?? {}),
        [classId]: { ...(v.matchups?.[classId] ?? DEFAULT_MATCHUP), ...patch },
      },
    }));

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

      <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h2 className="font-display text-xl font-bold uppercase">Klasser</h2>
          <p className="text-sm text-muted-foreground">
            Varje klass spelar efter sina egna regler, t.ex. Easy Basket för åldersgruppen.
            Reglerna ändras under{" "}
            <Link href={`/arrangor/${eventId}`} className="underline">
              Redigera sammandrag
            </Link>
            .
          </p>
        </div>
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">Sammandraget har inga klasser.</p>
        )}
        <ul className="grid gap-3">
          {classes.map((c) => {
            const m = values.matchups[c.id] ?? DEFAULT_MATCHUP;
            const name = `matchup-${c.id}`;
            return (
              <li key={c.id} className="grid gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.label}</span>
                    <LevelBadge level={c.level} />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {c.teams} {c.teams === 1 ? "anmält lag" : "anmälda lag"}
                    {c.teams < 2 && " – får inga matcher"}
                  </span>
                </div>

                {c.rules ? (
                  <p className="text-sm">
                    <span className="font-medium">{c.rules.gameFormat}</span>
                    {" · "}
                    {c.rules.periods} × {c.rules.periodMinutes} min
                    {c.rules.periods > 1 && `, ${c.rules.breakMinutes} min paus`}
                    <span className="text-muted-foreground">
                      {" "}
                      = {matchMinutes(c.rules)} min per match
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Klassen saknar matchregler. Ange spelform och speltid under{" "}
                    <Link href={`/arrangor/${eventId}`} className="underline">
                      Redigera sammandrag
                    </Link>
                    .
                  </p>
                )}

                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <legend className="sr-only">Vilka möts i {c.label}?</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={name}
                      checked={m.matchup === "alla"}
                      onChange={() => setMatchup(c.id, { matchup: "alla" })}
                    />
                    Alla möter alla
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      name={name}
                      checked={m.matchup === "antal"}
                      onChange={() => setMatchup(c.id, { matchup: "antal" })}
                    />
                    Varje lag spelar
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      aria-label={`Matcher per lag i ${c.label}`}
                      className="h-8 w-16"
                      value={m.matchesPerTeam}
                      onChange={(e) => setMatchup(c.id, { matchesPerTeam: e.target.value })}
                      disabled={m.matchup !== "antal"}
                    />
                    matcher
                  </label>
                </fieldset>
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
          <p className="text-sm text-muted-foreground">Det nuvarande schemat ersätts.</p>
        )}
      </div>
    </form>
  );
}

function matchMinutes(r: { periods: number; periodMinutes: number; breakMinutes: number }) {
  return r.periods * r.periodMinutes + Math.max(0, r.periods - 1) * r.breakMinutes;
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
