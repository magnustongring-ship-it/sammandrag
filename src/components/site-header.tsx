import Link from "next/link";
import { getSession } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/mobile-menu";

export async function SiteHeader() {
  const session = await getSession();
  const approved = session?.organization?.status === "godkand";

  const links = session
    ? [
        approved && { href: "/mina-anmalningar", label: "Mina anmälningar" },
        approved &&
          session.profile.is_org_admin && { href: "/arrangor", label: "Mina sammandrag" },
        session.profile.is_site_admin && { href: "/admin", label: "Admin" },
      ].filter((l): l is { href: string; label: string } => Boolean(l))
    : [];

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Sammandrag
        </Link>

        {!session ? (
          <nav className="flex items-center gap-2 text-sm">
            <Button asChild variant="ghost" size="sm">
              <Link href="/logga-in">Logga in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/registrera">Registrera förening</Link>
            </Button>
          </nav>
        ) : (
          <>
            {/* Dator och surfplatta */}
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {session.organization && (
                <span className="mr-2 text-muted-foreground">
                  {session.organization.name}
                </span>
              )}
              {links.map((l) => (
                <Button key={l.href} asChild variant="ghost" size="sm">
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              ))}
              <form action={signOut} className="ml-1">
                <Button variant="outline" size="sm" type="submit">
                  Logga ut
                </Button>
              </form>
            </nav>

            {/* Mobil */}
            <MobileMenu>
              {session.organization && (
                <p className="px-2 py-1.5 text-muted-foreground">
                  {session.organization.name}
                </p>
              )}
              <Link href="/" className="rounded-md px-2 py-2 hover:bg-accent">
                Kalender
              </Link>
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-2 py-2 hover:bg-accent"
                >
                  {l.label}
                </Link>
              ))}
              <form action={signOut} className="border-t pt-1">
                <button
                  type="submit"
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-accent"
                >
                  Logga ut
                </button>
              </form>
            </MobileMenu>
          </>
        )}
      </div>
    </header>
  );
}
