import { formatDate } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/events";
import { EventCard } from "./event-card";

export function ListView({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Inga kommande sammandrag.
      </p>
    );
  }

  // Gruppera per datum, listan är redan sorterad.
  const groups: { date: string; events: CalendarEvent[] }[] = [];
  for (const e of events) {
    const last = groups.at(-1);
    if (last?.date === e.date) last.events.push(e);
    else groups.push({ date: e.date, events: [e] });
  }

  return (
    <div className="grid gap-6">
      {groups.map((g) => (
        <section key={g.date} className="grid gap-2">
          <h2 className="text-sm font-medium capitalize text-muted-foreground">
            {formatDate(g.date, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>
          {g.events.map((e) => (
            <EventCard key={e.id} event={e} showDate={false} />
          ))}
        </section>
      ))}
    </div>
  );
}
