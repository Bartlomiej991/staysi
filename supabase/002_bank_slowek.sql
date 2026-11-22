-- STAYSI: rozbudowa banku słówek (karta słówka i powtórki jak w fiszkach).
-- Uruchom raz w Supabase: SQL Editor -> New query -> wklej całość -> Run.
alter table public.bank
  add column if not exists pron text not null default '',
  add column if not exists ex text not null default '',
  add column if not exists ex_pl text not null default '',
  add column if not exists tip text not null default '',
  add column if not exists fam jsonb,
  add column if not exists introduced boolean not null default true;

-- Słówka dodane ręcznie mają introduced = false, dopóki nie przejdziesz ich w lekcji słówek.
create index if not exists bank_new_idx on public.bank (user_id, lang, introduced);
