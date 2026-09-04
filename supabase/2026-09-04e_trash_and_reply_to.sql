-- "Coș de gunoi" pentru evenimentele șterse de admin — nu se mai șterg
-- definitiv pe loc, ci devin invizibile peste tot (feed, hartă, profilul
-- organizatorului) timp de 7 zile, recuperabile din tab-ul nou "Șterse". Dacă
-- nu le restaurezi în 7 zile, un job zilnic le șterge definitiv.
--
-- + reply_to pe emailul trimis organizatorului la ștergere, ca să poată
-- răspunde direct (ajunge la contact@nightfeed.ro, care redirecționează spre
-- echipă) în loc să fie nevoit să scrie un email nou de la zero.

begin;

alter table public.posted_events add column if not exists admin_deleted_at timestamptz;

-- Re-creăm view-ul ca să excludă evenimentele din coșul de gunoi peste tot
-- (feed, hartă, profilul organizatorului) — coloanele rămân identice cu
-- ultima versiune, din 2026-08-19c_official_qr_and_max_participants.sql.
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
left join public.event_locations el on el.event_id = pe.id
where pe.admin_deleted_at is null;

grant select on public.posted_events_feed to anon, authenticated;

-- admin_delete_event nu mai șterge definitiv — doar mută în coșul de gunoi.
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

  update public.posted_events set admin_deleted_at = now() where id = target_event_id;
end;
$$;

-- La fel și "Șterge postarea" din Raportări — mută în coș + trimite emailul,
-- cu reply_to spre contact@nightfeed.ro (nu spre notificari@, care nu are
-- nicio cutie poștală reală în spate).
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
          Evenimentul <strong>%s</strong> a fost eliminat de pe NightFeed în urma unei raportări (motiv: %s). Dacă crezi că e o greșeală, răspunde direct la acest email.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro</div>
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
          'reply_to', 'contact@nightfeed.ro',
          'subject', 'Evenimentul tău a fost eliminat de pe NightFeed',
          'html', html_body
        )
      );
    end if;

    -- Coș de gunoi, nu ștergere definitivă — 7 zile ca să poți restaura din
    -- greșeală din tab-ul Șterse.
    update public.posted_events set admin_deleted_at = now() where id = v_event_id;
  end if;

  update public.reports
  set resolved = true, resolved_at = now(), resolved_by = auth.uid()
  where id = target_report_id;
end;
$$;

create or replace function public.admin_list_trash()
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
      pe.id, pe.title, pe.type, pe.event_date, el.venue, pe.admin_deleted_at,
      u.email as organizer_email
    from public.posted_events pe
    left join public.event_locations el on el.event_id = pe.id
    left join auth.users u on u.id = pe.user_id
    where pe.admin_deleted_at is not null
    order by pe.admin_deleted_at desc
  ) t;

  return result;
end;
$$;

revoke all on function public.admin_list_trash() from public;
grant execute on function public.admin_list_trash() to authenticated;

create or replace function public.admin_restore_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.posted_events set admin_deleted_at = null where id = target_event_id;
end;
$$;

revoke all on function public.admin_restore_event(uuid) from public;
grant execute on function public.admin_restore_event(uuid) to authenticated;

-- Ștergere definitivă manuală, direct din coșul de gunoi (nu mai aștepți 7
-- zile dacă știi sigur că vrei să scapi de el acum) — funcționează DOAR pe
-- ceva deja aflat în coș, ca să nu poată fi folosită ca o portiță de ștergere
-- definitivă instant pe orice eveniment, ocolind coșul.
create or replace function public.admin_purge_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.posted_events where id = target_event_id and admin_deleted_at is not null;
end;
$$;

revoke all on function public.admin_purge_event(uuid) from public;
grant execute on function public.admin_purge_event(uuid) to authenticated;

create or replace function public.purge_expired_admin_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.posted_events
  where admin_deleted_at is not null and admin_deleted_at < now() - interval '7 days';
end;
$$;

commit;

-- Job zilnic de curățenie — separat de tranzacția de mai sus (cron.schedule
-- nu trebuie rulat în begin/commit). Necesită extensia pg_cron activată pe
-- proiect. DACĂ blocul de mai jos dă eroare (ex: planul tău nu are pg_cron
-- disponibil), sari peste el — restul (coșul, restaurarea) funcționează
-- oricum, doar că ștergerea definitivă după 7 zile ar trebui făcută manual
-- din tab-ul Șterse din când în când.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-admin-trash-daily',
  '0 4 * * *',
  $$select public.purge_expired_admin_trash();$$
);

notify pgrst, 'reload schema';
