-- Fix definitiv la "structure of query does not match function result type":
-- RETURNS TABLE(...) cere ca fiecare coloană să aibă EXACT tipul din sursă
-- (varchar vs text, etc.) — indiferent câte ::text puneam, tot puteam rata
-- vreo coloană. Soluție robustă: funcțiile de listare returnează jsonb (un
-- array), care acceptă orice tip sursă fără să conteze declarația exactă.
--
-- Adaugă și: raportare de CONTURI (nu doar evenimente) — reports capătă
-- reported_user_id, ReportSheet devine generic, iar din Raportări poți acum
-- bloca/șterge direct contul raportat, nu doar evenimentul.

begin;

alter table public.reports add column if not exists reported_user_id uuid references auth.users(id) on delete cascade;

drop function if exists public.admin_list_reports(boolean);
create or replace function public.admin_list_reports(unresolved_only boolean default true)
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

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result
  from (
    select
      r.id, r.reason, r.details, r.created_at, r.resolved,
      u.email as reporter_email,
      r.event_id,
      pe.title as event_title,
      el.venue as event_venue,
      r.reported_user_id,
      ru.email as reported_user_email,
      nullif(trim(coalesce(rp.prenume, '') || ' ' || coalesce(rp.nume, '')), '') as reported_user_name
    from public.reports r
    left join auth.users u on u.id = r.reporter_id
    left join public.posted_events pe
      on r.event_id ~ '^posted_[0-9a-fA-F-]{36}$' and pe.id = substring(r.event_id from 8)::uuid
    left join public.event_locations el on el.event_id = pe.id
    left join auth.users ru on ru.id = r.reported_user_id
    left join public.profiles rp on rp.user_id = r.reported_user_id
    where (not unresolved_only or r.resolved = false)
    order by r.created_at desc
    limit 200
  ) t;

  return result;
end;
$$;

revoke all on function public.admin_list_reports(boolean) from public;
grant execute on function public.admin_list_reports(boolean) to authenticated;

drop function if exists public.admin_list_events(text, int, text);
create or replace function public.admin_list_events(search text default null, limit_n int default 60, status_filter text default 'all')
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

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result
  from (
    select
      pe.id, pe.title, pe.type, pe.event_date, el.venue, pe.verified, pe.archived, pe.created_at,
      u.email as organizer_email,
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
    limit limit_n
  ) t;

  return result;
end;
$$;

revoke all on function public.admin_list_events(text, int, text) from public;
grant execute on function public.admin_list_events(text, int, text) to authenticated;

drop function if exists public.admin_list_users(text, int, text);
create or replace function public.admin_list_users(search text default null, limit_n int default 60, filter_mode text default 'all')
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

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result
  from (
    select u.id, u.email, u.created_at, u.banned_until, u.nume, u.prenume, u.avatar_url, u.events_count, u.reports_against_count
    from (
      select
        au.id, au.email, au.created_at, au.banned_until,
        p.nume, p.prenume, p.avatar_url,
        (select count(*) from public.posted_events pe where pe.user_id = au.id) as events_count,
        (
          (select count(*) from public.reports r
             join public.posted_events pe2
               on r.event_id ~ '^posted_[0-9a-fA-F-]{36}$' and pe2.id = substring(r.event_id from 8)::uuid
             where pe2.user_id = au.id)
          +
          (select count(*) from public.reports r2 where r2.reported_user_id = au.id)
        ) as reports_against_count
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
    limit limit_n
  ) t;

  return result;
end;
$$;

revoke all on function public.admin_list_users(text, int, text) from public;
grant execute on function public.admin_list_users(text, int, text) to authenticated;

-- Trigger-ul de notificare pe email trebuia extins să înțeleagă și
-- raportările de conturi (reported_user_id), nu doar de evenimente.
create or replace function public.notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resend_key text;
  reporter_email text;
  event_title text;
  event_venue text;
  reported_email text;
  reported_name text;
  html_body text;
  subject_line text;
begin
  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';
  if resend_key is null then
    return new;
  end if;

  select email into reporter_email from auth.users where id = new.reporter_id;

  if new.reported_user_id is not null then
    subject_line := 'Raportare cont pe NightFeed';
    select email into reported_email from auth.users where id = new.reported_user_id;
    select nullif(trim(coalesce(prenume, '') || ' ' || coalesce(nume, '')), '') into reported_name
    from public.profiles where user_id = new.reported_user_id;

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
        <div style="font-size:16px;font-weight:600;color:#18181b;">Raportare cont</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <table role="presentation" width="100%%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Motiv</td>
            <td style="padding:5px 0;font-size:13px;color:#E8590C;font-weight:600;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Cont raportat</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Detalii</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:400;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Raportat de</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro — trimis automat, nu răspunde la acest email.</div>
      </td>
    </tr>
  </table>
</div>
$html$,
      new.reason,
      coalesce(reported_name, reported_email, 'necunoscut'),
      coalesce(new.details, '-'),
      coalesce(reporter_email, 'necunoscut')
    );
  else
    subject_line := 'Raportare nouă pe NightFeed';
    begin
      select title, venue into event_title, event_venue
      from public.posted_events_feed
      where id = replace(new.event_id, 'posted_', '')::uuid;
    exception when others then
      event_title := null;
      event_venue := null;
    end;

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
        <div style="font-size:16px;font-weight:600;color:#18181b;">Raportare nouă</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <table role="presentation" width="100%%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Motiv</td>
            <td style="padding:5px 0;font-size:13px;color:#E8590C;font-weight:600;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Eveniment</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Locație</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Detalii</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:400;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Raportat de</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s<br><span style="font-size:11px;color:#a1a1aa;font-weight:400;">%s</span></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro — trimis automat, nu răspunde la acest email.</div>
      </td>
    </tr>
  </table>
</div>
$html$,
      new.reason,
      coalesce(event_title, 'eveniment șters sau necunoscut'),
      coalesce(event_venue, '-'),
      coalesce(new.details, '-'),
      coalesce(reporter_email, 'necunoscut'),
      new.reporter_id::text
    );
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'NightFeed <notificari@nightfeed.ro>',
      'to', jsonb_build_array('contact@nightfeed.ro'),
      'subject', subject_line,
      'html', html_body
    )
  );

  return new;
end;
$$;

-- Grafice cu perioadă selectabilă (ultima zi/săptămână/3 luni/an/tot timpul),
-- bucket-uite diferit în funcție de cât de lungă e perioada (pe oră pt. o
-- singură zi, pe săptămână pt. un an întreg etc.) — altfel un an întreg
-- afișat pe zi ar însemna 365 de bare, ilizibil.
create or replace function public.admin_get_series(preset text default 'week')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_trunc text;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  case preset
    when 'day' then v_since := now() - interval '1 day'; v_trunc := 'hour';
    when 'week' then v_since := now() - interval '7 days'; v_trunc := 'day';
    when '3months' then v_since := now() - interval '90 days'; v_trunc := 'day';
    when 'year' then v_since := now() - interval '365 days'; v_trunc := 'week';
    else v_since := '1970-01-01'::timestamptz; v_trunc := 'month';
  end case;

  select jsonb_build_object(
    'preset', preset,
    'bucket', v_trunc,
    'signups', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b, 'count', cnt) order by b), '[]'::jsonb)
      from (select date_trunc(v_trunc, created_at) as b, count(*) as cnt from auth.users where created_at > v_since group by 1) s
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b, 'count', cnt) order by b), '[]'::jsonb)
      from (select date_trunc(v_trunc, created_at) as b, count(*) as cnt from public.posted_events where created_at > v_since group by 1) s
    ),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b, 'count', cnt) order by b), '[]'::jsonb)
      from (select date_trunc(v_trunc, created_at) as b, count(*) as cnt from public.reports where created_at > v_since group by 1) s
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_series(text) from public;
grant execute on function public.admin_get_series(text) to authenticated;

commit;

notify pgrst, 'reload schema';
