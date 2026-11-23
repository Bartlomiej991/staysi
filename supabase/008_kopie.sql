-- STAYSI: kopie bezpieczeństwa robione tuż przed przywróceniem danych (żeby dało się to cofnąć).
-- Dane są zaszyfrowane hasłem BACKUP_PASSWORD. Dostęp ma tylko serwer (brak uprawnień dla aplikacji).
-- Uruchom raz w Supabase -> SQL Editor -> Run.
create table if not exists public.snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  size int not null default 0,
  data text not null,
  created_at timestamptz not null default now()
);
alter table public.snapshots enable row level security;
revoke all on public.snapshots from anon, authenticated;
grant all on public.snapshots to service_role;
grant usage, select on all sequences in schema public to service_role;
