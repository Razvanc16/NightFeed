-- Notificările de like/comentariu nu duceau nicăieri în afară de profilul
-- celui care a declanșat acțiunea — acum ținem și evenimentul (și, pentru
-- comentarii, comentariul exact) ca să putem naviga direct acolo la atingere.

begin;

-- event_id e text, nu uuid: peste tot în aplicație (comments.event_id,
-- likes.event_id, attendances.event_id) evenimentele postate sunt referite
-- prin id-ul prefixat din client ("posted_<uuid>"), nu prin uuid-ul brut din
-- posted_events — păstrăm aceeași convenție aici, ca să se potrivească direct
-- cu event.id trimis din UI, fără conversii.
alter table public.notifications
  add column if not exists event_id text,
  add column if not exists comment_id uuid references public.comments(id) on delete set null;

commit;
