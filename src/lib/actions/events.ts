"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { canManageEvent, isSuperAdmin, requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInStockholm } from "@/lib/calendar";
import { validateEventForm, type EventFormValues, type ValidClass } from "@/lib/event-form";
import type { EventStatus, TablesInsert } from "@/lib/database.types";
import { overlaps, type Conflict } from "@/lib/conflicts";
import { formatTimeRange } from "@/lib/calendar";

export type EventFormState = { error?: string; conflicts?: Conflict[] } | undefined;
import { friendlyError } from "@/lib/errors";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function dbError(error: PostgrestError): string {
  if (error.code === "23505") {
    return "Samma åldersgrupp och kön finns redan i det här sammandraget.";
  }
  if (error.code === "PGRST204" || error.code === "42703") {
    return "Databasen saknar kolumnerna för matchregler. Kör migreringen supabase/migrations/20261007000000_easy_basket_rules.sql i Supabase → SQL Editor.";
  }
  if (error.code === "42501") {
    return "Du har inte behörighet att ändra det här sammandraget.";
  }
  return friendlyError(error, "Kunde inte spara");
}

function parseValues(formData: FormData): EventFormValues | null {
  try {
    const v = JSON.parse(String(formData.get("values") ?? ""));
    if (typeof v !== "object" || v === null || !Array.isArray(v.classes)) {
      return null;
    }
    const s = (x: unknown) => (typeof x === "string" ? x.trim() : "");
    return {
      title: s(v.title),
      eventDate: s(v.eventDate),
      startTime: s(v.startTime),
      endTime: s(v.endTime),
      venueName: s(v.venueName),
      address: s(v.address),
      city: s(v.city),
      description: s(v.description),
      registrationDeadline: s(v.registrationDeadline),
      classes: v.classes.map((c: Record<string, unknown>) => ({
        id: typeof c.id === "string" ? c.id : undefined,
        key: s(c.key),
        ageGroupId: s(c.ageGroupId),
        gender: s(c.gender),
        maxTeams: s(c.maxTeams),
        gameFormat: s(c.gameFormat),
        periods: s(c.periods),
        periodMinutes: s(c.periodMinutes),
        breakMinutes: s(c.breakMinutes),
      })),
    };
  } catch {
    return null;
  }
}

async function classCounts(supabase: Supabase, eventId: string) {
  const { data } = await supabase.rpc("event_class_counts", {
    p_event_ids: [eventId],
  });
  return new Map(
    (data ?? []).map((c) => [
      c.event_class_id,
      { registered: c.registered, total: c.registered + c.waitlisted },
    ]),
  );
}

function classFields(c: ValidClass) {
  return {
    age_group_id: c.ageGroupId,
    gender: c.gender,
    max_teams: c.maxTeams,
    game_format: c.gameFormat,
    periods: c.periods,
    period_minutes: c.periodMinutes,
    break_minutes: c.breakMinutes,
  };
}

function slotKey(date: string, start: string, end: string, venue: string, city: string) {
  return [date, start, end, venue.trim().toLowerCase(), city.trim().toLowerCase()].join("|");
}

/** Andra sammandrag samma dag i samma hall med överlappande tid. */
async function findConflicts(
  supabase: Supabase,
  eventId: string | null,
  values: EventFormValues,
): Promise<Conflict[]> {
  const { data } = await supabase
    .from("events")
    .select("id, title, start_time, end_time, venue_name, city, organizations(name)")
    .eq("event_date", values.eventDate)
    .neq("status", "avbokad");

  const slot = {
    venueName: values.venueName,
    city: values.city || null,
    startTime: values.startTime || null,
    endTime: values.endTime || null,
  };
  return (data ?? [])
    .filter(
      (e) =>
        e.id !== eventId &&
        overlaps(slot, {
          venueName: e.venue_name,
          city: e.city,
          startTime: e.start_time,
          endTime: e.end_time,
        }),
    )
    .map((e) => ({
      id: e.id,
      title: e.title,
      organizer: e.organizations?.name ?? null,
      time: formatTimeRange(e.start_time, e.end_time),
    }));
}

/**
 * Skapar (utan event_id) eller uppdaterar ett sammandrag med klasser.
 * intent: "utkast" sparar som utkast, "publicera" publicerar,
 * "spara" behåller nuvarande status.
 */
export async function saveEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  // Id skickas som dolt fält i stället för .bind(): bundna actions med
  // useActionState hänger i Next 16 när formuläret skickas utan JavaScript.
  const eventId = String(formData.get("event_id") ?? "") || null;
  const session = await requireOrganizer();
  const supabase = await createClient();
  const values = parseValues(formData);
  if (!values) return { error: "Formuläret kunde inte läsas. Ladda om sidan." };
  const intent = String(formData.get("intent") ?? "spara");

  let currentStatus: EventStatus = "utkast";
  let existingClassIds = new Set<string>();
  let existingSlot: string | null = null;
  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select(
        "status, organizer_org_id, event_date, start_time, end_time, venue_name, city, event_classes(id)",
      )
      .eq("id", eventId)
      .single();
    if (!event || !canManageEvent(session, event.organizer_org_id)) {
      return { error: "Sammandraget hittades inte." };
    }
    currentStatus = event.status;
    existingClassIds = new Set(event.event_classes.map((c) => c.id));
    existingSlot = slotKey(
      event.event_date,
      event.start_time?.slice(0, 5) ?? "",
      event.end_time?.slice(0, 5) ?? "",
      event.venue_name,
      event.city ?? "",
    );
  }

  const status: EventStatus =
    intent === "publicera"
      ? "publicerad"
      : intent === "utkast" && currentStatus === "utkast"
        ? "utkast"
        : currentStatus;

  const result = validateEventForm(values, {
    publishing: status === "publicerad",
    today: todayInStockholm(),
    isNew: !eventId,
  });
  if (!result.ok) return { error: result.error };
  const classes = result.classes;

  // Dubbelbokning: kontrollera när sammandraget publiceras, eller när ett
  // publicerat sammandrag byter datum, tid eller hall.
  const slotChanged =
    existingSlot !==
    slotKey(values.eventDate, values.startTime, values.endTime, values.venueName, values.city);
  if (
    status === "publicerad" &&
    (currentStatus !== "publicerad" || slotChanged) &&
    formData.get("confirm_conflict") !== "1"
  ) {
    const conflicts = await findConflicts(supabase, eventId, values);
    if (conflicts.length > 0) {
      return {
        conflicts,
        error:
          "Hallen verkar redan vara bokad samma tid. Kontrollera, och kryssa i rutan för att spara ändå.",
      };
    }
  }

  const fields = {
    title: values.title,
    event_date: values.eventDate,
    start_time: values.startTime || null,
    end_time: values.endTime || null,
    venue_name: values.venueName,
    address: values.address || null,
    city: values.city || null,
    description: values.description || null,
    registration_deadline: values.registrationDeadline || null,
    status,
  };

  if (!eventId) {
    if (!session.organization) {
      return { error: "Du måste tillhöra en förening för att skapa sammandrag." };
    }
    const { data: created, error } = await supabase
      .from("events")
      .insert({
        ...fields,
        organizer_org_id: session.organization.id,
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !created) return { error: error ? dbError(error) : "Kunde inte spara." };

    if (classes.length > 0) {
      const { error: classError } = await supabase.from("event_classes").insert(
        classes.map(
          (c): TablesInsert<"event_classes"> => ({
            event_id: created.id,
            ...classFields(c),
          }),
        ),
      );
      if (classError) {
        // Ångra så att inget halvt sparat sammandrag blir kvar.
        await supabase.from("events").delete().eq("id", created.id);
        return { error: dbError(classError) };
      }
    }
    revalidatePath("/");
    revalidatePath("/arrangor");
    redirect(`/arrangor/${created.id}?sparat=1`);
  }

  // Redigering: jämför klasser mot det som finns sparat.
  for (const c of classes) {
    if (c.id && !existingClassIds.has(c.id)) {
      return { error: "En klass hör inte till det här sammandraget. Ladda om sidan." };
    }
  }
  const keptIds = new Set(classes.flatMap((c) => (c.id ? [c.id] : [])));
  const removedIds = [...existingClassIds].filter((id) => !keptIds.has(id));
  const counts = await classCounts(supabase, eventId);

  const removedWithTeams = removedIds.filter(
    (id) => (counts.get(id)?.total ?? 0) > 0,
  );
  if (removedWithTeams.length > 0 && formData.get("confirm_remove") !== "1") {
    return {
      error:
        "Du tar bort klasser som har anmälda lag. Bekräfta borttagningen i rutan under klasserna och spara igen.",
    };
  }

  for (const [i, c] of classes.entries()) {
    const registered = c.id ? (counts.get(c.id)?.registered ?? 0) : 0;
    if (c.maxTeams < registered) {
      return {
        error: `Klass ${i + 1}: ${registered} lag är redan anmälda, max antal lag kan inte vara lägre.`,
      };
    }
  }

  const { error: eventError } = await supabase
    .from("events")
    .update(fields)
    .eq("id", eventId);
  if (eventError) return { error: dbError(eventError) };

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("event_classes")
      .delete()
      .in("id", removedIds);
    if (error) return { error: dbError(error) };
  }

  for (const c of classes.filter((c) => c.id)) {
    const { error } = await supabase
      .from("event_classes")
      .update(classFields(c))
      .eq("id", c.id!);
    if (error) return { error: dbError(error) };
  }

  const added = classes.filter((c) => !c.id);
  if (added.length > 0) {
    const { error } = await supabase.from("event_classes").insert(
      added.map((c) => ({
        event_id: eventId,
        ...classFields(c),
      })),
    );
    if (error) return { error: dbError(error) };
  }

  revalidatePath("/");
  revalidatePath("/arrangor");
  revalidatePath(`/sammandrag/${eventId}`);
  redirect(`/arrangor/${eventId}?sparat=1`);
}

export type ActionResult = { error?: string };

/** Avboka eller återpublicera ett publicerat sammandrag. */
export async function setEventStatus(
  eventId: string,
  status: "publicerad" | "avbokad",
): Promise<ActionResult> {
  const session = await requireOrganizer();
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("status, organizer_org_id, event_classes(id)")
    .eq("id", eventId)
    .single();
  if (!event || !canManageEvent(session, event.organizer_org_id)) {
    return { error: "Sammandraget hittades inte." };
  }
  if (status === "publicerad" && event.event_classes.length === 0) {
    return { error: "Lägg till minst en klass innan du publicerar." };
  }

  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId);
  if (error) return { error: dbError(error) };

  revalidatePath("/");
  revalidatePath("/arrangor");
  revalidatePath(`/arrangor/${eventId}`);
  revalidatePath(`/sammandrag/${eventId}`);
  return {};
}

/** Tar bort ett utkast. Publicerade sammandrag avbokas i stället. */
export async function deleteDraft(eventId: string): Promise<ActionResult> {
  const session = await requireOrganizer();
  const supabase = await createClient();
  const query = supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("status", "utkast");
  const { data, error } = await (isSuperAdmin(session)
    ? query
    : query.eq("organizer_org_id", session.organization?.id ?? "")
  ).select("id");
  if (error) return { error: dbError(error) };
  if (!data?.length) return { error: "Bara utkast kan raderas." };

  revalidatePath("/arrangor");
  redirect("/arrangor");
}

/**
 * Tar bort ett sammandrag oavsett status, med klasser, anmälningar, spelschema
 * och domaranmälningar. Bara SuperAdmin: för alla andra avbokas publicerade
 * sammandrag i stället. Anmälda föreningar får inget meddelande.
 */
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const session = await requireOrganizer();
  if (!isSuperAdmin(session)) {
    return { error: "Bara SuperAdmin kan radera publicerade sammandrag." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("id");
  if (error) return { error: dbError(error) };
  if (!data?.length) return { error: "Sammandraget hittades inte." };

  revalidatePath("/");
  revalidatePath("/arrangor");
  revalidatePath("/mina-anmalningar");
  revalidatePath("/mina-matcher");
  redirect("/arrangor");
}
