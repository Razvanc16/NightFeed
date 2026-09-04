// Edge Function: acțiuni de admin care au nevoie de cheia SERVICE ROLE
// (blocare/deblocare cont, ștergere definitivă a contului altcuiva) — nu pot
// fi RPC-uri SQL simple, fiindcă blocarea unui user (auth.admin.updateUserById)
// și ștergerea din auth.users necesită Admin API-ul Supabase, nu doar SQL.
//
// Singurul loc care contează pt. securitate e verificarea ADMIN_EMAILS de mai
// jos, făcută pe fiecare cerere după ce identificăm userul din tokenul trimis
// — un buton ascuns în UI nu oprește pe cineva să apeleze funcția direct.
//
// Deploy (din terminal, cu Supabase CLI):
//   supabase functions deploy admin-action

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Aceeași listă ca is_admin() din SQL (2026-09-04_admin_panel.sql) — dacă se
// schimbă emailul de login al unui founder, actualizează în AMBELE locuri.
const ADMIN_EMAILS = ["rchiceanu@gmail.com", "ivictorcebuc@gmail.com"];

const ALLOWED_ORIGINS = [
  "https://nightfeed.ro",
  "https://www.nightfeed.ro",
  "http://localhost:5173",
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, targetUserId } = await req.json();
    if (!action || !targetUserId) {
      return new Response(JSON.stringify({ error: "Missing action or targetUserId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === "ban_user") {
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: "876000h" });
      if (error) throw error;
    } else if (action === "unban_user") {
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
      if (error) throw error;
    } else if (action === "delete_user") {
      // Emailul de notificare trebuie trimis ÎNAINTE să ștergem contul —
      // odată șters din auth.users, nu mai avem de unde să-i luăm adresa.
      // Best-effort: dacă eșuează trimiterea, ștergerea continuă oricum.
      const { data: targetUserData } = await adminClient.auth.admin.getUserById(targetUserId);
      const targetEmail = targetUserData?.user?.email;
      if (targetEmail) {
        await adminClient.rpc("admin_notify_account_deleted", { target_email: targetEmail }).catch(() => {});
      }

      // Aceeași listă de tabele ca la auto-ștergerea contului din
      // ProfilePage.jsx (handleDeleteAccount) — un admin poate șterge
      // definitiv un cont abuziv/raportat repetat, la fel de complet.
      const results = await Promise.all([
        adminClient.from("posted_events").delete().eq("user_id", targetUserId),
        adminClient.from("attendances").delete().eq("user_id", targetUserId),
        adminClient.from("likes").delete().eq("user_id", targetUserId),
        adminClient.from("follows").delete().eq("follower_id", targetUserId),
        adminClient.from("follows").delete().eq("following_id", targetUserId),
        adminClient.from("comments").delete().eq("user_id", targetUserId),
        adminClient.from("comment_likes").delete().eq("user_id", targetUserId),
        adminClient.from("attendance_requests").delete().eq("requester_id", targetUserId),
        adminClient.from("attendance_requests").delete().eq("host_id", targetUserId),
        adminClient.from("push_subscriptions").delete().eq("user_id", targetUserId),
        adminClient.from("notifications").delete().eq("user_id", targetUserId),
        adminClient.from("event_checkins").delete().eq("user_id", targetUserId),
        adminClient.from("usernames").delete().eq("user_id", targetUserId),
        adminClient.from("profiles").delete().eq("user_id", targetUserId),
      ]);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;

      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
