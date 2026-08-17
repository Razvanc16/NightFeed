-- Check-in cu QR: fiecare participant confirmat (fie prin "Particip" direct pe
-- evenimente oficiale, fie prin cerere acceptată la cele neoficiale) primește
-- un token unic (nu doar id-ul evenimentului) — scanat de host la intrare.
--
-- Populăm event_checkins prin triggere pe attendances/attendance_requests, nu
-- din client — așa acoperim toate punctele existente unde apare un participant
-- confirmat (EventCard, MapPage, MiniEventCard, RequestsPage) fără să le
-- modificăm pe fiecare, și fără risc ca vreunul să "uite" să creeze biletul.

begin;

create table if not exists public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_checkins_event_id_idx on public.event_checkins (event_id);

alter table public.event_checkins enable row level security;

-- Participantul își vede propriul bilet (ca să-și afișeze codul QR).
drop policy if exists "checkin_select_own" on public.event_checkins;
create policy "checkin_select_own" on public.event_checkins
for select using (user_id = auth.uid());

-- Hostul evenimentului vede toate biletele lui (listă participanți / progres scanare).
drop policy if exists "checkin_select_host" on public.event_checkins;
create policy "checkin_select_host" on public.event_checkins
for select using (
  exists (
    select 1 from public.posted_events pe
    where 'posted_' || pe.id::text = event_checkins.event_id
      and pe.user_id = auth.uid()
  )
);

-- Niciun insert/update/delete direct de la client — totul trece prin
-- triggerele de mai jos (creare bilet) și funcția checkin_scan (marcare
-- scanat), ambele security definer. Fără politici explicite = interzis
-- implicit pentru authenticated pe aceste operații.

-- Creează biletul când cineva participă direct (evenimente oficiale, sau
-- neoficiale fără aprobare).
create or replace function public.checkin_create_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_checkins (event_id, user_id)
  values (new.event_id, new.user_id)
  on conflict (event_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_checkin_from_attendance on public.attendances;
create trigger trg_checkin_from_attendance
  after insert on public.attendances
  for each row execute function public.checkin_create_from_attendance();

-- Revocă biletul dacă userul renunță la participare.
create or replace function public.checkin_revoke_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.event_checkins where event_id = old.event_id and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_checkin_revoke_attendance on public.attendances;
create trigger trg_checkin_revoke_attendance
  after delete on public.attendances
  for each row execute function public.checkin_revoke_from_attendance();

-- Creează biletul când hostul acceptă o cerere de participare (evenimente
-- neoficiale) — security definer fiindcă actorul e hostul (auth.uid() =
-- host_id), nu participantul (new.requester_id) pentru care se creează rândul.
--
-- attendance_requests.event_id ține uuid-ul BRUT (fără prefixul "posted_"),
-- spre deosebire de attendances.event_id — convenție diferită, verificată în
-- JoinRequestSheet.jsx și MapPage.jsx la inserare. Normalizăm aici la formatul
-- comun ("posted_<uuid>"), ca event_checkins să aibă un singur format de id,
-- indiferent din care tabel a apărut biletul.
create or replace function public.checkin_create_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    insert into public.event_checkins (event_id, user_id)
    values ('posted_' || new.event_id::text, new.requester_id)
    on conflict (event_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_checkin_from_request on public.attendance_requests;
create trigger trg_checkin_from_request
  after update on public.attendance_requests
  for each row execute function public.checkin_create_from_request();

-- Scanarea propriu-zisă — apelată de host din scaner cu tokenul citit din QR.
-- Security definer + row lock (for update) ca să fie atomică: două scanări
-- rapide ale aceluiași bilet (ecran instabil, cod scanat de 2 ori) nu pot
-- amândouă "câștiga" statusul de prima intrare.
--
-- p_event_id: scanerul e deschis pentru UN eveniment anume (din panoul
-- hostului) — un bilet valid al hostului dar de la ALT eveniment de-al lui
-- trebuie respins aici, nu doar biletele care nu-i aparțin deloc.
create or replace function public.checkin_scan(p_token uuid, p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_display_name text;
begin
  select ec.*, pe.user_id as host_id, pe.title as event_title
    into v_row
    from public.event_checkins ec
    join public.posted_events pe on 'posted_' || pe.id::text = ec.event_id
    where ec.token = p_token
    for update of ec;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_row.host_id <> auth.uid() or v_row.event_id <> p_event_id then
    return jsonb_build_object('ok', false, 'reason', 'not_host');
  end if;

  if v_row.checked_in then
    return jsonb_build_object(
      'ok', false, 'reason', 'already',
      'checked_in_at', v_row.checked_in_at,
      'event_title', v_row.event_title
    );
  end if;

  update public.event_checkins set checked_in = true, checked_in_at = now() where id = v_row.id;

  select coalesce(nullif(trim(coalesce(p.prenume, '') || ' ' || coalesce(p.nume, '')), ''), 'Participant')
    into v_display_name
    from public.profiles p where p.user_id = v_row.user_id;

  return jsonb_build_object(
    'ok', true, 'name', coalesce(v_display_name, 'Participant'), 'event_title', v_row.event_title
  );
end;
$$;

grant execute on function public.checkin_scan(uuid, text) to authenticated;

commit;

-- Fără asta, participantul nu vede live statusul "Verificat" în Biletele
-- mele când e scanat — doar la un refresh manual al ecranului.
alter publication supabase_realtime add table public.event_checkins;

notify pgrst, 'reload schema';
