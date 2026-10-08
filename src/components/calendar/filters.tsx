"use client";

import Link from "next/link";
import { useRef } from "react";
import { genderLabel, genders } from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FilterValues = {
  vy: string;
  manad?: string;
  alder?: string;
  kon?: string;
  ort?: string;
  /** "avbokade" döljer avbokade sammandrag */
  dolj?: string;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

// Vanligt GET-formulär, så filtren fungerar även utan JavaScript.
// Med JavaScript skickas formuläret direkt när en lista ändras.
export function CalendarFilters({
  values,
  ageGroups,
  clearHref,
}: {
  values: FilterValues;
  ageGroups: { id: number; name: string }[];
  clearHref: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const active = Boolean(values.alder || values.kon || values.ort || values.dolj);

  return (
    <form
      ref={formRef}
      method="get"
      action="/"
      className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end"
    >
      <input type="hidden" name="vy" value={values.vy} />
      {values.manad && <input type="hidden" name="manad" value={values.manad} />}

      <div className="grid gap-1.5">
        <Label htmlFor="alder">Åldersgrupp</Label>
        <select
          id="alder"
          name="alder"
          defaultValue={values.alder ?? ""}
          onChange={submit}
          className={selectClass}
        >
          <option value="">Alla</option>
          {ageGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="kon">Kön</Label>
        <select
          id="kon"
          name="kon"
          defaultValue={values.kon ?? ""}
          onChange={submit}
          className={selectClass}
        >
          <option value="">Alla</option>
          {genders.map((g) => (
            <option key={g} value={g}>
              {genderLabel[g]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ort">Ort</Label>
        <Input
          id="ort"
          name="ort"
          type="search"
          placeholder="t.ex. Uppsala"
          defaultValue={values.ort ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-full">
        <input
          type="checkbox"
          name="dolj"
          value="avbokade"
          defaultChecked={values.dolj === "avbokade"}
          onChange={submit}
          className="size-4 accent-primary"
        />
        Dölj avbokade sammandrag
      </label>

      <div className="flex gap-2 sm:col-start-4 sm:row-start-1">
        <Button type="submit">Filtrera</Button>
        {active && (
          <Button asChild variant="ghost">
            <Link href={clearHref}>Rensa</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
