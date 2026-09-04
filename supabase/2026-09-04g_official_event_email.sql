-- Cererile de eveniment oficial trimiteau doar o notificare în-app către
-- Razvan (notifyUser din PostPage.jsx) — ușor de ratat dacă nu e activ chiar
-- atunci în aplicație. Adăugăm și un email către contact@nightfeed.ro, la
-- fel ca la raportări/conturi noi, garantat trimis server-side (nu depinde
-- de un call JS de pe clientul care postează).

begin;

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
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro — verifică și aprobă din Admin.</div>
      </td>
    </tr>
  </table>
</div>
$html$,
    new.title,
    coalesce(new.date, '-'),
    coalesce(new.price, 'Gratuit'),
    coalesce(organizer_email, 'necunoscut')
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

drop trigger if exists trg_notify_new_official_event on public.posted_events;
create trigger trg_notify_new_official_event
  after insert on public.posted_events
  for each row execute function public.notify_new_official_event();

commit;

notify pgrst, 'reload schema';
