// Login cu Google prin Google Identity Services (GIS) + supabase.signInWithIdToken.
//
// De ce nu signInWithOAuth? Fluxul clasic de redirect trece prin
// <proiect>.supabase.co/auth/v1/callback, așa că Google afișa
// "to continue to rjeyiovwmkmltenmyhij.supabase.co". Cu GIS, Google emite
// token-ul direct pentru site-ul nostru, iar fereastra afișează nightfeed.ro.
//
// Necesită VITE_GOOGLE_CLIENT_ID (același Web Client ID setat în Supabase →
// Authentication → Providers → Google). Fără el, AuthPage revine la redirect.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

let scriptPromise = null;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error("GIS indisponibil")));
    s.onerror = () => { scriptPromise = null; reject(new Error("Nu s-a putut încărca Google Sign-In")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Nonce: Google primește hash-ul SHA-256, Supabase primește valoarea brută și
// verifică potrivirea — împiedică reutilizarea unui token furat.
export async function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}
