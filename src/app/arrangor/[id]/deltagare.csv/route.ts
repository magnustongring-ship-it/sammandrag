import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE, genderLabel } from "@/lib/calendar";
import { toCsv } from "@/lib/csv";
import type { RegistrationStatus } from "@/lib/database.types";

const statusLabel: Record<RegistrationStatus, string> = {
  anmald: "Anmäld",
  vantelista: "Väntelista",
  avanmald: "Avanmäld",
};
const statusOrder: Record<RegistrationStatus, number> = {
  anmald: 0,
  vantelista: 1,
  avanmald: 2,
};

const timestamp = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

// Deltagarlista som CSV för arrangörens föreningsadmin.
export async function GET(_req: NextRequest, ctx: RouteContext<"/arrangor/[id]/deltagare.csv">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session?.organization || !session.profile.is_org_admin) {
    return new Response("Ingen behörighet", { status: 403 });
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "title, event_date, event_classes(id, gender, age_groups(name, sort_order), registrations(team_name, contact_email, contact_phone, status, created_at, organizations(name)))",
    )
    .eq("id", id)
    .eq("organizer_org_id", session.organization.id)
    .maybeSingle();
  if (!event) return new Response("Sammandraget hittades inte", { status: 404 });

  const classes = [...event.event_classes].sort(
    (a, b) =>
      (a.age_groups?.sort_order ?? 0) - (b.age_groups?.sort_order ?? 0) ||
      a.gender.localeCompare(b.gender),
  );

  const rows = classes.flatMap((c) => {
    const label = `${c.age_groups?.name ?? "?"} ${genderLabel[c.gender].toLowerCase()}`;
    const regs = [...c.registrations].sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        a.created_at.localeCompare(b.created_at),
    );
    const position: Partial<Record<RegistrationStatus, number>> = {};
    return regs.map((r) => {
      position[r.status] = (position[r.status] ?? 0) + 1;
      return [
        label,
        statusLabel[r.status],
        r.status === "avanmald" ? "" : position[r.status],
        r.team_name,
        r.organizations?.name ?? "",
        r.contact_email,
        r.contact_phone,
        timestamp.format(new Date(r.created_at)),
      ];
    });
  });

  const csv = toCsv(
    ["Klass", "Status", "Plats", "Lag", "Förening", "E-post", "Telefon", "Anmäld"],
    rows,
  );
  const slug = event.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const filename = `deltagare-${slug || "sammandrag"}-${event.event_date}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
