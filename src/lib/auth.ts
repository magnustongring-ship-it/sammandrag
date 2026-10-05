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

// Vart en inloggad användare ska skickas utifrån föreningens status.
export function homePathFor(session: Session): string {
  if (!session.organization) {
    return session.profile.is_site_admin ? "/admin" : "/registrera/forening";
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

export async function requireSiteAdmin(): Promise<Session> {
  const session = await requireUser();
  if (!session.profile.is_site_admin) redirect("/");
  return session;
}
