-- 1) Biletul cu QR (event_checkins) rămâne DOAR pentru evenimentele oficiale
--    (aprobate manual de admin, prin contact@nightfeed.ro). Evenimentele
--    neoficiale (homemade) nu mai primesc bilet QR — în schimb, hostul poate
--    seta un număr maxim de participanți (mai jos), impus la nivel de bază
--    de date, nu doar în UI.
--
-- 2) Nu ștergem tabelul event_checkins — doar oprim crearea de bilete noi
--    pentru evenimente neoficiale, și curățăm biletele deja create pentru
--    ele (nu mai au ce căuta acolo).

begin;

alter table public.posted_events
  add column if not exists max_participants integer;

-- Raza de "fuzzing" a locației aproximative (folosită pe hartă pentru
-- evenimentele cu adresă ascunsă) era 300-500m — prea aproape de locația
-- reală. O mărim la 800-1500m, ca zona arătată să nu mai poată fi legată
-- vizual de clădirea/strada exactă.
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
  dist_m := 800 + (seed % 700)::double precision; -- 800-1500m

  dlat := (dist_m * cos(angle)) / 111320;
  dlng := (dist_m * sin(angle)) / (111320 * cos(new.lat * pi() / 180));

  update public.posted_events
    set lat_approx = new.lat + dlat, lng_approx = new.lng + dlng
    where id = new.event_id;
  return new;
end;
$$;

-- Re-calculăm fuzzing-ul pentru toate locațiile deja existente cu noua rază
-- (altfel doar evenimentele postate de-acum-încolo ar fi mai puțin precise).
update public.event_locations set lat = lat, lng = lng where lat is not null and lng is not null;

-- Bilet la "Particip" direct (evenimente oficiale, sau neoficiale cu adresă
-- publică) — acum verifică type='official' înainte de a crea biletul.
create or replace function public.checkin_create_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.posted_events pe
    where 'posted_' || pe.id::text = new.event_id and pe.type = 'official'
  ) then
    insert into public.event_checkins (event_id, user_id)
    values (new.event_id, new.user_id)
    on conflict (event_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Bilet la acceptarea unei cereri (evenimente neoficiale, prin definiție) —
-- verificarea type='official' e mai mult o plasă de siguranță aici, dar ne
-- ferește dacă vreodată se schimbă fluxul.
create or replace function public.checkin_create_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    if exists (select 1 from public.posted_events pe where pe.id = new.event_id and pe.type = 'official') then
      insert into public.event_checkins (event_id, user_id)
      values ('posted_' || new.event_id::text, new.requester_id)
      on conflict (event_id, user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Curăță biletele deja create pentru evenimente neoficiale (comportamentul vechi).
delete from public.event_checkins ec
using public.posted_events pe
where 'posted_' || pe.id::text = ec.event_id and pe.type <> 'official';

-- Cap de participanți la "Particip" direct (attendances) — doar dacă hostul
-- a setat max_participants; altfel, nelimitat ca înainte.
create or replace function public.enforce_attendance_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  select max_participants into v_max
  from public.posted_events
  where 'posted_' || id::text = new.event_id;

  if v_max is not null then
    select count(*) into v_count from public.attendances where event_id = new.event_id;
    if v_count >= v_max then
      raise exception 'S-a atins numărul maxim de % participanți pentru acest eveniment.', v_max;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_attendance_cap on public.attendances;
create trigger trg_enforce_attendance_cap
  before insert on public.attendances
  for each row execute function public.enforce_attendance_cap();

-- Cap de participanți la acceptarea unei cereri (attendance_requests).
create or replace function public.enforce_request_accept_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select max_participants into v_max from public.posted_events where id = new.event_id;
    if v_max is not null then
      select count(*) into v_count from public.attendance_requests
        where event_id = new.event_id and status = 'accepted';
      if v_count >= v_max then
        raise exception 'S-a atins numărul maxim de % participanți pentru acest eveniment.', v_max;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_request_accept_cap on public.attendance_requests;
create trigger trg_enforce_request_accept_cap
  before update on public.attendance_requests
  for each row execute function public.enforce_request_accept_cap();

-- Re-creăm view-ul ca să includă max_participants (celelalte coloane rămân
-- identice cu ultima versiune, din 2026-08-16b_event_vibe.sql).
drop view if exists public.posted_events_feed;

create view public.posted_events_feed
with (security_invoker = true)
as
select
  pe.id, pe.user_id, pe.title, pe.type, pe.date, pe.event_date, pe.price,
  pe.age_restricted, pe.description, pe.tags, pe.ticket_link, pe.cover_url,
  pe.verified, pe.created_at, pe.code, pe.lat_approx, pe.lng_approx, pe.archived,
  pe.location_visible, pe.vibe, pe.max_participants,
  el.venue, el.lat, el.lng
from public.posted_events pe
left join public.event_locations el on el.event_id = pe.id;

grant select on public.posted_events_feed to anon, authenticated;

commit;

notify pgrst, 'reload schema';
