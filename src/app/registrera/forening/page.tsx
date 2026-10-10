import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth";
import { signUpOrganization } from "@/lib/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "../signup-form";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Registrera förening" };

// Utloggad: konto och förening i samma formulär. Inloggad utan förening
// (t.ex. en domare): bara föreningens uppgifter.
export default async function OrganizationSignupPage() {
  const session = await getSession();
  if (session?.organization) redirect(homePathFor(session));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase">
            Registrera förening
          </CardTitle>
          <CardDescription>
            Du blir föreningens FöreningsAdmin. Nya föreningar granskas innan de kan
            skapa sammandrag och anmäla lag. Därefter lägger du upp föreningens lag och
            bjuder in lagledarna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session ? (
            <OrganizationForm defaultEmail={session.email ?? ""} />
          ) : (
            <SignupForm
              action={signUpOrganization}
              submitLabel="Registrera förening"
              extra={{
                legend: "Föreningen",
                fields: [
                  { name: "name", label: "Föreningens namn", autoComplete: "organization", required: true },
                  { name: "city", label: "Ort", autoComplete: "address-level2", required: true },
                  {
                    name: "contact_email",
                    label: "Föreningens kontakt-e-post",
                    type: "email",
                    hint: "Lämna tomt för att använda din e-post.",
                  },
                ],
              }}
            />
          )}
        </CardContent>
        {!session && (
          <CardFooter className="text-sm text-muted-foreground">
            Har du redan ett konto?&nbsp;
            <Link href="/logga-in?next=/registrera/forening" className="font-medium text-foreground underline">
              Logga in
            </Link>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
