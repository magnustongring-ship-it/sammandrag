import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth";
import { signUpOrganization } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
            <SignupForm action={signUpOrganization} submitLabel="Registrera förening">
              <fieldset className="grid gap-4 border-t pt-4">
                <legend className="pr-2 text-sm font-medium">Föreningen</legend>
                <div className="grid gap-2">
                  <Label htmlFor="name">Föreningens namn</Label>
                  <Input id="name" name="name" autoComplete="organization" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">Ort</Label>
                  <Input id="city" name="city" autoComplete="address-level2" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact_email">Föreningens kontakt-e-post</Label>
                  <Input id="contact_email" name="contact_email" type="email" />
                  <p className="text-xs text-muted-foreground">
                    Lämna tomt för att använda din e-post.
                  </p>
                </div>
              </fieldset>
            </SignupForm>
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
