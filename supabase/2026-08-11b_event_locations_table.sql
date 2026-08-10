-- Revocarea SELECT pe coloane (venue/lat/lng) din posted_events nu s-a aplicat
-- în acest proiect, verificat repetat (owner = postgres, revoke rulat de mai
-- multe ori, information_schema tot arată SELECT pentru anon/authenticated).
-- În loc să mai depindem de asta, mutăm adresa/coordonatele exacte într-un
-- tabel separat protejat prin RLS pe rânduri — mecanism deja verificat
-- funcțional în acest proiect (profiles, posted_events, attendance_requests).

begin;

-- View-ul vechi încă referă pe.venue/pe.lat/pe.lng — trebuie șters înainte să
-- putem scoate acele coloane din posted_events mai jos.
drop view if exists public.posted_events_feed;

create table if not exists public.event_locations (
  event_id uuid primary key references public.posted_events(id) on delete cascade,
  venue text,
  lat double precision,
  lng double precision
);

alter table public.event_locations enable row level security;

drop policy if exists "location_select_authorized" on public.event_locations;
create policy "location_select_authorized" on public.event_locations
for select using (
  exists (
    select 1 from public.posted_events pe
    where pe.id = event_locations.event_id
      and (pe.type = 'official' or pe.user_id = auth.uid())
  )
  or exists (
    select 1 from public.attendance_requests ar
    where ar.event_id = event_locations.event_id
      and ar.requester_id = auth.uid()
      and ar.status = 'accepted'
  )
);

drop policy if exists "location_insert_own" on public.event_locations;
create policy "location_insert_own" on public.event_locations
for insert with check (
  exists (select 1 from public.posted_events pe where pe.id = event_id and pe.user_id = auth.uid())
);

drop policy if exists "location_update_own" on public.event_locations;
create policy "location_update_own" on public.event_locations
for update using (
  exists (select 1 from public.posted_events pe where pe.id = event_id and pe.user_id = auth.uid())
);

drop policy if exists "location_delete_own" on public.event_locations;
create policy "location_delete_own" on public.event_locations
for delete using (
  exists (select 1 from public.posted_events pe where pe.id = event_id and pe.user_id = auth.uid())
);

-- Mută datele existente din posted_events.
insert into public.event_locations (event_id, venue, lat, lng)
select id, venue, lat, lng from public.posted_events
where venue is not null or lat is not null or lng is not null
on conflict (event_id) do nothing;

-- Fuzzing-ul (lat_approx/lng_approx) se mută pe event_locations — sursa reală
-- a coordonatelor acum — și scrie rezultatul înapoi pe posted_events.
drop trigger if exists trg_fuzz_event_location on public.posted_events;

create or replace function public.fuzz_event_location()
returns trigger
language plpgsql
as $$
declare
  seed integer;
  angle double precision;
  dist_m double precision;
  dlat double precision;
  dlng double precision;
begin
  if new.lat is null or new.lng is null then
    update public.posted_events set lat_approx = null, lng_approx = null where id = new.event_id;
    return new;
  end if;

  seed := abs(('x' || substr(md5(new.event_id::text || coalesce(new.lat::text, '') || coalesce(new.lng::text, '')), 1, 8))::bit(32)::int);
  angle := (seed % 360)::double precision * pi() / 180;
  dist_m := 300 + (seed % 200)::double precision; -- 300-500m

  dlat := (dist_m * cos(angle)) / 111320;
  dlng := (dist_m * sin(angle)) / (111320 * cos(new.lat * pi() / 180));

  update public.posted_events
    set lat_approx = new.lat + dlat, lng_approx = new.lng + dlng
    where id = new.event_id;
  return new;
end;
$$;

drop trigger if exists trg_fuzz_event_location_ins on public.event_locations;
create trigger trg_fuzz_event_location_ins
  after insert or update of lat, lng on public.event_locations
  for each row execute function public.fuzz_event_location();

-- Backfill pentru rândurile deja mutate mai sus (forțează trigger-ul de UPDATE).
update public.event_locations set lat = lat where lat is not null;

-- posted_events nu mai ține adresa exactă.
alter table public.posted_events drop column if exists venue;
alter table public.posted_events drop column if exists lat;
alter table public.posted_events drop column if exists lng;

-- View-ul rulează cu drepturile celui care interoghează (security_invoker),
-- deci RLS de pe event_locations se aplică normal, ca la orice query direct —
-- un rând neautorizat pur și simplu lipsește din join, venue/lat/lng ies null.
create view public.posted_events_feed
with (security_invoker = true)
as
select
  pe.id, pe.user_id, pe.title, pe.type, pe.date, pe.event_date, pe.price,
  pe.age_restricted, pe.description, pe.tags, pe.ticket_link, pe.cover_url,
  pe.verified, pe.created_at, pe.code, pe.lat_approx, pe.lng_approx,
  el.venue, el.lat, el.lng
from public.posted_events pe
left join public.event_locations el on el.event_id = pe.id;

grant select on public.posted_events_feed to anon, authenticated;

commit;

notify pgrst, 'reload schema';
