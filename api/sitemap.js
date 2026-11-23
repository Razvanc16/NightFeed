// Sitemap dinamic: pagina principală + evenimentele active (nightfeed.ro/e/<id>),
// ca Google să le poată indexa. Servit la /sitemap.xml (rewrite în vercel.json).
const SUPABASE_URL = "https://rjeyiovwmkmltenmyhij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZXlpb3Z3bWttbHRlbm15aGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Nzc4NTYsImV4cCI6MjA5NjE1Mzg1Nn0.3QgA2D94kqcjd_oUzOJDArVmczja3vc1ozJVYMo_be8";
const SITE = "https://nightfeed.ro";

export default async function handler(req, res) {
  let events = [];
  try {
    const now = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/posted_events_feed?select=id,created_at,event_date&archived=eq.false&or=(type.neq.official,verified.eq.true)&event_date=gte.${now}&order=event_date.asc&limit=1000`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    const rows = await r.json();
    if (Array.isArray(rows)) events = rows;
  } catch { /* doar pagina principală */ }

  const urls = [
    `<url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...events.map((e) => `<url><loc>${SITE}/e/${e.id}</loc>${e.created_at ? `<lastmod>${new Date(e.created_at).toISOString()}</lastmod>` : ""}<changefreq>daily</changefreq><priority>0.7</priority></url>`),
  ];
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
}
