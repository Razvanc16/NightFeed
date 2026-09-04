-- Vizualizări per eveniment — metrică nouă în "Insights" (alături de
-- aprecieri/participanți), incrementată din EventCard când devine cardul
-- activ din feed. Contor simplu pe rând (nu tabel cu un rând per vizionare —
-- feed-ul poate genera mii de incrementări/zi, un tabel granular ar crește
-- nejustificat de repede pentru o cifră pe care oricum n-o desfacem pe useri).

begin;

alter table public.posted_events add column if not exists view_count integer not null default 0;

create or replace function public.increment_event_view(target_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posted_events set view_count = view_count + 1 where id = target_event_id;
$$;

revoke all on function public.increment_event_view(uuid) from public;
grant execute on function public.increment_event_view(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
