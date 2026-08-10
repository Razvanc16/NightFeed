// Edge Function: șterge complet contul de autentificare al userului care face
// cererea (rândul din auth.users — email, parolă hash, tot).
//
// De ce e nevoie de o funcție server-side pentru asta: ștergerea unui user din
// auth.users necesită cheia SERVICE ROLE a Supabase, care NU trebuie niciodată
// expusă în cod client (browser) — cine ar avea-o ar putea șterge orice cont.
// Aici rulează server-side, în infrastructura Supabase, nu ajunge în browser.
//
// Deploy (o singură dată, din terminalul tău, cu Supabase CLI):
//   npm install -g supabase
//   supabase login
//   supabase link --project-ref rjeyiovwmkmltenmyhij
//   supabase functions deploy delete-account
//
// Nu trebuie configurate manual variabile de mediu — Supabase injectează automat
// SUPABASE_URL, SUPABASE_ANON_KEY și SUPABASE_SERVICE_ROLE_KEY în orice Edge Function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Identificăm userul din tokenul trimis de aplicație (nu din body — nu avem
    // încredere într-un id trimis de client, ca să nu poată cineva să ceară
    // ștergerea contului altcuiva).
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

    // Doar aici, server-side, folosim cheia de admin.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
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
