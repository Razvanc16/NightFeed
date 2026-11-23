-- Securitate (din Supabase Security Advisor): funcțiile SECURITY DEFINER nu
-- mai pot fi apelate de vizitatori nelogați (rolul anon).
--  * admin_*, is_admin, checkin_scan, increment_event_view: doar useri logați
--    (adminii sunt oricum verificați în interior cu is_admin()).
--  * funcțiile de trigger + purge_expired_admin_trash (rulată de cron) +
--    register_username (nefolosită; permitea oricui să rezerve un username
--    pentru orice user_id) + generate_event_code (folosită doar intern):
--    nimeni prin API. Triggerele și cron-ul rulează în continuare normal.
--  * service_role (edge functions) nu e afectat.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, pg_get_function_result(p.oid) as ret
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    if r.proname like 'admin\_%' or r.proname in ('is_admin', 'checkin_scan', 'increment_event_view') then
      execute format('revoke execute on function %s from public, anon', r.sig);
      execute format('grant execute on function %s to authenticated', r.sig);
    elsif r.ret = 'trigger' or r.proname in ('purge_expired_admin_trash', 'register_username', 'generate_event_code') then
      execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    end if;
  end loop;
end $$;

-- "Function Search Path Mutable"
alter function public.fuzz_event_location() set search_path = public;
