"use client";

import { useActionState } from "react";
import { createTeam, inviteTeamAdmin } from "@/lib/actions/teams";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeam, undefined);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="team_name">Lagets namn</Label>
        <div className="flex gap-2">
          <Input
            id="team_name"
            name="name"
            maxLength={100}
            placeholder="t.ex. Borlänge Basket Röd"
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Skapar…" : "Skapa lag"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Klassens förkortning (t.ex. PU10) läggs till när laget anmäls.
        </p>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function InviteForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [state, action, pending] = useActionState(inviteTeamAdmin, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="team_id" value={teamId} />
      <Label htmlFor={`invite-${teamId}`}>Bjud in ledare</Label>
      <div className="flex gap-2">
        <Input
          id={`invite-${teamId}`}
          name="email"
          type="email"
          placeholder="ledarens@e-post.se"
          aria-label={`E-post till ny ledare för ${teamName}`}
          required
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Skickar…" : "Bjud in"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
