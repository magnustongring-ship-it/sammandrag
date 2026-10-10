-- Domarsidorna visas bara för domare.
-- Kör i Supabase → SQL Editor, efter 20261012000000_teams_invitations.sql.
-- Kan köras flera gånger.
--
-- Att vara domare är skilt från nivån (role), så att t.ex. en FöreningsAdmin
-- också kan vara domare med samma konto. Domare är den som
--   * registrerat sig som domare (eller lagt till domarsidorna på sitt konto), eller
--   * anmält intresse att döma med kontots bekräftade e-postadress.

alter table profiles add column if not exists is_referee boolean not null default false;
update profiles set is_referee = true where role = 'domare' and not is_referee;

-- Ny användare: som i 20261012000000, men domare markeras också med is_referee.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := nullif(trim(meta->>'full_name'), '');
  v_org_name text := nullif(trim(meta->>'org_name'), '');
  new_org uuid;
begin
  insert into profiles (id, full_name, role, is_referee)
  values (
    new.id,
    v_full_name,
    case when meta->>'account_type' = 'domare' then 'domare' else 'lagadmin' end,
    meta->>'account_type' = 'domare'
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

-- Är den inloggade domare?
create or replace function am_i_referee()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_referee from profiles where id = auth.uid()), false)
    or exists (
      select 1 from referee_applications ra
      where lower(ra.email) = (
        select lower(u.email) from auth.users u
        where u.id = auth.uid() and u.email_confirmed_at is not null
      )
    )
$$;

-- Lägger till domarsidorna på den inloggades konto.
create or replace function become_referee()
returns void
language sql security definer set search_path = public as $$
  update profiles set is_referee = true where id = auth.uid()
$$;

revoke execute on function am_i_referee(), become_referee() from public, anon;
grant execute on function am_i_referee(), become_referee() to authenticated;
