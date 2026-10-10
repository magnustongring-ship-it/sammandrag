import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, Users } from "lucide-react";
import { getSession, homePathFor } from "@/lib/auth";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Registrera" };

const choices = [
  {
    href: "/registrera/forening",
    icon: Users,
    title: "Förening",
    text: "Registrera din förening. Du blir FöreningsAdmin, skapar föreningens lag och bjuder in lagledare.",
  },
  {
    href: "/registrera/domare",
    icon: Flag,
    title: "Domare",
    text: "Skapa ett domarkonto och se matcherna du är tillsatt att döma.",
  },
];

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session));

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-12">
      <div className="grid gap-1">
        <h1 className="font-display text-3xl font-bold uppercase">Registrera dig</h1>
        <p className="text-sm text-muted-foreground">Vad vill du registrera?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {choices.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Card className="h-full border-t-4 border-t-primary shadow-md transition-shadow group-hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-2xl font-bold uppercase">
                  <Icon className="size-6 text-primary" aria-hidden="true" />
                  {title}
                </CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Är du lagledare? Be din förenings FöreningsAdmin att bjuda in dig. Du får ett
        mejl med en länk där du skapar ditt konto. Har du redan ett konto?{" "}
        <Link href="/logga-in" className="font-medium text-foreground underline">
          Logga in
        </Link>
        .
      </p>
    </main>
  );
}
