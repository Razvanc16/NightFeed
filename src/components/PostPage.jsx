import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { formatEventDateTime, toDateInputValue, toTimeInputValue } from "../utils/eventTime";

const searchAddress = async (query) => {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=ro`,
      { headers: { "Accept-Language": "ro" } }
    );
    const data = await res.json();
    return data.map(r => ({
      label: r.display_name,
      short: r.display_name.split(",").slice(0, 2).join(","),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch { return []; }
};

export default function PostPage({ user, onClose, editEvent }) {
  const isEdit = !!editEvent;
  const [form, setForm] = useState({
    title: editEvent?.title || "",
    venue: editEvent?.venue || "",
    eventDate: toDateInputValue(editEvent?.event_date),
    eventTime: toTimeInputValue(editEvent?.event_date),
    price: editEvent?.price || "",
    type: editEvent?.type || "homemade",
    age_restricted: editEvent?.age_restricted || false,
    description: editEvent?.description || "",
    tags: editEvent?.tags || "",
    ticket_link: editEvent?.ticket_link || "",
    lat: editEvent?.lat || null,
    lng: editEvent?.lng || null,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(editEvent?.cover_url || null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [addressFocused, setAddressFocused] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);

  const handleAddressChange = (val) => {
    setForm(f => ({ ...f, venue: val, lat: null, lng: null }));
    clearTimeout(searchTimer.current);
    if (val.length >= 3) {
      setSearchingAddress(true);
      searchTimer.current = setTimeout(async () => {
        const results = await searchAddress(val);
        setAddressResults(results);
        setSearchingAddress(false);
      }, 500);
    } else {
      setAddressResults([]);
    }
  };

  const handleSelectAddress = (result) => {
    setForm(f => ({ ...f, venue: result.short, lat: result.lat, lng: result.lng }));
    setAddressResults([]);
    setAddressFocused(false);
  };

  const handleCover = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.venue || !form.eventDate || !form.eventTime) {
      alert("Completează titlul, locația și data/ora!"); return;
    }
    if (!user) { alert("Trebuie să fii autentificat!"); return; }

    setLoading(true);
    try {
      let cover_url = editEvent?.cover_url || null;
      if (coverFile) {
        const path = `covers/${user.id}_${Date.now()}`;
        const { error } = await supabase.storage.from("covers").upload(path, coverFile, { upsert: true });
        if (!error) {
          const { data } = supabase.storage.from("covers").getPublicUrl(path);
          cover_url = data.publicUrl;
        }
      }

      // venue/lat/lng nu mai trăiesc în posted_events (sunt în tabelul separat
      // event_locations, protejat prin RLS — vezi supabase/2026-08-11b_event_locations_table.sql).
      const { eventDate, eventTime, venue, lat, lng, ...rest } = form;
      const event_date = new Date(`${eventDate}T${eventTime}`).toISOString();
      const payload = { ...rest, date: formatEventDateTime(event_date), event_date, cover_url, user_id: user.id };

      let eventId = editEvent?.id;
      if (isEdit) {
        const { error } = await supabase.from("posted_events").update(payload).eq("id", eventId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("posted_events").insert([{ ...payload, verified: false }]).select("id").single();
        if (error) throw error;
        eventId = inserted.id;
      }

      const { error: locError } = await supabase.from("event_locations").upsert([{ event_id: eventId, venue, lat, lng }]);
      if (locError) throw locError;

      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 2000);
    } catch (err) {
      alert("Eroare: " + err.message);
    }
    setLoading(false);
  };

  if (success) return (
    <div style={{ width: "100%", height: "100%", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 64 }}>{isEdit ? "✅" : "🎉"}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{isEdit ? "Eveniment actualizat!" : "Eveniment trimis!"}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", padding: "0 32px" }}>
        {isEdit ? "Modificările au fost salvate." : "Va apărea în feed după verificare."}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808", overflowY: "auto", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: "50px 20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{isEdit ? "Editează eveniment" : "Adaugă eveniment"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{isEdit ? "Modifică detaliile" : "Va fi verificat înainte de publicare"}</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Închide
        </button>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        {/* Cover */}
        <div onClick={() => fileRef.current?.click()} style={{ width: "100%", height: 160, borderRadius: 16, background: coverPreview ? "transparent" : "rgba(255,51,102,0.08)", border: `2px dashed ${coverPreview ? "transparent" : "rgba(255,51,102,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 20, overflow: "hidden" }}>
          {coverPreview ? <img src={coverPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Adaugă poză cover</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleCover} style={{ display: "none" }} />

        {/* Tip */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tip eveniment</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "official", label: "⚡ Oficial" }, { id: "homemade", label: "🏠 Homemade" }].map(t => (
              <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))} style={{ flex: 1, padding: "10px", borderRadius: 12, background: form.type === t.id ? "rgba(255,51,102,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${form.type === t.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`, color: form.type === t.id ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: form.type === t.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Eveniment 18+ — doar etichetă informativă pe card, nu blochează pe nimeni */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setForm(f => ({ ...f, age_restricted: !f.age_restricted }))}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderRadius: 12, cursor: "pointer",
              background: form.age_restricted ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${form.age_restricted ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <span style={{ fontSize: 13, color: form.age_restricted ? "#FF3366" : "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif", fontWeight: form.age_restricted ? 700 : 400 }}>
              🔞 Eveniment 18+
            </span>
            <div style={{ width: 40, height: 22, borderRadius: 11, background: form.age_restricted ? "#FF3366" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 2, left: form.age_restricted ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </button>
        </div>

        {/* Titlu */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Titlu eveniment *</div>
          <input type="text" placeholder="ex: Petrecere la mine acasă" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
        </div>

        {/* Locație cu search */}
        <div style={{ marginBottom: 14, position: "relative" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Locație * {form.lat ? <span style={{ color: "#00C864" }}>📍 Localizat</span> : ""}
          </div>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Caută adresa..."
              value={form.venue}
              onChange={e => handleAddressChange(e.target.value)}
              onFocus={() => setAddressFocused(true)}
              style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: `1px solid ${form.lat ? "rgba(0,200,100,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
            {searchingAddress && (
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>...</div>
            )}
          </div>

          {/* Suggestions dropdown */}
          {addressResults.length > 0 && addressFocused && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(15,15,18,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, zIndex: 100, overflow: "hidden", marginTop: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
              {addressResults.map((r, i) => (
                <div key={i} onClick={() => handleSelectAddress(r)} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: i < addressResults.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ fontSize: 13, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>📍 {r.short}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Privacy note for homemade */}
          {form.type === "homemade" && form.lat && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 10, fontSize: 11, color: "#FFB800", fontFamily: "'DM Sans', sans-serif" }}>
              🔒 Pe hartă se va afișa doar o zonă aproximativă. Adresa exactă e vizibilă doar participanților acceptați.
            </div>
          )}
        </div>

        {/* Dată și oră — pickere native (pe iPhone apar exact ca rotițele de la ceasul cu alarmă).
            Click oriunde pe câmp (nu doar pe iconiță) deschide picker-ul, prin showPicker(). */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dată și oră *</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="date"
              value={form.eventDate}
              onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
              onClick={e => e.currentTarget.showPicker?.()}
              style={{ flex: 1, colorScheme: "dark", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
            <input
              type="time"
              step="60"
              lang="ro-RO"
              value={form.eventTime}
              onChange={e => setForm(f => ({ ...f, eventTime: e.target.value }))}
              onClick={e => e.currentTarget.showPicker?.()}
              style={{ flex: 1, colorScheme: "dark", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
          </div>
        </div>

        {/* Restul câmpurilor */}
        {[
          { key: "price", label: "Preț", placeholder: "ex: 80 RON sau Gratuit", type: "text" },
          { key: "tags", label: "Tag-uri", placeholder: "ex: techno, club, party", type: "text" },
          { key: "ticket_link", label: "Link bilete", placeholder: "https://...", type: "url" },
        ].map(field => (
          <div key={field.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{field.label}</div>
            <input type={field.type} placeholder={field.placeholder} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
              style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
          </div>
        ))}

        {/* Descriere */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Descriere</div>
          <textarea placeholder="Descrie evenimentul..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "none" }} />
        </div>

        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(255,51,102,0.3)" }}>
          {loading ? "Se salvează..." : isEdit ? "Salvează modificările ✅" : "Trimite evenimentul 🚀"}
        </button>
      </div>
    </div>
  );
}
