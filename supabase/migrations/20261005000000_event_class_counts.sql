-- Antal anmälda lag och lag på väntelista per klass, för "X av Y platser"
-- och färgmarkeringen i kalendern. Körs som security definer så att även
-- besökare får antalen, men inga lagnamn eller kontaktuppgifter läcker ut.
-- Följer samma synlighet som events_read: publicerade/avbokade sammandrag,
-- plus egna utkast.
--
-- Kör i Supabase → SQL Editor.

create or replace function event_class_counts(p_event_ids uuid[])
returns table (event_class_id uuid, registered int, waitlisted int)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    (count(r.id) filter (where r.status = 'anmald'))::int,
    (count(r.id) filter (where r.status = 'vantelista'))::int
  from event_classes c
  join events e on e.id = c.event_id
  left join registrations r on r.event_class_id = c.id
  where c.event_id = any(p_event_ids)
    and (e.status in ('publicerad', 'avbokad') or e.organizer_org_id = my_org())
  group by c.id
$$;

revoke execute on function event_class_counts(uuid[]) from public;
grant execute on function event_class_counts(uuid[]) to anon, authenticated;
