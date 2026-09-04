-- La fiecare cont nou creat (auth.users), trimite un email de notificare la
-- contact@nightfeed.ro (redirecționează prin Cloudflare Email Routing spre
-- toată echipa) prin Resend (https://resend.com), cu totalul curent de
-- utilizatori. pg_net face request-ul async, fără să blocheze signup-ul dacă
-- API-ul de email pică sau întârzie.
--
-- ÎNAINTE să funcționeze, o singură dată, manual din Supabase SQL Editor
-- (cheia NU trebuie pusă niciodată într-un fișier de migrare care ajunge pe git):
--   select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
-- (cheia se ia de pe resend.com, după ce îți faci cont acolo — gratuit, 3000
-- emailuri/lună — și generezi un API key din dashboard).
--
-- Sender-ul de mai jos, notificari@nightfeed.ro, necesită domeniul nightfeed.ro
-- verificat în Resend (Domains → Add Domain, apoi înregistrările DNS SPF/DKIM
-- puse în Cloudflare) — altfel Resend respinge cu 403 orice destinatar în afară
-- de adresa proprie a contului Resend (sandbox mode).

begin;

create extension if not exists pg_net;

create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count bigint;
  resend_key text;
  html_body text;
begin
  select count(*) into user_count from auth.users;
  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';

  -- Cheia nu e configurată încă (sau a fost ștearsă) — nu blocăm/nu stricăm
  -- signup-ul userului din cauza unei notificări interne.
  if resend_key is null then
    return new;
  end if;

  html_body := format($html$
<div style="background-color:#0a0a0c;padding:40px 16px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" style="max-width:520px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="background-color:#FF3366;background-image:linear-gradient(135deg,#FF3366,#FF6B35);padding:22px 28px;border-radius:16px 16px 0 0;">
        <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">NightFeed</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">Notificare internă</div>
      </td>
    </tr>
    <tr>
      <td style="background-color:#17171b;padding:28px;">
        <div style="display:inline-block;background-color:rgba(255,107,107,0.12);color:#FF6B6B;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:5px 12px;border-radius:20px;margin-bottom:18px;">Cont nou</div>
        <table role="presentation" width="100%%" style="border-collapse:collapse;margin-top:6px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.45);font-size:13px;">Email</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#ffffff;font-size:14px;font-weight:600;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:rgba(255,255,255,0.45);font-size:13px;">Total utilizatori</td>
            <td style="padding:10px 0;color:#ffffff;font-size:14px;font-weight:600;text-align:right;">%s</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#0f0f12;padding:18px 28px;border-radius:0 0 16px 16px;text-align:center;">
        <div style="font-size:11px;color:rgba(255,255,255,0.3);">NightFeed · nightfeed.ro</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.25);margin-top:4px;">Email generat automat — nu răspunde la această adresă.</div>
      </td>
    </tr>
  </table>
</div>
$html$, coalesce(new.email, 'necunoscut'), user_count);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'NightFeed <notificari@nightfeed.ro>',
      'to', jsonb_build_array('contact@nightfeed.ro'),
      'subject', 'Cont nou pe NightFeed',
      'html', html_body
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_new_signup on auth.users;
create trigger trg_notify_new_signup
  after insert on auth.users
  for each row execute function public.notify_new_signup();

commit;
