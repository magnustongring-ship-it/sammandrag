"use client";

import { useActionState } from "react";
import { deleteAgeGroup, saveAgeGroup } from "@/lib/actions/age-groups";
import { ConfirmButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GAME_FORMATS } from "@/lib/schedule-settings";

type AgeGroup = {
  id: number;
  name: string;
  sort_order: number;
  /** Saknas om migreringen för matchregler inte är körd */
  level?: string | null;
  game_format?: string | null;
  periods?: number | null;
  period_minutes?: number | null;
  break_minutes?: number | null;
  court_note?: string | null;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function AgeGroups({ groups }: { groups: AgeGroup[] }) {
  const nextOrder = Math.max(0, ...groups.map((g) => g.sort_order)) + 1;
  const hasRules = groups.length === 0 || "game_format" in groups[0];

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Ordningen styr sorteringen i listor och filter. En åldersgrupp som
        används i ett sammandrag kan döpas om men inte tas bort. Matchreglerna
        fylls i automatiskt när en klass skapas, och arrangören kan ändra dem.
      </p>
      <ul className="grid gap-2">
        {groups.map((g) => (
          <li key={g.id}>
            <AgeGroupRow group={g} hasRules={hasRules} />
          </li>
        ))}
      </ul>
      <div className="border-t pt-3">
        <p className="mb-2 text-sm font-medium">Lägg till åldersgrupp</p>
        <AgeGroupRow
          key={nextOrder}
          group={null}
          defaultOrder={nextOrder}
          hasRules={hasRules}
        />
      </div>
    </div>
  );
}

function AgeGroupRow({
  group,
  defaultOrder,
  hasRules,
}: {
  group: AgeGroup | null;
  defaultOrder?: number;
  hasRules: boolean;
}) {
  const [state, action, pending] = useActionState(saveAgeGroup, undefined);

  return (
    <div className="grid gap-2 rounded-lg border p-2">
      <div className="flex flex-wrap items-start gap-2">
        <form action={action} className="flex flex-1 flex-wrap gap-2">
          {group && (
            <input type="hidden" name="age_group_id" value={group.id} />
          )}
          {hasRules && <input type="hidden" name="has_rules" value="1" />}
          <Input
            name="name"
            defaultValue={group?.name ?? ""}
            placeholder="t.ex. U18"
            aria-label="Namn"
            className="min-w-32 flex-1"
            required
          />
          <Input
            name="sort_order"
            type="number"
            defaultValue={group?.sort_order ?? defaultOrder}
            aria-label="Ordning"
            className="w-20"
            required
          />
          <Button
            type="submit"
            variant={group ? "outline" : "default"}
            disabled={pending}
          >
            {group ? "Spara" : "Lägg till"}
          </Button>
          {hasRules && <RuleFields group={group} />}
        </form>
        {group && (
          <ConfirmButton
            action={deleteAgeGroup.bind(null, group.id)}
            label="Ta bort"
            confirmLabel="Ja, ta bort"
            question={`Ta bort ${group.name}?`}
            variant="destructive"
          />
        )}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

function RuleFields({ group }: { group: AgeGroup | null }) {
  const id = (f: string) => `${f}-${group?.id ?? "ny"}`;
  const summary = group?.game_format
    ? `${group.level ? `${group.level} · ` : ""}${group.game_format} · ${group.periods} × ${group.period_minutes} min, paus ${group.break_minutes} min`
    : "Inga matchregler";
  return (
    <details className="w-full text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Matchregler: {summary}
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field id={id("level")} label="Nivå">
          <select
            id={id("level")}
            name="level"
            defaultValue={group?.level ?? ""}
            className={selectClass}
          >
            <option value="">Ingen</option>
            <option value="Blå">Blå</option>
            <option value="Orange">Orange</option>
            <option value="Lila">Lila</option>
          </select>
        </Field>
        <Field id={id("format")} label="Spelform">
          <select
            id={id("format")}
            name="game_format"
            defaultValue={group?.game_format ?? ""}
            className={selectClass}
          >
            <option value="">Ingen</option>
            {GAME_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field id={id("periods")} label="Perioder">
          <Input
            id={id("periods")}
            name="periods"
            type="number"
            min={1}
            max={12}
            defaultValue={group?.periods ?? ""}
          />
        </Field>
        <Field id={id("minutes")} label="Min per period">
          <Input
            id={id("minutes")}
            name="period_minutes"
            type="number"
            min={1}
            max={60}
            defaultValue={group?.period_minutes ?? ""}
          />
        </Field>
        <Field id={id("break")} label="Paus (min)">
          <Input
            id={id("break")}
            name="break_minutes"
            type="number"
            min={0}
            max={30}
            defaultValue={group?.break_minutes ?? ""}
          />
        </Field>
        <Field id={id("court")} label="Plan">
          <Input
            id={id("court")}
            name="court_note"
            placeholder="t.ex. På tvären"
            defaultValue={group?.court_note ?? ""}
          />
        </Field>
      </div>
    </details>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
