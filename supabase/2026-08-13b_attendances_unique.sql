-- Bug: apăsat rapid/repetat pe "Particip" crea mai multe rânduri în
-- attendances pentru același user+eveniment (nu exista niciun guard nici în
-- client, nici constrângere unică în bază — spre deosebire de "likes", care
-- avea deja unique + upsert). Rezultat: contorul de participanți umflat
-- artificial. Aici: ștergem duplicatele existente (păstrăm rândul cel mai
-- vechi per event_id+user_id), apoi adăugăm constrângerea unică — fix-ul din
-- client (upsert + guard) e într-un commit separat.

begin;

delete from public.attendances a
using public.attendances b
where a.event_id = b.event_id
  and a.user_id = b.user_id
  and a.id > b.id;

alter table public.attendances
  drop constraint if exists attendances_event_user_unique;

alter table public.attendances
  add constraint attendances_event_user_unique unique (event_id, user_id);

commit;
