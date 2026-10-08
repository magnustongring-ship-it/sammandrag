"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { genderLabel, todayInStockholm } from "@/lib/calendar";
import {
  EMAIL_PATTERN,
  PHONE_PATTERN,
  classSuffix,
  isRegistrationOpen,
  lastRegistrationDay,
  swapClassSuffix,
  teamNameWithClass,
} from "@/lib/registration";
import { sendEmail } from "@/lib/email";
import { organizerEmail, registrantEmail } from "@/lib/email-templates";
import { friendlyError } from "@/lib/errors";

export type RegisterValues = {
  classId: string;
  teamName: string;
  contactEmail: string;
  contactPhone: string;
};

export type RegisterState =
  | { error?: string; message?: string; values: RegisterValues }
  | undefined;

export async function registerTeam(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // Dolt fält i stället för .bind(), se saveEvent.
  const eventId = String(formData.get("event_id") ?? "");
  const values: RegisterValues = {
    classId: String(formData.get("class_id") ?? ""),
    teamName: String(formData.get("team_name") ?? "").trim(),
    contactEmail: String(formData.get("contact_email") ?? "").trim(),
    contactPhone: String(formData.get("contact_phone") ?? "").trim(),
  };
  const fail = (error: string): RegisterState => ({ error, values });

  const session = await getSession();
  if (!session) return fail("Du måste logga in för att anmäla lag.");
  if (session.organization?.status !== "godkand") {
    return fail("Din förening måste vara godkänd innan ni kan anmäla lag.");
  }

  if (!values.classId) return fail("Välj klass.");
  if (!values.teamName) return fail("Ange lagnamn.");
  if (values.teamName.length > 100) return fail("Lagnamnet är för långt.");
  if (!EMAIL_PATTERN.test(values.contactEmail)) {
    return fail("Ange en giltig e-postadress till kontaktpersonen.");
  }
  if (!PHONE_PATTERN.test(values.contactPhone)) {
    return fail("Ange ett giltigt telefonnummer till kontaktpersonen.");
  }

  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("event_classes")
    .select(
      "id, gender, age_groups(name), events(status, title, event_date, start_time, end_time, venue_name, city, registration_deadline, organizations(name, contact_email))",
    )
    .eq("id", values.classId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!cls?.events) return fail("Klassen hittades inte.");
  if (!isRegistrationOpen(cls.events, todayInStockholm())) {
    return fail("Anmälan till det här sammandraget är stängd.");
  }

  // Lägg till klassens förkortning efter lagnamnet, t.ex. "Borlänge Basket PU8".
  const teamName = teamNameWithClass(
    values.teamName,
    classSuffix(cls.gender, cls.age_groups?.name ?? ""),
  );

  const { data, error } = await supabase
    .from("registrations")
    .insert({
      event_class_id: values.classId,
      organization_id: session.organization.id,
      registered_by: session.userId,
      team_name: teamName,
      contact_email: values.contactEmail,
      contact_phone: values.contactPhone,
    })
    .select("status")
    .single();

  if (error) {
    return fail(friendlyError(error, "Kunde inte anmäla laget"));
  }

  revalidatePath(`/sammandrag/${eventId}`);
  revalidatePath("/mina-anmalningar");
  revalidatePath("/");

  // Bekräftelsemejl skickas efter svaret så att anmälan aldrig väntar på dem.
  const origin = (await headers()).get("origin") ?? "";
  const ev = cls.events;
  const mail = {
    url: `${origin}/sammandrag/${eventId}`,
    teamName,
    clubName: session.organization.name,
    classLabel: `${cls.age_groups?.name ?? "?"} ${genderLabel[cls.gender].toLowerCase()}`,
    waitlisted: data.status === "vantelista",
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
    event: {
      title: ev.title,
      date: ev.event_date,
      startTime: ev.start_time,
      endTime: ev.end_time,
      venue: ev.venue_name,
      city: ev.city,
      lastDay: lastRegistrationDay(ev),
      organizer: ev.organizations?.name ?? "",
    },
  };
  const organizerAddress = ev.organizations?.contact_email;
  after(async () => {
    await sendEmail({
      to: values.contactEmail,
      replyTo: organizerAddress,
      ...registrantEmail(mail),
    });
    if (organizerAddress) {
      await sendEmail({
        to: organizerAddress,
        replyTo: values.contactEmail,
        ...organizerEmail({ ...mail, url: `${origin}/arrangor/${eventId}` }),
      });
    }
  });

  return {
    message:
      data.status === "vantelista"
        ? `${teamName} står på väntelistan. Laget flyttas upp automatiskt om en plats blir ledig.`
        : `${teamName} är anmält!`,
    // Behåll klass och kontaktuppgifter så att det går snabbt att anmäla fler lag.
    values: { ...values, teamName: "" },
  };
}

export async function cancelRegistration(
  registrationId: string,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Du måste vara inloggad." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: registrationId,
  });
  if (error) {
    return { error: friendlyError(error, "Kunde inte avanmäla laget") };
  }

  revalidatePath("/sammandrag/[id]", "page");
  revalidatePath("/arrangor/[id]", "page");
  revalidatePath("/mina-anmalningar");
  revalidatePath("/");
  return {};
}

// Arrangören flyttar ett lag till en annan klass (eller mellan anmälda och
// väntelista) när anmälan har stängt. Databasen kontrollerar att det är
// arrangören och att klassen har plats.
export async function moveRegistration(
  registrationId: string,
  classId: string,
  status: "anmald" | "vantelista",
): Promise<{ error?: string; status?: "anmald" | "vantelista" }> {
  const session = await getSession();
  if (!session) return { error: "Du måste vara inloggad." };

  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select(
      "team_name, event_class_id, event_classes(event_id, gender, age_groups(name), events(status, event_date, registration_deadline))",
    )
    .eq("id", registrationId)
    .maybeSingle();
  const from = reg?.event_classes;
  if (!reg || !from?.events) return { error: "Anmälan hittades inte." };
  if (isRegistrationOpen(from.events, todayInStockholm())) {
    return { error: "Lag kan flyttas först när anmälningstiden har gått ut." };
  }

  const { data: to } = await supabase
    .from("event_classes")
    .select("gender, age_groups(name)")
    .eq("id", classId)
    .eq("event_id", from.event_id)
    .maybeSingle();
  if (!to) return { error: "Klassen hittades inte." };

  // Lagnamnet slutar på klassens förkortning (t.ex. PU8) som byts mot den nya klassens.
  const teamName = swapClassSuffix(
    reg.team_name,
    classSuffix(from.gender, from.age_groups?.name ?? ""),
    classSuffix(to.gender, to.age_groups?.name ?? ""),
  );

  const { data: newStatus, error } = await supabase.rpc("move_registration", {
    p_registration_id: registrationId,
    p_class_id: classId,
    p_status: status,
    p_team_name: teamName,
  });
  if (error) {
    return { error: friendlyError(error, "Kunde inte flytta laget") };
  }

  revalidatePath("/sammandrag/[id]", "page");
  revalidatePath("/arrangor/[id]", "page");
  revalidatePath("/mina-anmalningar");
  revalidatePath("/");
  return { status: newStatus as "anmald" | "vantelista" };
}
