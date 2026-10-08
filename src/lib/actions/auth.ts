"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, homePathFor } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";

export type FormState = { error?: string; message?: string } | undefined;

// Översätter Supabase Auths felkoder till svenska.
function authErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Fel e-postadress eller lösenord.";
    case "email_not_confirmed":
      return "Du måste bekräfta din e-postadress först. Kolla din inkorg.";
    case "user_already_exists":
    case "email_exists":
      return "Det finns redan ett konto med den e-postadressen.";
    case "weak_password":
      return "Lösenordet är för svagt. Använd minst 8 tecken.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "För många försök. Vänta en stund och försök igen.";
    case "email_address_invalid":
      return "Ogiltig e-postadress.";
    default:
      console.error("[auth]", code, fallback);
      return "Något gick fel. Försök igen om en stund.";
  }
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = field(formData, "full_name");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email) return { error: "Fyll i namn och e-postadress." };
  if (password.length < 8) {
    return { error: "Lösenordet måste vara minst 8 tecken." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/registrera/forening`,
    },
  });

  if (error) return { error: authErrorMessage(error.code, error.message) };

  // Med e-postbekräftelse påslagen returnerar Supabase inget fel för en
  // redan registrerad adress, men användaren saknar då identiteter.
  if (data.user && data.user.identities?.length === 0) {
    return { error: authErrorMessage("user_already_exists", "") };
  }

  // Om e-postbekräftelse är avstängd blir man inloggad direkt.
  if (data.session) redirect("/registrera/forening");

  return {
    message: `Vi har skickat ett bekräftelsemejl till ${email}. Klicka på länken i mejlet för att fortsätta.`,
  };
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Fyll i e-post och lösenord." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: authErrorMessage(error.code, error.message) };

  const session = await getSession();
  revalidatePath("/", "layout");
  // Utan förening (t.ex. en domare) finns inget föreningssteg att tvinga fram.
  if (session && !session.organization && session.profile.role !== "superadmin") {
    redirect("/mina-matcher");
  }
  redirect(session ? homePathFor(session) : "/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createOrganization(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = field(formData, "name");
  const city = field(formData, "city");
  const contactEmail = field(formData, "contact_email");
  if (!name || !city || !contactEmail) {
    return { error: "Fyll i föreningens namn, ort och kontakt-e-post." };
  }

  const session = await getSession();
  if (!session) redirect("/logga-in");
  if (session.organization) redirect(homePathFor(session));

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_city: city,
    p_contact_email: contactEmail,
  });
  if (error) return { error: friendlyError(error, "Kunde inte registrera föreningen") };

  // Spara namnet från registreringen på profilen (bara full_name får ändras).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === "string" && !session.profile.full_name) {
    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", session.userId);
  }

  revalidatePath("/", "layout");
  redirect("/vantar-pa-godkannande");
}
