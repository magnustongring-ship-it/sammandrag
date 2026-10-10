"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Gemensamt formulär för att skapa konto. Extra fält (t.ex. föreningens
// uppgifter) skickas in som children.
export function SignupForm({
  action: signUp,
  submitLabel,
  defaultEmail,
  hidden,
  children,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaultEmail?: string;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.message) return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-2">
        <Label htmlFor="full_name">Ditt namn</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Lösenord</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Minst 8 tecken.</p>
      </div>
      {children}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Skapar konto…" : submitLabel}
      </Button>
    </form>
  );
}
