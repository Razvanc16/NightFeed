-- Două câmpuri noi de profil, gen Tinder/Hinge — completate opțional din
-- Profil → Editare, nu obligatorii la înregistrare. Apar pe cardul fiecărei
-- cereri de participare primite de un host (RequestsPage), ca să-și dea
-- seama repede cui îi acceptă cererea, nu doar dintr-un nume și mesaj scurt.

begin;

alter table public.profiles add column if not exists prompt_answer text;
alter table public.profiles add column if not exists instagram text;

commit;

notify pgrst, 'reload schema';
