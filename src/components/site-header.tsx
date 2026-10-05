import Link from "next/link";
import { getSession } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Sammandrag
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {session ? (
            <>
              {session.organization && (
                <span className="text-muted-foreground">
                  {session.organization.name}
                </span>
              )}
              {session.profile.is_site_admin && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              <form action={signOut}>
                <Button variant="outline" size="sm" type="submit">
                  Logga ut
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/logga-in">Logga in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/registrera">Registrera förening</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
