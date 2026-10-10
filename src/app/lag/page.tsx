import Link from "next/link";
import { headers } from "next/headers";
import { isOrgAdmin, requireApprovedOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteTeam, removeTeamAdmin, revokeInvitation } from "@/lib/actions/teams";
import { friendlyError } from "@/lib/errors";
import { formatDate, todayInStockholm } from "@/lib/calendar";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTeamForm, InviteForm } from "./team-controls";

export const metadata = { title: "Lag" };

export default async function TeamsPage({ searchParams }: PageProps<"/lag">) {
  const session = await requireApprovedOrg();
  const orgAdmin = isOrgAdmin(session);
  const { valkommen } = await searchParams;
  const supabase = await createClient();

  const [teams, admins, invitations, mine] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name")
      .eq("organization_id", session.organization.id)
      .order("name"),
    orgAdmin
      ? supabase.rpc("list_team_admins", { p_org: session.organization.id })
      : Promise.resolve({ data: [], error: null }),
    orgAdmin
      ? supabase
          .from("team_invitations")
          .select("id, team_id, email, token, expires_at")
          .is("accepted_at", null)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("team_admins").select("team_id").eq("user_id", session.userId),
  ]);

  const error = teams.error ?? admins.error ?? invitations.error;
  const myTeamIds = new Set((mine.data ?? []).map((t) => t.team_id));
  const visibleTeams = (teams.data ?? []).filter((t) => orgAdmin || myTeamIds.has(t.id));
  const origin = (await headers()).get("origin") ?? "";
  const today = todayInStockholm();

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold uppercase">{orgAdmin ? "Föreningens lag" : "Mina lag"}</h1>
        <p className="text-sm text-muted-foreground">{session.organization.name}</p>
      </div>

      {valkommen && (
        <p
          role="status"
          className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
        >
          Välkommen! Du är nu LagAdmin. Hitta ett sammandrag i{" "}
          <Link href="/" className="font-medium underline">
            kalendern
          </Link>{" "}
          och anmäl ditt lag.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {friendlyError(error, "Kunde inte hämta lagen")}
        </p>
      )}

      {orgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Nytt lag</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTeamForm />
          </CardContent>
        </Card>
      )}

      {visibleTeams.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {orgAdmin
            ? "Föreningen har inga lag ännu. Skapa ett lag ovan och bjud in lagets ledare."
            : "Du är inte LagAdmin för något lag. Be din förenings FöreningsAdmin om en inbjudan."}
        </p>
      ) : (
        <ul className="grid gap-4">
          {visibleTeams.map((team) => {
            const teamAdmins = (admins.data ?? []).filter((a) => a.team_id === team.id);
            const pending = (invitations.data ?? []).filter((i) => i.team_id === team.id);
            return (
              <li key={team.id}>
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      {team.name}
                      {myTeamIds.has(team.id) && <Badge variant="secondary">Du är LagAdmin</Badge>}
                    </CardTitle>
                    {orgAdmin && (
                      <ConfirmButton
                        action={deleteTeam.bind(null, team.id)}
                        label="Ta bort lag"
                        confirmLabel="Ja, ta bort"
                        question={`Ta bort ${team.name}? Ledarna förlorar kopplingen till laget. Lagets anmälningar finns kvar.`}
                      />
                    )}
                  </CardHeader>
                  {orgAdmin && (
                    <CardContent className="grid gap-4 text-sm">
                      <div className="grid gap-2">
                        <h3 className="font-medium">Ledare (LagAdmin)</h3>
                        {teamAdmins.length === 0 ? (
                          <p className="text-muted-foreground">Inga ledare ännu.</p>
                        ) : (
                          <ul className="divide-y rounded-lg border">
                            {teamAdmins.map((a) => (
                              <li
                                key={a.user_id}
                                className="flex flex-wrap items-center justify-between gap-2 p-2"
                              >
                                <span className="min-w-0">
                                  <span className="font-medium">{a.full_name || a.email}</span>
                                  <span className="block truncate text-muted-foreground">{a.email}</span>
                                </span>
                                <ConfirmButton
                                  action={removeTeamAdmin.bind(null, team.id, a.user_id)}
                                  label="Ta bort"
                                  confirmLabel="Ja, ta bort"
                                  question={`Ta bort ${a.full_name || a.email} som ledare för ${team.name}?`}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {pending.length > 0 && (
                        <div className="grid gap-2">
                          <h3 className="font-medium">Skickade inbjudningar</h3>
                          <ul className="divide-y rounded-lg border">
                            {pending.map((i) => {
                              // Stämmer på dagen; databasen kontrollerar exakt tid.
                              const expired = i.expires_at.slice(0, 10) < today;
                              return (
                                <li
                                  key={i.id}
                                  className="flex flex-wrap items-center justify-between gap-2 p-2"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">{i.email}</span>
                                    <span className="text-muted-foreground">
                                      {expired
                                        ? "Har gått ut"
                                        : `Gäller till ${formatDate(i.expires_at.slice(0, 10))}`}
                                    </span>
                                  </span>
                                  <span className="flex flex-wrap gap-2">
                                    {!expired && (
                                      <CopyButton
                                        text={`${origin}/inbjudan/${i.token}`}
                                        label="Kopiera länk"
                                      />
                                    )}
                                    <ConfirmButton
                                      action={revokeInvitation.bind(null, i.id)}
                                      label={expired ? "Ta bort" : "Dra tillbaka"}
                                      confirmLabel="Ja"
                                      question={`Dra tillbaka inbjudan till ${i.email}? Länken slutar fungera.`}
                                    />
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      <InviteForm teamId={team.id} teamName={team.name} />
                    </CardContent>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
