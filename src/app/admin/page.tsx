import { requireSiteAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setOrganizationStatus } from "@/lib/actions/admin";
import type { OrganizationStatus, Tables } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { friendlyError } from "@/lib/errors";
import { AgeGroups } from "./age-groups";

export const metadata = { title: "Admin" };

const statusLabel: Record<OrganizationStatus, string> = {
  vantar: "Väntar",
  godkand: "Godkänd",
  avslagen: "Avslagen",
};

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

export default async function AdminPage() {
  await requireSiteAdmin();
  const supabase = await createClient();
  const [{ data: organizations, error }, { data: ageGroups }] = await Promise.all([
    supabase.from("organizations").select("*").order("created_at", { ascending: false }),
    supabase.from("age_groups").select("*").order("sort_order"),
  ]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p role="alert" className="text-destructive">
          {friendlyError(error, "Kunde inte hämta föreningar")}
        </p>
      </main>
    );
  }

  const pending = organizations.filter((o) => o.status === "vantar");
  const others = organizations.filter((o) => o.status !== "vantar");

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>Föreningar som väntar ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga föreningar väntar på godkännande.
            </p>
          ) : (
            <ul className="divide-y">
              {pending.map((org) => (
                <OrganizationRow key={org.id} org={org} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Övriga föreningar ({others.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga ännu.</p>
          ) : (
            <ul className="divide-y">
              {others.map((org) => (
                <OrganizationRow key={org.id} org={org} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Åldersgrupper</CardTitle>
        </CardHeader>
        <CardContent>
          <AgeGroups groups={ageGroups ?? []} />
        </CardContent>
      </Card>
    </main>
  );
}

function OrganizationRow({ org }: { org: Tables<"organizations"> }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{org.name}</span>
          <Badge variant={org.status === "godkand" ? "default" : "secondary"}>
            {statusLabel[org.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {[org.city, org.contact_email].filter(Boolean).join(" · ")}
          {" · registrerad "}
          {dateFormat.format(new Date(org.created_at))}
        </p>
      </div>
      <div className="flex gap-2">
        {org.status !== "godkand" && (
          <form action={setOrganizationStatus.bind(null, org.id, "godkand")}>
            <Button size="sm" type="submit">
              Godkänn
            </Button>
          </form>
        )}
        {org.status !== "avslagen" && (
          <form action={setOrganizationStatus.bind(null, org.id, "avslagen")}>
            <Button size="sm" variant="outline" type="submit">
              Avslå
            </Button>
          </form>
        )}
      </div>
    </li>
  );
}
