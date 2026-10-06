"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { FormState } from "@/lib/actions/auth";
import { GAME_FORMATS } from "@/lib/schedule-settings";

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

function parseRules(formData: FormData) {
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const gameFormat = text("game_format");
  const level = text("level");
  const courtNote = text("court_note");
  if (!gameFormat) {
    return {
      level,
      court_note: courtNote,
      game_format: null,
      periods: null,
      period_minutes: null,
      break_minutes: null,
    };
  }
  if (!GAME_FORMATS.includes(gameFormat as (typeof GAME_FORMATS)[number])) {
    return "Välj spelform.";
  }
  const num = (k: string, label: string, min: number, max: number) => {
    const n = Number(formData.get(k));
    return Number.isInteger(n) && n >= min && n <= max
      ? n
      : `${label} måste vara ett heltal mellan ${min} och ${max}.`;
  };
  const periods = num("periods", "Antal perioder", 1, 12);
  if (typeof periods === "string") return periods;
  const periodMinutes = num("period_minutes", "Minuter per period", 1, 60);
  if (typeof periodMinutes === "string") return periodMinutes;
  const breakMinutes = num("break_minutes", "Paus", 0, 30);
  if (typeof breakMinutes === "string") return breakMinutes;
  return {
    level,
    court_note: courtNote,
    game_format: gameFormat,
    periods,
    period_minutes: periodMinutes,
    break_minutes: breakMinutes,
  };
}

/** Skapar (utan age_group_id) eller uppdaterar en åldersgrupp. */
export async function saveAgeGroup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Dolt fält i stället för .bind(), se saveEvent.
  const id = Number(formData.get("age_group_id")) || null;
  await requireSiteAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order"));
  if (!name) return { error: "Ange ett namn." };
  if (name.length > 40) return { error: "Namnet är för långt." };
  if (!Number.isInteger(sortOrder)) return { error: "Ordningen måste vara ett heltal." };

  // Matchregler skickas bara när regelkolumnerna finns (migreringen körd).
  let rules = {};
  if (formData.get("has_rules") === "1") {
    const parsed = parseRules(formData);
    if (typeof parsed === "string") return { error: parsed };
    rules = parsed;
  }

  const supabase = await createClient();
  const fields = { name, sort_order: sortOrder, ...rules };
  const query = id
    ? supabase.from("age_groups").update(fields).eq("id", id)
    : supabase.from("age_groups").insert(fields);
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
