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
import { LoginForm } from "./login-form";

export const metadata = { title: "Logga in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/logga-in">) {
  const session = await getSession();
  if (session) redirect(homePathFor(session));

  const { fel } = await searchParams;

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-sm border-t-4 border-t-primary shadow-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase">Logga in</CardTitle>
          <CardDescription>Logga in med ditt konto för föreningen.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {fel === "lank" && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              Länken är ogiltig eller har gått ut. Logga in, eller registrera dig
              igen om du inte har bekräftat din e-post.
            </p>
          )}
          <LoginForm />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Inget konto?&nbsp;
          <Link href="/registrera" className="font-medium text-foreground underline">
            Registrera dig
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
