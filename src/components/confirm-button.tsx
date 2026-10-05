"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

// Tvåstegsknapp för åtgärder som är svåra att ångra (confirm() fungerar
// inte överallt och går inte att styla).
export function ConfirmButton({
  action,
  label,
  confirmLabel,
  question,
  variant = "outline",
}: {
  action: () => Promise<{ error?: string }>;
  label: string;
  confirmLabel: string;
  question: string;
  variant?: "outline" | "destructive";
}) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!asking) {
    return (
      <Button type="button" variant={variant} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <p>{question}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await action();
              if (result?.error) setError(result.error);
              else setAsking(false);
            })
          }
        >
          {pending ? "Vänta…" : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setAsking(false)}
        >
          Avbryt
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
