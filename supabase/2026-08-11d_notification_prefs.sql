-- Preferințe de notificare per tip (like, comentariu, cerere participare,
-- urmăritor nou), stocate pe profilul userului. RLS-ul existent pe profiles
-- (select all / update own) acoperă și aceste coloane — nu e nevoie de politici noi.
-- Edge Function-ul send-push le citește cu service role (ocolește RLS oricum).

begin;

alter table public.profiles
  add column if not exists notif_likes boolean not null default true,
  add column if not exists notif_comments boolean not null default true,
  add column if not exists notif_requests boolean not null default true,
  add column if not exists notif_followers boolean not null default true;

-- Lipsea o politică de DELETE pe attendance_requests — requester-ul nu putea
-- anula o cerere trimisă (nici accept/refuz din partea hostului nu foloseau
-- delete, deci nimeni n-a avut nevoie de asta până acum).
drop policy if exists "requests_delete_own" on public.attendance_requests;
create policy "requests_delete_own" on public.attendance_requests
for delete using (auth.uid() = requester_id);

commit;
