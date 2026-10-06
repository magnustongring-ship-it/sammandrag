-- Spelschema för sammandrag.
-- Kör i Supabase → SQL Editor.
--
-- event_schedules: arrangörens inställningar (en rad per sammandrag).
-- schedule_matches: de schemalagda matcherna. Lagnamn och förening sparas i
-- matchen så att ett publicerat schema kan visas för alla utan att
-- anmälningarna (med kontaktuppgifter) behöver vara läsbara.

create table event_schedules (
  event_id uuid primary key references events(id) on delete cascade,
  start_time time not null,
  courts int not null default 1 check (courts between 1 and 20),
  min_rest_minutes int not null default 20 check (min_rest_minutes between 0 and 240),
  game_format text not null default '5-mot-5',
  periods int not null default 2 check (periods between 1 and 8),
  period_minutes int not null default 10 check (period_minutes between 1 and 60),
  break_minutes int not null default 2 check (break_minutes between 0 and 30),
  matchup text not null default 'alla' check (matchup in ('alla', 'antal')),
  matches_per_team int not null default 3 check (matches_per_team between 1 and 20),
  -- Egna inställningar per klass: { "<event_class_id>": { gameFormat, periods, ... } }
  class_settings jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table schedule_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  event_class_id uuid not null references event_classes(id) on delete cascade,
  court int not null check (court >= 1),
  starts_at time not null,
  ends_at time not null,
  game_format text not null,
  home_registration_id uuid references registrations(id) on delete set null,
  away_registration_id uuid references registrations(id) on delete set null,
  home_team text not null,
  home_club text,
  away_team text not null,
  away_club text
);

create index schedule_matches_event_idx on schedule_matches (event_id, starts_at);

-- Är inloggad användare föreningsadmin för sammandragets arrangör?
create or replace function is_event_organizer(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_my_org_admin() and exists (
    select 1 from events where id = p_event_id and organizer_org_id = my_org()
  )
$$;

alter table event_schedules enable row level security;
alter table schedule_matches enable row level security;

-- Arrangören ser alltid sitt schema, övriga bara när det är publicerat.
create policy "schedules_read" on event_schedules for select using (
  is_event_organizer(event_id)
  or (published and exists (
    select 1 from events e
    where e.id = event_id and e.status in ('publicerad', 'avbokad')
  ))
);
create policy "schedules_write" on event_schedules for all
  using (is_event_organizer(event_id))
  with check (is_event_organizer(event_id));

create policy "matches_read" on schedule_matches for select using (
  is_event_organizer(event_id)
  or exists (
    select 1 from event_schedules s join events e on e.id = s.event_id
    where s.event_id = schedule_matches.event_id
      and s.published and e.status in ('publicerad', 'avbokad')
  )
);
create policy "matches_write" on schedule_matches for all
  using (is_event_organizer(event_id))
  with check (
    is_event_organizer(event_id)
    and exists (
      select 1 from event_classes c
      where c.id = event_class_id and c.event_id = schedule_matches.event_id
    )
  );
