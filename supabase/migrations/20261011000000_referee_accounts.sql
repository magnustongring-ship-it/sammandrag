-- Domare med konto ser sina uppdrag.
-- Kör i Supabase → SQL Editor, efter 20261010000000_roles.sql.
--
-- En domare anmäler intresse utan konto (referee_applications) och kopplas till
-- ett konto via e-postadressen. Bara en bekräftad e-postadress räknas, så
-- ingen kan registrera en annans adress och läsa hens uppdrag. Funktionerna
-- returnerar bara den inloggades egna rader, så ingen ny policy behövs.

create or replace function my_referee_matches()
returns table (
  match_id uuid,
  event_id uuid,
  event_title text,
  event_date date,
  event_status text,
  venue_name text,
  city text,
  organizer_name text,
  starts_at time,
  ends_at time,
  court int,
  game_format text,
  age_group text,
  gender text,
  home_team text,
  away_team text,
  referee_slot int,
  partner_name text
)
language sql stable security definer set search_path = public as $$
  select
    m.id, e.id, e.title, e.event_date, e.status, e.venue_name, e.city, o.name,
    m.starts_at, m.ends_at, m.court, m.game_format, ag.name, c.gender,
    m.home_team, m.away_team, s.slot,
    case s.slot when 1 then m.referee2_name else m.referee1_name end
  from schedule_matches m
  join events e on e.id = m.event_id
  join organizations o on o.id = e.organizer_org_id
  join event_classes c on c.id = m.event_class_id
  join age_groups ag on ag.id = c.age_group_id
  cross join lateral (values (1, m.referee1_id), (2, m.referee2_id)) as s(slot, ref_id)
  join referee_applications ra on ra.id = s.ref_id
  where lower(ra.email) = (
      select lower(u.email) from auth.users u
      where u.id = auth.uid() and u.email_confirmed_at is not null
    )
    and e.status in ('publicerad', 'avbokad')
  order by e.event_date, m.starts_at, m.court
$$;

-- Den inloggades intresseanmälningar, även de som inte har blivit tillsatta än.
create or replace function my_referee_applications()
returns table (
  application_id uuid,
  event_id uuid,
  event_title text,
  event_date date,
  event_status text,
  venue_name text,
  city text,
  level text,
  assigned_matches int
)
language sql stable security definer set search_path = public as $$
  select
    ra.id, e.id, e.title, e.event_date, e.status, e.venue_name, e.city, ra.level,
    (select count(*)::int from schedule_matches m
      where m.referee1_id = ra.id or m.referee2_id = ra.id)
  from referee_applications ra
  join events e on e.id = ra.event_id
  where lower(ra.email) = (
      select lower(u.email) from auth.users u
      where u.id = auth.uid() and u.email_confirmed_at is not null
    )
    and e.status in ('publicerad', 'avbokad')
  order by e.event_date, e.title
$$;

revoke execute on function my_referee_matches(), my_referee_applications() from public, anon;
grant execute on function my_referee_matches(), my_referee_applications() to authenticated;
