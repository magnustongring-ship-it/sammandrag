import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Registrera" };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-sm border-t-4 border-t-primary shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase">Skapa konto</CardTitle>
          <CardDescription>
            Steg 1 av 2. Efter att du bekräftat din e-post fyller du i uppgifter
            om din förening.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
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
