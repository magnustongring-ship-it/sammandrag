import Link from "next/link";
import {
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  Flag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelRegistration } from "@/lib/actions/registrations";
import {
  formatDate,
  formatTimeRange,
  genderLabel,
  todayInStockholm,
} from "@/lib/calendar";
import { isRegistrationOpen, lastRegistrationDay } from "@/lib/registration";
import type { Tables } from "@/lib/database.types";
import { ConfirmButton } from "@/components/confirm-button";
import { EventStatusBadge } from "@/components/event-status-badge";
import { RegistrationStatusBadge } from "@/components/registration-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RegisterForm } from "./register-form";
import { RefereeForm } from "./referee-form";
import { getScheduleMatches } from "@/lib/schedule";
import { ScheduleView } from "@/components/schedule-view";
import { LevelBadge } from "@/components/level-badge";

export async function generateMetadata({ params }: PageProps<"/sammandrag/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Sammandraget hittades inte" };
}

const longDate: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

export default async function EventPage({ params }: PageProps<"/sammandrag/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [session, { data: event }] = await Promise.all([
    getSession(),
    supabase
      .from("events")
      .select(
        "*, organizations(name), event_classes(*, age_groups(*))",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!event) notFound();

  const classIds = event.event_classes.map((c) => c.id);
  const myOrg = session?.organization;
  const [{ data: counts }, { data: myRegs }, { data: schedule }] = await Promise.all([
    supabase.rpc("event_class_counts", { p_event_ids: [id] }),
    myOrg && classIds.length > 0
      ? supabase
          .from("registrations")
          .select("*")
          .eq("organization_id", myOrg.id)
          .in("event_class_id", classIds)
          .neq("status", "avanmald")
          .order("created_at")
      : Promise.resolve({ data: [] as Tables<"registrations">[] }),
    supabase.from("event_schedules").select("published").eq("event_id", id).maybeSingle(),
  ]);
  // Arrangören kan läsa ett opublicerat schema, men det visas bara när det är publicerat.
  const scheduleMatches = schedule?.published
    ? (await getScheduleMatches(supabase, id)).matches
    : [];
  const countById = new Map((counts ?? []).map((c) => [c.event_class_id, c]));
  const countsKnown = counts !== null;

  const classes = [...event.event_classes]
    .sort(
      (a, b) =>
        (a.age_groups?.sort_order ?? 0) - (b.age_groups?.sort_order ?? 0) ||
        a.gender.localeCompare(b.gender),
    )
    .map((c) => {
      const count = countById.get(c.id);
      const registered = countsKnown ? (count?.registered ?? 0) : null;
      return {
        id: c.id,
        label: `${c.age_groups?.name ?? "?"} ${genderLabel[c.gender].toLowerCase()}`,
        max: c.max_teams,
        registered,
        waitlisted: countsKnown ? (count?.waitlisted ?? 0) : null,
        free: registered === null ? null : Math.max(0, c.max_teams - registered),
        rules: c.game_format
          ? `${c.game_format} · ${c.periods} × ${c.period_minutes} min`
          : null,
        level: c.age_groups?.level ?? null,
        courtNote: c.age_groups?.court_note ?? null,
      };
    });
  const classLabel = new Map(classes.map((c) => [c.id, c.label]));

  const today = todayInStockholm();
  const open = isRegistrationOpen(event, today);
  const refereesWelcome = event.status === "publicerad" && today <= event.event_date;
  const isOrganizer =
    myOrg?.id === event.organizer_org_id && session?.profile.is_org_admin;
  const time = formatTimeRange(event.start_time, event.end_time);
  const cancelled = event.status === "avbokad";

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <div className="grid gap-2">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Kalendern
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={cn("text-3xl font-bold uppercase", cancelled && "line-through")}>
            {event.title}
          </h1>
          {event.status !== "publicerad" && <EventStatusBadge status={event.status} />}
          <div className="ml-auto flex flex-wrap gap-2">
            {refereesWelcome && (
              <Button asChild variant="outline" size="sm">
                <a href="#domare">
                  <Flag /> Anmäl dig som domare
                </a>
              </Button>
            )}
            {isOrganizer && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/arrangor/${event.id}`}>Redigera</Link>
              </Button>
            )}
          </div>
        </div>
        {cancelled && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
            Sammandraget är avbokat av arrangören.
          </p>
        )}
        {event.status === "utkast" && (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Det här är ett utkast och syns bara för din förening.
          </p>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-4 rounded-xl border bg-card p-4 text-sm shadow-sm sm:grid-cols-2">
        <Info label="Datum" icon={CalendarDays}>
          <span className="capitalize">{formatDate(event.event_date, longDate)}</span>
          {time && `, ${time}`}
        </Info>
        <Info label="Plats" icon={MapPin}>
          {event.venue_name}
          {event.address && <>, {event.address}</>}
          {event.city && <>, {event.city}</>}
        </Info>
        <Info label="Arrangör" icon={Users}>{event.organizations?.name ?? "–"}</Info>
        <Info label="Sista anmälningsdag" icon={Clock}>
          {formatDate(lastRegistrationDay(event), longDate)}
        </Info>
      </dl>

      {event.description && (
        <section className="flex gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-muted-foreground">Beskrivning</h2>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{event.description}</p>
          </div>
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Klasser</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga klasser ännu.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-sm">
            {classes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="grid gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {c.label}
                    <LevelBadge level={c.level} />
                  </span>
                  {c.rules && (
                    <span className="text-xs text-muted-foreground">
                      {c.rules}
                      {c.courtNote && ` · ${c.courtNote}`}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-sm">
                  {c.registered === null ? (
                    <span className="text-muted-foreground">Max {c.max} lag</span>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "tabular-nums",
                          c.free === 0 && "font-medium text-red-700 dark:text-red-400",
                        )}
                      >
                        {c.registered} av {c.max} platser fyllda
                      </span>
                      {!!c.waitlisted && (
                        <span className="text-muted-foreground">
                          {c.waitlisted} på väntelista
                        </span>
                      )}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {scheduleMatches.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl font-bold uppercase">Spelschema</h2>
          <ScheduleView matches={scheduleMatches} />
        </section>
      )}

      {(myRegs ?? []).length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-medium">Era anmälda lag</h2>
          <ul className="divide-y rounded-xl border bg-card shadow-sm">
            {myRegs!.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.team_name}</span>
                    <RegistrationStatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {classLabel.get(r.event_class_id)} · {r.contact_email} ·{" "}
                    {r.contact_phone}
                  </p>
                </div>
                {open && (
                  <ConfirmButton
                    action={cancelRegistration.bind(null, r.id)}
                    label="Avanmäl"
                    confirmLabel="Ja, avanmäl"
                    question={`Avanmäla ${r.team_name}? Platsen går till nästa lag på väntelistan.`}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Anmäl lag</CardTitle>
        </CardHeader>
        <CardContent>
          {!open ? (
            <p className="text-sm text-muted-foreground">
              {cancelled
                ? "Sammandraget är avbokat."
                : event.status === "utkast"
                  ? "Anmälan öppnar när sammandraget publiceras."
                  : "Anmälan är stängd."}
            </p>
          ) : !session ? (
            <p className="text-sm">
              <Link href="/logga-in" className="font-medium underline">
                Logga in
              </Link>{" "}
              för att anmäla lag. Ny förening?{" "}
              <Link href="/registrera" className="font-medium underline">
                Registrera er här
              </Link>
              .
            </p>
          ) : myOrg?.status !== "godkand" ? (
            <p className="text-sm text-muted-foreground">
              Din förening måste vara godkänd innan ni kan anmäla lag.
            </p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Arrangören har inte lagt till några klasser ännu.
            </p>
          ) : (
            <RegisterForm
              eventId={event.id}
              classes={classes}
              defaults={{
                classId: classes.length === 1 ? classes[0].id : "",
                teamName: "",
                contactEmail: session.email ?? "",
                contactPhone: "",
              }}
            />
          )}
        </CardContent>
      </Card>

      {refereesWelcome && (
        <Card id="domare" className="scroll-mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-5 text-primary" aria-hidden="true" />
              Vill du döma?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOrganizer && (
              <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
                Du är arrangör. Här anmäler domare sitt intresse. Se anmälningarna och tillsätt
                domare under{" "}
                <Link href={`/arrangor/${event.id}/domare`} className="font-medium underline">
                  Domare
                </Link>
                .
              </p>
            )}
            <RefereeForm eventId={event.id} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Info({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}
