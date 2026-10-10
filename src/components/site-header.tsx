import Link from "next/link";
import { getSession, isOrgAdmin, isSuperAdmin } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/mobile-menu";
import { BallIcon } from "@/components/logo";

const onDark =
  "text-brand-foreground hover:bg-white/10 hover:text-brand-foreground";

export async function SiteHeader() {
  const session = await getSession();
  const approved = session?.organization?.status === "godkand";

  const links = session
    ? [
        approved && { href: "/mina-anmalningar", label: "Mina anmälningar" },
        approved && { href: "/lag", label: isOrgAdmin(session) ? "Lag" : "Mina lag" },
        (approved || isSuperAdmin(session)) &&
          isOrgAdmin(session) && {
            href: "/arrangor",
            label: isSuperAdmin(session) ? "Alla sammandrag" : "Mina sammandrag",
          },
        isOrgAdmin(session) && { href: "/medlemmar", label: "Medlemmar" },
        isSuperAdmin(session) && { href: "/admin", label: "Admin" },
        { href: "/mina-matcher", label: "Mina matcher" },
        { href: "/domare", label: "Bli domare" },
      ].filter((l): l is { href: string; label: string } => Boolean(l))
    : [];

  return (
    <header className="border-b-4 border-ball bg-brand text-brand-foreground">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="Easy Basket planeraren, till kalendern"
        >
          <BallIcon className="size-9" />
          <span className="flex flex-col font-display leading-none">
            <span className="text-2xl font-bold uppercase tracking-wide">
              Easy Basket
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-ball">
              planeraren
            </span>
          </span>
        </Link>

        {!session ? (
          <nav className="flex items-center gap-2 text-sm">
            <Button asChild variant="ghost" size="sm" className={onDark}>
              <Link href="/logga-in">Logga in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/registrera">Registrera</Link>
            </Button>
          </nav>
        ) : (
          <>
            {/* Dator och surfplatta */}
            <nav className="hidden items-center gap-1 text-sm lg:flex">
              {session.organization && (
                <span className="mr-2 text-brand-foreground/70">
                  {session.organization.name}
                </span>
              )}
              {links.map((l) => (
                <Button
                  key={l.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={onDark}
                >
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              ))}
              <form action={signOut} className="ml-1">
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  className="border-white/30 bg-transparent text-brand-foreground hover:bg-white/10 hover:text-brand-foreground"
                >
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
