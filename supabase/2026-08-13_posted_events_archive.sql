-- "Șterge" pe un eveniment postat era ștergere definitivă instant — fără cale
-- de întoarcere dacă apeși din greșeală. Devine arhivare: rândul rămâne în
-- bază (archived = true), dispare din feed/căutare/hartă, dar rămâne
-- accesibil (și ștergibil definitiv) din Profil → Postate → Arhivă.

begin;

alter table public.posted_events
  add column if not exists archived boolean not null default false;

drop view if exists public.posted_events_feed;

create view public.posted_events_feed
with (security_invoker = true)
as
select
  pe.id, pe.user_id, pe.title, pe.type, pe.date, pe.event_date, pe.price,
  pe.age_restricted, pe.description, pe.tags, pe.ticket_link, pe.cover_url,
  pe.verified, pe.created_at, pe.code, pe.lat_approx, pe.lng_approx, pe.archived,
  el.venue, el.lat, el.lng
from public.posted_events pe
left join public.event_locations el on el.event_id = pe.id;

grant select on public.posted_events_feed to anon, authenticated;

commit;

notify pgrst, 'reload schema';
