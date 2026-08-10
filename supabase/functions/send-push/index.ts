// Edge Function: trimite o notificare push tuturor abonamentelor unui user țintă.
//
// De ce server-side: trimiterea unui push semnat cu VAPID necesită cheia
// PRIVATĂ, care nu trebuie niciodată expusă în cod client. Aici rulează în
// infrastructura Supabase, cu cheile citite din secretele funcției.
//
// Deploy + configurare secrete (o singură dată, din terminal, cu Supabase CLI):
//   supabase functions deploy send-push
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
//
// Oricine e autentificat poate apela funcția pentru a notifica orice alt user
// (nu doar pe sine) — e nevoie de asta ca hostul să poată notifica requester-ul
// la accept/refuz, sau ca cineva să notifice organizatorul la like. Singura
// verificare e că apelantul are o sesiune validă (nu e complet anonim);
// funcția nu validează o relație reală (host/requester, liker/organizator)
// între apelant și targetUserId — de reținut ca limitare, nu ca bug.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:contact@nightfeed.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    const { targetUserId, title, body, url, type } = await req.json();
    if (!targetUserId || !title) {
      return new Response(JSON.stringify({ error: "Missing targetUserId or title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Respectăm preferința userului țintă pentru acest tip de notificare
    // (likes / comments / requests / followers). Fără tip specificat, trimitem oricum.
    const prefColumn = { like: "notif_likes", comment: "notif_comments", request: "notif_requests", follower: "notif_followers" }[type];
    if (prefColumn) {
      const { data: profile } = await adminClient.from("profiles").select(prefColumn).eq("user_id", targetUserId).maybeSingle();
      if (profile && profile[prefColumn] === false) {
        return new Response(JSON.stringify({ sent: 0, total: 0, skipped: "preference_disabled" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: subs, error: subsError } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", targetUserId);
    if (subsError) throw subsError;

    const payload = JSON.stringify({ title, body: body || "", url: url || "/" });

    const results = await Promise.allSettled(
      (subs || []).map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          .catch(async (err) => {
            // Abonament expirat/invalid (dispozitivul nu mai există sau userul
            // a revocat permisiunea) — îl ștergem, altfel tot încercăm degeaba.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await adminClient.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            }
            throw err;
          })
      )
    );

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.status === "fulfilled").length, total: results.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
