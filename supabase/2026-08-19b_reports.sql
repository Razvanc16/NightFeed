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
begin
  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';
  if resend_key is null then
    return new;
  end if;

  select email into reporter_email from auth.users where id = new.reporter_id;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      -- Domeniul nightfeed.ro e verificat în Resend — sender propriu, nu mai
      -- suntem limitați la sandbox-ul care trimitea doar către contul Resend.
      -- contact@nightfeed.ro redirecționează (Cloudflare Email Routing) spre
      -- toți cei din echipă.
      'from', 'NightFeed <notificari@nightfeed.ro>',
      'to', jsonb_build_array('contact@nightfeed.ro'),
      'subject', 'Raportare nouă pe NightFeed',
      'html',
        '<p><strong>Motiv:</strong> ' || new.reason || '</p>' ||
        '<p><strong>Eveniment:</strong> ' || coalesce(new.event_id, 'N/A') || '</p>' ||
        '<p><strong>Detalii:</strong> ' || coalesce(new.details, '-') || '</p>' ||
        '<p><strong>Raportat de:</strong> ' || coalesce(reporter_email, 'necunoscut') || ' (' || new.reporter_id || ')</p>'
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
