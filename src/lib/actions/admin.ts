"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationStatus } from "@/lib/database.types";
import { friendlyError } from "@/lib/errors";

const allowed: OrganizationStatus[] = ["godkand", "avslagen", "vantar"];

export async function setOrganizationStatus(
  organizationId: string,
  status: OrganizationStatus,
): Promise<void> {
  await requireSiteAdmin();
  if (!allowed.includes(status)) throw new Error("Ogiltig status");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ status })
    .eq("id", organizationId)
    .select("id");

  if (error) throw new Error(friendlyError(error, "Kunde inte uppdatera föreningen"));
  if (!data?.length) throw new Error("Föreningen hittades inte.");

  revalidatePath("/admin");
}
