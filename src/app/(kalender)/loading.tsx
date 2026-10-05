export default function Loading() {
  return (
    <main
      className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6"
      aria-busy="true"
      aria-label="Laddar"
    >
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
      <span className="sr-only">Laddar…</span>
    </main>
  );
}
