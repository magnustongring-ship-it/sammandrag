"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { sendEmail } from "@/lib/email";
import { EMAIL_PATTERN, PHONE_PATTERN } from "@/lib/registration";
import { autoAssign, refereeConflicts, refereeLevelLabel, REFEREE_LEVELS } from "@/lib/referees";
import { toMinutes } from "@/lib/scheduler";
import { emailEnabled } from "@/lib/email";
import { notifyRefereeChanges, refereeSnapshot } from "@/lib/referee-notify";

async function origin() {
  return (await headers()).get("origin") ?? "";
}

/** Meddelande till arrangören om vilka domare som får mejl. */
function mailNote(sent: number, published: boolean): string[] {
  if (!published) return ["Domarna får mejl om sina matcher när schemat publiceras."];
  if (sent === 0) return [];
  return emailEnabled()
    ? [`${sent} domare får mejl om ändringen.`]
    : [`E-post är inte aktiverat, så ${sent} domare fick inget mejl om ändringen.`];
}
import type { RefereeLevel } from "@/lib/database.types";

export type RefereeState = { error?: string; message?: string; warnings?: string[] } | undefined;

const MISSING_TABLES =
  "Domarfunktionen är inte aktiverad i databasen ännu. Kör migreringen supabase/migrations/20261008000000_referees.sql i Supabase → SQL Editor.";

function refError(error: { code?: string; message: string }, context: string) {
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") {
    return MISSING_TABLES;
  }
  return friendlyError(error, context);
}

function revalidate(eventId: string) {
  revalidatePath(`/arrangor/${eventId}/domare`);
  revalidatePath(`/arrangor/${eventId}/schema`);
  revalidatePath(`/arrangor/${eventId}`);
  revalidatePath(`/sammandrag/${eventId}`);
}

/** Intresseanmälan från en domare. Kräver ingen inloggning. */
export async function applyAsReferee(
  _prev: RefereeState,
  formData: FormData,
): Promise<RefereeState> {
  const eventId = String(formData.get("event_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const level = String(formData.get("level") ?? "") as RefereeLevel;

  if (!name || name.length > 100) return { error: "Ange ditt namn." };
  if (!EMAIL_PATTERN.test(email)) return { error: "Ange en giltig e-postadress." };
  if (!PHONE_PATTERN.test(phone)) return { error: "Ange ett giltigt telefonnummer." };
  if (!REFEREE_LEVELS.some((l) => l.value === level)) return { error: "Välj din domarnivå." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("referee_applications")
    .insert({ event_id: eventId, name, email, phone, level });
  if (error) {
    if (error.code === "23505") {
      return { error: "Du har redan anmält intresse till det här sammandraget med den e-postadressen." };
    }
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return { error: "Det går inte längre att anmäla sig som domare till det här sammandraget." };
    }
    return { error: refError(error, "Kunde inte skicka anmälan") };
  }

  // Meddela arrangören (om e-post är aktiverat).
  const { data: event } = await supabase
    .from("events")
    .select("title, organizations(contact_email)")
    .eq("id", eventId)
    .maybeSingle();
  const to = event?.organizations?.contact_email;
  const origin = (await headers()).get("origin") ?? "";
  if (event && to) {
    after(() =>
      sendEmail({
        to,
        replyTo: email,
        subject: `Ny domaranmälan: ${name}, ${event.title}`,
        text: [
          "Hej!",
          "",
          `${name} (${refereeLevelLabel[level]}) vill döma på ${event.title}.`,
          `Kontakt: ${email}, ${phone}`,
          "",
          "Tillsätt domare under Mina sammandrag:",
          `${origin}/arrangor/${eventId}/domare`,
          "",
          "/Easy Basket planeraren",
        ].join("\n"),
      }),
    );
  }

  revalidate(eventId);
  return { message: "Tack! Din intresseanmälan är skickad till arrangören." };
}

async function ownEvent(eventId: string) {
  const session = await requireOrganizer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("organizer_org_id")
    .eq("id", eventId)
    .maybeSingle();
  return { supabase, ok: data?.organizer_org_id === session.organization.id };
}

export async function deleteReferee(
  eventId: string,
  refereeId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await ownEvent(eventId);
  if (!ok) return { error: "Sammandraget hittades inte." };
  const before = await refereeSnapshot(supabase, eventId);
  const { error } = await supabase
    .from("referee_applications")
    .delete()
    .eq("id", refereeId)
    .eq("event_id", eventId);
  if (error) return { error: refError(error, "Kunde inte ta bort domaren") };
  await notifyRefereeChanges(
    supabase,
    eventId,
    before,
    await refereeSnapshot(supabase, eventId),
    await origin(),
  );
  revalidate(eventId);
  return {};
}

async function loadForAssignment(eventId: string) {
  const { supabase, ok } = await ownEvent(eventId);
  if (!ok) return null;
  const [
    { data: matches, error: mErr },
    { data: referees, error: rErr },
    { data: schedule },
  ] = await Promise.all([
    supabase
      .from("schedule_matches")
      .select("id, court, starts_at, ends_at")
      .eq("event_id", eventId)
      .order("starts_at")
      .order("court"),
    supabase.from("referee_applications").select("id, name, level").eq("event_id", eventId),
    supabase.from("event_schedules").select("published").eq("event_id", eventId).maybeSingle(),
  ]);
  return {
    supabase,
    matches: matches ?? [],
    referees: referees ?? [],
    published: Boolean(schedule?.published),
    error: mErr ?? rErr,
  };
}

/** Fördelar alla domare automatiskt och ersätter tidigare tillsättning. */
export async function autoAssignReferees(
  _prev: RefereeState,
  formData: FormData,
): Promise<RefereeState> {
  const eventId = String(formData.get("event_id") ?? "");
  const perMatch = formData.get("per_match") === "2" ? 2 : 1;
  const loaded = await loadForAssignment(eventId);
  if (!loaded) return { error: "Sammandraget hittades inte." };
  const { supabase, matches, referees, published, error } = loaded;
  if (error) return { error: refError(error, "Kunde inte hämta matcher och domare") };
  if (matches.length === 0) return { error: "Skapa ett spelschema först." };
  const before = await refereeSnapshot(supabase, eventId);
  if (referees.length === 0) return { error: "Inga domare har anmält intresse ännu." };

  const { assignments, unfilled } = autoAssign(
    matches.map((m) => ({ id: m.id, start: toMinutes(m.starts_at), end: toMinutes(m.ends_at) })),
    referees,
    perMatch,
  );
  const name = new Map(referees.map((r) => [r.id, r.name]));
  for (const a of assignments) {
    const { error: upErr } = await supabase
      .from("schedule_matches")
      .update({
        referee1_id: a.referee1,
        referee1_name: a.referee1 ? name.get(a.referee1)! : null,
        referee2_id: a.referee2,
        referee2_name: a.referee2 ? name.get(a.referee2)! : null,
      })
      .eq("id", a.matchId);
    if (upErr) return { error: refError(upErr, "Kunde inte spara tillsättningen") };
  }

  const sent = await notifyRefereeChanges(
    supabase,
    eventId,
    before,
    await refereeSnapshot(supabase, eventId),
    await origin(),
  );

  revalidate(eventId);
  return {
    message: `Domarna är fördelade på ${matches.length} matcher.`,
    warnings: [
      ...(unfilled > 0
        ? [
            `${unfilled} ${unfilled === 1 ? "domarplats" : "domarplatser"} kunde inte fyllas eftersom det finns för få domare som är lediga samtidigt.`,
          ]
        : []),
      ...mailNote(sent, published),
    ],
  };
}

/** Sparar manuell tillsättning från tabellen. */
export async function saveRefereeAssignments(
  _prev: RefereeState,
  formData: FormData,
): Promise<RefereeState> {
  const eventId = String(formData.get("event_id") ?? "");
  const loaded = await loadForAssignment(eventId);
  if (!loaded) return { error: "Sammandraget hittades inte." };
  const { supabase, matches, referees, published, error } = loaded;
  if (error) return { error: refError(error, "Kunde inte hämta matcher och domare") };
  const before = await refereeSnapshot(supabase, eventId);

  const name = new Map(referees.map((r) => [r.id, r.name]));
  const pick = (key: string) => {
    const v = String(formData.get(key) ?? "");
    return v && name.has(v) ? v : null;
  };

  const updates = matches.map((m) => ({
    m,
    r1: pick(`ref1_${m.id}`),
    r2: pick(`ref2_${m.id}`),
  }));
  for (const u of updates) {
    if (u.r1 && u.r1 === u.r2) {
      return {
        error: `Matchen ${u.m.starts_at.slice(0, 5)} på plan ${u.m.court} har samma domare två gånger.`,
      };
    }
  }

  for (const u of updates) {
    // Domare 2 utan domare 1: flytta upp.
    const [a, b] = u.r1 ? [u.r1, u.r2] : [u.r2, null];
    const { error: upErr } = await supabase
      .from("schedule_matches")
      .update({
        referee1_id: a,
        referee1_name: a ? name.get(a)! : null,
        referee2_id: b,
        referee2_name: b ? name.get(b)! : null,
      })
      .eq("id", u.m.id);
    if (upErr) return { error: refError(upErr, "Kunde inte spara tillsättningen") };
  }

  const warnings = refereeConflicts(
    updates.map((u) => ({
      id: u.m.id,
      start: toMinutes(u.m.starts_at),
      end: toMinutes(u.m.ends_at),
      label: `${u.m.starts_at.slice(0, 5)} plan ${u.m.court}`,
      referees: [u.r1, u.r2].filter((x): x is string => Boolean(x)),
    })),
    name,
  );

  const sent = await notifyRefereeChanges(
    supabase,
    eventId,
    before,
    await refereeSnapshot(supabase, eventId),
    await origin(),
  );

  revalidate(eventId);
  return { message: "Tillsättningen är sparad.", warnings: [...warnings, ...mailNote(sent, published)] };
}
