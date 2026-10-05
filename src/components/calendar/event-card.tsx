import Link from "next/link";
import { formatDate, formatTimeRange, genderLabel } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { AvailabilityText, classChipClass } from "./availability";

export function EventCard({
  event,
  showDate = true,
}: {
  event: CalendarEvent;
  showDate?: boolean;
}) {
  const time = formatTimeRange(event.startTime, event.endTime);
  const cancelled = event.status === "avbokad";

  return (
    <Link
      href={`/sammandrag/${event.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {[showDate && formatDate(event.date), time].filter(Boolean).join(" · ")}
          </p>
          <h3 className={cn("font-semibold", cancelled && "line-through")}>
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {[event.venue, event.city].filter(Boolean).join(", ")}
            {event.organizer && ` · ${event.organizer}`}
          </p>
        </div>
        <div className="text-sm">
          <AvailabilityText event={event} />
        </div>
      </div>
      {event.classes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {event.classes.map((c) => (
            <li
              key={c.id}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                classChipClass(c, cancelled),
              )}
            >
              {c.ageGroup} {genderLabel[c.gender].toLowerCase()}
              {c.registered !== null && ` · ${c.registered}/${c.maxTeams}`}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
