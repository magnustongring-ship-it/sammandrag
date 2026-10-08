// Vad har ändrats för varje domare mellan två tillsättningar? Ren logik,
// så att den går att testa fristående.
//
// Matcher jämförs på tid, plan och lag i stället för id, eftersom ett schema
// som skapas på nytt får nya id:n för samma match.

export type MatchSnapshot = {
  key: string;
  label: string;
  start: string;
  refereeIds: string[];
};

export type RefereeChange = {
  refereeId: string;
  added: MatchSnapshot[];
  removed: MatchSnapshot[];
  /** Domarens matcher efter ändringen */
  current: MatchSnapshot[];
};

export function matchKey(m: {
  start: string;
  court: number;
  home: string;
  away: string;
}): string {
  return `${m.start}|${m.court}|${m.home}|${m.away}`;
}

export function refereeChanges(before: MatchSnapshot[], after: MatchSnapshot[]): RefereeChange[] {
  const forRef = (list: MatchSnapshot[], id: string) =>
    list.filter((m) => m.refereeIds.includes(id));
  const ids = new Set([...before, ...after].flatMap((m) => m.refereeIds));
  const byStart = (a: MatchSnapshot, b: MatchSnapshot) => a.start.localeCompare(b.start);

  const changes: RefereeChange[] = [];
  for (const id of ids) {
    const was = forRef(before, id);
    const now = forRef(after, id);
    const wasKeys = new Set(was.map((m) => m.key));
    const nowKeys = new Set(now.map((m) => m.key));
    const added = now.filter((m) => !wasKeys.has(m.key)).sort(byStart);
    const removed = was.filter((m) => !nowKeys.has(m.key)).sort(byStart);
    if (added.length || removed.length) {
      changes.push({ refereeId: id, added, removed, current: now.sort(byStart) });
    }
  }
  return changes;
}

/** E-posttext till en domare om ändrade uppdrag. */
export function refereeEmail(
  change: RefereeChange,
  ctx: {
    name: string;
    eventTitle: string;
    eventDate: string;
    venue: string;
    url: string;
    /** Sidan där en inloggad domare ser alla sina matcher. */
    accountUrl?: string;
  },
): { subject: string; text: string } {
  const lines = (list: MatchSnapshot[]) => list.map((m) => `  • ${m.label}`);
  const onlyAdded = change.removed.length === 0;
  const onlyRemoved = change.added.length === 0;
  const subject = onlyAdded
    ? `Domaruppdrag: ${ctx.eventTitle}`
    : onlyRemoved && change.current.length === 0
      ? `Borttagen som domare: ${ctx.eventTitle}`
      : `Ändrade domaruppdrag: ${ctx.eventTitle}`;

  const text = [
    `Hej ${ctx.name}!`,
    "",
    onlyAdded
      ? `Du är tillsatt som domare på ${ctx.eventTitle} (${ctx.eventDate}, ${ctx.venue}).`
      : `Dina domaruppdrag på ${ctx.eventTitle} (${ctx.eventDate}, ${ctx.venue}) har ändrats.`,
    ...(change.added.length && !onlyAdded
      ? ["", "Du är tillsatt som domare på:", ...lines(change.added)]
      : []),
    ...(change.removed.length ? ["", "Du är borttagen från:", ...lines(change.removed)] : []),
    "",
    change.current.length
      ? "Dina matcher just nu:"
      : "Du har inga domaruppdrag på sammandraget just nu.",
    ...lines(change.current),
    "",
    "Spelschemat:",
    ctx.url,
    ...(ctx.accountUrl
      ? [
          "",
          "Se alla dina matcher genom att skapa ett konto eller logga in med den här e-postadressen:",
          ctx.accountUrl,
        ]
      : []),
    "",
    "Svara på det här mejlet för att nå arrangören.",
    "",
    "/Easy Basket planeraren",
  ]
    .filter((l, i, all) => !(l === "" && all[i - 1] === ""))
    .join("\n");

  return { subject, text };
}
