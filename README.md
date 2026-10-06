# Easy Basket planeraren

Webbapp där basketföreningar planerar sammandrag i en kalender och andra
föreningar anmäler lag. Se `SPEC.md` i mappen ovanför för hela beskrivningen.

Byggd med Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui och Supabase.

## Kom igång

1. Installera beroenden:

   ```bash
   npm install
   ```

2. Kopiera `.env.example` till `.env.local` och fyll i Supabase-projektets
   URL och anon-nyckel (Supabase → Project Settings → API).

3. Sätt upp databasen i Supabase → SQL Editor, i den här ordningen:
   1. SQL-schemat i `SPEC.md` avsnitt 8
   2. Filerna i `supabase/migrations/`, i namnordning

4. I Supabase → Authentication → URL Configuration, lägg till
   `http://localhost:3000/auth/callback` (och motsvarande adress i produktion)
   under Redirect URLs. Annars fungerar inte länken i bekräftelsemejlet.

5. Starta utvecklingsservern:

   ```bash
   npm run dev
   ```

   och öppna [http://localhost:3000](http://localhost:3000).

6. Registrera ett konto och en förening. Gör dig sedan till sajtadmin genom att
   sätta `is_site_admin = true` på din rad i tabellen `profiles`, och godkänn
   din förening under `/admin`.

## Migreringar

| Fil | Innehåll |
|---|---|
| `20261005000000_event_class_counts.sql` | Antal anmälda per klass utan att lagnamn läcker ut |
| `20261005010000_registration_rules.sql` | Anmälningsregler, väntelista och avanmälan |
| `20261005020000_age_groups_admin.sql` | Sajtadmin får hantera åldersgrupper |
| `20261006000000_schedule.sql` | Spelschema: inställningar och matcher |
| `20261007000000_easy_basket_rules.sql` | Matchregler per åldersgrupp och klass (Easy Basket) |
| `20261008000000_referees.sql` | Domare: intresseanmälan och tillsättning på matcher |

Databastyperna i `src/lib/database.types.ts` är skrivna för hand. Uppdatera dem
när schemat ändras, eller generera dem med `supabase gen types typescript`.

## Sidor

| Sida | Innehåll |
|---|---|
| `/` | Kalender (månad och lista) med filter |
| `/sammandrag/[id]` | Detaljer, lediga platser, anmälan |
| `/logga-in`, `/registrera` | Inloggning och registrering av förening |
| `/mina-anmalningar` | Föreningens anmälda lag |
| `/arrangor`, `/arrangor/[id]` | Föreningens sammandrag, redigering och deltagarlista |
| `/arrangor/[id]/schema` | Skapa och publicera spelschema |
| `/arrangor/[id]/domare` | Domarnas intresseanmälningar och tillsättning |
| `/domare` | Kommande sammandrag där domare kan anmäla intresse |
| `/admin` | Godkänna föreningar och hantera åldersgrupper |

## Kommandon

```bash
npm run dev     # utvecklingsserver
npm run build   # produktionsbygge
npm run lint    # ESLint
npx tsc --noEmit  # typkontroll
```
