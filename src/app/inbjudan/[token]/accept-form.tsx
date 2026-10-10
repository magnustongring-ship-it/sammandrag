"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/lib/actions/teams";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";

export function AcceptForm({ token, teamName }: { token: string; teamName: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Vänta…" : `Bli LagAdmin för ${teamName}`}
      </Button>
    </form>
  );
}
