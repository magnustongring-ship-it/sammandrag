"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid w-full max-w-md gap-3 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold uppercase">Något gick fel</h1>
      <p className="text-sm text-muted-foreground">
        Sidan kunde inte visas. Försök igen, eller gå tillbaka till kalendern.
        {error.digest && (
          <span className="mt-2 block text-xs">Felkod: {error.digest}</span>
        )}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => retry()}>Försök igen</Button>
        <Button asChild variant="outline">
          <Link href="/">Till kalendern</Link>
        </Button>
      </div>
    </main>
  );
}
