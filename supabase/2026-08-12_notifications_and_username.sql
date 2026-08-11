-- 1) Notificări persistente (istoric în aplicație, nu doar push efemer).
-- notifyUser() din client scrie aici în paralel cu push-ul — un singur loc,
-- deci toate declanșatoarele existente (like, comentariu, cerere, follower)
-- populează automat lista fără să mai umblăm la fiecare punct de apel.
--
-- Aceeași observație ca la send-push: oricine autentificat poate insera o
-- notificare pentru orice alt user (nu doar pentru relații reale) — model de
-- încredere identic cu cel deja acceptat pentru push, nu o gaură nouă.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated" on public.notifications
for insert with check (auth.uid() is not null);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update using (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
for delete using (auth.uid() = user_id);

-- 2) Schimbare username, cu cooldown de 30 de zile — usernames nu avea până
-- acum nicio politică de UPDATE (doar select/delete), deci userul nu putea
-- să-și schimbe username-ul din aplicație, doar la înregistrare.
alter table public.usernames
  add column if not exists updated_at timestamptz not null default now();

-- Cooldown-ul chiar impus la nivel de bază de date (nu doar UI): poți face
-- UPDATE doar dacă rândul curent (dinainte de update) are updated_at de cel
-- puțin 30 de zile — altfel un apel direct la API ar putea ocoli verificarea
-- din client.
drop policy if exists "usernames_update_own" on public.usernames;
create policy "usernames_update_own" on public.usernames
for update
using (auth.uid() = user_id and updated_at <= now() - interval '30 days')
with check (auth.uid() = user_id);

commit;
