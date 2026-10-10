import { requireSiteAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

// Gemensam rubrik och undermeny för Admin.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireSiteAdmin();

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div className="grid gap-3">
        <h1 className="text-3xl font-bold uppercase">Admin</h1>
        <AdminNav />
      </div>
      {children}
    </main>
  );
}
