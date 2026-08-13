import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { formatEventDateTime, toDateInputValue, toTimeInputValue } from "../utils/eventTime";
import { CheckCircleIcon, ConfettiIcon, CameraIcon, LightningIcon, HouseIcon, NoEntryIcon, PinIcon, LockIcon, RocketIcon } from "./Icons";

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

// "80 RON" -> "80"; "Gratuit"/gol -> ""
const extractPriceAmount = (price) => {
  if (!price || price === "Gratuit") return "";
  const match = price.match(/\d+/);
  return match ? match[0] : "";
};

export default function PostPage({ user, onClose, editEvent }) {
  const isEdit = !!editEvent;
  const [priceMode, setPriceMode] = useState(editEvent?.price && editEvent.price !== "Gratuit" ? "paid" : "free");
  const [priceAmount, setPriceAmount] = useState(extractPriceAmount(editEvent?.price));
  const [form, setForm] = useState({
    title: editEvent?.title || "",
    venue: editEvent?.venue || "",
    eventDate: toDateInputValue(editEvent?.event_date),
    eventTime: toTimeInputValue(editEvent?.event_date),
    price: editEvent?.price || "",
    type: editEvent?.type || "homemade",
    age_restricted: editEvent?.age_restricted || false,
    description: editEvent?.description || "",
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

  const [coverError, setCoverError] = useState("");

  const handleCover = (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // permite reselectarea aceluiași fișier dacă ai corectat ceva
    if (!file) return;
    setCoverError("");

    if (file.type.startsWith("video/")) {
      // Verificăm durata înainte să acceptăm — feed-ul suportă doar clipuri
      // scurte (max 15s), ca să rămână un format rapid de consumat, nu un
      // upload de filmuleț întreg.
      const url = URL.createObjectURL(file);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        if (probe.duration > 15.5) {
          setCoverError(`Videoclipul are ${probe.duration.toFixed(0)}s — maxim 15 secunde.`);
          URL.revokeObjectURL(url);
          return;
        }
        setCoverFile(file);
        setCoverPreview(url);
      };
      probe.onerror = () => {
        setCoverError("Nu am putut citi acest videoclip. Încearcă alt fișier.");
        URL.revokeObjectURL(url);
      };
      probe.src = url;
    } else {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const [showNoPhotoConfirm, setShowNoPhotoConfirm] = useState(false);

  const handleSubmit = () => {
    if (!form.title || !form.venue || !form.eventDate || !form.eventTime) {
      alert("Completează titlul, locația și data/ora!"); return;
    }
    if (priceMode === "paid" && !priceAmount) {
      alert("Completează prețul, sau alege Gratuit!"); return;
    }
    if (!user) { alert("Trebuie să fii autentificat!"); return; }

    // Evenimentele fără poză se văd mult mai slab în feed (doar gradient) —
    // înainte să postăm, dăm ocazia să adauge una, fără să blocăm pe cine
    // chiar vrea să posteze fără.
    if (!coverPreview) { setShowNoPhotoConfirm(true); return; }
    doSubmit();
  };

  const doSubmit = async () => {
    setLoading(true);
    try {
      let cover_url = editEvent?.cover_url || null;
      if (coverFile) {
        // Extensia rămâne în path — e cum deosebim video de poză mai târziu în
        // feed (fără o coloană nouă în bază: .mp4/.mov/.webm etc. = video).
        const ext = coverFile.name.split(".").pop();
        const path = `covers/${user.id}_${Date.now()}.${ext}`;
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
      <div style={{ color: "#00C864" }}>{isEdit ? <CheckCircleIcon size={56} /> : <ConfettiIcon size={56} />}</div>
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
        <div onClick={() => fileRef.current?.click()} style={{ width: "100%", height: 160, borderRadius: 16, background: coverPreview ? "transparent" : "rgba(255,51,102,0.08)", border: `2px dashed ${coverPreview ? "transparent" : "rgba(255,51,102,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: coverPreview ? 8 : 8, overflow: "hidden" }}>
          {coverPreview ? (
            coverFile?.type.startsWith("video/")
              ? <video src={coverPreview} muted autoPlay loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <img src={coverPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
              <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><CameraIcon size={30} /></div>
              <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Adaugă poză sau video cover (max 15s)</div>
            </div>
          )}
        </div>
        {coverError && (
          <div style={{ fontSize: 12, color: "#FF3366", fontFamily: "'DM Sans', sans-serif", marginTop: 8, textAlign: "center" }}>{coverError}</div>
        )}
        {!coverPreview && !coverError && (
          <div style={{ fontSize: 12, color: "#FF3366", fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 20, textAlign: "center" }}>
            📸 Evenimentele cu poză sau video ies mult mai bine în evidență în feed
          </div>
        )}
        {coverPreview && <div style={{ marginBottom: 20 }} />}
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleCover} style={{ display: "none" }} />

        {/* Tip */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tip eveniment</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "official", label: "Oficial", icon: LightningIcon }, { id: "homemade", label: "Homemade", icon: HouseIcon }].map(t => (
              <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))} style={{ flex: 1, padding: "10px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: form.type === t.id ? "rgba(255,51,102,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${form.type === t.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`, color: form.type === t.id ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: form.type === t.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}><t.icon size={14} /> {t.label}</button>
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: form.age_restricted ? "#FF3366" : "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif", fontWeight: form.age_restricted ? 700 : 400 }}>
              <NoEntryIcon size={15} /> Eveniment 18+
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
            Locație * {form.lat ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#00C864" }}><PinIcon size={12} /> Localizat</span> : ""}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}><PinIcon size={12} /> {r.short}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Privacy note for homemade */}
          {form.type === "homemade" && form.lat && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 10, fontSize: 11, color: "#FFB800", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "flex-start", gap: 6 }}>
              <LockIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Pe hartă se va afișa doar o zonă aproximativă. Adresa exactă e vizibilă doar participanților acceptați.
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

        {/* Preț */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Preț</div>
          <div style={{ display: "flex", gap: 8, marginBottom: priceMode === "paid" ? 8 : 0 }}>
            {[{ id: "free", label: "Gratuit" }, { id: "paid", label: "Cu preț" }].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPriceMode(m.id);
                  setForm(f => ({ ...f, price: m.id === "free" ? "Gratuit" : (priceAmount ? `${priceAmount} RON` : "") }));
                }}
                style={{ flex: 1, padding: "10px", borderRadius: 12, background: priceMode === m.id ? "rgba(255,51,102,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${priceMode === m.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`, color: priceMode === m.id ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: priceMode === m.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {priceMode === "paid" && (
            <div style={{ position: "relative" }}>
              <input
                type="number" min="0" placeholder="ex: 80" value={priceAmount}
                onChange={e => {
                  const val = e.target.value;
                  setPriceAmount(val);
                  setForm(f => ({ ...f, price: val ? `${val} RON` : "" }));
                }}
                style={{ width: "100%", padding: "12px 50px 12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              />
              <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>RON</span>
            </div>
          )}
        </div>

        {/* Restul câmpurilor */}
        {[
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

        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: loading ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(255,51,102,0.3)" }}>
          {loading ? "Se salvează..." : isEdit ? <><CheckCircleIcon size={17} /> Salvează modificările</> : <><RocketIcon size={17} /> Trimite evenimentul</>}
        </button>
      </div>

      {showNoPhotoConfirm && (
        <>
          <div onClick={() => setShowNoPhotoConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 500 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501, background: "#0f0f12", borderTop: "2px solid rgba(255,51,102,0.3)", borderRadius: "24px 24px 0 0", padding: "22px 20px 40px", animation: "slideUp 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: "#FF3366" }}><CameraIcon size={36} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", textAlign: "center", marginBottom: 8 }}>
              Postezi fără poză?
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", lineHeight: 1.5, marginBottom: 20 }}>
              Evenimentele cu poză primesc mult mai multă atenție în feed. Poți oricând să adaugi una acum.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { setShowNoPhotoConfirm(false); fileRef.current?.click(); }} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}>
                Adaugă o poză
              </button>
              <button onClick={() => { setShowNoPhotoConfirm(false); doSubmit(); }} style={{ width: "100%", padding: "13px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                Postează oricum
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
