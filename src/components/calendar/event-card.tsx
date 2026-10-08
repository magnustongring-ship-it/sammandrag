import Link from "next/link";
import { Clock } from "lucide-react";
import { formatDate, formatTimeRange, genderLabel, nowInStockholm } from "@/lib/calendar";
import { deadlineStatus } from "@/lib/registration";
import type { CalendarEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { AvailabilityText, classChipClass, eventEdgeClass } from "./availability";

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
      className={cn(
        "block rounded-xl border border-l-4 bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md",
        eventEdgeClass(event),
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {[showDate && formatDate(event.date), time].filter(Boolean).join(" · ")}
          </p>
          <h3 className={cn("text-lg font-semibold", cancelled && "line-through")}>
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {[event.venue, event.city].filter(Boolean).join(", ")}
            {event.organizer && ` · ${event.organizer}`}
          </p>
          {!cancelled && <Deadline event={event} />}
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

function Deadline({ event }: { event: CalendarEvent }) {
  const lastDay = event.registrationDeadline ?? event.date;
  const status = deadlineStatus(lastDay, nowInStockholm());

  if (status.kind === "soon") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
        <Clock className="size-4" aria-hidden="true" />
        Anmälan stänger i kväll –{" "}
        {status.hoursLeft < 1
          ? "under en timme kvar"
          : `${status.hoursLeft} timmar kvar`}
      </p>
    );
  }
  return (
    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="size-4" aria-hidden="true" />
      {status.kind === "closed"
        ? "Anmälan stängd"
        : `Sista anmälningsdag ${formatDate(lastDay)}`}
    </p>
  );
}
