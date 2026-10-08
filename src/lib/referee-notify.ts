import "server-only";
import { after } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/calendar";
import { getScheduleMatches } from "@/lib/schedule";
import { sendEmail } from "@/lib/email";
import {
  matchKey,
  refereeChanges,
  refereeEmail,
  type MatchSnapshot,
} from "@/lib/referee-changes";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RefereeContact = { id: string; name: string; email: string };

/** Nuvarande tillsättning och domarnas kontaktuppgifter. */
export async function refereeSnapshot(
  supabase: Supabase,
  eventId: string,
): Promise<{ matches: MatchSnapshot[]; contacts: RefereeContact[] }> {
  const [{ matches }, { data: contacts }] = await Promise.all([
    getScheduleMatches(supabase, eventId),
    supabase.from("referee_applications").select("id, name, email").eq("event_id", eventId),
  ]);
  return {
    contacts: contacts ?? [],
    matches: matches.map((m) => ({
      key: matchKey(m),
      start: m.start,
      label: `${m.start} plan ${m.court}, ${m.classLabel}: ${m.home} – ${m.away}`,
      refereeIds: m.refereeIds.filter((r): r is string => Boolean(r)),
    })),
  };
}

/**
 * Mejlar domare vars uppdrag har ändrats. Görs bara när schemat är
 * publicerat, så att arrangören kan planera i fred. Mejlen skickas efter
 * svaret och hoppas över om e-post inte är aktiverat.
 */
export async function notifyRefereeChanges(
  supabase: Supabase,
  eventId: string,
  before: { matches: MatchSnapshot[]; contacts: RefereeContact[] },
  afterSnapshot: { matches: MatchSnapshot[]; contacts: RefereeContact[] },
  origin: string,
  options: { force?: boolean } = {},
): Promise<number> {
  const [{ data: schedule }, { data: event }] = await Promise.all([
    supabase.from("event_schedules").select("published").eq("event_id", eventId).maybeSingle(),
    supabase
      .from("events")
      .select("title, event_date, venue_name, city, organizations(contact_email)")
      .eq("id", eventId)
      .maybeSingle(),
  ]);
  if (!event || (!schedule?.published && !options.force)) return 0;

  const changes = refereeChanges(before.matches, afterSnapshot.matches);
  // Kontaktuppgifter från före ändringen täcker domare som just tagits bort.
  const contacts = new Map(
    [...before.contacts, ...afterSnapshot.contacts].map((c) => [c.id, c]),
  );
  const replyTo = event.organizations?.contact_email ?? null;
  const ctx = {
    eventTitle: event.title,
    eventDate: formatDate(event.event_date, { weekday: "long", day: "numeric", month: "long" }),
    venue: [event.venue_name, event.city].filter(Boolean).join(", "),
    url: `${origin}/sammandrag/${eventId}`,
    accountUrl: `${origin}/mina-matcher`,
  };

  const mails = changes.flatMap((change) => {
    const c = contacts.get(change.refereeId);
    return c ? [{ to: c.email, ...refereeEmail(change, { ...ctx, name: c.name }) }] : [];
  });
  if (mails.length > 0) {
    after(async () => {
      for (const m of mails) await sendEmail({ ...m, replyTo });
    });
  }
  return mails.length;
}
