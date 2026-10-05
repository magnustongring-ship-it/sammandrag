"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { FormState } from "@/lib/actions/auth";

const MISSING_POLICY =
  "Databasen tillåter inte ändringar av åldersgrupper ännu. Kör migreringen supabase/migrations/20261005020000_age_groups_admin.sql i Supabase → SQL Editor.";

// Utan migreringen nekar RLS ändringen (42501), och en update/delete
// påverkar då 0 rader utan fel.
function isRlsDenied(error: { code?: string; message: string }) {
  return error.code === "42501" || error.message.includes("row-level security");
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Skapar (utan id) eller uppdaterar en åldersgrupp. */
export async function saveAgeGroup(
  id: number | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSiteAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order"));
  if (!name) return { error: "Ange ett namn." };
  if (name.length > 40) return { error: "Namnet är för långt." };
  if (!Number.isInteger(sortOrder)) return { error: "Ordningen måste vara ett heltal." };

  const supabase = await createClient();
  const query = id
    ? supabase.from("age_groups").update({ name, sort_order: sortOrder }).eq("id", id)
    : supabase.from("age_groups").insert({ name, sort_order: sortOrder });
  const { data, error } = await query.select("id");

  if (error) {
    if (error.code === "23505") return { error: `Det finns redan en åldersgrupp som heter ${name}.` };
    if (isRlsDenied(error)) return { error: MISSING_POLICY };
    return { error: friendlyError(error, "Kunde inte spara åldersgruppen") };
  }
  if (!data?.length) {
    return { error: MISSING_POLICY };
  }

  revalidate();
  return { message: id ? "Sparat." : `${name} har lagts till.` };
}

export async function deleteAgeGroup(id: number): Promise<{ error?: string }> {
  await requireSiteAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("age_groups").delete().eq("id", id).select("id");

  if (error) {
    if (error.code === "23503") {
      return {
        error: "Åldersgruppen används i sammandrag och kan inte tas bort. Du kan döpa om den i stället.",
      };
    }
    if (isRlsDenied(error)) return { error: MISSING_POLICY };
    return { error: friendlyError(error, "Kunde inte ta bort åldersgruppen") };
  }
  if (!data?.length) {
    return { error: MISSING_POLICY };
  }

  revalidate();
  return {};
}
