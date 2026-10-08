-- Arrangören flyttar lag mellan klasser i sitt sammandrag.
-- Kör i Supabase → SQL Editor, efter 20261006000000_schedule.sql
-- (använder is_event_organizer).
--
-- Föreningar får inte uppdatera anmälningar direkt (se
-- 20261005010000_registration_rules.sql), så flytten görs här.

create or replace function move_registration(
  p_registration_id uuid,
  p_class_id uuid,
  p_status text,
  p_team_name text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  r registrations%rowtype;
  old_class event_classes%rowtype;
  new_class event_classes%rowtype;
  taken int;
begin
  select * into r from registrations where id = p_registration_id for update;
  if r.id is null then
    raise exception 'Anmälan hittades inte.';
  end if;
  if r.status = 'avanmald' then
    raise exception 'Laget är avanmält och kan inte flyttas.';
  end if;
  if p_status not in ('anmald', 'vantelista') then
    raise exception 'Ogiltig status.';
  end if;

  select * into old_class from event_classes where id = r.event_class_id for update;
  if not is_event_organizer(old_class.event_id) then
    raise exception 'Bara arrangören kan flytta lag.';
  end if;
  select * into new_class from event_classes where id = p_class_id for update;
  if new_class.id is null or new_class.event_id <> old_class.event_id then
    raise exception 'Klassen finns inte i sammandraget.';
  end if;

  if p_status = 'anmald'
     and not (r.event_class_id = p_class_id and r.status = 'anmald') then
    select count(*) into taken from registrations
      where event_class_id = p_class_id and status = 'anmald' and id <> r.id;
    if taken >= new_class.max_teams then
      raise exception 'Klassen är full (% av % platser). Höj max antal lag eller lägg laget på väntelistan.',
        taken, new_class.max_teams;
    end if;
  end if;

  update registrations set
    event_class_id = p_class_id,
    status = p_status,
    team_name = coalesce(nullif(trim(p_team_name), ''), team_name),
    -- Till en väntelista: sist i kön, så att ingen som redan väntar förbigås.
    created_at = case
      when p_status = 'vantelista'
        and not (r.event_class_id = p_class_id and r.status = 'vantelista')
      then now() else created_at end
  where id = r.id;

  -- Lediga platser fylls från väntelistorna, i båda klasserna.
  perform promote_waitlist(r.event_class_id);
  if p_class_id <> r.event_class_id then
    perform promote_waitlist(p_class_id);
  end if;

  select status into p_status from registrations where id = r.id;
  return p_status;
end $$;

revoke execute on function move_registration(uuid, uuid, text, text) from public, anon;
grant execute on function move_registration(uuid, uuid, text, text) to authenticated;
