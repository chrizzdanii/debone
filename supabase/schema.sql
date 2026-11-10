-- DEBONE database set-up for Supabase. Run this once: Supabase dashboard > SQL Editor > New query > paste > Run.

-- All site data (users, payments, courses, chat and so on) is stored here, one row per record.
create table if not exists public.docs (
  seq        bigint generated always as identity,
  coll       text not null,                       -- which list the record belongs to, e.g. 'users'
  id         text not null,                       -- the record's id
  data       jsonb,                               -- the record itself
  deleted    boolean not null default false,      -- removed records stay as a marker so other servers learn about it
  updated_at timestamptz not null default clock_timestamp(),
  primary key (coll, id)
);
create index if not exists docs_updated_idx on public.docs (updated_at);
create index if not exists docs_seq_idx on public.docs (seq);

create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

-- Lock the table: only the server (using the service-role key) can read or write it. Nobody can reach it from a browser.
alter table public.docs enable row level security;

-- Private file storage for payment receipts and backups.
insert into storage.buckets (id, name, public)
values ('debone', 'debone', false)
on conflict (id) do nothing;
