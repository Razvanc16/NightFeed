-- Erori JS raportate din browser (src/utils/errorReporting.js).
-- Oricine (inclusiv vizitatori nelogați) poate doar INSERA; citirea e
-- permisă doar adminilor, din panoul de admin sau din Supabase.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 4000),
  source text check (char_length(source) <= 300),
  url text check (char_length(url) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  user_id uuid,
  app_version text check (char_length(app_version) <= 20)
);

alter table public.client_errors enable row level security;

drop policy if exists "client_errors insert" on public.client_errors;
create policy "client_errors insert" on public.client_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Fără politică de SELECT/UPDATE/DELETE => nimeni nu le poate citi prin API
-- (în afară de service_role / dashboard).

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);
