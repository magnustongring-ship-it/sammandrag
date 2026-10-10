import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Session = {
  userId: string;
  email: string | null;
  profile: Tables<"profiles">;
  organization: Tables<"organizations"> | null;
};

// Hämtar inloggad användare med profil och förening. Cachas per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  let organization: Tables<"organizations"> | null = null;
  if (profile.organization_id) {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();
    organization = data;
  }

  return { userId: user.id, email: user.email ?? null, profile, organization };
});

export const isSuperAdmin = (session: Session) => session.profile.role === "superadmin";

/** FöreningsAdmin eller SuperAdmin. */
export const isOrgAdmin = (session: Session) =>
  session.profile.role === "foreningsadmin" || session.profile.role === "superadmin";

/** Får användaren hantera sammandrag som arrangeras av föreningen? */
export function canManageEvent(session: Session, organizerOrgId: string): boolean {
  return isSuperAdmin(session) || (isOrgAdmin(session) && session.organization?.id === organizerOrgId);
}

// Vart en inloggad användare ska skickas utifrån föreningens status.
export function homePathFor(session: Session): string {
  if (!session.organization) {
    if (isSuperAdmin(session)) return "/admin";
    // Domare (och den som saknar förening) ser sina matcher.
    return "/mina-matcher";
  }
  if (session.organization.status !== "godkand") {
    return "/vantar-pa-godkannande";
  }
  return "/";
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/logga-in");
  return session;
}

// För sidor som kräver en godkänd förening (skapa sammandrag, anmäla lag).
export async function requireApprovedOrg(): Promise<
  Session & { organization: Tables<"organizations"> }
> {
  const session = await requireUser();
  if (session.organization?.status !== "godkand") {
    redirect(homePathFor(session));
  }
  return session as Session & { organization: Tables<"organizations"> };
}

// För arrangörssidor: FöreningsAdmin i en godkänd förening, eller SuperAdmin
// (som inte behöver tillhöra någon förening). Kontrollera äganderätt till ett
// sammandrag med canManageEvent.
export async function requireOrganizer(): Promise<Session> {
  const session = await requireUser();
  if (isSuperAdmin(session)) return session;
  if (session.organization?.status !== "godkand") redirect(homePathFor(session));
  if (!isOrgAdmin(session)) redirect("/");
  return session;
}

// För sidor som skapar något åt en förening: kräver en förening att skapa för.
export async function requireOrganizerWithOrg(): Promise<
  Session & { organization: Tables<"organizations"> }
> {
  const session = await requireOrganizer();
  if (!session.organization) redirect("/admin");
  return session as Session & { organization: Tables<"organizations"> };
}

// För sidor om föreningens medlemmar: FöreningsAdmin eller SuperAdmin.
export async function requireOrgAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!isOrgAdmin(session)) redirect("/");
  return session;
}

export async function requireSiteAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!isSuperAdmin(session)) redirect("/");
  return session;
}
