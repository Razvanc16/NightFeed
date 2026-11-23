// Raportare minimă de erori din browser în tabela Supabase `client_errors`
// (vezi supabase/2026-11-23_client_errors.sql). Fără servicii externe:
// prinde erorile JS necaptate și promise-urile respinse, maxim câteva pe
// sesiune, ca să nu inunde baza dacă o eroare se repetă în buclă.

import { supabase } from "../supabase";

const MAX_PER_SESSION = 5;
let sent = 0;
const seen = new Set();

function report(message, stack, source) {
  if (sent >= MAX_PER_SESSION) return;
  const msg = String(message || "").slice(0, 500);
  if (!msg || seen.has(msg)) return;
  // Zgomot fără valoare (extensii de browser, scripturi terțe, rețea căzută).
  if (/ResizeObserver loop|Script error\.?$|chrome-extension:|Load failed|Failed to fetch|NetworkError/i.test(msg)) return;
  seen.add(msg);
  sent += 1;

  supabase.auth.getSession().then(({ data }) => {
    supabase.from("client_errors").insert({
      message: msg,
      stack: String(stack || "").slice(0, 4000),
      source: String(source || "").slice(0, 300),
      url: window.location.pathname.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 300),
      user_id: data?.session?.user?.id || null,
      app_version: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    }).then(() => {}, () => {});
  });
}

export function initErrorReporting() {
  if (import.meta.env.DEV) return; // local vedem oricum consola
  window.addEventListener("error", (e) => {
    report(e.message, e.error?.stack, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    report(r?.message || String(r), r?.stack, "unhandledrejection");
  });
}
