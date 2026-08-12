-- Notificările nu știau CINE a declanșat acțiunea (doar titlul/textul, scris
-- deja cu numele în el) — ca să putem arăta poza celui care a dat
-- like/comentat/urmărit (în loc de o iconiță generică), avem nevoie de
-- id-ul lui, nu doar de numele lui în text.

alter table public.notifications
  add column if not exists actor_id uuid references auth.users(id) on delete set null;
