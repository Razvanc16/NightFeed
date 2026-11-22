// Utilitare mici pentru ecranul de autentificare — ținute separat ca să nu
// umfle AuthPage.jsx și ca să poată fi refolosite (ex: în Setări).

// --- Sugestie la greșeli de tipar în domeniul emailului --------------------
// "ion@gmial.com" → "ion@gmail.com". Comparăm domeniul cu o listă scurtă de
// provideri populari în RO și sugerăm doar dacă diferența e de 1-2 litere.
const COMMON_DOMAINS = [
  "gmail.com", "yahoo.com", "yahoo.ro", "hotmail.com", "outlook.com",
  "icloud.com", "live.com", "protonmail.com", "proton.me", "me.com",
];

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

export function suggestEmail(email) {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (domain.length < 4 || COMMON_DOMAINS.includes(domain)) return null;
  let best = null;
  let bestDist = Infinity;
  for (const d of COMMON_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist < bestDist) { best = d; bestDist = dist; }
  }
  if (bestDist > 0 && bestDist <= 2) return email.slice(0, at + 1) + best;
  return null;
}

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

// --- Buton "Deschide Gmail" pe ecranele de verificare ----------------------
export function mailProviderFor(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain === "gmail.com" || domain === "googlemail.com") return { name: "Gmail", url: "https://mail.google.com/mail/u/0/#inbox" };
  if (domain.startsWith("yahoo.")) return { name: "Yahoo Mail", url: "https://mail.yahoo.com" };
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return { name: "Outlook", url: "https://outlook.live.com/mail/" };
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) return { name: "iCloud Mail", url: "https://www.icloud.com/mail" };
  if (["proton.me", "protonmail.com"].includes(domain)) return { name: "Proton Mail", url: "https://mail.proton.me" };
  return null;
}

// --- "Ultima dată ai intrat cu..." ------------------------------------------
// Ținem doar metoda și emailul (nu parola!) în localStorage, ca la revenire
// să precompletăm emailul și să marcăm butonul folosit ultima dată.
const LAST_AUTH_KEY = "nf_last_auth";

export function getLastAuth() {
  try {
    const raw = localStorage.getItem(LAST_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setLastAuth(method, email) {
  try {
    localStorage.setItem(LAST_AUTH_KEY, JSON.stringify({ method, email: email || null }));
  } catch { /* storage blocat (mod privat) — nu e critic */ }
}
