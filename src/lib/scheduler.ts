// Automatisk schemaläggning av matcher för ett sammandrag.
//
// 1. Matchpar skapas per klass, antingen alla-möter-alla eller ett bestämt
//    antal matcher per lag. Paren skapas i omgångar (berger-/cirkelmetoden)
//    så att alla lag kommer igång tidigt.
// 2. Matcherna läggs ut på planerna en i taget: den match som kan starta
//    tidigast väljs, med hänsyn till lediga planer och att varje lag ska få
//    minst den angivna vilotiden mellan sina matcher.
//
// Ren logik utan databas, så att den går att testa fristående.

export type Matchup = "alla" | "antal";

export type MatchSettings = {
  gameFormat: string;
  periods: number;
  periodMinutes: number;
  breakMinutes: number;
  matchup: Matchup;
  matchesPerTeam: number;
};

export type Team = { id: string; name: string; club: string | null };

export type ScheduleClass = {
  id: string;
  label: string;
  teams: Team[];
  settings: MatchSettings;
};

export type ScheduleInput = {
  /** Minuter efter midnatt */
  startMinutes: number;
  courts: number;
  minRestMinutes: number;
  classes: ScheduleClass[];
};

export type ScheduledMatch = {
  classId: string;
  classLabel: string;
  court: number;
  start: number;
  end: number;
  home: Team;
  away: Team;
  gameFormat: string;
};

export type ScheduleResult = {
  matches: ScheduledMatch[];
  /** Klasser som hoppades över, t.ex. med färre än två lag */
  skipped: { classId: string; label: string; reason: string }[];
  endMinutes: number | null;
};

export function matchDuration(s: MatchSettings): number {
  return s.periods * s.periodMinutes + Math.max(0, s.periods - 1) * s.breakMinutes;
}

/** Omgångar med cirkelmetoden; vid udda antal får ett lag vila varje omgång. */
export function roundRobinRounds(teams: Team[]): [Team, Team][][] {
  const list: (Team | null)[] = [...teams];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: [Team, Team][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [Team, Team][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (!a || !b) continue;
      // Växla hemma/borta mellan omgångarna så att det jämnas ut.
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    // Rotera alla utom det första laget.
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Matchpar för en klass, i den ordning de bör spelas. */
export function pairings(teams: Team[], settings: MatchSettings): [Team, Team][][] {
  const rounds = roundRobinRounds(teams);
  if (settings.matchup === "alla" || settings.matchesPerTeam >= teams.length - 1) {
    return rounds;
  }

  // Bestämt antal: ta de första omgångarna. Vid udda antal lag har några lag
  // vilat en omgång och får en extra match mot ett annat lag med för få.
  const taken = rounds.slice(0, settings.matchesPerTeam);
  const count = new Map(teams.map((t) => [t.id, 0]));
  const played = new Set<string>();
  const key = (a: Team, b: Team) => [a.id, b.id].sort().join("|");
  for (const round of taken) {
    for (const [a, b] of round) {
      count.set(a.id, count.get(a.id)! + 1);
      count.set(b.id, count.get(b.id)! + 1);
      played.add(key(a, b));
    }
  }

  const extra: [Team, Team][] = [];
  const needing = () => teams.filter((t) => count.get(t.id)! < settings.matchesPerTeam);
  for (let guard = 0; guard < teams.length * settings.matchesPerTeam; guard++) {
    const short = needing();
    if (short.length === 0) break;
    const a = short[0];
    // Helst ett annat lag som också har för få matcher, annars det lag som
    // har minst antal matcher och inte redan mött laget.
    const candidates = teams
      .filter((t) => t.id !== a.id && !played.has(key(a, t)))
      .sort((x, y) => count.get(x.id)! - count.get(y.id)!);
    const b = candidates.find((t) => count.get(t.id)! < settings.matchesPerTeam) ?? candidates[0];
    if (!b) break;
    extra.push([a, b]);
    played.add(key(a, b));
    count.set(a.id, count.get(a.id)! + 1);
    count.set(b.id, count.get(b.id)! + 1);
  }

  return extra.length > 0 ? [...taken, extra] : taken;
}

type Pending = {
  classId: string;
  classLabel: string;
  home: Team;
  away: Team;
  duration: number;
  gameFormat: string;
  order: number;
};

export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const skipped: ScheduleResult["skipped"] = [];

  // Lägg omgång 1 för alla klasser först, sedan omgång 2 osv.
  const perClass = input.classes.flatMap((c) => {
    if (c.teams.length < 2) {
      skipped.push({
        classId: c.id,
        label: c.label,
        reason: c.teams.length === 0 ? "Inga anmälda lag" : "Bara ett anmält lag",
      });
      return [];
    }
    return [{ c, rounds: pairings(c.teams, c.settings) }];
  });
  const pending: Pending[] = [];
  const maxRounds = Math.max(0, ...perClass.map((p) => p.rounds.length));
  for (let r = 0; r < maxRounds; r++) {
    for (const { c, rounds } of perClass) {
      for (const [home, away] of rounds[r] ?? []) {
        pending.push({
          classId: c.id,
          classLabel: c.label,
          home,
          away,
          duration: matchDuration(c.settings),
          gameFormat: c.settings.gameFormat,
          order: pending.length,
        });
      }
    }
  }

  const courtFree = Array.from({ length: Math.max(1, input.courts) }, () => input.startMinutes);
  const teamReady = new Map<string, number>();
  const ready = (t: Team) => teamReady.get(t.id) ?? input.startMinutes;
  const matches: ScheduledMatch[] = [];

  while (pending.length > 0) {
    // Hitta den match och plan som ger tidigast möjliga start.
    let best: { index: number; court: number; start: number } | null = null;
    for (let i = 0; i < pending.length; i++) {
      const m = pending[i];
      const teamsReady = Math.max(ready(m.home), ready(m.away));
      for (let court = 0; court < courtFree.length; court++) {
        const start = Math.max(courtFree[court], teamsReady);
        if (!best || start < best.start || (start === best.start && m.order < pending[best.index].order)) {
          best = { index: i, court, start };
        }
      }
    }
    const m = pending.splice(best!.index, 1)[0];
    const end = best!.start + m.duration;
    courtFree[best!.court] = end;
    teamReady.set(m.home.id, end + input.minRestMinutes);
    teamReady.set(m.away.id, end + input.minRestMinutes);
    matches.push({
      classId: m.classId,
      classLabel: m.classLabel,
      court: best!.court + 1,
      start: best!.start,
      end,
      home: m.home,
      away: m.away,
      gameFormat: m.gameFormat,
    });
  }

  matches.sort((a, b) => a.start - b.start || a.court - b.court);
  return {
    matches,
    skipped,
    endMinutes: matches.length ? Math.max(...matches.map((m) => m.end)) : null,
  };
}

/** "09:30" eller "09:30:00" → 570 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
