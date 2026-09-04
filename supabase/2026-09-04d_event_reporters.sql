-- Vezi cine a raportat un eveniment anume, direct din tab-ul Evenimente
-- (înainte se vedea doar "3 raportări", fără să știi cine sau de ce).

begin;

create or replace function public.admin_get_event_reports(target_event_uuid uuid)
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

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result
  from (
    select r.id, r.reason, r.details, r.created_at, r.resolved, u.email as reporter_email
    from public.reports r
    left join auth.users u on u.id = r.reporter_id
    where r.event_id = 'posted_' || target_event_uuid::text
    order by r.created_at desc
  ) t;

  return result;
end;
$$;

revoke all on function public.admin_get_event_reports(uuid) from public;
grant execute on function public.admin_get_event_reports(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
