-- Email către user când adminul îi șterge definitiv contul (admin-action,
-- action "delete_user"). Trimisă din edge function ÎNAINTE de ștergerea
-- efectivă din auth.users (după, nu mai avem de unde lua emailul).
--
-- Fără is_admin() aici — funcția e apelată din edge function cu cheia
-- SERVICE ROLE (fără JWT de user în request, deci auth.jwt() ar fi gol oricum).
-- Securitatea vine din faptul că NU e acordat execute către authenticated/anon
-- mai jos — doar service_role (care oricum ocolește orice grant) o poate apela,
-- iar accesul la cheia service role e deja restricționat la backend.

begin;

create or replace function public.admin_notify_account_deleted(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resend_key text;
  html_body text;
begin
  select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';
  if resend_key is null or target_email is null then
    return;
  end if;

  html_body := format($html$
<div style="background-color:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" style="max-width:460px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:6px;">
    <tr>
      <td style="padding:24px 28px 0 28px;">
        <span style="font-size:13px;font-weight:700;letter-spacing:0.04em;color:#FF3366;">NIGHTFEED</span>
      </td>
    </tr>
    <tr>
      <td style="padding:6px 28px 20px 28px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:16px;font-weight:600;color:#18181b;">Contul tău a fost șters</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <div style="font-size:13px;color:#3f3f46;line-height:1.6;">
          Contul tău NightFeed a fost eliminat de un administrator. Dacă crezi că e o greșeală, răspunde direct la acest email.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 6px 6px;">
        <div style="font-size:11px;color:#a1a1aa;">NightFeed · nightfeed.ro</div>
      </td>
    </tr>
  </table>
</div>
$html$);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'NightFeed <notificari@nightfeed.ro>',
      'to', jsonb_build_array(target_email),
      'reply_to', 'contact@nightfeed.ro',
      'subject', 'Contul tău NightFeed a fost șters',
      'html', html_body
    )
  );
end;
$$;

commit;

notify pgrst, 'reload schema';
