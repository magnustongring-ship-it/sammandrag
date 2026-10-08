import { redirect } from "next/navigation";
import { homePathFor, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelMembershipRequest, requestMembership } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Din förening" };

const errors: Record<string, string> = {
  valj: "Välj vilken förening du vill ansluta till.",
  skicka: "Kunde inte skicka förfrågan. Du kan redan ha en väntande förfrågan, eller så är föreningen inte godkänd.",
};

export default async function OrganizationPage({
  searchParams,
}: PageProps<"/registrera/forening">) {
  const session = await requireUser();
  if (session.organization) redirect(homePathFor(session));
  const { fel } = await searchParams;

  const supabase = await createClient();
  const [{ data: orgs }, { data: pending }] = await Promise.all([
    supabase.from("organizations").select("id, name, city").eq("status", "godkand").order("name"),
    supabase
      .from("membership_requests")
      .select("id, organizations(name)")
      .eq("user_id", session.userId)
      .eq("status", "vantar")
      .maybeSingle(),
  ]);

  const error = typeof fel === "string" ? errors[fel] : undefined;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-12">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase">
            Anslut till din förening
          </CardTitle>
          <CardDescription>
            Steg 2 av 2. Du är LagAdmin och kan anmäla lag och domare för din förening
            så fort en FöreningsAdmin har godkänt dig.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {pending ? (
            <>
              <p className="text-sm">
                Din förfrågan till <strong>{pending.organizations?.name}</strong> väntar på
                svar från föreningens FöreningsAdmin. Ladda om sidan senare.
              </p>
              <form action={cancelMembershipRequest}>
                <Button type="submit" variant="outline">
                  Dra tillbaka förfrågan
                </Button>
              </form>
            </>
          ) : orgs?.length ? (
            <form action={requestMembership} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="organization_id">Förening</Label>
                <select
                  id="organization_id"
                  name="organization_id"
                  required
                  defaultValue=""
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="" disabled>
                    Välj förening…
                  </option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.city ? ` (${o.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Skicka förfrågan</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Det finns inga godkända föreningar ännu. Registrera din förening nedan.
            </p>
          )}
        </CardContent>
      </Card>

      {!pending && (
        <Card className="w-full max-w-md shadow-md">
          <CardHeader>
            <CardTitle className="font-display text-xl font-bold uppercase">
              Eller registrera en ny förening
            </CardTitle>
            <CardDescription>
              Nya föreningar granskas innan de kan skapa sammandrag och anmäla lag.
              Du blir FöreningsAdmin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationForm defaultEmail={session.email ?? ""} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
