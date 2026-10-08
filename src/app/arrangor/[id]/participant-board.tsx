"use client";

import { useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import { cancelRegistration, moveRegistration } from "@/lib/actions/registrations";
import { TIME_ZONE } from "@/lib/calendar";
import type { RegistrationStatus } from "@/lib/database.types";
import { ConfirmButton } from "@/components/confirm-button";
import { cn } from "@/lib/utils";

export type BoardClass = { id: string; label: string; max: number };

export type BoardRegistration = {
  id: string;
  event_class_id: string;
  team_name: string;
  contact_email: string;
  contact_phone: string;
  status: RegistrationStatus;
  created_at: string;
  organizationName: string | null;
};

type Zone = { classId: string; status: "anmald" | "vantelista" };

const timestamp = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

// Deltagarlistan per klass. När anmälan har stängt (canMove) kan arrangören
// dra lag mellan klasser och mellan anmälda och väntelista, eller välja
// "Flytta till…" där dra-och-släpp inte fungerar (mobil, tangentbord).
export function ParticipantBoard({
  classes,
  regs,
  canMove,
}: {
  classes: BoardClass[];
  regs: BoardRegistration[];
  canMove: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (id: string, zone: Zone) => {
    const reg = regs.find((r) => r.id === id);
    if (!reg || (reg.event_class_id === zone.classId && reg.status === zone.status)) return;
    startTransition(async () => {
      setError(null);
      const result = await moveRegistration(id, zone.classId, zone.status);
      if (result.error) setError(result.error);
    });
  };

  const zoneKey = (z: Zone) => `${z.classId}:${z.status}`;
  const dropProps = (zone: Zone) =>
    canMove
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (!dragId) return;
            e.preventDefault();
            setOverZone(zoneKey(zone));
          },
          onDragLeave: () => setOverZone((z) => (z === zoneKey(zone) ? null : z)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setOverZone(null);
            if (dragId) move(dragId, zone);
            setDragId(null);
          },
        }
      : {};

  return (
    <div className="grid gap-4">
      {canMove ? (
        <p className="text-sm text-muted-foreground">
          Anmälan har stängt. Dra lag mellan klasserna för att jämna ut antalet, eller till
          en väntelista. Lagnamnets klassförkortning byts automatiskt. Föreningen får inget
          meddelande om flytten.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Lag kan flyttas mellan klasser när anmälningstiden har gått ut.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {classes.map((c) => {
        const inClass = regs.filter((r) => r.event_class_id === c.id);
        const registered = inClass.filter((r) => r.status === "anmald");
        const waiting = inClass.filter((r) => r.status === "vantelista");
        const cancelled = inClass.filter((r) => r.status === "avanmald");
        const zones: { zone: Zone; rows: BoardRegistration[]; title?: string }[] = [
          { zone: { classId: c.id, status: "anmald" }, rows: registered },
          { zone: { classId: c.id, status: "vantelista" }, rows: waiting, title: "Väntelista" },
        ];
        return (
          <div
            key={c.id}
            className={cn(
              "overflow-hidden rounded-xl border bg-card shadow-sm",
              pending && "opacity-70",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-secondary px-3 py-2 text-secondary-foreground">
              <h3 className="font-medium">{c.label}</h3>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  registered.length >= c.max && "font-medium text-red-700 dark:text-red-400",
                )}
              >
                {registered.length} av {c.max}
                {waiting.length > 0 && ` · ${waiting.length} på väntelista`}
              </span>
            </div>

            {zones.map(({ zone, rows, title }) => {
              // Släppytorna finns alltid när lag kan flyttas. De får inte dyka upp
              // först när dragningen startar: då flyttas lagen i klasserna längre
              // ner under musen och Chrome avbryter dragningen.
              if (rows.length === 0 && !canMove && !(zone.status === "anmald" && inClass.length === 0)) {
                return null;
              }
              const active = overZone === zoneKey(zone);
              return (
                <div
                  key={zone.status}
                  {...dropProps(zone)}
                  className={cn(
                    "transition-colors",
                    zone.status === "vantelista" && "border-t",
                        active && "bg-primary/10 outline-2 -outline-offset-2 outline-primary",
                  )}
                >
                  {title && (
                    <p className="px-3 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {title}
                    </p>
                  )}
                  {rows.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      {canMove
                        ? zone.status === "anmald"
                          ? `${inClass.length === 0 ? "Inga anmälda lag ännu. " : ""}Dra lag hit för att anmäla dem i klassen.`
                          : "Dra lag hit för att lägga dem på väntelistan."
                        : "Inga anmälda lag ännu."}
                    </p>
                  ) : (
                    <TeamTable
                      rows={rows}
                      classes={classes}
                      canMove={canMove}
                      dragId={dragId}
                      onDragStart={setDragId}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverZone(null);
                      }}
                      onMove={move}
                    />
                  )}
                </div>
              );
            })}

            {cancelled.length > 0 && (
              <details className="border-t px-3 py-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Avanmälda ({cancelled.length})
                </summary>
                <ul className="mt-2 grid gap-1 text-muted-foreground">
                  {cancelled.map((r) => (
                    <li key={r.id}>
                      <span className="line-through">{r.team_name}</span>
                      {r.organizationName && ` · ${r.organizationName}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamTable({
  rows,
  classes,
  canMove,
  dragId,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  rows: BoardRegistration[];
  classes: BoardClass[];
  canMove: boolean;
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMove: (id: string, zone: Zone) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Plats</th>
            <th>Lag</th>
            <th>Kontakt</th>
            <th className="hidden sm:table-cell">Anmäld</th>
            <th>Åtgärd</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr
              key={r.id}
              draggable={canMove}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", r.id);
                // Uppdatera först efter dragstart: ändras sidan direkt avbryter
                // Chrome dragningen.
                setTimeout(() => onDragStart(r.id), 0);
              }}
              onDragEnd={onDragEnd}
              className={cn(
                "align-top",
                canMove && "cursor-grab active:cursor-grabbing",
                dragId === r.id && "opacity-40",
              )}
            >
              <td className="w-8 py-2 pl-3 tabular-nums text-muted-foreground">
                {canMove ? (
                  <GripVertical aria-hidden className="size-4" />
                ) : (
                  `${i + 1}.`
                )}
              </td>
              <td className="py-2 pr-3">
                <div className="font-medium">{r.team_name}</div>
                <div className="text-muted-foreground">{r.organizationName ?? "–"}</div>
              </td>
              <td className="py-2 pr-3">
                <a href={`mailto:${r.contact_email}`} className="block underline">
                  {r.contact_email}
                </a>
                <a href={`tel:${r.contact_phone.replace(/[ -]/g, "")}`} className="block">
                  {r.contact_phone}
                </a>
              </td>
              <td className="hidden whitespace-nowrap py-2 pr-3 text-muted-foreground sm:table-cell">
                {timestamp.format(new Date(r.created_at))}
              </td>
              <td className="grid gap-2 py-2 pr-3 text-right">
                {canMove && (
                  <select
                    aria-label={`Flytta ${r.team_name}`}
                    value=""
                    onChange={(e) => {
                      const [classId, status] = e.target.value.split(":");
                      if (classId) onMove(r.id, { classId, status: status as Zone["status"] });
                    }}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Flytta till…</option>
                    {classes.flatMap((c) =>
                      (["anmald", "vantelista"] as const)
                        .filter((s) => !(c.id === r.event_class_id && s === r.status))
                        .map((s) => (
                          <option key={`${c.id}:${s}`} value={`${c.id}:${s}`}>
                            {c.label}
                            {s === "vantelista" ? " (väntelista)" : ""}
                          </option>
                        )),
                    )}
                  </select>
                )}
                <ConfirmButton
                  action={cancelRegistration.bind(null, r.id)}
                  label="Avanmäl"
                  confirmLabel="Ja, avanmäl"
                  question={`Avanmäla ${r.team_name}? Föreningen får inget meddelande automatiskt.${r.status === "anmald" ? " Platsen går till nästa lag på väntelistan." : ""}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
