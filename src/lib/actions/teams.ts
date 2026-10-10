"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, isOrgAdmin, requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_PATTERN } from "@/lib/registration";
import { emailEnabled, sendEmail } from "@/lib/email";
import { teamInvitationEmail } from "@/lib/email-templates";
import { friendlyError } from "@/lib/errors";
import type { FormState } from "@/lib/actions/auth";

type Result = { error?: string };

// Behörigheten kontrolleras av databasen (RLS och funktioner). Anropen till
// requireOrgAdmin ger bara ett snabbt, tydligt nej.

function refresh() {
  revalidatePath("/lag");
}

export async function createTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireOrgAdmin();
  if (!session.organization) return { error: "Du tillhör ingen förening." };
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Ange lagets namn." };
  if (name.length > 100) return { error: "Namnet är för långt." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .insert({ organization_id: session.organization.id, name });
  if (error) {
    if (error.code === "23505") return { error: `Föreningen har redan ett lag som heter ${name}.` };
    return { error: friendlyError(error, "Kunde inte skapa laget") };
  }
  refresh();
  return { message: `${name} är skapat. Bjud in lagets ledare nedan.` };
}

export async function deleteTeam(teamId: string): Promise<Result> {
  await requireOrgAdmin();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("teams")
    .delete({ count: "exact" })
    .eq("id", teamId);
  if (error) return { error: friendlyError(error, "Kunde inte ta bort laget") };
  if (!count) return { error: "Laget hittades inte." };
  refresh();
  return {};
}

export async function inviteTeamAdmin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOrgAdmin();
  const teamId = String(formData.get("team_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Ange en giltig e-postadress." };

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select("name, organizations(name)")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: "Laget hittades inte." };

  const { data: invitation, error } = await supabase
    .from("team_invitations")
    .insert({ team_id: teamId, email, invited_by: session.userId })
    .select("token")
    .single();
  if (error) return { error: friendlyError(error, "Kunde inte skapa inbjudan") };

  const origin = (await headers()).get("origin") ?? "";
  await sendEmail({
    to: email,
    replyTo: session.email,
    ...teamInvitationEmail({
      url: `${origin}/inbjudan/${invitation.token}`,
      teamName: team.name,
      clubName: team.organizations?.name ?? "",
      invitedBy: session.profile.full_name || session.email || "Din förening",
    }),
  });

  refresh();
  return {
    message: emailEnabled()
      ? `Inbjudan är skickad till ${email}.`
      : `Inbjudan är skapad. E-post är avstängt, så kopiera länken nedan och skicka den till ${email}.`,
  };
}

export async function revokeInvitation(invitationId: string): Promise<Result> {
  await requireOrgAdmin();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("team_invitations")
    .delete({ count: "exact" })
    .eq("id", invitationId);
  if (error) return { error: friendlyError(error, "Kunde inte dra tillbaka inbjudan") };
  if (!count) return { error: "Inbjudan hittades inte eller är redan använd." };
  refresh();
  return {};
}

export async function removeTeamAdmin(teamId: string, userId: string): Promise<Result> {
  await requireOrgAdmin();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("team_admins")
    .delete({ count: "exact" })
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) return { error: friendlyError(error, "Kunde inte ta bort ledaren") };
  if (!count) return { error: "Ledaren hittades inte." };
  refresh();
  return {};
}

// Formulär på /inbjudan/[token].
export async function acceptInvitation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const session = await getSession();
  if (!session) redirect(`/logga-in?next=/inbjudan/${token}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_team_invitation", { p_token: token });
  if (error) return { error: friendlyError(error, "Kunde inte ta emot inbjudan") };

  revalidatePath("/", "layout");
  redirect(isOrgAdmin(session) ? "/lag" : "/lag?valkommen=1");
}
