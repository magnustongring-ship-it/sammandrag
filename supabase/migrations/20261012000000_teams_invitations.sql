-- Lag, inbjudningar av LagAdmin och separat registrering för domare och föreningar.
-- Kör i Supabase → SQL Editor, efter 20261011000000_referee_accounts.sql.
--
-- * domare         Ny nivå för den som registrerar sig som domare. Har ingen
--                  förening och ser bara sina matcher.
-- * Föreningar har lag (teams). FöreningsAdmin skapar lag och bjuder in
--   lagledare via e-post. Den som tackar ja blir LagAdmin för laget.
-- * LagAdmin anmäler bara sina egna lag. FöreningsAdmin anmäler alla
--   föreningens lag.

-- 1. Nivån domare.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('domare', 'lagadmin', 'foreningsadmin', 'superadmin'));

-- 2. Ny användare. Registreringsformuläret anger kontotyp i metadata:
--    'domare' får nivån domare, 'forening' skapar föreningen direkt (den
--    väntar på godkännande av SuperAdmin) och gör användaren till FöreningsAdmin.
--    Övriga (t.ex. via inbjudan) blir LagAdmin när de tackar ja.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := nullif(trim(meta->>'full_name'), '');
  v_org_name text := nullif(trim(meta->>'org_name'), '');
  new_org uuid;
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    v_full_name,
    case when meta->>'account_type' = 'domare' then 'domare' else 'lagadmin' end
  );

  if meta->>'account_type' = 'forening' and v_org_name is not null then
    insert into organizations (name, city, contact_email)
    values (
      left(v_org_name, 200),
      left(nullif(trim(meta->>'org_city'), ''), 100),
      coalesce(nullif(trim(meta->>'org_contact_email'), ''), new.email)
    )
    returning id into new_org;

    update profiles set organization_id = new_org, role = 'foreningsadmin'
      where id = new.id;
  end if;

  return new;
end $$;

-- 3. Lag i en förening.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create unique index if not exists teams_org_name_unique
  on teams (organization_id, lower(name));

-- LagAdmin för ett lag. Ett lag kan ha flera ledare och en ledare flera lag.
create table if not exists team_admins (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Inbjudan till en lagledare. Länken i mejlet innehåller token.
create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create index if not exists team_invitations_team_idx on team_invitations (team_id);

-- Är den inloggade LagAdmin för laget?
create or replace function is_team_admin(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_admins where team_id = p_team and user_id = auth.uid())
$$;

-- Får den inloggade anmäla laget? FöreningsAdmin alla föreningens lag,
-- LagAdmin sina egna. Föreningen måste vara godkänd.
create or replace function can_register_team(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_my_org_approved() and exists (
    select 1 from teams t
    where t.id = p_team
      and t.organization_id = my_org()
      and (is_my_org_admin() or is_team_admin(t.id))
  )
$$;

-- Är den inloggade FöreningsAdmin i lagets förening (eller SuperAdmin)?
create or replace function is_team_org_admin(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_site_admin() or (is_my_org_admin() and exists (
    select 1 from teams where id = p_team and organization_id = my_org()
  ))
$$;

alter table teams enable row level security;
alter table team_admins enable row level security;
alter table team_invitations enable row level security;

-- Föreningens medlemmar ser lagen, FöreningsAdmin i en godkänd förening hanterar dem.
create policy "teams_read" on teams for select using (
  organization_id = my_org() or is_site_admin()
);
create policy "teams_insert" on teams for insert with check (
  (organization_id = my_org() and is_my_org_admin() and is_my_org_approved())
  or is_site_admin()
);
create policy "teams_update" on teams for update using (
  (organization_id = my_org() and is_my_org_admin()) or is_site_admin()
);
create policy "teams_delete" on teams for delete using (
  (organization_id = my_org() and is_my_org_admin()) or is_site_admin()
);

-- Ledarna läggs till via accept_team_invitation, och tas bort av FöreningsAdmin.
revoke insert, update on team_admins from anon, authenticated;
create policy "team_admins_read" on team_admins for select using (
  user_id = auth.uid()
  or is_site_admin()
  or exists (select 1 from teams t where t.id = team_id and t.organization_id = my_org())
);
create policy "team_admins_delete" on team_admins for delete using (
  is_team_org_admin(team_id)
);

-- Inbjudningar hanteras bara av FöreningsAdmin. Den inbjudna läser sin
-- inbjudan via team_invitation_info (med token).
revoke update on team_invitations from anon, authenticated;
create policy "team_invitations_read" on team_invitations for select using (
  is_team_org_admin(team_id)
);
create policy "team_invitations_insert" on team_invitations for insert with check (
  is_team_org_admin(team_id) and invited_by = auth.uid()
  and (is_site_admin() or is_my_org_approved())
);
create policy "team_invitations_delete" on team_invitations for delete using (
  is_team_org_admin(team_id) and accepted_at is null
);

-- 4. Den inbjudna: läs inbjudan och tacka ja. Token är hemlig och räcker som
--    bevis, så inbjudan kan tas emot med en annan e-postadress än den som
--    mejlet skickades till.
create or replace function team_invitation_info(p_token uuid)
returns table (
  team_name text, organization_id uuid, organization_name text, email text,
  expired boolean, accepted boolean
)
language sql stable security definer set search_path = public as $$
  select t.name, o.id, o.name, i.email, i.expires_at < now(), i.accepted_at is not null
  from team_invitations i
  join teams t on t.id = i.team_id
  join organizations o on o.id = t.organization_id
  where i.token = p_token
$$;

create or replace function accept_team_invitation(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv team_invitations%rowtype;
  team_org uuid;
  me profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Du måste vara inloggad.';
  end if;

  select * into inv from team_invitations where token = p_token for update;
  if inv.id is null then
    raise exception 'Inbjudan finns inte. Den kan ha dragits tillbaka.';
  end if;
  if inv.accepted_at is not null then
    raise exception 'Inbjudan har redan använts.';
  end if;
  if inv.expires_at < now() then
    raise exception 'Inbjudan har gått ut. Be om en ny.';
  end if;

  select organization_id into team_org from teams where id = inv.team_id;
  select * into me from profiles where id = auth.uid() for update;

  if me.organization_id is not null and me.organization_id <> team_org then
    raise exception 'Du tillhör redan en annan förening.';
  end if;

  update profiles
    set organization_id = team_org,
        role = case when role = 'domare' then 'lagadmin' else role end
    where id = auth.uid();

  insert into team_admins (team_id, user_id)
  values (inv.team_id, auth.uid())
  on conflict do nothing;

  update team_invitations
    set accepted_at = now(), accepted_by = auth.uid()
    where id = inv.id;

  -- En gammal förfrågan om att ansluta behövs inte längre.
  delete from membership_requests where user_id = auth.uid() and status = 'vantar';

  return inv.team_id;
end $$;

-- Ledarna för föreningens lag, med e-post (finns bara i auth.users).
create or replace function list_team_admins(p_org uuid)
returns table (team_id uuid, user_id uuid, full_name text, email text)
language sql stable security definer set search_path = public as $$
  select a.team_id, a.user_id, p.full_name, u.email::text
  from team_admins a
  join teams t on t.id = a.team_id
  join profiles p on p.id = a.user_id
  join auth.users u on u.id = a.user_id
  where t.organization_id = p_org
    and (is_site_admin() or (is_my_org_admin() and p_org = my_org()))
  order by p.full_name, u.email
$$;

-- 5. Anmälningar kopplas till ett lag.
alter table registrations
  add column if not exists team_id uuid references teams(id) on delete set null;

create index if not exists registrations_team_idx on registrations (team_id);

-- Samma lag kan inte anmälas två gånger till samma klass.
create unique index if not exists registrations_team_class_unique
  on registrations (event_class_id, team_id)
  where team_id is not null and status <> 'avanmald';

drop policy if exists "registrations_insert" on registrations;
create policy "registrations_insert" on registrations for insert with check (
  organization_id = my_org()
  and registered_by = auth.uid()
  and team_id is not null
  and can_register_team(team_id)
);

-- Avanmälan: FöreningsAdmin alla föreningens lag, LagAdmin sina egna lag
-- (och lag hen själv anmält), arrangören när som helst.
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

  if not (
    is_organizer
    or (r.organization_id = my_org() and (
      is_my_org_admin() or r.registered_by = auth.uid() or is_team_admin(r.team_id)
    ))
  ) then
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

-- 6. Nivåer: domare kan bara sättas av SuperAdmin. Den som kopplas till en
--    förening slutar vara domare och blir LagAdmin.
create or replace function set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  target profiles%rowtype;
begin
  if p_role not in ('domare', 'lagadmin', 'foreningsadmin', 'superadmin') then
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
        and target.role in ('lagadmin', 'foreningsadmin')
        and p_role in ('lagadmin', 'foreningsadmin') then
    null;
  else
    raise exception 'Du har inte behörighet att ändra användarens nivå.';
  end if;

  if p_role = 'foreningsadmin' and target.organization_id is null then
    raise exception 'Koppla användaren till en förening först.';
  end if;
  if p_role = 'domare' and target.organization_id is not null then
    raise exception 'En domare tillhör ingen förening. Ta bort föreningen först.';
  end if;

  update profiles set role = p_role where id = p_user;
end $$;

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
        role = case
          when p_org is null and role = 'foreningsadmin' then 'lagadmin'
          when p_org is not null and role = 'domare' then 'lagadmin'
          else role
        end
    where id = p_user;
  if not found then
    raise exception 'Användaren hittades inte.';
  end if;

  -- Lagen hör till den gamla föreningen.
  delete from team_admins a using teams t
    where a.team_id = t.id and a.user_id = p_user
      and t.organization_id is distinct from p_org;
end $$;

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
    update profiles
      set organization_id = req.organization_id,
          role = case when role = 'domare' then 'lagadmin' else role end
      where id = req.user_id;
  end if;

  update membership_requests
    set status = case when p_approve then 'godkand' else 'avslagen' end,
        decided_by = auth.uid()
    where id = req.id;
end $$;

revoke execute on function
  accept_team_invitation(uuid), list_team_admins(uuid)
  from public, anon;
grant execute on function
  accept_team_invitation(uuid), list_team_admins(uuid)
  to authenticated;
-- Inbjudan visas även för den som inte har något konto än.
grant execute on function team_invitation_info(uuid) to anon, authenticated;
