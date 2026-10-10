"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createOrganization } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";

// För inloggade utan förening (t.ex. en domare). Samma felhantering som
// SignupForm: inget töms och felaktiga fält markeras.
export function OrganizationForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(createOrganization, undefined);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    contact_email: defaultEmail,
    ...state?.values,
  }));
  const formRef = useRef<HTMLFormElement>(null);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.values) setValues((v) => ({ ...v, ...state.values }));
  }

  useEffect(() => {
    if (state?.fieldErrors) {
      formRef.current?.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus();
    }
  }, [state]);

  // Med JavaScript skickas formuläret härifrån, så att React inte återställer
  // fälten efteråt (det gör det annars med formulär-actions). Utan JavaScript
  // används action-attributet.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  };

  const errors = state?.fieldErrors ?? {};
  const bind = (name: string) => ({
    name,
    value: values[name] ?? "",
    onChange: (value: string) => setValues((v) => ({ ...v, [name]: value })),
    error: errors[name],
  });

  return (
    <form ref={formRef} action={action} onSubmit={submit} noValidate className="grid gap-4">
      <FormField {...bind("name")} label="Föreningens namn" autoComplete="organization" required />
      <FormField {...bind("city")} label="Ort" autoComplete="address-level2" required />
      <FormField {...bind("contact_email")} label="Kontakt-e-post" type="email" required />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Skickar…" : "Skicka för godkännande"}
      </Button>
    </form>
  );
}
