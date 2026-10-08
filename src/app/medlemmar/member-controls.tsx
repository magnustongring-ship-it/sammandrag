"use client";

import { useState, useTransition } from "react";
import { decideMembership, setUserOrganization, setUserRole } from "@/lib/actions/members";
import type { UserRole } from "@/lib/database.types";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
    });
  return { error, pending, run };
}

export function RoleSelect({
  userId,
  role,
  options,
  disabled,
  label,
}: {
  userId: string;
  role: UserRole;
  options: UserRole[];
  disabled?: boolean;
  label: string;
}) {
  const { error, pending, run } = useAction();
  return (
    <div className="grid gap-1">
      <select
        aria-label={`Nivå för ${label}`}
        value={role}
        disabled={disabled || pending}
        onChange={(e) => run(() => setUserRole(userId, e.target.value))}
        className={selectClass}
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {roleLabel[r]}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrganizationSelect({
  userId,
  organizationId,
  organizations,
  label,
}: {
  userId: string;
  organizationId: string | null;
  organizations: { id: string; name: string }[];
  label: string;
}) {
  const { error, pending, run } = useAction();
  return (
    <div className="grid gap-1">
      <select
        aria-label={`Förening för ${label}`}
        value={organizationId ?? ""}
        disabled={pending}
        onChange={(e) => run(() => setUserOrganization(userId, e.target.value || null))}
        className={selectClass}
      >
        <option value="">Ingen förening</option>
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function MembershipDecision({ requestId }: { requestId: string }) {
  const { error, pending, run } = useAction();
  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => decideMembership(requestId, true))}>
          Godkänn
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => decideMembership(requestId, false))}
        >
          Avslå
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
