import { redirect } from "next/navigation";
import { homePathFor, requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Registrera förening – Sammandrag" };

export default async function OrganizationPage() {
  const session = await requireUser();
  if (session.organization) redirect(homePathFor(session));

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Din förening</CardTitle>
          <CardDescription>
            Steg 2 av 2. Nya föreningar granskas innan de kan skapa sammandrag
            och anmäla lag. Du blir föreningsadmin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm defaultEmail={session.email ?? ""} />
        </CardContent>
      </Card>
    </main>
  );
}
