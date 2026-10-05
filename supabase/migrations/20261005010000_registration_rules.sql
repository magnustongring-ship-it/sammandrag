-- Regler för anmälan, avanmälan och väntelista (steg 6).
-- Kör i Supabase → SQL Editor, efter 20261005000000_event_class_counts.sql.
--
-- Sista dag räknas i svensk tid: anmälan och avanmälan är öppna till och med
-- sista anmälningsdag, eller till och med sammandragets datum om ingen är satt.

-- 1. Ny anmälan: kontrollera att sammandraget är öppet, sätt anmälningstid
--    på servern (så att ingen kan tränga sig före i kön) och välj
--    anmäld/väntelista. Ersätter funktionen från SPEC.md.
create or replace function set_registration_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int;
  taken int;
  ev events%rowtype;
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  -- Lås klassen så två samtidiga anmälningar inte kan överskrida max
  select max_teams into cap
    from event_classes where id = new.event_class_id for update;
  if cap is null then
    raise exception 'Klassen finns inte.';
  end if;

  select e.* into ev
    from events e join event_classes c on c.event_id = e.id
    where c.id = new.event_class_id;
  if ev.status <> 'publicerad' then
    raise exception 'Sammandraget är inte öppet för anmälan.';
  end if;
  if today > coalesce(ev.registration_deadline, ev.event_date) then
    raise exception 'Anmälan är stängd.';
  end if;

  new.created_at := now();

  select count(*) into taken
    from registrations
    where event_class_id = new.event_class_id and status = 'anmald';

  if taken >= cap then
    new.status := 'vantelista';
  else
    new.status := 'anmald';
  end if;
  return new;
end $$;

-- 2. Flytta upp lag från väntelistan när det finns lediga platser,
--    i anmälningsordning.
create or replace function promote_waitlist(p_class_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cap int;
  taken int;
begin
  select max_teams into cap
    from event_classes where id = p_class_id for update;
  if cap is null then
    return;
  end if;

  select count(*) into taken
    from registrations
    where event_class_id = p_class_id and status = 'anmald';
  if taken >= cap then
    return;
  end if;

  update registrations set status = 'anmald'
    where id in (
      select id from registrations
        where event_class_id = p_class_id and status = 'vantelista'
        order by created_at, id
        limit cap - taken
    );
end $$;

revoke execute on function promote_waitlist(uuid) from public, anon, authenticated;

-- När ett anmält lag avanmäls frigörs en plats.
create or replace function registrations_after_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'anmald' and new.status <> 'anmald' then
    perform promote_waitlist(new.event_class_id);
  end if;
  return null;
end $$;

drop trigger if exists registrations_promote on registrations;
create trigger registrations_promote
  after update of status on registrations
  for each row execute function registrations_after_status_change();

-- När arrangören höjer max antal lag frigörs platser.
create or replace function event_classes_after_max_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.max_teams > old.max_teams then
    perform promote_waitlist(new.id);
  end if;
  return null;
end $$;

drop trigger if exists event_classes_promote on event_classes;
create trigger event_classes_promote
  after update of max_teams on event_classes
  for each row execute function event_classes_after_max_change();

-- 3. Avanmälan. Den egna föreningen kan avanmäla fram till sista dag,
--    arrangörens föreningsadmin när som helst.
create or replace function cancel_registration(p_registration_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r registrations%rowtype;
  ev events%rowtype;
  is_organizer boolean;
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  select * into r from registrations where id = p_registration_id for update;
  if r.id is null then
    raise exception 'Anmälan hittades inte.';
  end if;

  select e.* into ev
    from events e join event_classes c on c.event_id = e.id
    where c.id = r.event_class_id;
  is_organizer := ev.organizer_org_id = my_org() and is_my_org_admin();

  if not (r.organization_id = my_org() or is_organizer) then
    raise exception 'Du har inte behörighet att avanmäla laget.';
  end if;
  if r.status = 'avanmald' then
    return;
  end if;
  if not is_organizer and today > coalesce(ev.registration_deadline, ev.event_date) then
    raise exception 'Sista dag för avanmälan har passerat. Kontakta arrangören.';
  end if;

  update registrations set status = 'avanmald' where id = r.id;
end $$;

revoke execute on function cancel_registration(uuid) from public, anon;
grant execute on function cancel_registration(uuid) to authenticated;

-- 4. Inga direkta ändringar av anmälningar. Policyn registrations_update i
--    SPEC.md lät en förening själv ändra status från väntelista till anmäld.
--    Avanmälan går i stället via cancel_registration.
revoke update on registrations from anon, authenticated;
