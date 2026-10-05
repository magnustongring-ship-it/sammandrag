"use client";

import { useActionState } from "react";
import { deleteAgeGroup, saveAgeGroup } from "@/lib/actions/age-groups";
import { ConfirmButton } from "@/components/confirm-button";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AgeGroup = { id: number; name: string; sort_order: number };

export function AgeGroups({ groups }: { groups: AgeGroup[] }) {
  const nextOrder = Math.max(0, ...groups.map((g) => g.sort_order)) + 1;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Ordningen styr sorteringen i listor och filter. En åldersgrupp som används i
        ett sammandrag kan döpas om men inte tas bort.
      </p>
      <ul className="grid gap-2">
        {groups.map((g) => (
          <li key={g.id}>
            <AgeGroupRow group={g} />
          </li>
        ))}
      </ul>
      <div className="border-t pt-3">
        <p className="mb-2 text-sm font-medium">Lägg till åldersgrupp</p>
        <AgeGroupRow key={nextOrder} group={null} defaultOrder={nextOrder} />
      </div>
    </div>
  );
}

function AgeGroupRow({
  group,
  defaultOrder,
}: {
  group: AgeGroup | null;
  defaultOrder?: number;
}) {
  const [state, action, pending] = useActionState(
    saveAgeGroup.bind(null, group?.id ?? null),
    undefined,
  );

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-start gap-2">
        <form action={action} className="flex flex-1 flex-wrap gap-2">
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
          <Button type="submit" variant={group ? "outline" : "default"} disabled={pending}>
            {group ? "Spara" : "Lägg till"}
          </Button>
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
