-- STAYSI: schemat bazy danych dla Supabase
-- Uruchom raz w Supabase: SQL Editor -> New query -> wklej całość -> Run.
-- Każda tabela ma RLS: zalogowany użytkownik widzi i zmienia tylko swoje wiersze.

-- Profil ucznia (karta ucznia)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  name_vocative text not null default '',
  native text not null default 'pl',
  job text not null default '',
  city text not null default '',
  about text not null default '',
  interests text[] not null default '{}',
  goal text not null default '',
  budget_usd numeric(8,2) not null default 5,
  remind boolean not null default true,
  remind_at text not null default '19:00',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Języki ucznia, poziom (skala 10-90) i postęp
create table if not exists public.user_languages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null,
  score int not null default 22 check (score between 10 and 90),
  lessons_done int not null default 0,
  difficulty_shift int not null default 0 check (difficulty_shift between -3 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, lang)
);

-- Bank zwrotów (i Skarbiec na poziomie C)
create table if not exists public.bank (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null,
  chunk text not null,
  meaning text not null default '',
  context text not null default '',
  strength int not null default 0 check (strength between 0 and 5),
  due date not null default (current_date + 1),
  created_at timestamptz not null default now(),
  unique (user_id, lang, chunk)
);
create index if not exists bank_due_idx on public.bank (user_id, lang, due);

-- Lekcje (treść wygenerowana przez Claude i wynik)
create table if not exists public.lessons (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null,
  minutes int not null,
  content jsonb not null,
  barometer text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lessons_user_idx on public.lessons (user_id, created_at desc);

-- Typowe błędy ucznia (trafiają do karty ucznia)
create table if not exists public.mistakes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null,
  note text not null,
  created_at timestamptz not null default now()
);

-- Zużycie Claude i koszty. Zapisuje tylko serwer.
create table if not exists public.usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  purpose text not null,
  lang text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_user_idx on public.usage (user_id, created_at desc);

-- RLS
alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.bank enable row level security;
alter table public.lessons enable row level security;
alter table public.mistakes enable row level security;
alter table public.usage enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own languages" on public.user_languages;
create policy "own languages" on public.user_languages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own bank" on public.bank;
create policy "own bank" on public.bank for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own lessons" on public.lessons;
create policy "own lessons" on public.lessons for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own mistakes" on public.mistakes;
create policy "own mistakes" on public.mistakes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Koszty: użytkownik może je tylko czytać
drop policy if exists "read own usage" on public.usage;
create policy "read own usage" on public.usage for select to authenticated
  using (user_id = auth.uid());

-- Dostęp przez API tylko dla zalogowanych, tabela po tabeli
grant select, insert, update, delete on public.profiles, public.user_languages, public.bank, public.lessons, public.mistakes to authenticated;
grant select on public.usage to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on public.profiles, public.user_languages, public.bank, public.lessons, public.mistakes, public.usage to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Pusty profil zakłada się sam przy rejestracji
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.bank
  add column if not exists pron text not null default '',
  add column if not exists ex text not null default '',
  add column if not exists ex_pl text not null default '',
  add column if not exists tip text not null default '',
  add column if not exists fam jsonb,
  add column if not exists introduced boolean not null default true;

-- Słówka dodane ręcznie mają introduced = false, dopóki nie przejdziesz ich w lekcji słówek.
create index if not exists bank_new_idx on public.bank (user_id, lang, introduced);

-- Moja gramatyka (to samo co 003_gramatyka.sql)
create table if not exists public.grammar (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null,
  title text not null,
  category text not null default 'other',
  rule text not null default '',
  examples jsonb not null default '[]'::jsonb,
  seen int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lang, title)
);
alter table public.grammar enable row level security;
drop policy if exists "own grammar" on public.grammar;
create policy "own grammar" on public.grammar for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.grammar to authenticated;
grant all on public.grammar to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Mapa tematów (to samo co 004_tematy.sql)
alter table public.lessons
  add column if not exists topic text,
  add column if not exists estimate int;
create index if not exists lessons_rated_idx on public.lessons (user_id, lang, completed_at) where estimate is not null;

-- Uwagi dla Claude'a (to samo co 005_uwagi.sql)
alter table public.profiles add column if not exists style_notes text not null default '';
