import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-md gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Sidan hittades inte</h1>
      <p className="text-sm text-muted-foreground">
        Sammandraget eller sidan finns inte, eller så har du inte behörighet att se den.
      </p>
      <Link href="/" className="font-medium underline">
        Till kalendern
      </Link>
    </main>
  );
}
