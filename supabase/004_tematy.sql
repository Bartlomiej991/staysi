-- STAYSI: mapa tematów i awans z kilku lekcji. Uruchom raz w Supabase -> SQL Editor -> Run.
alter table public.lessons
  add column if not exists topic text,
  add column if not exists estimate int;
create index if not exists lessons_rated_idx on public.lessons (user_id, lang, completed_at) where estimate is not null;
