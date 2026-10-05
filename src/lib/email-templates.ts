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
