import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus, Gender } from "@/lib/database.types";
import { friendlyError } from "@/lib/errors";

export type Availability = "lediga" | "fa-kvar" | "fullt" | "okant";

export type CalendarClass = {
  id: string;
  ageGroup: string;
  ageGroupOrder: number;
  gender: Gender;
  maxTeams: number;
  /** null om antalen inte kunde hämtas */
  registered: number | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string;
  city: string | null;
  status: EventStatus;
  registrationDeadline: string | null;
  organizer: string | null;
  classes: CalendarClass[];
  availability: Availability;
};

export type CalendarFilter = {
  from: string;
  to?: string;
  ageGroupId?: number;
  gender?: Gender;
  city?: string;
  /** Visa bara publicerade, inte avbokade */
  hideCancelled?: boolean;
};

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string;
  city: string | null;
  status: EventStatus;
  registration_deadline: string | null;
  organizations: { name: string } | null;
  event_classes: {
    id: string;
    gender: Gender;
    max_teams: number;
    age_groups: { name: string; sort_order: number } | null;
  }[];
};

const EVENT_FIELDS =
  "id, title, event_date, start_time, end_time, venue_name, city, status, registration_deadline, organizations(name)";
const CLASS_FIELDS = "id, gender, max_teams, age_group_id, age_groups(name, sort_order)";

/** Platser kvar räknas som "få" när högst en fjärdedel (minst 1) återstår. */
export function availabilityFor(classes: CalendarClass[]): Availability {
  if (classes.length === 0) return "okant";
  if (classes.some((c) => c.registered === null)) return "okant";
  const max = classes.reduce((sum, c) => sum + c.maxTeams, 0);
  const free = classes.reduce(
    (sum, c) => sum + Math.max(0, c.maxTeams - (c.registered ?? 0)),
    0,
  );
  if (free === 0) return "fullt";
  if (free <= Math.max(1, Math.ceil(max / 4))) return "fa-kvar";
  return "lediga";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Publicerade och avbokade sammandrag i ett datumintervall. Med filter på
 * åldersgrupp/kön tas bara sammandrag med en matchande klass med, och bara
 * de matchande klasserna räknas in i färgmarkeringen.
 */
export async function getCalendarEvents(
  filter: CalendarFilter,
): Promise<{ events: CalendarEvent[]; error: string | null }> {
  const supabase = await createClient();
  const classFilter = filter.ageGroupId !== undefined || filter.gender !== undefined;

  let query = supabase
    .from("events")
    .select(
      `${EVENT_FIELDS}, event_classes${classFilter ? "!inner" : ""}(${CLASS_FIELDS})`,
    )
    .in("status", filter.hideCancelled ? ["publicerad"] : ["publicerad", "avbokad"])
    .gte("event_date", filter.from)
    .order("event_date")
    .order("start_time", { nullsFirst: true });

  if (filter.to) query = query.lte("event_date", filter.to);
  if (filter.ageGroupId !== undefined) {
    query = query.eq("event_classes.age_group_id", filter.ageGroupId);
  }
  if (filter.gender) query = query.eq("event_classes.gender", filter.gender);
  if (filter.city) query = query.ilike("city", `%${escapeLike(filter.city)}%`);

  const { data, error } = await query.overrideTypes<EventRow[], { merge: false }>();
  if (error) {
    return { events: [], error: friendlyError(error, "Kunde inte hämta sammandrag") };
  }

  const rows = data ?? [];
  const counts = new Map<string, number>();
  let countsAvailable = false;
  if (rows.length > 0) {
    const { data: countRows, error: countError } = await supabase.rpc(
      "event_class_counts",
      { p_event_ids: rows.map((r) => r.id) },
    );
    if (!countError && countRows) {
      countsAvailable = true;
      for (const c of countRows) counts.set(c.event_class_id, c.registered);
    } else if (countError) {
      console.warn(
        "event_class_counts saknas eller misslyckades – kör migreringen i supabase/migrations.",
        countError.message,
      );
    }
  }

  const events = rows.map((row): CalendarEvent => {
    const classes = row.event_classes
      .map(
        (c): CalendarClass => ({
          id: c.id,
          ageGroup: c.age_groups?.name ?? "?",
          ageGroupOrder: c.age_groups?.sort_order ?? 0,
          gender: c.gender,
          maxTeams: c.max_teams,
          registered: countsAvailable ? (counts.get(c.id) ?? 0) : null,
        }),
      )
      .sort(
        (a, b) =>
          a.ageGroupOrder - b.ageGroupOrder || a.gender.localeCompare(b.gender),
      );
    return {
      id: row.id,
      title: row.title,
      date: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      venue: row.venue_name,
      city: row.city,
      status: row.status,
      registrationDeadline: row.registration_deadline,
      organizer: row.organizations?.name ?? null,
      classes,
      availability: availabilityFor(classes),
    };
  });

  return { events, error: null };
}
