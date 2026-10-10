import Link from "next/link";
import { isSuperAdmin, type Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { roleDescription, roleLabel, roles } from "@/lib/roles";
import type { UserRole } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MembershipDecision, OrganizationSelect, RoleSelect } from "./member-controls";

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeZone: "Europe/Stockholm",
});

// Användarna och deras behörighet. FöreningsAdmin ser sin förening under
// Medlemmar, SuperAdmin alla användare under Admin → Medlemmar.
export async function MembersView({ session }: { session: Session }) {
  const superAdmin = isSuperAdmin(session);
  const supabase = await createClient();

  const [users, requests, orgs] = await Promise.all([
    supabase.rpc("list_users"),
    supabase.rpc("list_membership_requests"),
    superAdmin
      ? supabase.from("organizations").select("id, name").order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  const error = users.error ?? requests.error;
  if (error) {
    return (
      <p role="alert" className="text-destructive">
        {friendlyError(error, "Kunde inte hämta användare")}
      </p>
    );
  }

  // FöreningsAdmin väljer mellan LagAdmin och FöreningsAdmin, SuperAdmin bland alla.
  const options: UserRole[] = superAdmin ? roles : ["lagadmin", "foreningsadmin"];

  return (
    <>

      {/* Förfrågningar från den tidigare anslutningen. Nya LagAdmin bjuds in under Lag. */}
      {!!requests.data?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Vill ansluta ({requests.data.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {requests.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.full_name || r.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.email}
                      {superAdmin && ` · vill ansluta till ${r.organization_name}`}
                      {" · "}
                      {dateFormat.format(new Date(r.created_at))}
                    </p>
                  </div>
                  <MembershipDecision requestId={r.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!superAdmin && (
        <p className="text-sm text-muted-foreground">
          Nya lagledare bjuder du in under{" "}
          <Link href="/lag" className="font-medium text-foreground underline">
            Lag
          </Link>
          . De blir LagAdmin för sitt lag.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {superAdmin ? "Alla användare" : "Föreningens medlemmar"} ({users.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid gap-1 text-sm text-muted-foreground">
            {options.map((r) => (
              <div key={r}>
                <dt className="inline font-medium text-foreground">{roleLabel[r]}: </dt>
                <dd className="inline">{roleDescription[r]}</dd>
              </div>
            ))}
          </dl>
          <ul className="divide-y">
            {users.data?.map((u) => {
              const self = u.id === session.userId;
              const name = u.full_name || u.email;
              return (
                <li key={u.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {name}
                      {self && <Badge variant="secondary">Du</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {u.email}
                      {!superAdmin ? "" : u.organization_name ? ` · ${u.organization_name}` : " · ingen förening"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {superAdmin && (
                      <OrganizationSelect
                        userId={u.id}
                        organizationId={u.organization_id}
                        organizations={orgs.data ?? []}
                        label={name}
                      />
                    )}
                    {self || (!superAdmin && u.role === "superadmin") ? (
                      <Badge>{roleLabel[u.role]}</Badge>
                    ) : (
                      <RoleSelect
                        userId={u.id}
                        role={u.role}
                        options={options}
                        label={name}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
