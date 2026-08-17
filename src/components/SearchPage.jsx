import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { filterActiveEvents, formatEventDateTime } from "../utils/eventTime";
import { KeyIcon, SearchIcon, MoonIcon, LightningIcon, HouseIcon, PersonIcon } from "./Icons";

const convertPostedEvent = (e, organizerMap = {}) => {
  const organizer = organizerMap[e.user_id] || {};
  return {
    id: `posted_${e.id}`,
    rawId: e.id,
    code: e.code,
    type: e.type || "homemade",
    title: e.title,
    venue: e.venue || "Locație necunoscută",
    location_visible: !!e.location_visible,
    date: (e.event_date && formatEventDateTime(e.event_date)) || e.date || "Data necunoscută",
    event_date: e.event_date || null,
    price: e.price || "Gratuit",
    tags: e.tags ? e.tags.split(",").map(t => t.trim()) : [],
    color: e.type === "official" ? "#FF3366" : "#FFB800",
    description: e.description || "",
    cover_url: e.cover_url,
    organizerName: organizer.displayName || "",
  };
};

export default function SearchPage({ onOpenEvent, onViewProfile }) {
  const [searchMode, setSearchMode] = useState("events"); // "events" | "people"
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [allEvents, setAllEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, nume, prenume, avatar_url");
      setPeople((profiles || []).map(p => ({
        user_id: p.user_id,
        displayName: [p.prenume, p.nume].filter(Boolean).join(" ").trim(),
        avatar_url: p.avatar_url,
      })).filter(p => p.displayName));
      setPeopleLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("posted_events_feed").select("*").eq("archived", false).or("type.neq.official,verified.eq.true").order("created_at", { ascending: false });
      const active = filterActiveEvents(data);

      // Aducem numele hostilor, ca să poți căuta și după numele lor,
      // nu doar după titlul/locația evenimentului.
      const hostIds = [...new Set(active.map(e => e.user_id).filter(Boolean))];
      let organizerMap = {};
      if (hostIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, nume, prenume").in("user_id", hostIds);
        organizerMap = Object.fromEntries((profiles || []).map(p => [
          p.user_id,
          { displayName: [p.prenume, p.nume].filter(Boolean).join(" ") },
        ]));
      }

      setAllEvents(active.map(e => convertPostedEvent(e, organizerMap)));
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
  // Nu arătăm toate evenimentele/userii din start — doar după ce cauți ceva.
  // allEvents/people rămân încărcate în fundal (pentru filtrare instant și
  // pentru căutarea după cod), doar nu le afișăm până tastezi.
  const results = q.length === 0 ? [] : allEvents.filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.venue.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.tags.some(t => t.toLowerCase().includes(q)) ||
    e.organizerName.toLowerCase().includes(q)
  );
  const peopleResults = q.length === 0 ? [] : people.filter(p =>
    p.displayName.toLowerCase().includes(q)
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
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#FF3366", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}><KeyIcon size={12} /> Acces direct cu cod</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && handleCodeSubmit()}
              placeholder=""
              maxLength={6}
              style={{ flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 18, fontFamily: "'DM Mono', monospace", letterSpacing: "0.2em", outline: "none", textTransform: "uppercase" }}
            />
            <button onClick={handleCodeSubmit} style={{ padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #FF3366, #FF6B35)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>Intră</button>
          </div>
          {codeError && <div style={{ fontSize: 12, color: "#FF3366", marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>{codeError}</div>}
        </div>

        {/* Căutare text */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", opacity: 0.4, display: "flex" }}><SearchIcon size={16} /></span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchMode === "events" ? "Caută după nume, host, loc, tag..." : "Caută după nume..."}
            style={{ width: "100%", padding: "13px 16px 13px 44px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
          />
        </div>

        {/* Comutator Evenimente / Oameni */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[{ id: "events", label: "Evenimente", icon: SearchIcon }, { id: "people", label: "Oameni", icon: PersonIcon }].map(m => (
            <button
              key={m.id}
              onClick={() => setSearchMode(m.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 12px", borderRadius: 12, cursor: "pointer",
                background: searchMode === m.id ? "rgba(255,51,102,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${searchMode === m.id ? "rgba(255,51,102,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: searchMode === m.id ? "#FF3366" : "rgba(255,255,255,0.5)",
                fontSize: 13, fontWeight: searchMode === m.id ? 700 : 500, fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <m.icon size={14} /> {m.label}
            </button>
          ))}
        </div>

        {/* Rezultate */}
        {searchMode === "events" ? (
          loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: "rgba(255,255,255,0.3)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={32} /></div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><SearchIcon size={36} /></div>
              <div style={{ fontSize: 14 }}>{q ? "Niciun rezultat pentru căutarea ta." : "Caută după nume, host, loc sau tag."}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map(event => (
                <button key={event.id} onClick={() => onOpenEvent(event)} style={{ textAlign: "left", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: event.cover_url ? "transparent" : `${event.color}20`, border: `1px solid ${event.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: event.color, flexShrink: 0, overflow: "hidden" }}>
                    {event.cover_url ? <img src={event.cover_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (event.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {event.location_visible ? event.venue : "Zonă aproximativă"} · {event.date}
                      {event.organizerName && ` · ${event.organizerName}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: event.color, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 8, background: `${event.color}15`, flexShrink: 0 }}>
                    {event.code || "—"}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          peopleLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: "rgba(255,255,255,0.3)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={32} /></div>
          ) : peopleResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><PersonIcon size={36} /></div>
              <div style={{ fontSize: 14 }}>{q ? "Niciun om găsit pentru căutarea ta." : "Caută după nume."}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {peopleResults.map(p => (
                <button key={p.user_id} onClick={() => onViewProfile(p.user_id)} style={{ textAlign: "left", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: p.avatar_url ? "transparent" : "linear-gradient(135deg, #FF3366, #B44FFF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, overflow: "hidden", fontSize: 16, fontWeight: 800 }}>
                    {p.avatar_url ? <img src={p.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.displayName}</div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
