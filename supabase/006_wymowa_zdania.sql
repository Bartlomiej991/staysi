-- STAYSI: wymowa całego przykładowego zdania przy słówku. Uruchom raz w Supabase -> SQL Editor -> Run.
alter table public.bank add column if not exists ex_pron text not null default '';
