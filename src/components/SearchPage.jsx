import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { filterActiveEvents } from "../utils/eventTime";

const convertPostedEvent = (e) => ({
  id: `posted_${e.id}`,
  rawId: e.id,
  code: e.code,
  type: e.type || "homemade",
  title: e.title,
  venue: e.venue || "Locație necunoscută",
  date: e.date || "Data necunoscută",
  event_date: e.event_date || null,
  price: e.price || "Gratuit",
  tags: e.tags ? e.tags.split(",").map(t => t.trim()) : [],
  color: e.type === "official" ? "#FF3366" : "#FFB800",
  description: e.description || "",
  cover_url: e.cover_url,
});

export default function SearchPage({ onOpenEvent }) {
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("posted_events").select("*").order("created_at", { ascending: false });
      setAllEvents(filterActiveEvents(data).map(convertPostedEvent));
      setLoading(false);
    })();
  }, []);

  // Scoate live evenimentele care expiră cât timp userul stă pe ecranul de căutare.
  useEffect(() => {
    const interval = setInterval(() => {
      setAllEvents(prev => filterActiveEvents(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q.length === 0 ? allEvents : allEvents.filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.venue.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.tags.some(t => t.toLowerCase().includes(q))
  );

  const handleCodeSubmit = () => {
    setCodeError("");
    const c = code.trim().toUpperCase();
    if (c.length !== 6) { setCodeError("Codul are exact 6 caractere."); return; }
    const found = allEvents.find(e => e.code === c);
    if (!found) { setCodeError("Niciun eveniment cu acest cod."); return; }
    onOpenEvent(found);
  };

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808", overflowY: "auto", paddingBottom: 80 }}>
      <div style={{ padding: "50px 20px 20px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Caută</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>Găsește petreceri sau intră cu un cod</div>

        {/* Acces direct cu cod */}
        <div style={{ background: "rgba(255,51,102,0.06)", border: "1px solid rgba(255,51,102,0.2)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#FF3366", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🔑 Acces direct cu cod</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && handleCodeSubmit()}
              placeholder="ex: A7X9K2"
              maxLength={6}
              style={{ flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 18, fontFamily: "'DM Mono', monospace", letterSpacing: "0.2em", outline: "none", textTransform: "uppercase" }}
            />
            <button onClick={handleCodeSubmit} style={{ padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #FF3366, #FF6B35)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>Intră</button>
          </div>
          {codeError && <div style={{ fontSize: 12, color: "#FF3366", marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>{codeError}</div>}
        </div>

        {/* Căutare text */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Caută după nume, loc, tag..."
            style={{ width: "100%", padding: "13px 16px 13px 44px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
          />
        </div>

        {/* Rezultate */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)", fontSize: 32, animation: "pulse 1.5s ease-in-out infinite" }}>🌙</div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14 }}>{q ? "Niciun rezultat pentru căutarea ta." : "Niciun eveniment încă."}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map(event => (
              <button key={event.id} onClick={() => onOpenEvent(event)} style={{ textAlign: "left", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: event.cover_url ? "transparent" : `${event.color}20`, border: `1px solid ${event.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, overflow: "hidden" }}>
                  {event.cover_url ? <img src={event.cover_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (event.type === "official" ? "⚡" : "🏠")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    {event.type === "homemade" ? "Zonă aproximativă" : event.venue} · {event.date}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: event.color, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 8, background: `${event.color}15`, flexShrink: 0 }}>
                  {event.code || "—"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
