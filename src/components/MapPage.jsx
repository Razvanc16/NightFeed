import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { events as staticEvents } from "../data/events";
import { filterActiveEvents, formatEventDateTime } from "../utils/eventTime";
import {
  SparkleIcon, LightningIcon, HouseIcon, FireIcon, TagIcon, PinIcon, LockIcon,
  ClockIcon, CheckCircleIcon, CrossCircleIcon, PlusIcon, MapIcon,
  houseIconSvg, lightningIconSvg, VIBE_OPTIONS,
} from "./Icons";

const vibeSvgById = Object.fromEntries(VIBE_OPTIONS.map(v => [v.id, v.svg]));
import { notifyUser } from "../utils/pushNotifications";

const filters = [
  { id: "all", label: "Toate", icon: SparkleIcon },
  { id: "official", label: "Oficial", icon: LightningIcon },
  { id: "homemade", label: "Neoficial", icon: HouseIcon },
  { id: "today", label: "Azi", icon: FireIcon },
  { id: "free", label: "Gratuit", icon: TagIcon },
];

const filterFn = (event, filter) => {
  if (filter === "all") return true;
  if (filter === "official") return event.type === "official";
  if (filter === "homemade") return event.type === "homemade";
  if (filter === "today") return event.date?.toLowerCase().includes("azi");
  // !event.price acoperă preț gol/null din bază — filtrul rulează pe datele
  // brute, înainte de conversia care rezolvă "" spre textul "Gratuit".
  if (filter === "free") return !event.price || event.price === "Gratuit";
  return true;
};

// Mai multe filtre simultan (ex: Oficial + Gratuit) — set gol = "Toate".
const matchesFilters = (event, activeFilters) => {
  if (activeFilters.size === 0) return true;
  for (const f of activeFilters) {
    if (!filterFn(event, f)) return false;
  }
  return true;
};

const staticCoords = {
  1: [44.4668, 26.0470],
  2: [44.4588, 26.0921],
  3: [44.4323, 26.1063],
  4: [44.4268, 26.0199],
  5: [46.7712, 23.6236],
};

// Offset fix (nu aleator la fiecare randare!) calculat din id-ul evenimentului —
// astfel încât toți userii văd cercul de "zonă aproximativă" exact în același loc,
// deplasat cu 20-30m față de adresa reală, o dată pentru totdeauna per eveniment.
const seededOffset = (id) => {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  const distanceMeters = 20 + (hash % 1000) / 1000 * 10; // 20-30m, fix per id
  return { angle, distanceMeters };
};

const applyOffset = (lat, lng, id) => {
  const { angle, distanceMeters } = seededOffset(id);
  const dLat = (distanceMeters * Math.cos(angle)) / 111320;
  const dLng = (distanceMeters * Math.sin(angle)) / (111320 * Math.cos(lat * Math.PI / 180));
  return [lat + dLat, lng + dLng];
};

export default function MapPage({ user, isActive, focusTarget }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const homemadeLayersRef = useRef([]);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const toggleFilter = (id) => {
    if (id === "all") { setActiveFilters(new Set()); return; }
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (id === "official") next.delete("homemade");
        if (id === "homemade") next.delete("official");
        next.add(id);
      }
      return next;
    });
  };
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attending, setAttending] = useState({});
  const [toast, setToast] = useState(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [zoom, setZoom] = useState(12);
  const [postedEvents, setPostedEvents] = useState([]);
  const [myRequests, setMyRequests] = useState({}); // { [rawId]: "pending" | "accepted" | "rejected" }

  // Harta rămâne montată permanent (vezi comentariul de mai jos), deci fără
  // isActive în deps, evenimentele s-ar încărca o singură dată la pornirea
  // aplicației și n-ar mai prinde niciodată evenimente noi postate ulterior —
  // trebuia să închizi și să redeschizi aplicația ca să le vezi.
  useEffect(() => {
    if (isActive) loadPostedEvents();
  }, [isActive]);

  // Harta rămâne montată (ascunsă cu display:none) și cât timp nu ești pe tab-ul
  // ei — dar Leaflet calculează dimensiunea containerului la inițializare, iar
  // un container ascuns are dimensiune 0. Rezultatul: doar câteva tile-uri se
  // încarcă (pentru o zonă practic goală), iar restul hărții rămâne albă/goală
  // chiar și după ce tab-ul devine vizibil. invalidateSize() îi spune lui
  // Leaflet să recalculeze exact în momentul în care harta chiar devine vizibilă.
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  }, [isActive]);

  // Scoate live de pe hartă evenimentele care expiră cât timp userul are ecranul deschis.
  useEffect(() => {
    const interval = setInterval(() => {
      setPostedEvents(prev => filterActiveEvents(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Cererile de participare la homemade — statusul lor decide dacă vezi adresa exactă
  useEffect(() => {
    if (user) loadMyRequests();
    else setMyRequests({});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-requests-map:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_requests", filter: `requester_id=eq.${user.id}` },
        () => loadMyRequests()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const loadMyRequests = async () => {
    const { data } = await supabase.from("attendance_requests").select("event_id, status").eq("requester_id", user.id);
    const map = {};
    (data || []).forEach(r => { map[r.event_id] = r.status; });
    setMyRequests(map);
  };

  // Participarea e acum în Supabase (tabelul "attendances"), per user — se sincronizează
  // pe orice device, la fel ca like-urile.
  useEffect(() => {
    if (user) loadMyAttendance();
    else setAttending({});
  }, [user]);

  const loadMyAttendance = async () => {
    const { data } = await supabase.from("attendances").select("event_id").eq("user_id", user.id);
    const state = {};
    (data || []).forEach(row => { state[row.event_id] = true; });
    setAttending(state);
  };

  const loadPostedEvents = async () => {
    const { data } = await supabase.from("posted_events_feed").select("*").eq("archived", false).or("type.neq.official,verified.eq.true").not("lat_approx", "is", null);
    setPostedEvents(filterActiveEvents(data));
  };

  useEffect(() => {
    // Dacă Leaflet e deja încărcat (dintr-un montaj anterior), gata
    if (window.L) { setLeafletLoaded(true); return; }

    // Dacă tag-urile există deja în pagină dar scriptul încă nu s-a terminat de
    // încărcat, așteptăm (polling) în loc să presupunem că e gata — asta era bug-ul
    // care ducea la ecran alb când intrai/ieșeai rapid din tab-ul Hartă.
    if (document.getElementById("leaflet-css")) {
      const check = setInterval(() => {
        if (window.L) {
          setLeafletLoaded(true);
          clearInterval(check);
        }
      }, 50);
      return () => clearInterval(check);
    }

    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [44.4268, 26.1025], zoom: 12, zoomControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      // Ține încărcate mai multe tile-uri din jurul zonei vizibile, ca la
      // deplasare să fie deja acolo (nu pătrate goale care apar cu întârziere).
      keepBuffer: 4,
      // Pe touch (telefon), Leaflet încarcă implicit tile-uri noi abia după ce
      // te oprești din deplasat — cu asta, începe să le ceară cât încă tragi.
      updateWhenIdle: false,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstanceRef.current = map;
    map.on("zoomend", () => setZoom(map.getZoom()));

    // Cerem locația automat la deschiderea hărții. Dacă userul acceptă, harta se
    // centrează pe el; dacă refuză sau browserul nu suportă geolocation, rămâne
    // pe centrul default (București) exact ca înainte — fără mesaje suplimentare.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 13);
        const userIcon = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#4FC3F7;border:3px solid #fff;box-shadow:0 0 0 4px rgba(79,195,247,0.3);"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
      });
    }

    // Plasă de siguranță: dacă totuși componenta se demontează vreodată (ex.
    // logout), distrugem instanța Leaflet — altfel rămâne "vie" în memorie
    // (listenere, tile-uri) chiar și după ce nu mai există în pagină.
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // Toate evenimentele cu coordonate, nefiltrate — separat de efectul care
  // desenează marker-ele (acela mai aplică și activeFilters), ca să putem
  // găsi orice eveniment după id pentru focus (tap pe locație în feed),
  // indiferent ce filtre sunt active în hartă în acel moment.
  const allMapEvents = useMemo(() => [
    ...staticEvents.map(e => ({
      ...e, coords: staticCoords[e.id], isHomemade: e.type === "homemade", isPosted: false,
    })),
    ...postedEvents.map(e => ({
      id: `posted_${e.id}`,
      title: e.title, venue: e.venue, date: (e.event_date && formatEventDateTime(e.event_date)) || e.date, price: e.price || "Gratuit",
      type: e.type, description: e.description, age_restricted: !!e.age_restricted,
      color: e.type === "official" ? "#FF3366" : "#FFB800",
      vibe: e.vibe || null,
      // Coordonatele exacte vs fuzzate depind acum de location_visible (setat
      // de host la postare), nu de tip — un eveniment oficial poate alege să
      // rămână aproximativ, unul neoficial poate alege să fie exact.
      coords: e.location_visible ? [e.lat, e.lng] : [e.lat_approx, e.lng_approx],
      location_visible: !!e.location_visible,
      isHomemade: e.type === "homemade",
      isPosted: true,
      rawId: e.id,
      hostId: e.user_id,
    })),
  ].filter(e => e.coords), [postedEvents]);

  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    markersRef.current.forEach(m => map.removeLayer(m));
    circlesRef.current.forEach(c => map.removeLayer(c));
    markersRef.current = [];
    circlesRef.current = [];
    homemadeLayersRef.current = [];

    const allEvents = allMapEvents.filter(e => matchesFilters(e, activeFilters));

    allEvents.forEach(event => {
      const isHomemade = event.isHomemade;
      const color = event.color || "#FF3366";
      const isMarkedActive = isHomemade
        ? myRequests[String(event.rawId ?? event.id)] === "accepted"
        : !!attending[event.id];

      // Cercul de "zonă aproximativă" apare doar cât timp locația chiar e
      // ascunsă — dacă hostul a activat location_visible, evenimentul (chiar
      // neoficial) primește marker clasic tip pin, cu poziția exactă.
      if (isHomemade && !event.location_visible) {
        // Cercul de zonă are un offset FIX (identic pentru toți) față de adresa reală
        const offsetCenter = applyOffset(event.coords[0], event.coords[1], event.rawId ?? event.id);

        // Sub acest nivel de zoom, arătăm un pin clasic (ca la oficiale) — de-abia
        // când dai zoom suficient de aproape, pinul dispare (cu fade) și rămân doar
        // cercul + casa transparentă, ancorate geografic. Citim zoom-ul live din hartă
        // (nu din closure) ca desenul inițial să fie corect indiferent când rulează efectul.
        const ZOOM_THRESHOLD = 15;
        const zoomedIn = map.getZoom() >= ZOOM_THRESHOLD;

        const circle = L.circle(offsetCenter, {
          radius: 150,
          color: color,
          fillColor: color,
          fillOpacity: zoomedIn ? 0.12 : 0,
          weight: 1.5,
          opacity: zoomedIn ? 0.55 : 0,
          dashArray: "6, 4",
        }).addTo(map);
        circle.on("click", () => setSelectedEvent(event));
        circlesRef.current.push(circle);
        if (circle.getElement()) {
          circle.getElement().style.transition = "opacity 0.4s ease, fill-opacity 0.4s ease, stroke-opacity 0.4s ease";
        }

        // Iconița de casă e ancorată geografic (nu în pixeli, ca un marker normal),
        // ca dimensiunea ei să se scaleze împreună cu cercul la orice nivel de zoom.
        const houseRadiusMeters = 55;
        const dLat = houseRadiusMeters / 111320;
        const dLng = houseRadiusMeters / (111320 * Math.cos(offsetCenter[0] * Math.PI / 180));
        const bounds = [
          [offsetCenter[0] - dLat, offsetCenter[1] - dLng],
          [offsetCenter[0] + dLat, offsetCenter[1] + dLng],
        ];

        const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgEl.setAttribute("viewBox", "0 0 24 24");
        svgEl.setAttribute("style", `filter: drop-shadow(0 0 3px ${color}); transition: opacity 0.4s ease;`);
        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("d", "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z");
        pathEl.setAttribute("fill", color);
        svgEl.appendChild(pathEl);

        const houseOverlay = L.svgOverlay(svgEl, bounds, { interactive: true }).addTo(map);
        houseOverlay.setOpacity(zoomedIn ? (isMarkedActive ? 0.85 : 0.5) : 0);
        houseOverlay.on("click", () => setSelectedEvent(event));
        markersRef.current.push(houseOverlay);

        // Pinul clasic (vizibil de departe, dispare cu fade la zoom apropiat) — folosim
        // o clasă CSS globală pentru tranziție, fiindcă marker.setOpacity() animă
        // containerul exterior creat de Leaflet, nu div-ul nostru din interior.
        const pinIcon = L.divIcon({
          className: "homemade-pin-marker",
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid ${isMarkedActive ? '#fff' : color + 'b0'};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 18px ${color}90, 0 4px 16px rgba(0,0,0,0.5);cursor:pointer;">
                ${(event.vibe && vibeSvgById[event.vibe]) ? vibeSvgById[event.vibe]("#fff") : houseIconSvg("#fff")}
              </div>
              <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-2px;"></div>
            </div>
          `,
          iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -44],
        });
        const pinMarker = L.marker(offsetCenter, { icon: pinIcon }).addTo(map).on("click", () => setSelectedEvent(event));
        pinMarker.setOpacity(zoomedIn ? 0 : 1);
        markersRef.current.push(pinMarker);

        // Păstrăm referințele ca să putem doar actualiza opacitatea la schimbarea
        // zoom-ului (nu recreăm elementele — altfel tranziția CSS nu are ce anima).
        homemadeLayersRef.current.push({ circle, houseOverlay, pinMarker, color, isMarkedActive });
        return;
      }

      // Evenimente oficiale — marker clasic tip pin, neschimbat
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid ${isMarkedActive ? '#fff' : color + 'b0'};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 18px ${color}90, 0 4px 16px rgba(0,0,0,0.5);cursor:pointer;">
              ${(event.vibe && vibeSvgById[event.vibe]) ? vibeSvgById[event.vibe]("#fff") : lightningIconSvg("#fff")}
            </div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-2px;"></div>
          </div>
        `,
        iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -44],
      });

      const marker = L.marker(event.coords, { icon }).addTo(map).on("click", () => setSelectedEvent(event));
      markersRef.current.push(marker);
    });
  }, [leafletLoaded, activeFilters, attending, allMapEvents, myRequests]);

  // Focus venit din feed (tap pe locația unui eveniment) — sare peste filtrele
  // active (userul a cerut explicit locația asta) și deschide fișa de jos.
  useEffect(() => {
    if (!focusTarget?.id || !leafletLoaded || !mapInstanceRef.current) return;
    const target = allMapEvents.find(e => String(e.id) === focusTarget.id);
    if (!target) return;
    setActiveFilters(new Set());
    mapInstanceRef.current.flyTo(target.coords, 16, { duration: 0.6 });
    setSelectedEvent(target);
  }, [focusTarget, leafletLoaded, allMapEvents]);

  // Doar actualizăm opacitatea elementelor deja desenate la schimbarea zoom-ului
  // (nu le recreăm) — așa tranziția CSS chiar animă lin, nu sare brusc.
  useEffect(() => {
    const ZOOM_THRESHOLD = 15;
    const zoomedIn = zoom >= ZOOM_THRESHOLD;
    homemadeLayersRef.current.forEach(({ circle, houseOverlay, pinMarker, color, isMarkedActive }) => {
      circle.setStyle({
        opacity: zoomedIn ? 0.55 : 0,
        fillOpacity: zoomedIn ? 0.12 : 0,
      });
      houseOverlay.setOpacity(zoomedIn ? (isMarkedActive ? 0.85 : 0.5) : 0);
      pinMarker.setOpacity(zoomedIn ? 0 : 1);
      const pinEl = pinMarker.getElement();
      if (pinEl) pinEl.style.pointerEvents = zoomedIn ? "none" : "auto";
    });
  }, [zoom]);

  const handleAttend = async (event) => {
    if (!user) {
      setToast("Autentifică-te ca să participi!");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    const newVal = !attending[event.id];
    setAttending(prev => ({ ...prev, [event.id]: newVal }));
    setSelectedEvent(null);
    try {
      if (newVal) {
        const { error } = await supabase.from("attendances").insert([{ event_id: String(event.id), user_id: user.id }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendances").delete().eq("event_id", String(event.id)).eq("user_id", user.id);
        if (error) throw error;
      }
      setToast(newVal ? `Înscris la ${event.title}!` : "Ai renunțat");
    } catch (err) {
      setAttending(prev => ({ ...prev, [event.id]: !newVal }));
      setToast("Eroare. Încearcă din nou.");
    }
    setTimeout(() => setToast(null), 2500);
  };

  const handleJoinRequest = async (event) => {
    if (!user) {
      setToast("Autentifică-te ca să ceri să participi!");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    const rawId = String(event.rawId ?? event.id);
    setSelectedEvent(null);
    try {
      const username = [user.user_metadata?.prenume, user.user_metadata?.nume].filter(Boolean).join(" ") || user.email?.split("@")[0] || "User";
      const { error } = await supabase.from("attendance_requests").insert([{
        event_id: rawId,
        requester_id: user.id,
        requester_username: username,
        host_id: event.hostId,
        status: "pending",
      }]);
      if (error) throw error;
      setMyRequests(prev => ({ ...prev, [rawId]: "pending" }));
      if (event.hostId) {
        notifyUser({
          targetUserId: event.hostId,
          title: "Cerere nouă de participare",
          body: `${username} vrea să participe la ${event.title}.`,
          type: "request",
          actorId: user.id,
        });
      }
      setToast("Cerere trimisă! Aștepți răspunsul hostului.");
    } catch (err) {
      setToast("Eroare la trimiterea cererii.");
    }
    setTimeout(() => setToast(null), 2500);
  };

  const handleNavigate = (event) => {
    if (!event.coords) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.coords[0]},${event.coords[1]}`, "_blank");
  };

  // Adresa exactă (și deci navigarea) e permisă doar dacă hostul a ales
  // location_visible la postare, sau pentru homemade unde hostul te-a acceptat
  // deja — altfel ar fi doar de fațadă să scrie "zonă aproximativă" dacă oricine
  // putea oricum să navigheze la adresa reală.
  const canSeeExactAddress = (event) => {
    if (event.location_visible) return true;
    if (!event.isHomemade) return false;
    const rawId = String(event.rawId ?? event.id);
    return myRequests[rawId] === "accepted";
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#050506" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

      {/* Ambient "lumini de club" — foarte discret, doar ca să dea o notă de petrecere fără să lumineze harta */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        background: `
          radial-gradient(circle at 12% 15%, rgba(255,51,102,0.14) 0%, transparent 32%),
          radial-gradient(circle at 88% 10%, rgba(180,79,255,0.13) 0%, transparent 32%),
          radial-gradient(circle at 50% 95%, rgba(0,229,255,0.10) 0%, transparent 38%)
        `,
      }} />

      {/* Filter chips — pot fi combinate (ex: Oficial + Gratuit), nu doar unul */}
      <div style={{ position: "absolute", top: 16, left: 0, right: 0, display: "flex", gap: 6, padding: "0 12px", overflowX: "auto", zIndex: 500, scrollbarWidth: "none" }}>
        {filters.map(f => {
          const selected = f.id === "all" ? activeFilters.size === 0 : activeFilters.has(f.id);
          return (
            <button key={f.id} onClick={() => toggleFilter(f.id)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 20, background: selected ? "rgba(255,51,102,0.9)" : "rgba(8,8,10,0.92)", border: `1px solid ${selected ? "#FF3366" : "rgba(255,255,255,0.25)"}`, color: selected ? "#fff" : "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace", cursor: "pointer", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s", boxShadow: selected ? "0 0 16px rgba(255,51,102,0.5)" : "none" }}>
              <f.icon size={13} /> {f.label}
            </button>
          );
        })}
      </div>

      {/* Selected event popup */}
      {selectedEvent && (
        <div style={{ position: "absolute", bottom: 80, left: 16, right: 16, background: "rgba(10,10,12,0.98)", border: `1px solid ${selectedEvent.color}60`, borderRadius: 20, padding: "16px", backdropFilter: "blur(20px)", zIndex: 600, animation: "slideUp 0.25s ease-out", boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 30px ${selectedEvent.color}20` }}>
          <button onClick={() => setSelectedEvent(null)} style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${selectedEvent.color}25`, border: `1px solid ${selectedEvent.color}50`, display: "flex", alignItems: "center", justifyContent: "center", color: selectedEvent.color, flexShrink: 0 }}>
              {selectedEvent.type === "official" ? <LightningIcon size={20} /> : <HouseIcon size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: selectedEvent.color, fontWeight: 700, fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>
                  {selectedEvent.type === "official" ? <><LightningIcon size={11} /> Oficial</> : <><HouseIcon size={11} /> Homemade</>}
                </div>
                {selectedEvent.age_restricted && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#FF3366", background: "rgba(255,51,102,0.2)", border: "1px solid rgba(255,51,102,0.5)", borderRadius: 10, padding: "1px 6px", fontFamily: "'DM Mono', monospace" }}>18+</span>
                )}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{selectedEvent.title}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}><ClockIcon size={13} /> {selectedEvent.date}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>
              <PinIcon size={13} />
              {canSeeExactAddress(selectedEvent) ? selectedEvent.venue : <>Zonă aproximativă <LockIcon size={12} /></>}
            </span>
            <span style={{ fontSize: 12, color: selectedEvent.color, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{selectedEvent.price}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {selectedEvent.isHomemade ? (
              (() => {
                const rawId = String(selectedEvent.rawId ?? selectedEvent.id);
                const status = myRequests[rawId];
                if (status === "accepted") {
                  return (
                    <button disabled style={{ flex: 2, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(0,200,100,0.2)", border: "1px solid rgba(0,200,100,0.4)", borderRadius: 12, color: "#00C864", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "default" }}>
                      <CheckCircleIcon size={15} /> Acceptat de host
                    </button>
                  );
                }
                if (status === "pending") {
                  return (
                    <button disabled style={{ flex: 2, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,184,0,0.15)", border: "1px solid rgba(255,184,0,0.3)", borderRadius: 12, color: "#FFB800", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "default" }}>
                      <ClockIcon size={15} /> Aștepți răspunsul hostului
                    </button>
                  );
                }
                if (status === "rejected") {
                  return (
                    <button disabled style={{ flex: 2, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.25)", borderRadius: 12, color: "#FF3366", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "default" }}>
                      <CrossCircleIcon size={15} /> Cerere refuzată
                    </button>
                  );
                }
                return (
                  <button onClick={() => handleJoinRequest(selectedEvent)} style={{ flex: 2, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: `linear-gradient(135deg, ${selectedEvent.color}, ${selectedEvent.color}cc)`, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                    <LockIcon size={15} /> Cer să particip
                  </button>
                );
              })()
            ) : (
              <button onClick={() => handleAttend(selectedEvent)} style={{ flex: 2, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: attending[selectedEvent.id] ? `${selectedEvent.color}35` : `linear-gradient(135deg, ${selectedEvent.color}, ${selectedEvent.color}cc)`, border: `1px solid ${attending[selectedEvent.id] ? selectedEvent.color : "transparent"}`, borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                {attending[selectedEvent.id] ? <><CheckCircleIcon size={15} /> Participi</> : <><PlusIcon size={15} /> Vreau să vin</>}
              </button>
            )}
            {canSeeExactAddress(selectedEvent) && (
              <button onClick={() => handleNavigate(selectedEvent)} style={{ flex: 1, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                <MapIcon size={15} /> Navighez
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(15,15,18,0.97)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, padding: "10px 20px", zIndex: 700, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", backdropFilter: "blur(20px)", whiteSpace: "nowrap", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}

      <style>{`
        /* Leaflet pune implicit un fundal deschis la culoare pe container —
           orice gol subpixel între tile-uri (mai ales la zoom) arăta ca o
           margine/linie albă peste harta noastră întunecată. */
        .leaflet-container { background: #050506 !important; }
        .leaflet-tile-pane { filter: brightness(1.75) contrast(1.1) saturate(1.25); }
        .leaflet-control-attribution { display: none !important; }
        .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.2) !important; background: rgba(10,10,12,0.92) !important; }
        .leaflet-control-zoom a { color: rgba(255,255,255,0.85) !important; background: transparent !important; border-color: rgba(255,255,255,0.15) !important; }
        .homemade-pin-marker { transition: opacity 0.4s ease; }
      `}</style>
    </div>
  );
}
