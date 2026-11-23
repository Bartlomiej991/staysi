-- STAYSI: zapisywanie lekcji w trakcie + minuty filmów (kalendarz, prognoza).
-- Uruchom raz w Supabase -> SQL Editor -> Run.

-- 1. Stan niedokończonej lekcji (żeby po wyjściu można ją było dokończyć, także na innym urządzeniu)
alter table public.lessons add column if not exists state jsonb;
-- punkty po lekcji: z nich liczymy Twoje prawdziwe tempo w prognozie
alter table public.lessons add column if not exists score int;

-- 2. Czas nauki poza lekcją: filmy, seriale, podcasty (wpisywane ręcznie)
create table if not exists public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null,
  day date not null,
  kind text not null default 'video',
  minutes int not null check (minutes between 1 and 600),
  title text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_user_day on public.activity (user_id, day desc);
alter table public.activity enable row level security;
drop policy if exists "own activity" on public.activity;
create policy "own activity" on public.activity for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.activity to authenticated;
grant all on public.activity to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
