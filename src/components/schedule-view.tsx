"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ScheduleMatch = {
  id: string;
  classLabel: string;
  court: number;
  start: string;
  end: string;
  gameFormat: string;
  home: string;
  homeClub: string | null;
  away: string;
  awayClub: string | null;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

// Spelschema grupperat per starttid, med filter på lag och klass.
export function ScheduleView({ matches }: { matches: ScheduleMatch[] }) {
  const [team, setTeam] = useState("");
  const [cls, setCls] = useState("");

  const teams = useMemo(
    () =>
      [...new Set(matches.flatMap((m) => [m.home, m.away]))].sort((a, b) =>
        a.localeCompare(b, "sv"),
      ),
    [matches],
  );
  const classes = useMemo(() => [...new Set(matches.map((m) => m.classLabel))], [matches]);

  const shown = matches.filter(
    (m) => (!team || m.home === team || m.away === team) && (!cls || m.classLabel === cls),
  );
  const groups: { start: string; matches: ScheduleMatch[] }[] = [];
  for (const m of shown) {
    const last = groups.at(-1);
    if (last?.start === m.start) last.matches.push(m);
    else groups.push({ start: m.start, matches: [m] });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="schema-lag">Visa lag</Label>
          <select
            id="schema-lag"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className={selectClass}
          >
            <option value="">Alla lag</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {classes.length > 1 && (
          <div className="grid gap-1.5">
            <Label htmlFor="schema-klass">Visa klass</Label>
            <select
              id="schema-klass"
              value={cls}
              onChange={(e) => setCls(e.target.value)}
              className={selectClass}
            >
              <option value="">Alla klasser</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          Inga matcher med det filtret.
        </p>
      ) : (
        <ol className="grid gap-3">
          {groups.map((g) => (
            <li key={g.start} className="grid gap-2 sm:grid-cols-[4.5rem_1fr]">
              <div className="font-display text-2xl font-bold tabular-nums text-primary">
                {g.start}
              </div>
              <ul className="grid gap-2">
                {g.matches.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-l-4 border-l-ball bg-card px-3 py-2 shadow-xs"
                  >
                    <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                      Plan {m.court}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Team name={m.home} club={m.homeClub} highlight={m.home === team} />
                      <span className="mx-2 text-muted-foreground">–</span>
                      <Team name={m.away} club={m.awayClub} highlight={m.away === team} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.classLabel} · {m.gameFormat} · {m.start}–{m.end}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Team({
  name,
  club,
  highlight,
}: {
  name: string;
  club: string | null;
  highlight: boolean;
}) {
  return (
    <span className={cn("font-medium", highlight && "text-primary")}>
      {name}
      {club && club !== name && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">({club})</span>
      )}
    </span>
  );
}
