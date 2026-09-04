-- Vizualizările trebuiau să fie per persoană unică, nu un contor care crește
-- la fiecare trecere prin feed (userul care scrolează în sus/jos peste
-- același eveniment de 5 ori nu înseamnă 5 vizualizări). Înlocuim contorul
-- simplu de pe posted_events cu un tabel de perechi (event, user), unde a
-- doua "vizualizare" a aceluiași user pur și simplu nu se mai inserează
-- (on conflict do nothing) — count(*) pe el = număr de useri unici.

begin;

create table if not exists public.event_views (
  event_id uuid not null references public.posted_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_views_event_id_idx on public.event_views (event_id);

alter table public.event_views enable row level security;

-- Doar hostul evenimentului își vede numărul de vizualizări — la fel ca la
-- event_checkins mai sus, nimeni altcineva n-are treabă cu cifra asta.
drop policy if exists "event_views_select_host" on public.event_views;
create policy "event_views_select_host" on public.event_views
for select using (
  exists (select 1 from public.posted_events pe where pe.id = event_views.event_id and pe.user_id = auth.uid())
);

create or replace function public.increment_event_view(target_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_views (event_id, user_id)
  values (target_event_id, auth.uid())
  on conflict (event_id, user_id) do nothing;
$$;

revoke all on function public.increment_event_view(uuid) from public;
grant execute on function public.increment_event_view(uuid) to authenticated;

alter table public.posted_events drop column if exists view_count;

commit;

notify pgrst, 'reload schema';
