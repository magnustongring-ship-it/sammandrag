"use client";

import { useActionState } from "react";
import { createOrganization } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrganizationForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(createOrganization, undefined);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Föreningens namn</Label>
        <Input id="name" name="name" autoComplete="organization" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="city">Ort</Label>
        <Input id="city" name="city" autoComplete="address-level2" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact_email">Kontakt-e-post</Label>
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={defaultEmail}
          required
        />
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Skickar…" : "Skicka för godkännande"}
      </Button>
    </form>
  );
}
