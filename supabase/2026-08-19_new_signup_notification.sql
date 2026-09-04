-- La fiecare cont nou creat (auth.users), trimite un email de notificare la
-- contact@nightfeed.ro prin Resend (https://resend.com), cu totalul curent de
-- utilizatori. pg_net face request-ul async, fără să blocheze signup-ul dacă
-- API-ul de email pică sau întârzie.
--
-- ÎNAINTE să funcționeze, o singură dată, manual din Supabase SQL Editor
-- (cheia NU trebuie pusă niciodată într-un fișier de migrare care ajunge pe git):
--   select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
-- (cheia se ia de pe resend.com, după ce îți faci cont acolo — gratuit, 3000
-- emailuri/lună — și generezi un API key din dashboard).
--
-- Sender-ul de mai jos, onboarding@resend.dev, e sender-ul de test al Resend —
-- funcționează fără nicio verificare de domeniu, dar Gmail îl poate marca spam
-- la început. Quando vrei ceva mai serios, verifici domeniul nightfeed.ro în
-- Resend (are deja DNS-ul pe Cloudflare, e rapid) și schimbi sender-ul mai jos
-- în ceva de tipul notificari@nightfeed.ro.

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
begin
  select count(*) into user_count from auth.users;
  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';

  -- Cheia nu e configurată încă (sau a fost ștearsă) — nu blocăm/nu stricăm
  -- signup-ul userului din cauza unei notificări interne.
  if resend_key is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'NightFeed <onboarding@resend.dev>',
      -- contact@nightfeed.ro nu funcționează cu sender-ul de test onboarding@resend.dev
      -- (Resend restricționează sandbox-ul la adresa proprie a contului) — până
      -- se verifică domeniul nightfeed.ro în Resend, mergem pe adresa de cont.
      'to', jsonb_build_array('rchiceanu@gmail.com'),
      'subject', 'Cont nou pe NightFeed',
      'html', '<p>Utilizator nou: <strong>' || coalesce(new.email, 'necunoscut') || '</strong></p><p>Total utilizatori acum: <strong>' || user_count || '</strong></p>'
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
