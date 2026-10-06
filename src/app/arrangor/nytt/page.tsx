import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInStockholm } from "@/lib/calendar";
import { getAgeGroupsWithRules } from "@/lib/age-groups";
import { EventForm } from "../event-form";

export const metadata = { title: "Nytt sammandrag" };

export default async function NewEventPage() {
  const session = await requireOrganizer();
  const supabase = await createClient();
  const ageGroups = await getAgeGroupsWithRules(supabase);

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div>
        <Link href="/arrangor" className="text-sm text-muted-foreground hover:underline">
          ← Mina sammandrag
        </Link>
        <h1 className="text-3xl font-bold uppercase">Nytt sammandrag</h1>
      </div>
      <EventForm
        eventId={null}
        status="utkast"
        minDate={todayInStockholm()}
        ageGroups={ageGroups}
        initial={{
          title: "",
          eventDate: "",
          startTime: "",
          endTime: "",
          venueName: "",
          address: "",
          city: session.organization.city ?? "",
          description: "",
          registrationDeadline: "",
          classes: [],
        }}
      />
    </main>
  );
}
