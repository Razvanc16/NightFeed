-- Hostul poate alege un "vibe" pentru eveniment (cu alcool, fără alcool,
-- muzică, chill, mâncare, gaming) — afișat ca iconiță pe hartă, în loc de
-- pinul generic, ca oricine să-și dea seama dintr-o privire ce fel de
-- petrecere e acolo. Opțional — null = rămâne iconița generică de tip.

begin;

alter table public.posted_events
  add column if not exists vibe text;

drop view if exists public.posted_events_feed;

create view public.posted_events_feed
with (security_invoker = true)
as
select
  pe.id, pe.user_id, pe.title, pe.type, pe.date, pe.event_date, pe.price,
  pe.age_restricted, pe.description, pe.tags, pe.ticket_link, pe.cover_url,
  pe.verified, pe.created_at, pe.code, pe.lat_approx, pe.lng_approx, pe.archived,
  pe.location_visible, pe.vibe,
  el.venue, el.lat, el.lng
from public.posted_events pe
left join public.event_locations el on el.event_id = pe.id;

grant select on public.posted_events_feed to anon, authenticated;

commit;

notify pgrst, 'reload schema';
