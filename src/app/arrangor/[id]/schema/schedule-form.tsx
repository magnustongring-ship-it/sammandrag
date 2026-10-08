"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { generateSchedule } from "@/lib/actions/schedule";
import {
  buildSchedule,
  fromMinutes,
  toMinutes,
  type ScheduleClass,
  type ScheduleResult,
} from "@/lib/scheduler";
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
  eventEndTime,
}: {
  eventId: string;
  /** Sammandragets sluttid "HH:MM", för varning om schemat blir för långt */
  eventEndTime: string | null;
  classes: ScheduleFormClass[];
  initial: ScheduleFormValues;
  hasSchedule: boolean;
}) {
  const [state, action, pending] = useActionState(generateSchedule, undefined);
  // Säkerställ matchups även om tillståndet kommer från en äldre version av
  // formuläret (t.ex. en sida som var öppen när koden uppdaterades).
  const [rawValues, setValues] = useState<ScheduleFormValues>(initial);
  const legacy = rawValues as ScheduleFormValues & { minRestMinutes?: string };
  const values = {
    ...rawValues,
    courtGapMinutes:
      rawValues.courtGapMinutes ?? legacy.minRestMinutes ?? initial.courtGapMinutes,
    matchups: rawValues.matchups ?? initial.matchups ?? {},
  };

  const estimate = estimateSchedule(values, classes);

  const setTop = (field: "startTime" | "courts" | "courtGapMinutes") =>
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
            label="Tid mellan matcherna"
            id="courtGapMinutes"
            hint="Minuter mellan två matcher på samma plan. Lagen vilar alltid minst en match mellan sina matcher."
          >
            <Input
              id="courtGapMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              value={values.courtGapMinutes}
              onChange={setTop("courtGapMinutes")}
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

                <ClassEstimate estimate={estimate} classId={c.id} />
              </li>
            );
          })}
        </ul>
      </section>

      <TotalEstimate estimate={estimate} eventEndTime={eventEndTime} />

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
            Det nuvarande schemat ersätts. Tillsatta domare tas bort och får fördelas på nytt.
          </p>
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

type Estimate =
  | { ok: false; reason: string }
  | {
      ok: true;
      courts: number;
      courtGap: number;
      total: ScheduleResult;
      startMinutes: number;
      perClass: Map<
        string,
        { matches: number; matchMinutes: number; playMinutes: number; aloneMinutes: number; endsAt: number }
      >;
    };

/**
 * Beräknad tidsåtgång med samma schemaläggning som "Skapa schema", med
 * påhittade lag i samma antal som de anmälda.
 */
function estimateSchedule(
  values: ScheduleFormValues,
  classes: ScheduleFormClass[],
): Estimate {
  const courts = Number(values.courts);
  const courtGap = Number(values.courtGapMinutes);
  if (!/^\d{2}:\d{2}$/.test(values.startTime)) return { ok: false, reason: "Ange starttid" };
  if (!Number.isInteger(courts) || courts < 1 || courts > 20) {
    return { ok: false, reason: "Ange antal planer (1–20)" };
  }
  if (!Number.isInteger(courtGap) || courtGap < 0 || courtGap > 240) {
    return { ok: false, reason: "Ange tid mellan matcherna (0–240 min)" };
  }

  const scheduleClasses: ScheduleClass[] = [];
  for (const c of classes) {
    if (!c.rules || c.teams < 2) continue;
    const m = values.matchups[c.id] ?? DEFAULT_MATCHUP;
    const perTeam = Number(m.matchesPerTeam);
    if (m.matchup === "antal" && (!Number.isInteger(perTeam) || perTeam < 1 || perTeam > 20)) {
      return { ok: false, reason: `Ange antal matcher per lag för ${c.label} (1–20)` };
    }
    scheduleClasses.push({
      id: c.id,
      label: c.label,
      teams: Array.from({ length: c.teams }, (_, i) => ({ id: `${c.id}-${i}`, name: `${i + 1}`, club: null })),
      settings: {
        ...c.rules,
        matchup: m.matchup,
        matchesPerTeam: Number.isInteger(perTeam) ? perTeam : 3,
      },
    });
  }

  const startMinutes = toMinutes(values.startTime);
  const run = (list: ScheduleClass[]) =>
    buildSchedule({ startMinutes, courts, courtGapMinutes: courtGap, classes: list });
  const total = run(scheduleClasses);

  const perClass = new Map<
    string,
    { matches: number; matchMinutes: number; playMinutes: number; aloneMinutes: number; endsAt: number }
  >();
  for (const sc of scheduleClasses) {
    const alone = run([sc]);
    const inTotal = total.matches.filter((m) => m.classId === sc.id);
    const perMatch = matchMinutes(sc.settings);
    perClass.set(sc.id, {
      matches: alone.matches.length,
      matchMinutes: perMatch,
      playMinutes: alone.matches.length * perMatch,
      aloneMinutes: (alone.endMinutes ?? startMinutes) - startMinutes,
      endsAt: Math.max(...inTotal.map((m) => m.end)),
    });
  }
  return { ok: true, courts, courtGap, total, startMinutes, perClass };
}

/** 107 → "1 h 47 min", 45 → "45 min" */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const plans = (n: number) => `${n} ${n === 1 ? "plan" : "planer"}`;

function ClassEstimate({ estimate, classId }: { estimate: Estimate; classId: string }) {
  if (!estimate.ok) return null;
  const e = estimate.perClass.get(classId);
  if (!e) return null;
  return (
    <div className="grid gap-0.5 rounded-md bg-accent/60 px-3 py-2 text-sm">
      <p>
        <span className="font-semibold">Beräknad tid: ca {duration(e.aloneMinutes)}</span>{" "}
        <span className="text-muted-foreground">
          med {plans(estimate.courts)} och {estimate.courtGap} min mellan matcherna
        </span>
      </p>
      <p className="text-muted-foreground">
        {e.matches} {e.matches === 1 ? "match" : "matcher"} × {e.matchMinutes} min ={" "}
        {duration(e.playMinutes)} speltid · klar ca {fromMinutes(e.endsAt)} när alla klasser
        spelar samtidigt
      </p>
    </div>
  );
}

function TotalEstimate({
  estimate,
  eventEndTime,
}: {
  estimate: Estimate;
  eventEndTime: string | null;
}) {
  return (
    <section className="grid gap-2 rounded-xl border-2 border-ball/60 bg-card p-4 shadow-sm">
      <h2 className="font-display text-xl font-bold uppercase">Total tidsåtgång</h2>
      {!estimate.ok ? (
        <p className="text-sm text-muted-foreground">{estimate.reason} för att se beräkningen.</p>
      ) : estimate.total.matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Inga matcher ännu. Varje klass behöver matchregler och minst två anmälda lag.
        </p>
      ) : (
        (() => {
          const end = estimate.total.endMinutes!;
          const play = [...estimate.perClass.values()].reduce((s, c) => s + c.playMinutes, 0);
          const over = eventEndTime && end > toMinutes(eventEndTime);
          return (
            <>
              <p className="text-lg">
                <span className="font-semibold">
                  {fromMinutes(estimate.startMinutes)}–{fromMinutes(end)}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({duration(end - estimate.startMinutes)} för alla klasser)
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {estimate.total.matches.length} matcher · {duration(play)} speltid totalt ·{" "}
                {plans(estimate.courts)} · {estimate.courtGap} min mellan matcherna
              </p>
              {end >= 24 * 60 && (
                <p className="text-sm font-medium text-destructive">
                  Schemat skulle gå över midnatt. Lägg till planer eller minska antalet matcher.
                </p>
              )}
              {over && end < 24 * 60 && (
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Slutar efter sammandragets sluttid {eventEndTime}.
                </p>
              )}
            </>
          );
        })()
      )}
    </section>
  );
}
