import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  genders,
  monthGrid,
  monthLabel,
  parseMonth,
  shiftMonth,
  todayInStockholm,
} from "@/lib/calendar";
import { getCalendarEvents, type CalendarFilter } from "@/lib/events";
import type { Gender } from "@/lib/database.types";
import { AvailabilityLegend } from "@/components/calendar/availability";
import {
  CalendarFilters,
  type FilterValues,
} from "@/components/calendar/filters";
import { ListView } from "@/components/calendar/list-view";
import { MonthView } from "@/components/calendar/month-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function single(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

function href(values: FilterValues, overrides: Partial<FilterValues> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...values, ...overrides })) {
    if (value) params.set(key, value);
  }
  return `/?${params}`;
}

export default async function CalendarPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const session = await getSession();
  const canCreate =
    session?.organization?.status === "godkand" && session.profile.is_org_admin;
  const today = todayInStockholm();
  const view = single(params.vy) === "lista" ? "lista" : "manad";
  const month = parseMonth(single(params.manad)) ?? today.slice(0, 7);

  const supabase = await createClient();
  const { data: ageGroups } = await supabase
    .from("age_groups")
    .select("id, name")
    .order("sort_order");

  const alder = single(params.alder);
  const ageGroupId = ageGroups?.find((g) => String(g.id) === alder)?.id;
  const kon = single(params.kon);
  const gender = genders.includes(kon as Gender) ? (kon as Gender) : undefined;
  const ort = single(params.ort);
  const dolj = single(params.dolj) === "avbokade" ? "avbokade" : undefined;

  const values: FilterValues = {
    vy: view,
    manad: view === "manad" ? month : undefined,
    alder: ageGroupId !== undefined ? String(ageGroupId) : undefined,
    kon: gender,
    ort,
    dolj,
  };

  const grid = monthGrid(month);
  const range: Pick<CalendarFilter, "from" | "to"> =
    view === "manad" ? { from: grid[0], to: grid.at(-1) } : { from: today };

  const { events, error } = await getCalendarEvents({
    ...range,
    ageGroupId,
    gender,
    city: ort,
    hideCancelled: dolj === "avbokade",
  });

  return (
    <>
      <section className="relative overflow-hidden bg-brand text-brand-foreground">
        {/* Mittcirkel och mittlinje från en basketplan som dekor */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 top-1/2 flex size-80 -translate-y-1/2 items-center justify-center rounded-full border-[6px] border-ball/25"
        >
          <div className="size-28 rounded-full border-[6px] border-ball/25" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[calc(3rem-3px)] w-[6px] bg-ball/25"
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-4 px-4 py-8 sm:py-10">
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold uppercase sm:text-5xl">
              Basket&shy;sammandrag
            </h1>
            <p className="mt-2 text-brand-foreground/80">
              Hitta sammandrag i kalendern och anmäl era lag. Arrangörer
              planerar klasser och håller koll på anmälningarna.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-brand-foreground hover:bg-white/10 hover:text-brand-foreground"
            >
              <Link href="/domare">
                <Flag /> Bli domare
              </Link>
            </Button>
            {canCreate ? (
              <Button asChild size="lg">
                <Link href="/arrangor/nytt">
                  <Plus /> Nytt sammandrag
                </Link>
              </Button>
            ) : (
              !session && (
                <Button asChild size="lg">
                  <Link href="/registrera">Registrera din förening</Link>
                </Button>
              )
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
            Kalender
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border bg-card p-0.5 shadow-xs"
              role="tablist"
            >
              {(
                [
                  ["manad", "Månad"],
                  ["lista", "Lista"],
                ] as const
              ).map(([v, label]) => (
                <Link
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  href={href(values, {
                    vy: v,
                    manad: v === "manad" ? month : undefined,
                  })}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium",
                    view === v
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <CalendarFilters
          values={values}
          ageGroups={ageGroups ?? []}
          clearHref={href({ vy: view, manad: values.manad })}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {view === "manad" ? (
            <div className="flex items-center gap-1">
              <Button
                asChild
                variant="outline"
                size="icon"
                aria-label="Föregående månad"
              >
                <Link href={href(values, { manad: shiftMonth(month, -1) })}>
                  <ChevronLeft />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="icon"
                aria-label="Nästa månad"
              >
                <Link href={href(values, { manad: shiftMonth(month, 1) })}>
                  <ChevronRight />
                </Link>
              </Button>
              <h2 className="ml-2 text-lg font-medium">{monthLabel(month)}</h2>
              {month !== today.slice(0, 7) && (
                <Button asChild variant="ghost" size="sm" className="ml-1">
                  <Link href={href(values, { manad: today.slice(0, 7) })}>
                    Idag
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <h2 className="text-lg font-medium">Kommande sammandrag</h2>
          )}
          <AvailabilityLegend />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : view === "manad" ? (
          <MonthView month={month} today={today} events={events} />
        ) : (
          <ListView events={events} />
        )}
      </main>
    </>
  );
}
