"use client";

import { useActionState } from "react";
import { signUp } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.message) return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="full_name">Ditt namn</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
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
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Skapar konto…" : "Skapa konto"}
      </Button>
    </form>
  );
}
