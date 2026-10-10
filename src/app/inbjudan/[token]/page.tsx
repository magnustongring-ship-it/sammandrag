import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut, signUpInvited } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "../../registrera/signup-form";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Inbjudan" };

// Hit kommer en lagledare via länken i inbjudan från FöreningsAdmin.
export default async function InvitationPage({ params }: PageProps<"/inbjudan/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const supabase = await createClient();
  const [session, { data }] = await Promise.all([
    getSession(),
    supabase.rpc("team_invitation_info", { p_token: token }),
  ]);
  const invitation = data?.[0];

  const problem = !invitation
    ? "Inbjudan finns inte. Den kan ha dragits tillbaka."
    : invitation.accepted
      ? "Inbjudan har redan använts."
      : invitation.expired
        ? "Inbjudan har gått ut. Be föreningens FöreningsAdmin om en ny."
        : null;

  const otherOrg =
    session?.organization && invitation && session.organization.id !== invitation.organization_id;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase">
            {invitation && !problem ? `LagAdmin för ${invitation.team_name}` : "Inbjudan"}
          </CardTitle>
          {invitation && !problem && (
            <CardDescription>
              {invitation.organization_name} har bjudit in dig att bli LagAdmin för{" "}
              {invitation.team_name}. Som LagAdmin anmäler du laget till sammandrag.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {problem ? (
            <p role="alert">{problem}</p>
          ) : !session ? (
            <SignupForm
              action={signUpInvited}
              submitLabel="Skapa konto"
              defaultEmail={invitation!.email}
              hidden={{ token }}
            />
          ) : otherOrg ? (
            <p role="alert">
              Du är inloggad som {session.email} och tillhör {session.organization!.name}. Ett
              konto kan bara tillhöra en förening. Logga ut och skapa ett nytt konto, eller
              kontakta sajtens administratör.
            </p>
          ) : (
            <>
              <p>
                Du är inloggad som <strong>{session.email}</strong>.
              </p>
              <AcceptForm token={token} teamName={invitation!.team_name} />
            </>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          {problem ? (
            <Link href="/" className="font-medium text-foreground underline">
              Till kalendern
            </Link>
          ) : !session ? (
            <>
              Har du redan ett konto?&nbsp;
              <Link
                href={`/logga-in?next=/inbjudan/${token}`}
                className="font-medium text-foreground underline"
              >
                Logga in
              </Link>
            </>
          ) : (
            <form action={signOut} className="flex items-center gap-1">
              Fel konto?
              <Button type="submit" variant="link" className="h-auto p-0 font-medium text-foreground underline">
                Logga ut
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
