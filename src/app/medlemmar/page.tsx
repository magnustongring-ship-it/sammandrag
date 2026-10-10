import { redirect } from "next/navigation";
import { isSuperAdmin, requireOrgAdmin } from "@/lib/auth";
import { MembersView } from "./members-view";

export const metadata = { title: "Medlemmar" };

// Föreningens medlemmar för FöreningsAdmin. SuperAdmin hittar alla
// användare under Admin → Medlemmar.
export default async function MembersPage() {
  const session = await requireOrgAdmin();
  if (isSuperAdmin(session)) redirect("/admin/medlemmar");

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold uppercase">Medlemmar</h1>
        <p className="text-sm text-muted-foreground">{session.organization?.name}</p>
      </div>
      <MembersView session={session} />
    </main>
  );
}
