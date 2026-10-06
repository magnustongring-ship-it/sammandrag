"use client";

import { useActionState } from "react";
import { Shuffle } from "lucide-react";
import {
  autoAssignReferees,
  saveRefereeAssignments,
  type RefereeState,
} from "@/lib/actions/referees";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full min-w-36 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function Result({ state }: { state: RefereeState }) {
  if (state?.error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {state.error}
      </p>
    );
  }
  if (!state?.message) return null;
  return (
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
  );
}

export function AutoAssignForm({ eventId, hasAssignments }: { eventId: string; hasAssignments: boolean }) {
  const [state, action, pending] = useActionState(autoAssignReferees, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="per_match">Domare per match</Label>
          <select id="per_match" name="per_match" defaultValue="1" className={selectClass}>
            <option value="1">En domare</option>
            <option value="2">Två domare</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          <Shuffle />
          {pending ? "Fördelar…" : "Fördela domare automatiskt"}
        </Button>
      </div>
      {hasAssignments && (
        <p className="text-xs text-muted-foreground">
          Den nuvarande tillsättningen ersätts.
        </p>
      )}
      <Result state={state} />
    </form>
  );
}

export type AssignRow = {
  id: string;
  time: string;
  court: number;
  classLabel: string;
  teams: string;
  referee1: string | null;
  referee2: string | null;
  conflict: boolean;
};

export function AssignmentForm({
  eventId,
  rows,
  referees,
}: {
  eventId: string;
  rows: AssignRow[];
  referees: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveRefereeAssignments, undefined);

  const options = (
    <>
      <option value="">–</option>
      {referees.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </>
  );

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-secondary-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tid</th>
              <th className="px-3 py-2 font-medium">Match</th>
              <th className="px-3 py-2 font-medium">Domare 1</th>
              <th className="px-3 py-2 font-medium">Domare 2</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              // key med tillsättningen så att listorna visar sparat värde efter sparning
              <tr
                key={`${r.id}-${r.referee1}-${r.referee2}`}
                className={r.conflict ? "bg-amber-50 dark:bg-amber-950" : undefined}
              >
                <td className="whitespace-nowrap px-3 py-2 align-top">
                  <div className="font-medium tabular-nums">{r.time}</div>
                  <div className="text-xs text-muted-foreground">Plan {r.court}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  <div>{r.teams}</div>
                  <div className="text-xs text-muted-foreground">{r.classLabel}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    name={`ref1_${r.id}`}
                    defaultValue={r.referee1 ?? ""}
                    aria-label={`Domare 1, ${r.time} plan ${r.court}`}
                    className={selectClass}
                  >
                    {options}
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    name={`ref2_${r.id}`}
                    defaultValue={r.referee2 ?? ""}
                    aria-label={`Domare 2, ${r.time} plan ${r.court}`}
                    className={selectClass}
                  >
                    {options}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Result state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sparar…" : "Spara tillsättning"}
        </Button>
      </div>
    </form>
  );
}
