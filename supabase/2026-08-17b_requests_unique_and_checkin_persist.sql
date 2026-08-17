-- Două bug-uri din aceeași familie ("apăsat rapid = mai multe rânduri
-- salvate"), care lovise deja attendances acum câteva zile (vezi
-- 2026-08-13b_attendances_unique.sql) — de data asta în attendance_requests,
-- care n-a primit niciodată aceeași protecție.

begin;

-- Ștergem duplicatele existente (păstrăm rândul cel mai vechi per event+user).
delete from public.attendance_requests a
using public.attendance_requests b
where a.event_id = b.event_id
  and a.requester_id = b.requester_id
  and a.id > b.id;

alter table public.attendance_requests
  drop constraint if exists attendance_requests_event_requester_unique;

alter table public.attendance_requests
  add constraint attendance_requests_event_requester_unique unique (event_id, requester_id);

commit;

-- Al doilea bug: fiecare toggle "particip" / "renunț" ștergea și recrea
-- biletul (event_checkins), deci codul QR se schimba de fiecare dată —
-- neplăcut pentru participant (codul salvat/screenshotat devine invalid) și
-- inutil de multe rânduri create/șterse în timp. Renunțăm la trigger-ul care
-- ștergea biletul la "renunț" — o dată emis, tokenul rămâne același cât timp
-- evenimentul există, indiferent de câte ori participi/renunți între timp.
drop trigger if exists trg_checkin_revoke_attendance on public.attendances;
drop function if exists public.checkin_revoke_from_attendance();
