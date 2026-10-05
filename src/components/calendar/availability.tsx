import type { Availability, CalendarClass, CalendarEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

const label: Record<Availability, string> = {
  lediga: "Lediga platser",
  "fa-kvar": "Få platser kvar",
  fullt: "Fullt",
  okant: "",
};

// Färgklasser per tillgänglighet; avbokade visas gråa och överstrukna.
const chip: Record<Availability | "avbokad", string> = {
  lediga:
    "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  "fa-kvar":
    "border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  fullt: "border-red-600/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  okant: "border-border bg-muted text-foreground",
  avbokad: "border-border bg-muted text-muted-foreground line-through",
};

const dot: Record<Availability, string> = {
  lediga: "bg-emerald-600",
  "fa-kvar": "bg-amber-500",
  fullt: "bg-red-600",
  okant: "bg-muted-foreground/40",
};

// Färgad vänsterkant på evenemangskort.
const edge: Record<Availability | "avbokad", string> = {
  lediga: "border-l-emerald-600",
  "fa-kvar": "border-l-amber-500",
  fullt: "border-l-red-600",
  okant: "border-l-ball",
  avbokad: "border-l-muted-foreground/40",
};

export function eventEdgeClass(event: CalendarEvent): string {
  return edge[event.status === "avbokad" ? "avbokad" : event.availability];
}

export function eventChipClass(event: CalendarEvent): string {
  return chip[event.status === "avbokad" ? "avbokad" : event.availability];
}

export function classChipClass(c: CalendarClass, cancelled: boolean): string {
  if (cancelled) return chip.avbokad;
  if (c.registered === null) return chip.okant;
  return chip[c.registered >= c.maxTeams ? "fullt" : "lediga"];
}

export function AvailabilityText({ event }: { event: CalendarEvent }) {
  if (event.status === "avbokad") {
    return <span className="font-medium text-muted-foreground">Avbokat</span>;
  }
  if (event.availability === "okant") return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dot[event.availability])} />
      {label[event.availability]}
    </span>
  );
}

export function AvailabilityLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(["lediga", "fa-kvar", "fullt"] as const).map((a) => (
        <li key={a} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", dot[a])} />
          {label[a]}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="line-through">Avbokat</span>
      </li>
    </ul>
  );
}
