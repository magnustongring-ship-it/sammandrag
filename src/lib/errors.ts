// Gör databasfel begripliga på svenska. Det tekniska felet loggas på
// servern i stället för att visas för användaren.

type DbError = { code?: string; message: string };

export function friendlyError(error: DbError, context: string): string {
  switch (error.code) {
    case "P0001":
      // Egna fel från databasfunktionerna är redan skrivna på svenska.
      return error.message;
    case "23505":
      return "Det finns redan en likadan post.";
    case "23503":
      return "Posten används på andra ställen och kan inte tas bort.";
    case "42501":
      return "Du har inte behörighet att göra det här.";
    case "PGRST202":
      return "En databasfunktion saknas. Kör SQL-migreringarna i supabase/migrations.";
  }
  if (error.message.includes("row-level security")) {
    return "Du har inte behörighet att göra det här.";
  }
  console.error(`[${context}]`, error);
  if (/fetch failed|network|ECONN/i.test(error.message)) {
    return `${context}: kunde inte nå databasen. Försök igen om en stund.`;
  }
  return `${context}. Försök igen, eller kontakta sajtens administratör om felet kvarstår.`;
}
