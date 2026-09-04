-- Fix + extindere panou admin (vezi 2026-09-04_admin_panel.sql pt. varianta
-- inițială).
--
-- FIX: auth.users.email e "character varying", nu "text" — orice funcție cu
-- RETURNS TABLE (... text ...) care selecta direct u.email dădea "structure
-- of query does not match function result type" la orice apel. Cast explicit
-- ::text pe toate coloanele expuse, ca să nu mai conteze tipul exact din sursă.
--
-- EXTINDERI:
-- - admin_get_stats(period_days) — grafic de creștere cu perioadă selectabilă
-- - admin_list_events(..., status_filter) — filtru active/arhivate/toate
-- - admin_list_users(..., filter_mode) — filtru blocați/raportați/cu evenimente
-- - admin_delete_event_notify(report_id) — șterge evenimentul raportat ȘI
--   trimite un email organizatorului că postarea i-a fost eliminată

begin;

drop function if exists public.admin_get_stats();
create or replace function public.admin_get_stats(period_days int default 14)
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
    'period_days', period_days,
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as day, count(*) as cnt
        from auth.users
        where created_at > now() - (period_days || ' days')::interval
        group by 1
      ) s
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_stats(int) from public;
grant execute on function public.admin_get_stats(int) to authenticated;

drop function if exists public.admin_list_reports(boolean);
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
    r.id, r.reason::text, r.details::text, r.created_at, r.resolved,
    u.email::text as reporter_email,
    r.event_id::text,
    pe.title::text as event_title,
    el.venue::text as event_venue
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

drop function if exists public.admin_list_events(text, int);
create or replace function public.admin_list_events(search text default null, limit_n int default 60, status_filter text default 'all')
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
    pe.id, pe.title::text, pe.type::text, pe.event_date, el.venue::text, pe.verified, pe.archived, pe.created_at,
    u.email::text as organizer_email,
    (select count(*) from public.reports r where r.event_id = 'posted_' || pe.id::text) as reports_count
  from public.posted_events pe
  left join public.event_locations el on el.event_id = pe.id
  left join auth.users u on u.id = pe.user_id
  where (search is null or search = '' or pe.title ilike '%' || search || '%' or u.email ilike '%' || search || '%')
    and (
      status_filter = 'all'
      or (status_filter = 'active' and pe.archived = false)
      or (status_filter = 'archived' and pe.archived = true)
    )
  order by pe.created_at desc
  limit limit_n;
end;
$$;

revoke all on function public.admin_list_events(text, int, text) from public;
grant execute on function public.admin_list_events(text, int, text) to authenticated;

drop function if exists public.admin_list_users(text, int);
create or replace function public.admin_list_users(search text default null, limit_n int default 60, filter_mode text default 'all')
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
  select u.id, u.email, u.created_at, u.banned_until, u.nume, u.prenume, u.avatar_url, u.events_count, u.reports_against_count
  from (
    select
      au.id, au.email::text as email, au.created_at, au.banned_until,
      p.nume::text as nume, p.prenume::text as prenume, p.avatar_url::text as avatar_url,
      (select count(*) from public.posted_events pe where pe.user_id = au.id) as events_count,
      (select count(*) from public.reports r
         join public.posted_events pe2
           on r.event_id ~ '^posted_[0-9a-fA-F-]{36}$' and pe2.id = substring(r.event_id from 8)::uuid
         where pe2.user_id = au.id) as reports_against_count
    from auth.users au
    left join public.profiles p on p.user_id = au.id
  ) u
  where (search is null or search = '' or u.email ilike '%' || search || '%' or u.nume ilike '%' || search || '%' or u.prenume ilike '%' || search || '%')
    and (
      filter_mode = 'all'
      or (filter_mode = 'banned' and u.banned_until is not null and u.banned_until > now())
      or (filter_mode = 'reported' and u.reports_against_count > 0)
      or (filter_mode = 'with_events' and u.events_count > 0)
    )
  order by u.created_at desc
  limit limit_n;
end;
$$;

revoke all on function public.admin_list_users(text, int, text) from public;
grant execute on function public.admin_list_users(text, int, text) to authenticated;

-- Șterge postarea raportată ȘI anunță organizatorul prin email — nu doar
-- rezolvă raportul în tăcere. Dacă evenimentul a fost deja șters (altă cale)
-- sau nu se poate identifica, doar marchează raportul rezolvat, fără eroare.
create or replace function public.admin_delete_event_notify(target_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report record;
  v_event_id uuid;
  v_event_title text;
  v_event_user_id uuid;
  v_organizer_email text;
  resend_key text;
  html_body text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_report from public.reports where id = target_report_id;
  if v_report is null then
    raise exception 'report not found';
  end if;

  if v_report.event_id ~ '^posted_[0-9a-fA-F-]{36}$' then
    select pe.id, pe.title::text, pe.user_id into v_event_id, v_event_title, v_event_user_id
    from public.posted_events pe
    where pe.id = substring(v_report.event_id from 8)::uuid;
  end if;

  if v_event_id is not null then
    select email::text into v_organizer_email from auth.users where id = v_event_user_id;
    select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';

    if resend_key is not null and v_organizer_email is not null then
      html_body := format($html$
<div style="background-color:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" style="max-width:460px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:6px;">
    <tr>
      <td style="padding:24px 28px 0 28px;">
        <span style="font-size:13px;font-weight:700;letter-spacing:0.04em;color:#FF3366;">NIGHTFEED</span>
      </td>
    </tr>
    <tr>
      <td style="padding:6px 28px 20px 28px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:16px;font-weight:600;color:#18181b;">Evenimentul tău a fost eliminat</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <div style="font-size:13px;color:#3f3f46;line-height:1.6;">
          Evenimentul <strong>%s</strong> a fost eliminat de pe NightFeed în urma unei raportări (motiv: %s). Dacă crezi că e o greșeală, scrie-ne la contact@nightfeed.ro.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro — trimis automat, nu răspunde la acest email.</div>
      </td>
    </tr>
  </table>
</div>
$html$, v_event_title, v_report.reason);

      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || resend_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'from', 'NightFeed <notificari@nightfeed.ro>',
          'to', jsonb_build_array(v_organizer_email),
          'subject', 'Evenimentul tău a fost eliminat de pe NightFeed',
          'html', html_body
        )
      );
    end if;

    delete from public.posted_events where id = v_event_id;
  end if;

  update public.reports
  set resolved = true, resolved_at = now(), resolved_by = auth.uid()
  where id = target_report_id;
end;
$$;

revoke all on function public.admin_delete_event_notify(uuid) from public;
grant execute on function public.admin_delete_event_notify(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
