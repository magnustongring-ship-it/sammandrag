import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth";
import { signUpReferee } from "@/lib/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "../signup-form";

export const metadata = { title: "Registrera dig som domare" };

export default async function RefereeSignupPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-sm border-t-4 border-t-primary shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase">
            Domarkonto
          </CardTitle>
          <CardDescription>
            Använd samma e-postadress som när du anmäler intresse att döma, så
            kopplas dina matcher till kontot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm action={signUpReferee} submitLabel="Skapa domarkonto" />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Har du redan ett konto?&nbsp;
          <Link href="/logga-in" className="font-medium text-foreground underline">
            Logga in
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
