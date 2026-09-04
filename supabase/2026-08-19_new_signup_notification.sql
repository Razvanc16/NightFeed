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
<div style="background-color:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" style="max-width:460px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:6px;">
    <tr>
      <td style="padding:24px 28px 0 28px;">
        <span style="font-size:13px;font-weight:700;letter-spacing:0.04em;color:#FF3366;">NIGHTFEED</span>
      </td>
    </tr>
    <tr>
      <td style="padding:6px 28px 20px 28px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:16px;font-weight:600;color:#18181b;">Cont nou creat</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <table role="presentation" width="100%%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;">Email</td>
            <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;text-align:right;">%s</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:13px;color:#71717a;">Total utilizatori</td>
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
