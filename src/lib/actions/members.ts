"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin, requireSiteAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUserRole } from "@/lib/roles";
import { friendlyError } from "@/lib/errors";

type Result = { error?: string };

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/medlemmar");
  revalidatePath("/admin/medlemmar");
  revalidatePath("/registrera/forening");
}

// Behörigheten kontrolleras av databasen (set_user_role m.fl.). Sidans
// require-anrop är bara till för att ge ett snabbt, tydligt nej.

export async function setUserRole(userId: string, role: string): Promise<Result> {
  await requireOrgAdmin();
  if (!isUserRole(role)) return { error: "Ogiltig behörighetsnivå." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_user: userId, p_role: role });
  if (error) return { error: friendlyError(error, "Kunde inte ändra nivån") };
  refresh();
  return {};
}

export async function setUserOrganization(
  userId: string,
  organizationId: string | null,
): Promise<Result> {
  await requireSiteAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_org", {
    p_user: userId,
    p_org: organizationId,
  });
  if (error) return { error: friendlyError(error, "Kunde inte ändra föreningen") };
  refresh();
  return {};
}

export async function decideMembership(requestId: string, approve: boolean): Promise<Result> {
  await requireOrgAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_membership", {
    p_request: requestId,
    p_approve: approve,
  });
  if (error) return { error: friendlyError(error, "Kunde inte besvara förfrågan") };
  refresh();
  return {};
}
