import Link from "next/link";
import { monthGrid, weekdayLabels } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { eventChipClass } from "./availability";
import { EventCard } from "./event-card";

export function MonthView({
  month,
  today,
  events,
}: {
  month: string;
  today: string;
  events: CalendarEvent[];
}) {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  const monthEvents = events.filter((e) => e.date.startsWith(month));

  return (
    <>
      {/* Rutnät på större skärmar */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm sm:block">
        <div className="grid grid-cols-7 bg-brand text-xs font-semibold uppercase tracking-wide text-brand-foreground">
          {weekdayLabels.map((d) => (
            <div key={d} className="px-2 py-1.5 capitalize">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthGrid(month).map((day, i) => {
            const inMonth = day.startsWith(month);
            const weekend = i % 7 >= 5;
            const dayEvents = byDate.get(day) ?? [];
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0",
                  weekend && "bg-accent/40",
                  !inMonth && "bg-muted/60 text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                    day === today && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </div>
                <ul className="grid gap-1">
                  {dayEvents.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/sammandrag/${e.id}`}
                        title={`${e.title}${e.city ? `, ${e.city}` : ""}`}
                        className={cn(
                          "block truncate rounded border px-1.5 py-0.5 text-xs hover:opacity-80",
                          eventChipClass(e),
                        )}
                      >
                        {e.startTime && (
                          <span className="tabular-nums">
                            {e.startTime.slice(0, 5)}{" "}
                          </span>
                        )}
                        {e.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista per dag på mobil */}
      <div className="grid gap-3 sm:hidden">
        {monthEvents.length === 0 ? (
          <EmptyMonth />
        ) : (
          monthEvents.map((e) => <EventCard key={e.id} event={e} />)
        )}
      </div>
      {monthEvents.length === 0 && (
        <div className="hidden sm:block">
          <EmptyMonth />
        </div>
      )}
    </>
  );
}

function EmptyMonth() {
  return (
    <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
      Inga sammandrag den här månaden.
    </p>
  );
}
