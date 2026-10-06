-- Matchregler per åldersgrupp och klass (Easy Basket).
-- Kör i Supabase → SQL Editor.
--
-- Källa: Svensk Baskets "Easy Basket Regler" 2025-04-11
-- https://www.basket.se/wp-content/uploads/2025/04/Easy-Basket-regler-2025-04-11.pdf
-- Dokumentet anger inte pausens längd, bara att byten sker i periodpausen;
-- 1 minut är en startgissning som går att ändra under /admin.

-- Standardregler per åldersgrupp (används när en klass skapas)
alter table age_groups
  add column if not exists level text,
  add column if not exists game_format text,
  add column if not exists periods int check (periods between 1 and 12),
  add column if not exists period_minutes int check (period_minutes between 1 and 60),
  add column if not exists break_minutes int check (break_minutes between 0 and 30),
  add column if not exists court_note text;

update age_groups set level = 'Blå', game_format = '3-mot-3', periods = 6,
  period_minutes = 4, break_minutes = 1, court_note = 'På tvären, sidlinje till sidlinje'
  where name in ('U8', 'U9');
update age_groups set level = 'Blå', game_format = '4-mot-4', periods = 6,
  period_minutes = 4, break_minutes = 1, court_note = 'På tvären, sidlinje till sidlinje'
  where name = 'U10';
update age_groups set level = 'Orange', game_format = '4-mot-4', periods = 8,
  period_minutes = 4, break_minutes = 1, court_note = 'På tvären eller i en mindre hall'
  where name = 'U11';
update age_groups set level = 'Lila', game_format = '4-mot-4', periods = 8,
  period_minutes = 4, break_minutes = 1, court_note = 'Fullstor plan'
  where name = 'U12';

-- Matchregler per klass i ett sammandrag (förifylls från åldersgruppen,
-- arrangören kan ändra). Tomt = spelschemats gemensamma inställningar gäller.
alter table event_classes
  add column if not exists game_format text,
  add column if not exists periods int check (periods between 1 and 12),
  add column if not exists period_minutes int check (period_minutes between 1 and 60),
  add column if not exists break_minutes int check (break_minutes between 0 and 30);

-- Spelschemat ska klara 8 perioder + egna inställningar upp till 12.
alter table event_schedules drop constraint if exists event_schedules_periods_check;
alter table event_schedules add constraint event_schedules_periods_check
  check (periods between 1 and 12);
