-- Detaliu complet pentru un eveniment, folosit când admin-ul apasă pe un
-- eveniment din listă (Evenimente/Raportări) ca să-l vadă pe larg — spre
-- deosebire de admin_list_events (doar câmpurile de listă), aici avem și
-- descriere/poză/tag-uri/organizator, ca previzualizarea din Admin să nu mai
-- trebuiască alt query separat (și să nu depindă de RLS-ul normal, care
-- ascunde evenimentele oficiale nevalidate de oricine, inclusiv admin).

begin;

create or replace function public.admin_get_event_detail(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select row_to_json(t) into result
  from (
    select
      pe.id, pe.title, pe.type, pe.description, pe.tags, pe.price, pe.date, pe.event_date,
      pe.cover_url, pe.verified, pe.archived, pe.vibe, pe.max_participants, pe.created_at,
      pe.contact_name, pe.contact_phone, pe.contact_email, pe.contact_social,
      pe.user_id as organizer_id,
      u.email as organizer_email,
      el.venue
    from public.posted_events pe
    left join public.event_locations el on el.event_id = pe.id
    left join auth.users u on u.id = pe.user_id
    where pe.id = target_event_id
  ) t;

  if result is null then
    raise exception 'event not found';
  end if;

  return result;
end;
$$;

revoke all on function public.admin_get_event_detail(uuid) from public;
grant execute on function public.admin_get_event_detail(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
