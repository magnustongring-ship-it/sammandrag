import { formatDate, formatTimeRange } from "@/lib/calendar";

export type RegistrationEmailData = {
  url: string;
  teamName: string;
  clubName: string;
  classLabel: string;
  waitlisted: boolean;
  contactEmail: string;
  contactPhone: string;
  event: {
    title: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    venue: string;
    city: string | null;
    lastDay: string;
    organizer: string;
  };
};

const longDate: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

function eventLines(d: RegistrationEmailData): string[] {
  const time = formatTimeRange(d.event.startTime, d.event.endTime);
  return [
    `Sammandrag: ${d.event.title}`,
    `Datum: ${formatDate(d.event.date, longDate)}${time ? `, ${time}` : ""}`,
    `Plats: ${[d.event.venue, d.event.city].filter(Boolean).join(", ")}`,
    `Arrangör: ${d.event.organizer}`,
    `Klass: ${d.classLabel}`,
  ];
}

export function registrantEmail(d: RegistrationEmailData) {
  const status = d.waitlisted
    ? `${d.teamName} står på väntelistan. Laget flyttas upp automatiskt om en plats blir ledig.`
    : `${d.teamName} är anmält.`;
  return {
    subject: `${d.waitlisted ? "Väntelista" : "Anmälan bekräftad"}: ${d.teamName}, ${d.event.title}`,
    text: [
      "Hej!",
      "",
      status,
      "",
      ...eventLines(d),
      "",
      `Avanmälan kan göras till och med ${formatDate(d.event.lastDay, longDate)}:`,
      d.url,
      "",
      "Svara på det här mejlet för att nå arrangören.",
      "",
      "/Easy Basket planeraren",
    ].join("\n"),
  };
}

export function organizerEmail(d: RegistrationEmailData) {
  return {
    subject: `Ny anmälan${d.waitlisted ? " (väntelista)" : ""}: ${d.teamName}, ${d.classLabel}`,
    text: [
      "Hej!",
      "",
      `${d.clubName} har anmält ${d.teamName} till ${d.event.title}${d.waitlisted ? ". Klassen är full, så laget står på väntelistan" : ""}.`,
      "",
      ...eventLines(d),
      `Kontakt: ${d.contactEmail}, ${d.contactPhone}`,
      "",
      "Deltagarlistan finns under Mina sammandrag:",
      d.url,
      "",
      "/Easy Basket planeraren",
    ].join("\n"),
  };
}

export function teamInvitationEmail(d: {
  url: string;
  teamName: string;
  clubName: string;
  invitedBy: string;
}) {
  return {
    subject: `Inbjudan: bli LagAdmin för ${d.teamName}`,
    text: [
      "Hej!",
      "",
      `${d.invitedBy} har bjudit in dig att bli LagAdmin för ${d.teamName} i ${d.clubName}.`,
      "Som LagAdmin anmäler du laget till sammandrag i Easy Basket planeraren.",
      "",
      "Skapa ett konto eller logga in via länken nedan. Länken gäller i 14 dagar:",
      d.url,
      "",
      "Svara på det här mejlet om du har frågor.",
      "",
      "/Easy Basket planeraren",
    ].join("\n"),
  };
}
