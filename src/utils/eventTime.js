// Utilitare pentru data/ora reală a evenimentelor postate (coloana "event_date",
// un timestamp adevărat — spre deosebire de "date", care rămâne un text de afișare
// gen "Sâmbătă, 22:00" generat automat din el, păstrat pentru compatibilitate cu
// ecranele care încă afișează direct event.date).

// Evenimentele vechi, postate înainte de acest update, nu au "event_date" — nu știm
// când au avut loc, așa că nu le considerăm expirate automat.
//
// Nu există un câmp separat de oră de final în schemă, doar ora de start —
// așa că "expirat" înseamnă "trecut de EVENT_GRACE_MS de la start", nu chiar
// momentul de start. Fără asta, un eveniment dispărea din Feed/Hartă/Căutare/
// Profil exact când începea — inclusiv pentru participanții cu cerere deja
// acceptată, care aveau nevoie de adresă și bilet QR chiar atunci, la intrare.
const EVENT_GRACE_MS = 6 * 60 * 60 * 1000; // 6h — durata tipică a unei petreceri
export const isEventExpired = (event) => {
  if (!event?.event_date) return false;
  const t = new Date(event.event_date).getTime();
  return !Number.isNaN(t) && t + EVENT_GRACE_MS < Date.now();
};

export const filterActiveEvents = (events) => (events || []).filter((e) => !isEventExpired(e));

// "Sâmbătă, 22/08, 22:00" generat dintr-un timestamp ISO real.
export const formatEventDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dayLabel = d.toLocaleDateString("ro-RO", { weekday: "long" });
  const capitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  const pad = (n) => String(n).padStart(2, "0");
  const dateNum = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const time = d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  return `${capitalized}, ${dateNum}, ${time}`;
};

// Prețul e text liber, salvat direct din formular — o valoare deja stocată
// malformat (introdusă înainte de clamp-ul de la tastare din PostPage, sau
// direct prin API) rupe layout-ul cardului dacă e afișată brută (ex: un șir
// de sute de cifre). Trunchiat defensiv la afișare, indiferent de sursă.
const MAX_PRICE_DISPLAY_LEN = 14;
export const formatPrice = (price) => {
  if (!price) return price;
  const s = String(price);
  return s.length > MAX_PRICE_DISPLAY_LEN ? s.slice(0, MAX_PRICE_DISPLAY_LEN) + "…" : s;
};

// "2026-08-09" pentru <input type="date">
export const toDateInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "22:00" pentru <input type="time">
export const toTimeInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Șterge best-effort evenimentele expirate ale userului curent. RLS din Supabase
// permite deja ștergerea propriilor rânduri (la fel ca butonul manual "Șterge
// eveniment" din profil), deci asta funcționează fără nicio schimbare de permisiuni.
// Dacă din orice motiv nu merge (offline, RLS diferit etc.), evenimentele tot rămân
// ascunse prin filterActiveEvents — nu se văd în aplicație oricum.
export async function cleanupOwnExpiredEvents(supabase, events) {
  const expiredIds = (events || []).filter(isEventExpired).map((e) => e.id);
  if (!expiredIds.length) return;
  try {
    await supabase.from("posted_events").delete().in("id", expiredIds);
  } catch {
    // best-effort
  }
}
