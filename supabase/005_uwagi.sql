-- STAYSI: Twoje uwagi dla Claude'a (dołączane do każdej lekcji). Uruchom raz w Supabase -> SQL Editor -> Run.
alter table public.profiles add column if not exists style_notes text not null default '';
