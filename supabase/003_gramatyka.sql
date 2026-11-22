-- STAYSI: "Moja gramatyka". Uruchom raz w Supabase -> SQL Editor -> Run.
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
