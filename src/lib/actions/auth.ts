"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, homePathFor } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { EMAIL_PATTERN } from "@/lib/registration";

export type FormState =
  | {
      error?: string;
      message?: string;
      /** Fel per fält, nyckel = fältets name */
      fieldErrors?: Record<string, string>;
      /** Det användaren skrev in (utom lösenord), så att inget töms vid fel */
      values?: Record<string, string>;
    }
  | undefined;

type FieldErrors = Record<string, string>;

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
    // Supabase avvisar adresser som inte kan ta emot mejl, t.ex. när
    // domänen (delen efter @) inte finns.
    case "email_address_invalid":
      return "E-postadressen kan inte ta emot mejl. Kontrollera att delen efter @ är rätt stavad och att adressen finns.";
    default:
      console.error("[auth]", code, fallback);
      return "Något gick fel. Försök igen om en stund.";
  }
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Intern sökväg att skicka användaren till, eller null (inga öppna omdirigeringar). */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** Alla ifyllda textfält utom lösenord, för att fylla i formuläret igen vid fel. */
function enteredValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData) {
    if (typeof value === "string" && !name.startsWith("password") && !name.startsWith("$")) {
      values[name] = value;
    }
  }
  return values;
}

function invalid(formData: FormData, fieldErrors: FieldErrors, error?: string): FormState {
  return {
    error: error ?? "Kontrollera de markerade fälten.",
    fieldErrors,
    values: enteredValues(formData),
  };
}

// Supabase Auths fel som gäller ett visst fält.
function authFieldError(code: string | undefined): FieldErrors {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
    case "email_address_invalid":
      return { email: authErrorMessage(code, "") };
    case "weak_password":
      return { password: authErrorMessage(code, "") };
    default:
      return {};
  }
}

// Kontrollerar kontots fält: namn, e-post och lösenord två gånger.
function accountErrors(formData: FormData): FieldErrors {
  const errors: FieldErrors = {};
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (!field(formData, "full_name")) errors.full_name = "Fyll i ditt namn.";
  if (!email) errors.email = "Fyll i din e-postadress.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Ogiltig e-postadress, t.ex. namn@exempel.se.";
  if (password.length < 8) errors.password = "Lösenordet måste vara minst 8 tecken.";
  if (!confirm) errors.password_confirm = "Upprepa lösenordet.";
  else if (confirm !== password) errors.password_confirm = "Lösenorden är inte likadana.";
  return errors;
}

// Kontrollerar föreningens fält. Kontakt-e-posten får vara tom om `optionalEmail`.
function organizationErrors(formData: FormData, optionalEmail: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const contactEmail = field(formData, "contact_email");
  if (!field(formData, "name")) errors.name = "Fyll i föreningens namn.";
  if (!field(formData, "city")) errors.city = "Fyll i ort.";
  if (!contactEmail) {
    if (!optionalEmail) errors.contact_email = "Fyll i föreningens kontakt-e-post.";
  } else if (!EMAIL_PATTERN.test(contactEmail)) {
    errors.contact_email = "Ogiltig e-postadress, t.ex. kansli@forening.se.";
  }
  return errors;
}

// Skapar kontot. Kontotyp och föreningsuppgifter sparas i metadata, och
// databasen (handle_new_user) skapar profilen och eventuell förening.
async function createAccount(
  formData: FormData,
  metadata: Record<string, string>,
  next: string,
  extraErrors: FieldErrors = {},
): Promise<FormState> {
  const errors = { ...accountErrors(formData), ...extraErrors };
  if (Object.keys(errors).length > 0) return invalid(formData, errors);

  const fullName = field(formData, "full_name");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, ...metadata },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return invalid(formData, authFieldError(error.code), authErrorMessage(error.code, error.message));
  }

  // Med e-postbekräftelse påslagen returnerar Supabase inget fel för en
  // redan registrerad adress, men användaren saknar då identiteter.
  if (data.user && data.user.identities?.length === 0) {
    return invalid(
      formData,
      authFieldError("user_already_exists"),
      authErrorMessage("user_already_exists", ""),
    );
  }

  // Om e-postbekräftelse är avstängd blir man inloggad direkt.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return {
    message: `Vi har skickat ett bekräftelsemejl till ${email}. Klicka på länken i mejlet för att fortsätta.`,
  };
}

/** Registrering som domare: konto utan förening. */
export async function signUpReferee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return createAccount(formData, { account_type: "domare" }, "/mina-matcher");
}

/** Registrering av förening: kontot och föreningen skapas på en gång. */
export async function signUpOrganization(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return createAccount(
    formData,
    {
      account_type: "forening",
      org_name: field(formData, "name"),
      org_city: field(formData, "city"),
      org_contact_email: field(formData, "contact_email") || field(formData, "email"),
    },
    "/vantar-pa-godkannande",
    organizationErrors(formData, true),
  );
}

/** Registrering via en inbjudan från FöreningsAdmin. */
export async function signUpInvited(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = field(formData, "token");
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return { error: "Ogiltig inbjudan.", values: enteredValues(formData) };
  }
  return createAccount(formData, { account_type: "inbjudan" }, `/inbjudan/${token}`);
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
  redirect(safeNext(formData.get("next")) ?? (session ? homePathFor(session) : "/"));
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
  const errors = organizationErrors(formData, false);
  if (Object.keys(errors).length > 0) return invalid(formData, errors);
  const name = field(formData, "name");
  const city = field(formData, "city");
  const contactEmail = field(formData, "contact_email");

  const session = await getSession();
  if (!session) redirect("/logga-in");
  if (session.organization) redirect(homePathFor(session));

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_city: city,
    p_contact_email: contactEmail,
  });
  if (error) {
    return {
      error: friendlyError(error, "Kunde inte registrera föreningen"),
      values: enteredValues(formData),
    };
  }

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

/** Lägger till domarsidorna på kontot, t.ex. för en FöreningsAdmin som också dömer. */
export async function becomeReferee(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/logga-in?next=/registrera/domare");

  const supabase = await createClient();
  const { error } = await supabase.rpc("become_referee");
  if (error) throw new Error(friendlyError(error, "Kunde inte lägga till domarsidorna"));

  revalidatePath("/", "layout");
  redirect("/mina-matcher");
}
