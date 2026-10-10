"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";

export type FieldSpec = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
};

const accountFields: FieldSpec[] = [
  { name: "full_name", label: "Ditt namn", autoComplete: "name", required: true },
  { name: "email", label: "E-post", type: "email", autoComplete: "email", required: true },
  {
    name: "password",
    label: "Lösenord",
    type: "password",
    autoComplete: "new-password",
    hint: "Minst 8 tecken.",
    required: true,
  },
  {
    name: "password_confirm",
    label: "Upprepa lösenord",
    type: "password",
    autoComplete: "new-password",
    required: true,
  },
];

// Formulär för att skapa konto, med valfria extra fält (t.ex. föreningens
// uppgifter). Fälten är kontrollerade så att inget töms när servern svarar
// med ett fel, och felaktiga fält markeras. Servern skickar tillbaka det som
// skrevs in, så att det fungerar även utan JavaScript (utom lösenorden).
export function SignupForm({
  action: signUp,
  submitLabel,
  defaultEmail = "",
  hidden,
  extra,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaultEmail?: string;
  hidden?: Record<string, string>;
  extra?: { legend: string; fields: FieldSpec[] };
}) {
  const [state, action, pending] = useActionState(signUp, undefined);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    email: defaultEmail,
    ...state?.values,
  }));
  const formRef = useRef<HTMLFormElement>(null);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    // Lösenorden finns kvar i fälten; övriga värden kommer från servern.
    if (state?.values) setValues((v) => ({ ...v, ...state.values }));
  }

  // Flytta fokus till första felaktiga fältet.
  useEffect(() => {
    if (state?.fieldErrors) {
      formRef.current?.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus();
    }
  }, [state]);

  if (state?.message) return <FormMessage state={state} />;

  // Med JavaScript skickas formuläret härifrån, så att React inte återställer
  // fälten efteråt (det gör det annars med formulär-actions). Utan JavaScript
  // används action-attributet.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  };

  const errors = state?.fieldErrors ?? {};
  const render = (f: FieldSpec) => (
    <FormField
      key={f.name}
      name={f.name}
      label={f.label}
      type={f.type}
      autoComplete={f.autoComplete}
      hint={f.hint}
      required={f.required}
      value={values[f.name] ?? ""}
      onChange={(value) => setValues((v) => ({ ...v, [f.name]: value }))}
      error={errors[f.name]}
    />
  );

  return (
    // noValidate: servern kontrollerar och visar felen vid rätt fält.
    <form ref={formRef} action={action} onSubmit={submit} noValidate className="grid gap-4">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {accountFields.map(render)}
      {extra && (
        <fieldset className="grid gap-4 border-t pt-4">
          <legend className="pr-2 text-sm font-medium">{extra.legend}</legend>
          {extra.fields.map(render)}
        </fieldset>
      )}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Skapar konto…" : submitLabel}
      </Button>
    </form>
  );
}
