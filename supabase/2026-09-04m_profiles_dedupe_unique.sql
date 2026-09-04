-- Bug: pagina de Profil se remontează la fiecare vizită și caută profilul cu
-- .single() — dacă existau (ex. dintr-un double-submit la creare) DOUĂ rânduri
-- în profiles pentru același user_id, acel query eșua de fiecare dată și te
-- trimitea înapoi la formularul de creare, la nesfârșit, deși profilul exista
-- deja. Ștergem duplicatele (păstrăm cel mai recent rând per user) și punem o
-- constrângere UNIQUE ca să nu se mai poată întâmpla din nou.

begin;

delete from public.profiles p
using public.profiles p2
where p.user_id = p2.user_id
  and (p.created_at, p.ctid) < (p2.created_at, p2.ctid);

alter table public.profiles add constraint profiles_user_id_key unique (user_id);

commit;

notify pgrst, 'reload schema';
