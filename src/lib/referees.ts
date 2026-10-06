// Domarnivåer och automatisk fördelning av domare på matcher.
// Ren logik utan databas, så att den går att testa fristående.

import type { RefereeLevel } from "@/lib/database.types";

export const REFEREE_LEVELS: { value: RefereeLevel; label: string }[] = [
  { value: "matchledare", label: "Matchledare" },
  { value: "niva1", label: "Nivå 1 domare" },
  { value: "niva2", label: "Nivå 2 domare" },
  { value: "niva3", label: "Nivå 3 domare" },
  { value: "niva4", label: "Nivå 4 domare" },
];

export const refereeLevelLabel = Object.fromEntries(
  REFEREE_LEVELS.map((l) => [l.value, l.label]),
) as Record<RefereeLevel, string>;

/** Högre värde = högre domarnivå */
export const refereeLevelRank = Object.fromEntries(
  REFEREE_LEVELS.map((l, i) => [l.value, i]),
) as Record<RefereeLevel, number>;

export type AssignReferee = { id: string; name: string; level: RefereeLevel };
export type AssignMatch = { id: string; start: number; end: number };
export type Assignment = { matchId: string; referee1: string | null; referee2: string | null };

/**
 * Fördelar domare på matcherna. Först får varje match en domare 1 (i
 * tidsordning), sedan fylls domare 2 med dem som är lediga, så att alla
 * matcher får minst en domare innan någon får två. Ingen domare dömer två
 * matcher som överlappar. Den som dömt minst väljs först; vid lika väljs
 * högst nivå som domare 1 och lägst nivå som domare 2, så att erfarna och
 * nya domare blandas.
 */
export function autoAssign(
  matches: AssignMatch[],
  referees: AssignReferee[],
  perMatch: 1 | 2,
): { assignments: Assignment[]; unfilled: number } {
  const busy = new Map<string, { start: number; end: number }[]>(
    referees.map((r) => [r.id, []]),
  );
  const load = new Map<string, number>(referees.map((r) => [r.id, 0]));
  const free = (r: AssignReferee, m: AssignMatch) =>
    busy.get(r.id)!.every((b) => b.end <= m.start || m.end <= b.start);

  const ordered = [...matches].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const picked = new Map<string, string[]>(ordered.map((m) => [m.id, []]));
  let unfilled = 0;

  for (let slot = 0; slot < perMatch; slot++) {
    for (const m of ordered) {
      const inMatch = picked.get(m.id)!;
      const candidates = referees
        .filter((r) => !inMatch.includes(r.id) && free(r, m))
        .sort(
          (a, b) =>
            load.get(a.id)! - load.get(b.id)! ||
            (slot === 0
              ? refereeLevelRank[b.level] - refereeLevelRank[a.level]
              : refereeLevelRank[a.level] - refereeLevelRank[b.level]) ||
            a.name.localeCompare(b.name, "sv"),
        );
      const r = candidates[0];
      if (!r) {
        unfilled++;
        continue;
      }
      inMatch.push(r.id);
      busy.get(r.id)!.push({ start: m.start, end: m.end });
      load.set(r.id, load.get(r.id)! + 1);
    }
  }

  const assignments = ordered.map((m) => {
    const ids = picked.get(m.id)!;
    return { matchId: m.id, referee1: ids[0] ?? null, referee2: ids[1] ?? null };
  });
  return { assignments, unfilled };
}

/** Domare som dömer två matcher samtidigt: lista med varningstexter. */
export function refereeConflicts(
  matches: { id: string; start: number; end: number; label: string; referees: string[] }[],
  names: Map<string, string>,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i];
      const b = matches[j];
      if (!(a.start < b.end && b.start < a.end)) continue;
      for (const r of a.referees) {
        if (b.referees.includes(r)) {
          out.push(`${names.get(r) ?? "En domare"} dömer både ${a.label} och ${b.label} samtidigt.`);
        }
      }
    }
  }
  return out;
}
