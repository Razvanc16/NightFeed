-- Până acum, dacă adresa exactă era vizibilă tuturor sau doar aproximativă
-- depindea strict de tip (oficial = mereu exactă, homemade = mereu aproximativă,
-- cu excepția hostului și a celor acceptați). Hostul vrea să poată alege asta
-- independent de tip — de ex. un eveniment neoficial în aer liber unde chiar
-- vrea adresa publică, sau un eveniment oficial unde ar prefera să rămână
-- aproximativă până confirmi participarea.

begin;

alter table public.posted_events
  add column if not exists location_visible boolean not null default false;

-- Păstrăm comportamentul actual pentru rândurile deja existente (oficial =
-- vizibilă, cum era mereu până acum).
update public.posted_events set location_visible = true where type = 'official';

drop view if exists public.posted_events_feed;

create view public.posted_events_feed
with (security_invoker = true)
as
select
  pe.id, pe.user_id, pe.title, pe.type, pe.date, pe.event_date, pe.price,
  pe.age_restricted, pe.description, pe.tags, pe.ticket_link, pe.cover_url,
  pe.verified, pe.created_at, pe.code, pe.lat_approx, pe.lng_approx, pe.archived,
  pe.location_visible,
  el.venue, el.lat, el.lng
from public.posted_events pe
left join public.event_locations el on el.event_id = pe.id;

grant select on public.posted_events_feed to anon, authenticated;

-- Politica de SELECT pe adresa exactă (event_locations) verifica înainte
-- pe.type = 'official' — acum verifică noul flag, controlat de host.
drop policy if exists "location_select_authorized" on public.event_locations;
create policy "location_select_authorized" on public.event_locations
for select using (
  exists (
    select 1 from public.posted_events pe
    where pe.id = event_locations.event_id
      and (pe.location_visible = true or pe.user_id = auth.uid())
  )
  or exists (
    select 1 from public.attendance_requests ar
    where ar.event_id = event_locations.event_id
      and ar.requester_id = auth.uid()
      and ar.status = 'accepted'
  )
);

commit;

notify pgrst, 'reload schema';
