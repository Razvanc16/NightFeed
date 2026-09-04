-- Mecanism de raportare rapidă pentru conținut (poze/video încărcate de alți
-- useri fără acordul persoanelor din cadru, conținut ilegal/înșelător,
-- hărțuire/spam etc.) — până acum nu exista NICIUN mod din aplicație de a
-- semnala așa ceva.
--
-- Nu construim un panou de admin în aplicație (echipa are 2 persoane) —
-- fiecare raport declanșează un email către contact@nightfeed.ro prin
-- Resend, la fel ca la notificarea de cont nou, ca să fie văzut imediat.

begin;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  event_id text,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_created on public.reports (created_at desc);

alter table public.reports enable row level security;

-- Doar insert pe propriul raport — nimeni, în afară de founderi (care citesc
-- direct din Supabase Dashboard cu rol de service, nu prin API-ul RLS-at),
-- nu are voie să vadă raportările altora.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
for insert with check (auth.uid() = reporter_id);

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
  html_body text;
begin
  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';
  if resend_key is null then
    return new;
  end if;

  select email into reporter_email from auth.users where id = new.reporter_id;

  -- event_id vine din client ca "posted_<uuid>" — extragem titlul/locația
  -- reale în loc să afișăm ID-ul brut în email. Într-un bloc separat, ca un
  -- event_id invalid/șters să nu blocheze trimiterea notificării.
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

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'NightFeed <notificari@nightfeed.ro>',
      'to', jsonb_build_array('contact@nightfeed.ro'),
      'subject', 'Raportare nouă pe NightFeed',
      'html', html_body
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_new_report on public.reports;
create trigger trg_notify_new_report
  after insert on public.reports
  for each row execute function public.notify_new_report();

commit;

notify pgrst, 'reload schema';
