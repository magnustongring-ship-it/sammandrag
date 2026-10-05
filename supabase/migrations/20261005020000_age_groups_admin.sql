-- Sajtadmin får hantera åldersgrupper (SPEC.md avsnitt 5 och 9: /admin).
-- Kör i Supabase → SQL Editor.
--
-- En åldersgrupp som används av en klass kan inte tas bort
-- (event_classes.age_group_id har en främmande nyckel), men den kan döpas om.

create policy "age_groups_site_admin_insert" on age_groups
  for insert with check (is_site_admin());
create policy "age_groups_site_admin_update" on age_groups
  for update using (is_site_admin());
create policy "age_groups_site_admin_delete" on age_groups
  for delete using (is_site_admin());
