-- Panou de admin ("god mode") pentru cei 2 founderi — statistici, raportări,
-- management useri/evenimente, direct din aplicație, fără să intre în
-- Supabase Dashboard de fiecare dată.
--
-- IMPORTANT: lista de emailuri de mai jos e SINGURUL loc care contează pentru
-- securitate — orice ascundere de buton în UI e doar cosmetică, funcțiile de
-- mai jos verifică ele însele apelantul (is_admin()), deci chiar dacă cineva
-- ar apela direct RPC-urile, tot e blocat dacă nu e pe listă.
--
-- Dacă vreodată se schimbă emailul de login al vreunuia dintre voi, sau se
-- adaugă cineva nou în echipă, actualizează array-ul din is_admin() de mai
-- jos și rulează din nou funcția (create or replace).

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = any(array[
    'rchiceanu@gmail.com',
    'ivictorcebuc@gmail.com'
  ]);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Raportările nu aveau până acum niciun status — orice raport rămânea
-- "deschis" la infinit, fără urmă că a fost văzut/rezolvat.
alter table public.reports add column if not exists resolved boolean not null default false;
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolved_by uuid references auth.users(id);

create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'total_events', (select count(*) from public.posted_events),
    'active_events', (select count(*) from public.posted_events where archived = false),
    'archived_events', (select count(*) from public.posted_events where archived = true),
    'official_events', (select count(*) from public.posted_events where verified = true),
    'total_reports', (select count(*) from public.reports),
    'unresolved_reports', (select count(*) from public.reports where resolved = false),
    'total_likes', (select count(*) from public.likes),
    'total_attendances', (select count(*) from public.attendances),
    'total_comments', (select count(*) from public.comments),
    'total_checkins', (select count(*) from public.event_checkins),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as day, count(*) as cnt
        from auth.users
        where created_at > now() - interval '14 days'
        group by 1
      ) s
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_stats() from public;
grant execute on function public.admin_get_stats() to authenticated;

create or replace function public.admin_list_reports(unresolved_only boolean default true)
returns table (
  id uuid,
  reason text,
  details text,
  created_at timestamptz,
  resolved boolean,
  reporter_email text,
  event_id text,
  event_title text,
  event_venue text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    r.id, r.reason, r.details, r.created_at, r.resolved,
    u.email as reporter_email,
    r.event_id,
    pe.title as event_title,
    el.venue as event_venue
  from public.reports r
  left join auth.users u on u.id = r.reporter_id
  left join public.posted_events pe
    on r.event_id ~ '^posted_[0-9a-fA-F-]{36}$' and pe.id = substring(r.event_id from 8)::uuid
  left join public.event_locations el on el.event_id = pe.id
  where (not unresolved_only or r.resolved = false)
  order by r.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_list_reports(boolean) from public;
grant execute on function public.admin_list_reports(boolean) to authenticated;

create or replace function public.admin_resolve_report(report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.reports
  set resolved = true, resolved_at = now(), resolved_by = auth.uid()
  where id = report_id;
end;
$$;

revoke all on function public.admin_resolve_report(uuid) from public;
grant execute on function public.admin_resolve_report(uuid) to authenticated;

create or replace function public.admin_list_events(search text default null, limit_n int default 60)
returns table (
  id uuid,
  title text,
  type text,
  event_date timestamptz,
  venue text,
  verified boolean,
  archived boolean,
  created_at timestamptz,
  organizer_email text,
  reports_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    pe.id, pe.title, pe.type, pe.event_date, el.venue, pe.verified, pe.archived, pe.created_at,
    u.email as organizer_email,
    (select count(*) from public.reports r where r.event_id = 'posted_' || pe.id::text) as reports_count
  from public.posted_events pe
  left join public.event_locations el on el.event_id = pe.id
  left join auth.users u on u.id = pe.user_id
  where search is null or search = '' or pe.title ilike '%' || search || '%' or u.email ilike '%' || search || '%'
  order by pe.created_at desc
  limit limit_n;
end;
$$;

revoke all on function public.admin_list_events(text, int) from public;
grant execute on function public.admin_list_events(text, int) to authenticated;

create or replace function public.admin_delete_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.posted_events where id = target_event_id;
end;
$$;

revoke all on function public.admin_delete_event(uuid) from public;
grant execute on function public.admin_delete_event(uuid) to authenticated;

create or replace function public.admin_list_users(search text default null, limit_n int default 60)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  banned_until timestamptz,
  nume text,
  prenume text,
  avatar_url text,
  events_count bigint,
  reports_against_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id, u.email, u.created_at, u.banned_until,
    p.nume, p.prenume, p.avatar_url,
    (select count(*) from public.posted_events pe where pe.user_id = u.id) as events_count,
    (select count(*) from public.reports r
       join public.posted_events pe2
         on r.event_id ~ '^posted_[0-9a-fA-F-]{36}$' and pe2.id = substring(r.event_id from 8)::uuid
       where pe2.user_id = u.id) as reports_against_count
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where search is null or search = '' or u.email ilike '%' || search || '%' or p.nume ilike '%' || search || '%' or p.prenume ilike '%' || search || '%'
  order by u.created_at desc
  limit limit_n;
end;
$$;

revoke all on function public.admin_list_users(text, int) from public;
grant execute on function public.admin_list_users(text, int) to authenticated;

commit;

notify pgrst, 'reload schema';
