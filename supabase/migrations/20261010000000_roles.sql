-- Behörighetsnivåer: LagAdmin, FöreningsAdmin och SuperAdmin.
-- Kör i Supabase → SQL Editor, efter 20261009000000_move_registration.sql.
--
-- * lagadmin       Grundnivån vid registrering. Anmäler lag och domare för sin
--                  förening, men skapar inga sammandrag.
-- * foreningsadmin Arrangerar sammandrag (som dagens is_org_admin) och hanterar
--                  medlemmarna i sin förening.
-- * superadmin     Kan allt: alla föreningar, sammandrag, användare och nivåer.
--
-- Rollen ersätter profiles.is_org_admin och profiles.is_site_admin. Funktionerna
-- is_my_org_admin() och is_site_admin() finns kvar (nu beräknade från rollen),
-- så alla befintliga RLS-policyer gäller som förut.

-- 1. Roll på profilen. Dagens flaggor flyttas över.
alter table profiles
  add column if not exists role text not null default 'lagadmin'
    check (role in ('lagadmin', 'foreningsadmin', 'superadmin'));

update profiles set role = case
  when is_site_admin then 'superadmin'
  when is_org_admin then 'foreningsadmin'
  else 'lagadmin'
end
where role = 'lagadmin';

create or replace function is_site_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from profiles where id = auth.uid()), false)
$$;

create or replace function is_my_org_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('foreningsadmin', 'superadmin') from profiles where id = auth.uid()),
    false
  )
$$;

alter table profiles drop column if exists is_org_admin;
alter table profiles drop column if exists is_site_admin;

-- Användare ändrar aldrig roll eller förening själva (bara full_name, se SPEC.md).
revoke update on profiles from authenticated;
grant update (full_name) on profiles to authenticated;

-- 2. Den som skapar en förening blir FöreningsAdmin (en SuperAdmin behåller sin nivå).
create or replace function create_organization(
  p_name text, p_city text, p_contact_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  if my_org() is not null then
    raise exception 'Du tillhör redan en förening';
  end if;

  insert into organizations (name, city, contact_email)
  values (p_name, p_city, p_contact_email)
  returning id into new_org;

  update profiles
    set organization_id = new_org,
        role = case when role = 'superadmin' then role else 'foreningsadmin' end
    where id = auth.uid();

  return new_org;
end $$;

-- 3. SuperAdmin kan allt. Policyer läggs till (de gamla gäller fortfarande).
create policy "events_superadmin_all" on events
  for all using (is_site_admin()) with check (is_site_admin());
create policy "classes_superadmin_all" on event_classes
  for all using (is_site_admin()) with check (is_site_admin());
create policy "registrations_superadmin_read" on registrations
  for select using (is_site_admin());

-- Schema, domare och flytt av lag går via is_event_organizer.
create or replace function is_event_organizer(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_site_admin() or (is_my_org_admin() and exists (
    select 1 from events where id = p_event_id and organizer_org_id = my_org()
  ))
$$;

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
    and (e.status in ('publicerad', 'avbokad') or e.organizer_org_id = my_org() or is_site_admin())
  group by c.id
$$;

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
  is_organizer := is_site_admin()
    or (ev.organizer_org_id = my_org() and is_my_org_admin());

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

-- 4. Förfrågningar om att ansluta till en förening. Ingen direkt skrivning:
--    allt går via funktionerna nedan.
create table if not exists membership_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'vantar'
    check (status in ('vantar', 'godkand', 'avslagen')),
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Högst en väntande förfrågan per användare.
create unique index if not exists membership_requests_one_pending
  on membership_requests (user_id) where status = 'vantar';

alter table membership_requests enable row level security;
revoke insert, update, delete on membership_requests from anon, authenticated;

create policy "membership_requests_read" on membership_requests for select using (
  user_id = auth.uid()
  or is_site_admin()
  or (organization_id = my_org() and is_my_org_admin())
);

create or replace function request_membership(p_org uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad.';
  end if;
  if my_org() is not null then
    raise exception 'Du tillhör redan en förening.';
  end if;
  if not exists (select 1 from organizations where id = p_org and status = 'godkand') then
    raise exception 'Föreningen finns inte eller är inte godkänd.';
  end if;
  if exists (select 1 from membership_requests where user_id = auth.uid() and status = 'vantar') then
    raise exception 'Du har redan en väntande förfrågan.';
  end if;

  insert into membership_requests (user_id, organization_id)
  values (auth.uid(), p_org)
  returning id into new_id;
  return new_id;
end $$;

create or replace function cancel_membership_request() returns void
language sql security definer set search_path = public as $$
  delete from membership_requests where user_id = auth.uid() and status = 'vantar'
$$;

-- FöreningsAdmin godkänner eller avslår anslutning till sin egen förening,
-- SuperAdmin till vilken förening som helst.
create or replace function decide_membership(p_request uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  req membership_requests%rowtype;
begin
  select * into req from membership_requests where id = p_request for update;
  if req.id is null or req.status <> 'vantar' then
    raise exception 'Förfrågan finns inte eller är redan besvarad.';
  end if;
  if not (is_site_admin() or (is_my_org_admin() and my_org() = req.organization_id)) then
    raise exception 'Du har inte behörighet att besvara förfrågan.';
  end if;

  if p_approve then
    if exists (select 1 from profiles where id = req.user_id and organization_id is not null) then
      raise exception 'Användaren tillhör redan en förening.';
    end if;
    update profiles set organization_id = req.organization_id where id = req.user_id;
  end if;

  update membership_requests
    set status = case when p_approve then 'godkand' else 'avslagen' end,
        decided_by = auth.uid()
    where id = req.id;
end $$;

-- 5. Nivåer och föreningstillhörighet.
create or replace function set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  target profiles%rowtype;
begin
  if p_role not in ('lagadmin', 'foreningsadmin', 'superadmin') then
    raise exception 'Ogiltig behörighetsnivå.';
  end if;
  if p_user = auth.uid() then
    raise exception 'Du kan inte ändra din egen behörighet.';
  end if;

  select * into target from profiles where id = p_user;
  if target.id is null then
    raise exception 'Användaren hittades inte.';
  end if;

  if is_site_admin() then
    null;
  elsif is_my_org_admin()
        and target.organization_id = my_org()
        and target.role <> 'superadmin'
        and p_role <> 'superadmin' then
    null;
  else
    raise exception 'Du har inte behörighet att ändra användarens nivå.';
  end if;

  if p_role = 'foreningsadmin' and target.organization_id is null then
    raise exception 'Koppla användaren till en förening först.';
  end if;

  update profiles set role = p_role where id = p_user;
end $$;

-- Bara SuperAdmin. p_org = null tar bort kopplingen (och en FöreningsAdmin blir LagAdmin).
create or replace function set_user_org(p_user uuid, p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_admin() then
    raise exception 'Bara SuperAdmin kan koppla användare till föreningar.';
  end if;
  if p_org is not null and not exists (select 1 from organizations where id = p_org) then
    raise exception 'Föreningen hittades inte.';
  end if;

  update profiles
    set organization_id = p_org,
        role = case when p_org is null and role = 'foreningsadmin' then 'lagadmin' else role end
    where id = p_user;
  if not found then
    raise exception 'Användaren hittades inte.';
  end if;
end $$;

-- 6. Listor med e-post (finns bara i auth.users). SuperAdmin ser alla,
--    FöreningsAdmin sin egen förenings medlemmar.
create or replace function list_users()
returns table (
  id uuid, email text, full_name text, role text,
  organization_id uuid, organization_name text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text, p.full_name, p.role,
         p.organization_id, o.name, p.created_at
  from profiles p
  join auth.users u on u.id = p.id
  left join organizations o on o.id = p.organization_id
  where is_site_admin()
     or (is_my_org_admin() and p.organization_id = my_org())
  order by p.created_at
$$;

create or replace function list_membership_requests()
returns table (
  id uuid, user_id uuid, email text, full_name text,
  organization_id uuid, organization_name text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, u.email::text, p.full_name,
         m.organization_id, o.name, m.created_at
  from membership_requests m
  join auth.users u on u.id = m.user_id
  join profiles p on p.id = m.user_id
  join organizations o on o.id = m.organization_id
  where m.status = 'vantar'
    and (is_site_admin() or (is_my_org_admin() and m.organization_id = my_org()))
  order by m.created_at
$$;

revoke execute on function
  request_membership(uuid), cancel_membership_request(),
  decide_membership(uuid, boolean), set_user_role(uuid, text),
  set_user_org(uuid, uuid), list_users(), list_membership_requests()
  from public, anon;
grant execute on function
  request_membership(uuid), cancel_membership_request(),
  decide_membership(uuid, boolean), set_user_role(uuid, text),
  set_user_org(uuid, uuid), list_users(), list_membership_requests()
  to authenticated;
