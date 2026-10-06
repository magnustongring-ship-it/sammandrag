-- Domare: intresseanmälan och tillsättning på matcher.
-- Kör i Supabase → SQL Editor, efter 20261006000000_schedule.sql.
--
-- Domare anmäler intresse utan att logga in. Uppgifterna (e-post, telefon,
-- nivå) kan bara läsas av sammandragets arrangör. Tillsatta domares namn
-- sparas i matchen så att de kan visas i det publicerade schemat.

create table referee_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  phone text not null check (char_length(phone) between 6 and 30),
  level text not null
    check (level in ('matchledare', 'niva1', 'niva2', 'niva3', 'niva4')),
  created_at timestamptz not null default now()
);

-- Samma e-postadress kan bara anmäla sig en gång per sammandrag.
create unique index referee_applications_event_email_idx
  on referee_applications (event_id, lower(email));

alter table referee_applications enable row level security;

-- Vem som helst kan anmäla intresse till ett publicerat sammandrag som inte
-- har varit ännu. Ingen utom arrangören kan läsa anmälningarna.
create policy "referees_apply" on referee_applications for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from events e
      where e.id = event_id
        and e.status = 'publicerad'
        and e.event_date >= (now() at time zone 'Europe/Stockholm')::date
    )
  );
create policy "referees_read" on referee_applications for select
  using (is_event_organizer(event_id));
create policy "referees_delete" on referee_applications for delete
  using (is_event_organizer(event_id));

-- Tillsatta domare per match (domare 2 är valfri).
alter table schedule_matches
  add column if not exists referee1_id uuid references referee_applications(id) on delete set null,
  add column if not exists referee1_name text,
  add column if not exists referee2_id uuid references referee_applications(id) on delete set null,
  add column if not exists referee2_name text;

-- Tas en domare bort ska även namnet försvinna från matcherna.
create or replace function clear_removed_referee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update schedule_matches set referee1_id = null, referee1_name = null
    where referee1_id = old.id;
  update schedule_matches set referee2_id = null, referee2_name = null
    where referee2_id = old.id;
  return old;
end $$;

drop trigger if exists referee_applications_clear on referee_applications;
create trigger referee_applications_clear
  before delete on referee_applications
  for each row execute function clear_removed_referee();
