"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInStockholm } from "@/lib/calendar";
import {
  EMAIL_PATTERN,
  PHONE_PATTERN,
  isRegistrationOpen,
} from "@/lib/registration";

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
  eventId: string,
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
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
    .select("id, events(status, event_date, registration_deadline)")
    .eq("id", values.classId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!cls?.events) return fail("Klassen hittades inte.");
  if (!isRegistrationOpen(cls.events, todayInStockholm())) {
    return fail("Anmälan till det här sammandraget är stängd.");
  }

  const { data, error } = await supabase
    .from("registrations")
    .insert({
      event_class_id: values.classId,
      organization_id: session.organization.id,
      registered_by: session.userId,
      team_name: values.teamName,
      contact_email: values.contactEmail,
      contact_phone: values.contactPhone,
    })
    .select("status")
    .single();

  if (error) {
    // Fel från databasens regler (P0001) är redan på svenska.
    return fail(
      error.code === "P0001" ? error.message : `Kunde inte anmäla laget: ${error.message}`,
    );
  }

  revalidatePath(`/sammandrag/${eventId}`);
  revalidatePath("/mina-anmalningar");
  revalidatePath("/");

  return {
    message:
      data.status === "vantelista"
        ? `${values.teamName} står på väntelistan. Laget flyttas upp automatiskt om en plats blir ledig.`
        : `${values.teamName} är anmält!`,
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
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "PGRST202") {
      return {
        error:
          "Avanmälan är inte aktiverad i databasen ännu (migreringen för steg 6 saknas).",
      };
    }
    return { error: `Kunde inte avanmäla: ${error.message}` };
  }

  revalidatePath("/sammandrag/[id]", "page");
  revalidatePath("/mina-anmalningar");
  revalidatePath("/");
  return {};
}
