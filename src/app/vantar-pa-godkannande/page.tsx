import Link from "next/link";
import { redirect } from "next/navigation";
import { homePathFor, requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Väntar på godkännande – Sammandrag" };

export default async function PendingPage() {
  const session = await requireUser();
  const org = session.organization;
  if (!org || org.status === "godkand") redirect(homePathFor(session));

  const rejected = org.status === "avslagen";

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {rejected ? "Föreningen har inte godkänts" : "Väntar på godkännande"}
          </CardTitle>
          <CardDescription>{org.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {rejected ? (
            <p>
              Ansökan för {org.name} har avslagits. Kontakta sajtens
              administratör om du tror att det är fel.
            </p>
          ) : (
            <>
              <p>
                Tack! {org.name} är registrerad och väntar på att godkännas av
                sajtens administratör.
              </p>
              <p>
                Tills dess kan du titta i kalendern, men inte skapa sammandrag
                eller anmäla lag. Ladda om sidan senare för att se om föreningen
                har godkänts.
              </p>
            </>
          )}
          <Link href="/" className="font-medium underline">
            Till kalendern
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
