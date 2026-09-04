import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { formatEventDateTime, toDateInputValue, toTimeInputValue, filterActiveEvents } from "../utils/eventTime";
import { notifyUser } from "../utils/pushNotifications";
import { loadGoogleMaps, DARK_MAP_STYLE } from "../utils/googleMapsLoader";
import LegalPage from "./LegalPage";
import { CheckCircleIcon, ConfettiIcon, CameraIcon, LightningIcon, HouseIcon, PinIcon, LockIcon, RocketIcon, VIBE_OPTIONS } from "./Icons";

// Contul care aprobă evenimentele oficiale (Razvan) — evenimentele "oficial"
// rămân ascunse din feed până le validează manual (verified=true în Supabase),
// ca oricine să nu poată posta ca eveniment oficial fără control.
const OFFICIAL_REVIEWER_ID = "0185e56d-fa21-4d25-a6e0-9885fc08743f";

// Fără limită, un user putea posta oricâte petreceri simultan — feed-ul unei
// singure persoane putea acoperi tot feed-ul general. Se aplică doar la
// evenimente noi, nu și la editarea uneia deja postate.
const MAX_ACTIVE_EVENTS = 2;

// Autocomplete-ul de adresă folosea Nominatim (OpenStreetMap) — gratuit, dar
// vizibil mai lent decât Google și mult mai slab la găsit un local după nume
// (caută mai ales adrese stradale exacte). Aplicația oricum are deja Google
// Maps încărcat pentru hartă, deci refolosim același SDK pentru Places.
//
// IMPORTANT: nu AutocompleteService/PlacesService (API-ul "legacy") — de la
// 1 martie 2025, Google nu mai activează Places API (legacy) pentru proiecte
// noi ("not available to new customers"), confirmat live (eroare
// LegacyApiNotActivatedMapError). Trebuie noul Places API — clasele
// AutocompleteSuggestion / Place, prin google.maps.importLibrary("places").
let placesSessionToken = null;

const ensurePlacesLibrary = async () => {
  const maps = await loadGoogleMaps();
  if (!maps.places?.AutocompleteSuggestion) {
    await window.google.maps.importLibrary("places");
  }
  if (!placesSessionToken) placesSessionToken = new window.google.maps.places.AutocompleteSessionToken();
};

const searchAddress = async (query) => {
  if (!query || query.length < 3) return [];
  try {
    await ensurePlacesLibrary();
    const { AutocompleteSuggestion } = window.google.maps.places;
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query,
      includedRegionCodes: ["ro"],
      sessionToken: placesSessionToken,
    });
    return (suggestions || [])
      .filter(s => s.placePrediction)
      .map(s => {
        const p = s.placePrediction;
        return {
          label: p.text.text,
          short: [p.mainText?.text, p.secondaryText?.text].filter(Boolean).join(", ") || p.text.text,
          placePrediction: p,
        };
      });
  } catch (err) {
    console.error("Eroare autocomplete adresă:", err);
    return [];
  }
};

// Coordonatele exacte nu vin în sugestiile de autocomplete (doar text) — se
// cer separat, o singură dată, când userul chiar alege o sugestie.
const getPlaceCoords = async (result) => {
  try {
    await ensurePlacesLibrary();
    const place = result.placePrediction.toPlace();
    await place.fetchFields({ fields: ["location"] });
    placesSessionToken = null; // sesiunea se încheie odată aleasă o sugestie
    if (!place.location) return null;
    return { lat: place.location.lat(), lng: place.location.lng() };
  } catch (err) {
    console.error("Eroare la detaliile locației:", err);
    return null;
  }
};

// Adresa aproximativă a unui pin pus manual pe hartă — best-effort, dacă
// eșuează lăsăm userul să scrie el adresa (nu blocăm plasarea pinului).
const reverseGeocode = async (lat, lng) => {
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    if (!results?.[0]) return "";
    return results[0].formatted_address.split(",").slice(0, 2).join(",");
  } catch { return ""; }
};

// "80 RON" -> "80"; "Gratuit"/gol -> ""
const extractPriceAmount = (price) => {
  if (!price || price === "Gratuit") return "";
  const match = price.match(/\d+/);
  return match ? match[0] : "";
};

// Input-ul de preț era type=number fără max — nimic nu oprea un șir de sute
// de cifre, care rupea layout-ul cardului în feed (vezi eveniment de test
// cu preț de ~600 cifre). Clamp la o valoare rezonabilă, atât la tastare
// cât și la editarea unui eveniment care are deja un preț invalid salvat.
const MAX_PRICE = 100000;
const MAX_PARTICIPANTS = 5000;
// Whitelist explicită de tipuri — atributul accept="image/*,video/*" de pe
// input e doar un hint pt. selector-ul de fișiere, ușor de ocolit ("All files"
// în dialogul de sistem, sau un fișier setat programatic pe input); fără
// verificare aici, orice fișier (inclusiv unul executabil redenumit .jpg)
// ajungea direct în Supabase Storage.
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 60;
const clampPrice = (val) => {
  if (!val) return val;
  const n = Number(val);
  if (!Number.isFinite(n) || n > MAX_PRICE) return String(MAX_PRICE);
  return val;
};

export default function PostPage({ user, onClose, editEvent }) {
  const isEdit = !!editEvent;
  const [priceMode, setPriceMode] = useState(editEvent?.price && editEvent.price !== "Gratuit" ? "paid" : "free");
  const [priceAmount, setPriceAmount] = useState(clampPrice(extractPriceAmount(editEvent?.price)));
  const [form, setForm] = useState({
    title: editEvent?.title || "",
    venue: editEvent?.venue || "",
    eventDate: toDateInputValue(editEvent?.event_date),
    eventTime: toTimeInputValue(editEvent?.event_date),
    price: editEvent?.price || "Gratuit",
    type: editEvent?.type || "homemade",
    location_visible: editEvent ? !!editEvent.location_visible : false,
    vibe: editEvent?.vibe || null,
    age_restricted: editEvent?.age_restricted || false,
    description: editEvent?.description || "",
    ticket_link: editEvent?.ticket_link || "",
    lat: editEvent?.lat || null,
    lng: editEvent?.lng || null,
    max_participants: editEvent?.max_participants ?? "",
    contact_name: editEvent?.contact_name || "",
    contact_phone: editEvent?.contact_phone || "",
    contact_email: editEvent?.contact_email || "",
    contact_social: editEvent?.contact_social || "",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(editEvent?.cover_url || null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [addressFocused, setAddressFocused] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressDropUpward, setAddressDropUpward] = useState(false);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);
  const addressWrapRef = useRef(null);

  // Pin manual pe hartă — alternativă la căutarea de adresă, pentru locuri
  // fără adresă exactă (parc, curte, zonă în aer liber etc.). Ca la Uber: pinul
  // stă fix în centrul ecranului, tu miști harta pe sub el (nu pinul pe hartă) —
  // mai natural pe telefon decât să nimerești exact un punct cu degetul.
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [pickerMoving, setPickerMoving] = useState(false);
  const pickerMapRef = useRef(null);
  const pickerMapInstanceRef = useRef(null);
  const reverseGeocodeTimer = useRef(null);
  // true doar la primul "idle" (randarea inițială) când porneam deja cu o
  // locație (din căutarea de adresă) — nu vrem ca acel prim idle să
  // rescrie form.venue prin reverse-geocode peste adresa deja aleasă.
  const skipNextIdleRef = useRef(false);

  // Dacă adresa e completată jos de tot în formular (aproape de bara de
  // navigare fixă), lista de sugestii deschisă în jos ar ieși din vizibil —
  // o deschidem în sus în loc, ca la meniul ⋮ din Profil.
  useEffect(() => {
    if (!addressFocused || addressResults.length === 0 || !addressWrapRef.current) return;
    const rect = addressWrapRef.current.getBoundingClientRect();
    const NAVBAR_RESERVED = 90;
    const estimatedHeight = Math.min(addressResults.length, 5) * 52;
    const spaceBelow = window.innerHeight - rect.bottom - NAVBAR_RESERVED;
    setAddressDropUpward(spaceBelow < estimatedHeight);
  }, [addressFocused, addressResults]);

  // Pornește încărcarea SDK-ului din prima clipă (nu abia când userul apasă
  // pe hartă) — altfel prima literă tastată în câmpul de adresă aștepta după
  // tot scriptul Google Maps, simțindu-se "înțepenit" la prima căutare.
  useEffect(() => {
    loadGoogleMaps().catch(() => {});
  }, []);

  useEffect(() => {
    if (!showMapPicker) return;
    let cancelled = false;
    loadGoogleMaps().then(() => { if (!cancelled) setMapsLoaded(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [showMapPicker]);

  useEffect(() => {
    if (!showMapPicker || !mapsLoaded || !pickerMapRef.current || pickerMapInstanceRef.current) return;
    const google = window.google;
    const hasInitialLocation = !!(form.lat && form.lng);
    const center = hasInitialLocation ? { lat: form.lat, lng: form.lng } : { lat: 44.4268, lng: 26.1025 };
    const map = new google.maps.Map(pickerMapRef.current, {
      center, zoom: hasInitialLocation ? 16 : 12, styles: DARK_MAP_STYLE,
      disableDefaultUI: true, zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      clickableIcons: false,
    });
    pickerMapInstanceRef.current = map;
    // Locația era deja setată (ex: din căutarea de adresă) — sărim peste
    // primul "idle" (declanșat automat de randarea inițială), ca să nu
    // rescriem adresa deja aleasă printr-un reverse-geocode inutil.
    skipNextIdleRef.current = hasInitialLocation;

    const commitCenter = () => {
      const c = map.getCenter();
      const lat = c.lat(), lng = c.lng();
      setForm(f => ({ ...f, lat, lng }));
      setPickerMoving(false);
      clearTimeout(reverseGeocodeTimer.current);
      reverseGeocodeTimer.current = setTimeout(async () => {
        const addr = await reverseGeocode(lat, lng);
        if (addr) setForm(f => ({ ...f, venue: addr }));
      }, 400);
    };

    map.addListener("dragstart", () => setPickerMoving(true));
    // "idle" e echivalentul Google Maps pentru "moveend" (se declanșează și
    // după zoom, și după randarea inițială — de-aici nevoia de skipNextIdleRef).
    map.addListener("idle", () => {
      if (skipNextIdleRef.current) { skipNextIdleRef.current = false; return; }
      commitCenter();
    });

    return () => {
      pickerMapInstanceRef.current = null;
      clearTimeout(reverseGeocodeTimer.current);
    };
  }, [showMapPicker, mapsLoaded]);

  const handleAddressChange = (val) => {
    setForm(f => ({ ...f, venue: val, lat: null, lng: null }));
    clearTimeout(searchTimer.current);
    if (val.length >= 3) {
      setSearchingAddress(true);
      // 300ms, nu 500 — Google răspunde mult mai rapid decât Nominatim, iar
      // un debounce mai scurt simte căutarea "instant" în loc de "încet".
      searchTimer.current = setTimeout(async () => {
        const results = await searchAddress(val);
        setAddressResults(results);
        setSearchingAddress(false);
      }, 300);
    } else {
      setAddressResults([]);
    }
  };

  const handleSelectAddress = async (result) => {
    setForm(f => ({ ...f, venue: result.short }));
    setAddressResults([]);
    setAddressFocused(false);
    const coords = await getPlaceCoords(result);
    if (coords) setForm(f => ({ ...f, lat: coords.lat, lng: coords.lng }));
  };

  const [coverError, setCoverError] = useState("");
  const [coverUnverified, setCoverUnverified] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(isEdit);
  const [showLegal, setShowLegal] = useState(false);

  const handleCover = (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // permite reselectarea aceluiași fișier dacă ai corectat ceva
    if (!file) return;
    setCoverError("");
    setCoverUnverified(false);

    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setCoverError("Format neacceptat — doar poze (jpg, png, webp, gif) sau video (mp4, webm, mov).");
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
    if (file.size > maxBytes) {
      setCoverError(`Fișierul e prea mare — maxim ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB}MB.`);
      return;
    }

    if (file.type.startsWith("video/")) {
      // Verificăm durata înainte să acceptăm — feed-ul suportă doar clipuri
      // scurte (max 15s), ca să rămână un format rapid de consumat, nu un
      // upload de filmuleț întreg.
      const url = URL.createObjectURL(file);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;
      probe.playsInline = true;
      // Safari pe iOS nu declanșează fiabil loadedmetadata/error pe un
      // <video> care nu e atașat în DOM (Chrome/Firefox nu au problema asta)
      // — de-asta clipurile de pe iPhone cădeau direct pe "nu am putut citi".
      probe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(probe);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        probe.remove();
      };
      const finish = (duration) => {
        if (duration > 15.5) {
          setCoverError(`Videoclipul are ${duration.toFixed(0)}s — maxim 15 secunde.`);
          cleanup();
          return;
        }
        setCoverFile(file);
        setCoverPreview(url);
        probe.remove();
      };
      probe.onloadedmetadata = () => {
        // Chrome raportează duration = Infinity la unele fișiere (mai ales
        // webm fără metadate complete) până cauți în video măcar o dată —
        // fără hack-ul ăsta, orice astfel de clip era respins ca fiind "prea lung".
        if (!isFinite(probe.duration)) {
          probe.currentTime = 1e9;
          probe.ontimeupdate = () => {
            probe.ontimeupdate = null;
            finish(probe.duration);
          };
        } else {
          finish(probe.duration);
        }
      };
      probe.onerror = () => {
        // Unele clipuri (mai ales .mov de pe iPhone) nu pot fi decodate local
        // dintr-un blob: URL în Safari, deși același fișier se redă normal
        // odată urcat pe server (acolo ajunge prin HTTP, nu prin blob) — nu
        // blocăm postarea doar pentru că nu putem verifica local durata,
        // doar renunțăm la previzualizare și la limita de 15s pentru el.
        probe.remove();
        URL.revokeObjectURL(url);
        setCoverFile(file);
        setCoverPreview(null);
        setCoverUnverified(true);
      };
      probe.src = url;
    } else {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const [showNoPhotoConfirm, setShowNoPhotoConfirm] = useState(false);

  const handleSubmit = async () => {
    if (!form.title || !form.venue || !form.eventDate || !form.eventTime) {
      alert("Completează titlul, locația și data/ora!"); return;
    }
    if (priceMode === "paid" && !priceAmount) {
      alert("Completează prețul, sau alege Gratuit!"); return;
    }
    if (form.type === "official" && (!form.contact_name || !form.contact_phone || !form.contact_email)) {
      alert("Completează numele, telefonul și emailul de contact — necesare pentru verificarea evenimentelor oficiale!"); return;
    }
    if (!user) { alert("Trebuie să fii autentificat!"); return; }
    if (!acceptedTerms) { alert("Trebuie să accepți Termenii și Condițiile înainte să postezi!"); return; }

    // Maxim MAX_ACTIVE_EVENTS petreceri active (nearhivate, neexpirate) simultan
    // per user — doar la postare nouă, editarea uneia existente nu numără a doua oară.
    if (!isEdit) {
      setLoading(true);
      const { data: mine } = await supabase.from("posted_events_feed").select("id, event_date").eq("user_id", user.id).eq("archived", false);
      setLoading(false);
      if (filterActiveEvents(mine).length >= MAX_ACTIVE_EVENTS) {
        alert(`Poți avea maxim ${MAX_ACTIVE_EVENTS} petreceri active simultan. Arhivează sau așteaptă să expire una dintre cele curente înainte să postezi alta.`);
        return;
      }
    }

    // Evenimentele fără poză se văd mult mai slab în feed (doar gradient) —
    // înainte să postăm, dăm ocazia să adauge una, fără să blocăm pe cine
    // chiar vrea să posteze fără.
    if (!coverPreview && !coverUnverified) { setShowNoPhotoConfirm(true); return; }
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
        // upsert:true nu e necesar — path-ul conține Date.now(), deci e mereu
        // unic, niciodată nu există deja un fișier la calea asta. Găsit live:
        // pe bucket-ul "covers" (spre deosebire de "avatars"), upsert:true
        // declanșa constant "new row violates row-level security policy" la
        // Storage (cauza exactă rămâne neclară — politicile RLS sunt identice
        // între cele două bucket-uri), în timp ce un insert simplu funcționează
        // mereu. Fără upsert, ocolim complet problema.
        const { error } = await supabase.storage.from("covers").upload(path, coverFile);
        if (error) throw error;
        const { data } = supabase.storage.from("covers").getPublicUrl(path);
        cover_url = data.publicUrl;
      }

      // venue/lat/lng nu mai trăiesc în posted_events (sunt în tabelul separat
      // event_locations, protejat prin RLS — vezi supabase/2026-08-11b_event_locations_table.sql).
      const { eventDate, eventTime, venue, lat, lng, ...rest } = form;
      const event_date = new Date(`${eventDate}T${eventTime}`).toISOString();
      const max_participants = rest.type === "official" || rest.max_participants === "" ? null : Number(rest.max_participants) || null;
      const payload = { ...rest, max_participants, date: formatEventDateTime(event_date), event_date, cover_url, user_id: user.id };

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

      // Notificăm participanții deja înscriși dacă hostul mută evenimentul —
      // altfel ajung la adresa veche fără să știe că s-a schimbat.
      if (isEdit && (editEvent.venue !== venue || editEvent.lat !== lat || editEvent.lng !== lng)) {
        const { data: attendees } = await supabase.from("attendances").select("user_id").eq("event_id", `posted_${eventId}`);
        // Evenimentele cu locație ascunsă (aprobare manuală) nu au rând în
        // attendances pentru participanți — fără query-ul ăsta, exact ei
        // (cei cărora le pasă cel mai mult de adresă) nu erau anunțați
        // niciodată când hostul o schimbă.
        const { data: acceptedRequesters } = await supabase.from("attendance_requests").select("requester_id").eq("event_id", eventId).eq("status", "accepted");
        const posterName = [user.user_metadata?.prenume, user.user_metadata?.nume].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Organizatorul";
        const notifyTargets = new Set([
          ...(attendees || []).map(a => a.user_id),
          ...(acceptedRequesters || []).map(r => r.requester_id),
        ]);
        notifyTargets.forEach(targetUserId => {
          if (targetUserId === user.id) return;
          notifyUser({
            targetUserId,
            title: "Locație schimbată",
            body: `${posterName} a schimbat locația pentru „${payload.title}”.`,
            type: "event_update",
            actorId: user.id,
            eventId: `posted_${eventId}`,
          });
        });
      }

      // Evenimentele oficiale nu apar în feed până nu sunt aprobate — trimitem
      // un "ticket" cu toate detaliile ca să poată fi validat manual.
      if (!isEdit && payload.type === "official") {
        const posterName = [user.user_metadata?.prenume, user.user_metadata?.nume].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Cineva";
        notifyUser({
          targetUserId: OFFICIAL_REVIEWER_ID,
          title: "Cerere eveniment oficial",
          body: `${posterName} vrea să posteze „${payload.title}” la ${venue || "locație nespecificată"} · ${payload.date} · ${payload.price}.${payload.description ? ` „${payload.description.slice(0, 150)}”` : ""}`,
          type: "official_request",
          actorId: user.id,
        });
      }

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
      <div style={{ padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
        <div onClick={() => fileRef.current?.click()} style={{ width: "100%", height: 160, borderRadius: 16, background: (coverPreview || coverUnverified) ? "transparent" : "rgba(255,51,102,0.08)", border: `2px dashed ${(coverPreview || coverUnverified) ? "transparent" : "rgba(255,51,102,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 8, overflow: "hidden" }}>
          {coverUnverified ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><CameraIcon size={30} /></div>
              <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Videoclip selectat ({coverFile?.name})</div>
            </div>
          ) : coverPreview ? (
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
        {coverUnverified && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginTop: 8, textAlign: "center" }}>
            Nu am putut previzualiza clipul aici, dar se poate încă posta — verifică doar tu că e sub 15 secunde.
          </div>
        )}
        {!coverPreview && !coverUnverified && !coverError && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#FF3366", fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 20, textAlign: "center" }}>
            <CameraIcon size={13} /> Evenimentele cu poză sau video ies mult mai bine în evidență în feed
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleCover} style={{ display: "none" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
          <LockIcon size={12} style={{ flexShrink: 0, marginTop: 1 }} /> Prin încărcare confirmi, pe propria răspundere, că ai acordul persoanelor care apar în imagine/video.
        </div>

        {/* Tip */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tip eveniment</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "official", label: "Oficial", icon: LightningIcon }, { id: "homemade", label: "Neoficial", icon: HouseIcon }].map(t => (
              <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))} style={{ flex: 1, padding: "10px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: form.type === t.id ? "rgba(255,51,102,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${form.type === t.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`, color: form.type === t.id ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: form.type === t.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}><t.icon size={14} /> {t.label}</button>
            ))}
          </div>
          {form.type === "official" && !isEdit && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.2)", borderRadius: 10, fontSize: 11, color: "#FF3366", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "flex-start", gap: 6 }}>
              <LockIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Evenimentele oficiale sunt verificate manual înainte să apară în feed.
            </div>
          )}
        </div>

        {/* Contact — cerut doar la oficiale, ca reviewer-ul să aibă cu cine
            vorbi dacă ceva nu e clar înainte să aprobe (nu la neoficiale,
            unde nimeni nu validează manual). */}
        {form.type === "official" && (
          <div style={{ marginBottom: 16, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Date de contact (pentru verificare)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="text" placeholder="Nume persoană de contact" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
              <input type="tel" placeholder="Telefon" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
              <input type="email" placeholder="Email de contact" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
              <input type="text" placeholder="Instagram / website local" value={form.contact_social} onChange={e => setForm(f => ({ ...f, contact_social: e.target.value }))}
                style={{ width: "100%", padding: "11px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
            </div>
          </div>
        )}

        {/* Vibe — apare ca iconiță pe hartă în loc de pinul generic, ca oricine
            să-și dea seama dintr-o privire ce fel de petrecere e (opțional) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Vibe (opțional, apare pe hartă)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {VIBE_OPTIONS.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, vibe: f.vibe === v.id ? null : v.id }))}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 20, background: form.vibe === v.id ? "rgba(255,51,102,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${form.vibe === v.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`, color: form.vibe === v.id ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: form.vibe === v.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
              >
                <v.icon size={14} /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Titlu */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Titlu eveniment *</div>
          <input type="text" placeholder="Titlul evenimentului" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
        </div>

        {/* Locație cu search */}
        <div style={{ marginBottom: 14, position: "relative" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Locație * {form.lat ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#00C864" }}><PinIcon size={12} /> Localizat</span> : ""}
          </div>
          <div ref={addressWrapRef} style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Caută adresa..."
              value={form.venue}
              onChange={e => handleAddressChange(e.target.value)}
              onFocus={() => setAddressFocused(true)}
              onBlur={() => setTimeout(() => setAddressFocused(false), 150)}
              style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: `1px solid ${form.lat ? "rgba(0,200,100,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
            {searchingAddress && (
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>...</div>
            )}

            {/* Suggestions dropdown — ancorat la addressWrapRef (doar input-ul),
                nu la tot blocul "Locație" de mai jos, care mai include și
                butonul "Pune pin pe hartă" + eventual harta — altfel top:100%
                cădea sub tot ce urma, nu direct sub câmp. */}
            {addressResults.length > 0 && addressFocused && (
              <div style={{ position: "absolute", ...(addressDropUpward ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }), left: 0, right: 0, background: "rgba(15,15,18,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, zIndex: 100, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.5)", animation: "fadeIn 0.15s ease-out" }}>
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
          </div>

          <button
            type="button"
            onClick={() => { setAddressFocused(false); setShowMapPicker(v => !v); }}
            style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, background: showMapPicker ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${showMapPicker ? "rgba(255,51,102,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "7px 12px", color: showMapPicker ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
          >
            <PinIcon size={12} /> {showMapPicker ? "Ascunde harta" : "Pune pin pe hartă"}
          </button>

          {showMapPicker && (
            <div style={{ marginTop: 8, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ position: "relative" }}>
                <div ref={pickerMapRef} style={{ width: "100%", height: 260, background: "linear-gradient(135deg, rgba(255,51,102,0.18), rgba(180,79,255,0.18))" }} />
                {/* Pinul stă fix în centru, ca la Uber — muți harta pe sub el.
                    Vârful din PinIcon nu e chiar la marginea de jos a SVG-ului
                    (e la y=21 dintr-un viewBox de 24), deci -100% l-ar plasa
                    puțin mai sus decât punctul real — de-asta -87.5%, nu -100%. */}
                <div style={{
                  position: "absolute", top: "50%", left: "50%", zIndex: 401, pointerEvents: "none", color: "#FF3366",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
                  transform: `translate(-50%, ${pickerMoving ? "calc(-87.5% - 16px)" : "-87.5%"})`,
                  transition: "transform 0.15s ease-out",
                }}>
                  <PinIcon size={34} />
                </div>
                {pickerMoving && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, 0)", width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg, #FF3366, #B44FFF)", zIndex: 400 }} />
                )}
              </div>
              <div style={{ padding: "6px 10px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", background: "rgba(255,255,255,0.03)" }}>
                Mișcă harta ca pinul să ajungă exact unde vrei.
              </div>
            </div>
          )}

          {/* Vizibilitatea locației — independent de tip, alegerea hostului */}
          {form.lat && (
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, location_visible: !f.location_visible }))}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                marginTop: 8, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                background: form.location_visible ? "rgba(0,200,100,0.1)" : "rgba(255,184,0,0.1)",
                border: `1px solid ${form.location_visible ? "rgba(0,200,100,0.3)" : "rgba(255,184,0,0.2)"}`,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: form.location_visible ? "#00C864" : "#FFB800", fontFamily: "'DM Sans', sans-serif", textAlign: "left" }}>
                <LockIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                {form.location_visible
                  ? "Locație exactă vizibilă tuturor pe hartă"
                  : "Pe hartă se vede doar o zonă aproximativă — adresa exactă e vizibilă doar ție și participanților acceptați"}
              </span>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: form.location_visible ? "#00C864" : "rgba(255,255,255,0.15)", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ position: "absolute", top: 2, left: form.location_visible ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
            </button>
          )}

          {/* Evenimentele oficiale au deja control de acces prin verificarea
              manuală (contact@nightfeed.ro) — cele neoficiale n-au niciun
              filtru, de-asta au nevoie de un plafon separat. */}
          {form.type === "homemade" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Număr maxim de participanți (opțional)</div>
              <input
                type="number" min="1" max={MAX_PARTICIPANTS} placeholder="fără limită"
                value={form.max_participants}
                onChange={e => {
                  const raw = e.target.value;
                  const val = raw === "" ? "" : String(Math.min(Number(raw) || 0, MAX_PARTICIPANTS));
                  setForm(f => ({ ...f, max_participants: val }));
                }}
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              />
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
                type="number" min="0" max={MAX_PRICE} placeholder="0" value={priceAmount}
                onChange={e => {
                  const val = clampPrice(e.target.value);
                  setPriceAmount(val);
                  setForm(f => ({ ...f, price: val ? `${val} RON` : "" }));
                }}
                style={{ width: "100%", padding: "12px 50px 12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              />
              <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>RON</span>
            </div>
          )}
        </div>

        {/* Descriere */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Descriere</div>
          <textarea placeholder="Descrie evenimentul..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
            style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "none" }} />
        </div>

        {!isEdit && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "2px 0", marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "#FF3366", flexShrink: 0, cursor: "pointer" }}
            />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
              Am citit și accept{" "}
              <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLegal(true); }} style={{ color: "#FF3366", textDecoration: "underline", cursor: "pointer" }}>
                Termenii și Condițiile
              </span>
              , inclusiv faptul că NightFeed nu răspunde pentru ce se întâmplă la evenimentul postat.
            </span>
          </label>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: loading ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(255,51,102,0.3)" }}>
          {loading ? "Se salvează..." : isEdit ? <><CheckCircleIcon size={17} /> Salvează modificările</> : <><RocketIcon size={17} /> Trimite evenimentul</>}
        </button>
      </div>

      {showLegal && <LegalPage onClose={() => setShowLegal(false)} />}

      {showNoPhotoConfirm && (
        <>
          <div onClick={() => setShowNoPhotoConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 500, animation: "backdropIn 0.2s ease-out" }} />
          {/* paddingBottom cu safe-area — fără el, bara de navigare fixă de
              jos acoperea butonul "Postează oricum" (vezi fix-ul identic pe
              ReportSheet/JoinRequestSheet). */}
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "85vh", overflowY: "auto", zIndex: 501, background: "#0f0f12", borderTop: "2px solid rgba(255,51,102,0.3)", borderRadius: "24px 24px 0 0", padding: "22px 20px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))", animation: "slideUp 0.25s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: "#FF3366" }}><CameraIcon size={36} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", textAlign: "center", marginBottom: 8 }}>
              Postezi fără poză?
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", lineHeight: 1.5, marginBottom: 20 }}>
              Evenimentele cu poză primesc mult mai multă atenție în feed. Poți oricând să adaugi una acum.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { setShowNoPhotoConfirm(false); fileRef.current?.click(); }} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>
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
