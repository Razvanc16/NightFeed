// Pagina publică a unui eveniment: /e/<id> (rewrite din vercel.json).
//
// Aplicația e un SPA, deci fără asta toate linkurile ar avea aceeași
// previzualizare. Funcția ia index.html-ul construit, îi înlocuiește titlul,
// descrierea și imaginea Open Graph cu cele ale evenimentului, și îl
// returnează — crawlerele (WhatsApp, Facebook, Google) văd evenimentul,
// iar în browser React pornește normal și deschide evenimentul.

const SUPABASE_URL = "https://rjeyiovwmkmltenmyhij.supabase.co";
// Cheia publică "anon" — aceeași care e deja în bundle-ul din browser.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZXlpb3Z3bWttbHRlbm15aGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Nzc4NTYsImV4cCI6MjA5NjE1Mzg1Nn0.3QgA2D94kqcjd_oUzOJDArVmczja3vc1ozJVYMo_be8";
const SITE = "https://nightfeed.ro";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const opts = { timeZone: "Europe/Bucharest" };
  const day = d.toLocaleDateString("ro-RO", { ...opts, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ro-RO", { ...opts, hour: "2-digit", minute: "2-digit" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`;
}

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i");
  return html.replace(re, `$1${esc(value)}$2`);
}

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const htmlRes = await fetch(`${SITE}/index.html`);
  let html = await htmlRes.text();

  let event = null;
  if (UUID.test(id)) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/posted_events_feed?id=eq.${id}&select=id,title,description,cover_url,event_date,venue,location_visible,type,archived&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0] && !rows[0].archived) event = rows[0];
    } catch { /* cădem pe meta-urile implicite */ }
  }

  if (event) {
    const url = `${SITE}/e/${event.id}`;
    const when = formatDate(event.event_date);
    // La petrecerile homemade cu locație ascunsă nu dezvăluim adresa în preview.
    const where = event.location_visible ? (event.venue || "") : "Locația se află după ce ești acceptat";
    const title = `${event.title} · NightFeed`;
    const desc = [when, where].filter(Boolean).join(" · ") || "Vezi evenimentul pe NightFeed";
    const image = event.cover_url && !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(event.cover_url) ? event.cover_url : `${SITE}/og-image.png`;

    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
    html = setMeta(html, "name", "description", desc);
    html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${url}" />`);
    for (const [k, v] of [["og:url", url], ["og:title", title], ["og:description", desc], ["og:image", image], ["og:image:alt", event.title], ["og:type", "article"]]) {
      html = setMeta(html, "property", k, v);
    }
    for (const [k, v] of [["twitter:title", title], ["twitter:description", desc], ["twitter:image", image]]) {
      html = setMeta(html, "name", k, v);
    }
    if (image !== `${SITE}/og-image.png`) {
      // Dimensiunile din index.html sunt ale imaginii implicite (1200x630) — le scoatem.
      html = html.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/gi, "");
    }
    // Date structurate pentru Google (rezultat de tip "eveniment").
    const ld = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.title,
      description: event.description || desc,
      startDate: event.event_date || undefined,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      image: [image],
      url,
      location: { "@type": "Place", name: event.location_visible ? (event.venue || "România") : "România", address: event.location_visible ? (event.venue || "România") : "România" },
      organizer: { "@type": "Organization", name: "NightFeed", url: SITE },
    };
    html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\u003c")}</script>\n  </head>`);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.status(200).send(html);
}
