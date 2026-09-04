-- Flux complet de aprobare pentru evenimente oficiale:
-- 1. Coloane noi de contact (cerute doar la postarea unui eveniment oficial,
--    ca reviewer-ul să aibă cu cine vorbi dacă ceva nu e clar).
-- 2. admin_list_events capătă filtrul "pending" (oficiale nevalidate încă).
-- 3. admin_approve_event — aprobă direct din Admin, fără SQL/Table Editor manual.
-- 4. Emailul de cerere oficial include acum și datele de contact.

begin;

alter table public.posted_events add column if not exists contact_name text;
alter table public.posted_events add column if not exists contact_phone text;
alter table public.posted_events add column if not exists contact_social text;

drop view if exists public.posted_events_feed;
create view public.posted_events_feed
with (security_invoker = true)
as
select
  pe.id, pe.user_id, pe.title, pe.type, pe.date, pe.event_date, pe.price,
  pe.age_restricted, pe.description, pe.tags, pe.ticket_link, pe.cover_url,
  pe.verified, pe.created_at, pe.code, pe.lat_approx, pe.lng_approx, pe.archived,
  pe.location_visible, pe.vibe, pe.max_participants,
  pe.contact_name, pe.contact_phone, pe.contact_social,
  el.venue, el.lat, el.lng
from public.posted_events pe
left join public.event_locations el on el.event_id = pe.id
where pe.admin_deleted_at is null;

grant select on public.posted_events_feed to anon, authenticated;

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
      pe.contact_name, pe.contact_phone, pe.contact_social,
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
        or (status_filter = 'pending' and pe.type = 'official' and pe.verified = false)
      )
    order by pe.created_at desc
    limit limit_n
  ) t;

  return result;
end;
$$;

revoke all on function public.admin_list_events(text, int, text) from public;
grant execute on function public.admin_list_events(text, int, text) to authenticated;

create or replace function public.admin_approve_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.posted_events set verified = true where id = target_event_id;
end;
$$;

revoke all on function public.admin_approve_event(uuid) from public;
grant execute on function public.admin_approve_event(uuid) to authenticated;

create or replace function public.notify_new_official_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resend_key text;
  organizer_email text;
  html_body text;
begin
  if new.type <> 'official' then
    return new;
  end if;

  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';
  if resend_key is null then
    return new;
  end if;

  select email into organizer_email from auth.users where id = new.user_id;

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
        <div style="font-size:16px;font-weight:600;color:#18181b;">Cerere eveniment oficial</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <table role="presentation" width="100%%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Titlu</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:600;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Data</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Preț</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Organizator</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Contact</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Telefon</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;vertical-align:top;">Social/Website</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro — aprobă din aplicație: Setări → Admin → Evenimente → Neaprobate.</div>
      </td>
    </tr>
  </table>
</div>
$html$,
    new.title,
    coalesce(new.date, '-'),
    coalesce(new.price, 'Gratuit'),
    coalesce(organizer_email, 'necunoscut'),
    coalesce(new.contact_name, '-'),
    coalesce(new.contact_phone, '-'),
    coalesce(new.contact_social, '-')
  );

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'NightFeed <notificari@nightfeed.ro>',
      'to', jsonb_build_array('contact@nightfeed.ro'),
      'reply_to', 'contact@nightfeed.ro',
      'subject', 'Cerere eveniment oficial: ' || new.title,
      'html', html_body
    )
  );

  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';
