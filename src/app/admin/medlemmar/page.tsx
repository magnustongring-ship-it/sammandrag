import { requireSiteAdmin } from "@/lib/auth";
import { MembersView } from "../../medlemmar/members-view";

export const metadata = { title: "Medlemmar" };

// Alla användare på sidan, med nivå och förening.
export default async function AdminMembersPage() {
  const session = await requireSiteAdmin();
  return <MembersView session={session} />;
}
