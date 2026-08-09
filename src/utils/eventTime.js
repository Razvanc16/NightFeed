// Utilitare pentru data/ora reală a evenimentelor postate (coloana "event_date",
// un timestamp adevărat — spre deosebire de "date", care rămâne un text de afișare
// gen "Sâmbătă, 22:00" generat automat din el, păstrat pentru compatibilitate cu
// ecranele care încă afișează direct event.date).

// Evenimentele vechi, postate înainte de acest update, nu au "event_date" — nu știm
// când au avut loc, așa că nu le considerăm expirate automat.
export const isEventExpired = (event) => {
  if (!event?.event_date) return false;
  const t = new Date(event.event_date).getTime();
  return !Number.isNaN(t) && t < Date.now();
};

export const filterActiveEvents = (events) => (events || []).filter((e) => !isEventExpired(e));

// "Sâmbătă, 22:00" generat dintr-un timestamp ISO real.
export const formatEventDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dayLabel = d.toLocaleDateString("ro-RO", { weekday: "long" });
  const capitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  const time = d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  return `${capitalized}, ${time}`;
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
