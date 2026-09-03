import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { events as staticEvents } from "../data/events";
import { filterActiveEvents, formatEventDateTime, formatPrice } from "../utils/eventTime";
import { loadGoogleMaps, DARK_MAP_STYLE, buildPinIconUrl, buildHouseOverlayUrl, userLocationIconUrl } from "../utils/googleMapsLoader";
import {
  SparkleIcon, LightningIcon, HouseIcon, FireIcon, TagIcon, PinIcon, LockIcon,
  ClockIcon, CheckCircleIcon, CrossCircleIcon, PlusIcon, MapIcon, InfoIcon,
  houseIconSvg, lightningIconSvg, VIBE_OPTIONS,
} from "./Icons";

const vibeSvgById = Object.fromEntries(VIBE_OPTIONS.map(v => [v.id, v.svg]));
import { notifyUser } from "../utils/pushNotifications";
import EventInsightsModal from "./EventInsightsModal";

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

// Bounds geografice pentru un overlay ancorat la sol (iconița de casă), în
// jurul unui centru, la o rază dată în metri — echivalentul L.svgOverlay(bounds).
const boundsAround = (lat, lng, radiusMeters) => {
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
};

export default function MapPage({ user, isActive, focusTarget, onViewProfile }) {
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
  const [insightsEvent, setInsightsEvent] = useState(null);
  const [popupDragY, setPopupDragY] = useState(0);
  const [popupClosing, setPopupClosing] = useState(false);
  const [popupEntering, setPopupEntering] = useState(false);
  const popupDragRef = useRef(null);
  const prevSelectedRef = useRef(null);

  // La deschidere, cardul pornește din afara ecranului (jos de tot) și
  // culisează în sus — nu doar un mic slideUp de 30px, ca să se simtă
  // vizual la fel ca la închidere (deci și gestul de swipe jos să pară
  // intuitiv, "se întoarce de unde a venit").
  useEffect(() => {
    if (selectedEvent && !prevSelectedRef.current) {
      setPopupEntering(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setPopupEntering(false)));
    }
    prevSelectedRef.current = selectedEvent;
  }, [selectedEvent]);

  // Închide cu animație (slide jos + fade), nu instant — setSelectedEvent(null)
  // direct demonta cardul fără nicio tranziție de ieșire. Durata de aici
  // trebuie să fie IDENTICĂ cu cea din style.transition de mai jos, altfel
  // fie se taie cardul brusc înainte să termine animația, fie rămâne un gol
  // (unmount întârziat) după ce a terminat deja de dispărut vizual.
  const POPUP_CLOSE_MS = 300;
  const closePopup = () => {
    setPopupClosing(true);
    setTimeout(() => {
      setSelectedEvent(null);
      setPopupClosing(false);
      setPopupDragY(0);
    }, POPUP_CLOSE_MS);
  };

  const handlePopupPointerDown = (e) => {
    // Un click pornit pe un buton (×, "Cer să particip" etc.) nu trebuie să
    // înceapă drag-ul de închidere — altfel micile mișcări ale mouse-ului
    // dintre mousedown și mouseup (normale pe desktop, aproape inexistente
    // pe touch) translatau popup-ul sub cursor înainte de mouseup, iar
    // click-ul ajungea pe alt element decât butonul de sub deget/cursor.
    if (e.target.closest?.("button")) return;
    popupDragRef.current = { startY: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePopupPointerMove = (e) => {
    if (!popupDragRef.current) return;
    const delta = e.clientY - popupDragRef.current.startY;
    if (delta > 0) setPopupDragY(delta); // doar tras în jos, nu în sus
  };
  const handlePopupPointerUp = () => {
    if (!popupDragRef.current) return;
    popupDragRef.current = null;
    if (popupDragY > 60) closePopup();
    else setPopupDragY(0);
  };

  const [attending, setAttending] = useState({});
  const [toast, setToast] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(null);
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
  // ei — Google Maps calculează dimensiunea containerului la inițializare, iar
  // un container ascuns are dimensiune 0. Rezultatul, la fel ca înainte cu
  // Leaflet: harta rămâne "înghețată" la acea dimensiune până îi spunem
  // explicit să-și recalculeze layout-ul, exact în momentul în care devine
  // vizibilă (evenimentul "resize" al Google Maps, echivalentul invalidateSize()).
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      window.google?.maps?.event.trigger(mapInstanceRef.current, "resize");
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

  // Încarcă SDK-ul Google Maps o singură dată (loadGoogleMaps deduplică
  // intern chiar dacă mai multe componente îl cer simultan).
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => { if (!cancelled) setMapsLoaded(true); })
      .catch((err) => { if (!cancelled) setMapsError(err.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const google = window.google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 44.4268, lng: 26.1025 },
      zoom: 12,
      styles: DARK_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: false,
      keyboardShortcuts: false,
      clickableIcons: false,
      backgroundColor: "#050506",
    });
    mapInstanceRef.current = map;
    map.addListener("zoom_changed", () => setZoom(map.getZoom()));

    // Cerem locația automat la deschiderea hărții. Dacă userul acceptă, harta se
    // centrează pe el; dacă refuză sau browserul nu suportă geolocation, rămâne
    // pe centrul default (București) exact ca înainte — fără mesaje suplimentare.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        map.setCenter({ lat: latitude, lng: longitude });
        map.setZoom(13);
        new google.maps.Marker({
          position: { lat: latitude, lng: longitude },
          map,
          icon: { url: userLocationIconUrl, scaledSize: new google.maps.Size(16, 16), anchor: new google.maps.Point(8, 8) },
          zIndex: 1,
        });
      });
    }

    // Plasă de siguranță: dacă totuși componenta se demontează vreodată (ex.
    // logout), curățăm instanța — Google Maps n-are un echivalent direct de
    // map.remove() din Leaflet, dar golirea referinței lasă instanța veche să
    // fie colectată de garbage collector odată ce nu mai are niciun ascultător activ.
    return () => {
      mapInstanceRef.current = null;
    };
  }, [mapsLoaded]);

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
    if (!mapsLoaded || !mapInstanceRef.current) return;
    const google = window.google;
    const map = mapInstanceRef.current;

    markersRef.current.forEach(m => m.setMap(null));
    circlesRef.current.forEach(c => c.setMap(null));
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
      const position = { lat: event.coords[0], lng: event.coords[1] };
      const innerIconSvg = (event.vibe && vibeSvgById[event.vibe]) ? vibeSvgById[event.vibe]("#fff") : (isHomemade ? houseIconSvg("#fff") : lightningIconSvg("#fff"));

      // Cercul de "zonă aproximativă" apare doar cât timp locația chiar e
      // ascunsă — dacă hostul a activat location_visible, evenimentul (chiar
      // neoficial) primește marker clasic tip pin, cu poziția exactă.
      if (isHomemade && !event.location_visible) {
        // Cercul de zonă are un offset FIX (identic pentru toți) față de adresa reală
        const [offLat, offLng] = applyOffset(event.coords[0], event.coords[1], event.rawId ?? event.id);
        const offsetPos = { lat: offLat, lng: offLng };

        // Sub acest nivel de zoom, arătăm un pin clasic (ca la oficiale) — de-abia
        // când dai zoom suficient de aproape, pinul dispare și rămân doar cercul +
        // casa transparentă, ancorate geografic. Citim zoom-ul live din hartă
        // (nu din closure) ca desenul inițial să fie corect indiferent când rulează efectul.
        const ZOOM_THRESHOLD = 15;
        const zoomedIn = map.getZoom() >= ZOOM_THRESHOLD;

        const circle = new google.maps.Circle({
          map, center: offsetPos, radius: 150,
          strokeColor: color, strokeOpacity: zoomedIn ? 0.55 : 0, strokeWeight: 1.5,
          fillColor: color, fillOpacity: zoomedIn ? 0.12 : 0,
          clickable: true,
        });
        circle.addListener("click", () => setSelectedEvent(event));
        circlesRef.current.push(circle);

        // Iconița de casă e ancorată geografic (nu în pixeli, ca un marker normal),
        // ca dimensiunea ei să se scaleze împreună cu cercul la orice nivel de zoom.
        const houseOverlay = new google.maps.GroundOverlay(
          buildHouseOverlayUrl(color),
          boundsAround(offLat, offLng, 55),
          { map, opacity: zoomedIn ? (isMarkedActive ? 0.85 : 0.5) : 0, clickable: true }
        );
        houseOverlay.addListener("click", () => setSelectedEvent(event));
        markersRef.current.push(houseOverlay);

        // Pinul clasic (vizibil de departe, dispare la zoom apropiat).
        const pinMarker = new google.maps.Marker({
          position: offsetPos, map,
          icon: { url: buildPinIconUrl(color, isMarkedActive, innerIconSvg), scaledSize: new google.maps.Size(36, 44), anchor: new google.maps.Point(18, 44) },
          opacity: zoomedIn ? 0 : 1,
          clickable: !zoomedIn,
        });
        pinMarker.addListener("click", () => setSelectedEvent(event));
        markersRef.current.push(pinMarker);

        // Păstrăm referințele ca să putem doar actualiza opacitatea la schimbarea
        // zoom-ului (nu recreăm elementele).
        homemadeLayersRef.current.push({ circle, houseOverlay, pinMarker, color, isMarkedActive });
        return;
      }

      // Evenimente oficiale (sau homemade cu adresă vizibilă) — marker clasic tip pin.
      const marker = new google.maps.Marker({
        position, map,
        icon: { url: buildPinIconUrl(color, isMarkedActive, innerIconSvg), scaledSize: new google.maps.Size(36, 44), anchor: new google.maps.Point(18, 44) },
      });
      marker.addListener("click", () => setSelectedEvent(event));
      markersRef.current.push(marker);
    });
  }, [mapsLoaded, activeFilters, attending, allMapEvents, myRequests]);

  // Focus venit din feed (tap pe locația unui eveniment) — sare peste filtrele
  // active (userul a cerut explicit locația asta) și deschide fișa de jos.
  useEffect(() => {
    if (!focusTarget?.id || !mapsLoaded || !mapInstanceRef.current) return;
    const target = allMapEvents.find(e => String(e.id) === focusTarget.id);
    if (!target) return;
    setActiveFilters(new Set());
    mapInstanceRef.current.panTo({ lat: target.coords[0], lng: target.coords[1] });
    mapInstanceRef.current.setZoom(16);
    setSelectedEvent(target);
  }, [focusTarget, mapsLoaded, allMapEvents]);

  // Doar actualizăm opacitatea elementelor deja desenate la schimbarea zoom-ului
  // (nu le recreăm). Spre deosebire de versiunea cu Leaflet, aici nu mai animăm
  // tranziția cu CSS (Circle/GroundOverlay din Google Maps nu expun un nod DOM
  // stabil de care să agățăm o tranziție) — opacitatea sare direct la noua
  // valoare, simplificare acceptată ca să nu depindem de comportament intern
  // nedocumentat al randererului Google Maps.
  useEffect(() => {
    const ZOOM_THRESHOLD = 15;
    const zoomedIn = zoom >= ZOOM_THRESHOLD;
    homemadeLayersRef.current.forEach(({ circle, houseOverlay, pinMarker, color, isMarkedActive }) => {
      circle.setOptions({
        strokeOpacity: zoomedIn ? 0.55 : 0,
        fillOpacity: zoomedIn ? 0.12 : 0,
      });
      houseOverlay.setOpacity(zoomedIn ? (isMarkedActive ? 0.85 : 0.5) : 0);
      pinMarker.setOpacity(zoomedIn ? 0 : 1);
      pinMarker.setClickable(!zoomedIn);
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
        // upsert + ignoreDuplicates, nu insert simplu — apăsat rapid/repetat
        // altfel crea mai multe rânduri (același bug fixat deja la EventCard).
        const { error } = await supabase.from("attendances").upsert(
          [{ event_id: String(event.id), user_id: user.id }],
          { onConflict: "event_id,user_id", ignoreDuplicates: true }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendances").delete().eq("event_id", String(event.id)).eq("user_id", user.id);
        if (error) throw error;
      }
      setToast(newVal ? `Înscris la ${event.title}!` : "Ai renunțat");
    } catch (err) {
      setAttending(prev => ({ ...prev, [event.id]: !newVal }));
      setToast(err.message?.includes("participanți") ? err.message : "Eroare. Încearcă din nou.");
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
      // upsert, nu insert simplu — apăsat rapid/repetat crea mai multe cereri
      // pentru același eveniment (constrângerea unică e pe event_id+requester_id).
      const { error } = await supabase.from("attendance_requests").upsert([{
        event_id: rawId,
        requester_id: user.id,
        requester_username: username,
        host_id: event.hostId,
        status: "pending",
      }], { onConflict: "event_id,requester_id" });
      if (error) throw error;
      setMyRequests(prev => ({ ...prev, [rawId]: "pending" }));
      if (event.hostId) {
        notifyUser({
          targetUserId: event.hostId,
          title: "Cerere nouă de participare",
          body: `${username} vrea să participe la ${event.title}.`,
          type: "request",
          actorId: user.id,
          eventId: `posted_${rawId}`,
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
    // window.open(..., "_blank") într-un PWA instalat (standalone) deschide
    // un tab de browser gol, în afara aplicației — nu există un "tab" vizibil
    // în care să navigheze, deci rămâi cu un ecran "Search or enter website
    // name" când încerci să revii în PWA. Navigarea directă a ferestrei
    // curente lasă telefonul să interpreteze link-ul ca intent nativ spre
    // aplicația Maps (deschide Maps, PWA-ul rămâne intact dedesubt); dacă
    // dispozitivul n-are Maps instalat, navighează normal, recuperabil cu
    // butonul de back al browserului, nu cu un tab gol orfan.
    window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${event.coords[0]},${event.coords[1]}`;
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

      {mapsError && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center", background: "#050506" }}>
          <MapIcon size={32} style={{ color: "rgba(255,255,255,0.3)" }} />
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif" }}>Harta nu s-a putut încărca</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", maxWidth: 280 }}>{mapsError}</div>
        </div>
      )}

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
        <div
          onPointerDown={handlePopupPointerDown}
          onPointerMove={handlePopupPointerMove}
          onPointerUp={handlePopupPointerUp}
          onPointerLeave={handlePopupPointerUp}
          style={{
            position: "absolute", bottom: 80, left: 16, right: 16, background: "rgba(10,10,12,0.98)", border: `1px solid ${selectedEvent.color}60`, borderRadius: 20, padding: "16px", backdropFilter: "blur(20px)", zIndex: 600, boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 30px ${selectedEvent.color}20`,
            touchAction: "none",
            transform: `translateY(${popupClosing || popupEntering ? 400 : popupDragY}px)`,
            opacity: popupClosing ? 0 : 1,
            transition: (popupDragRef.current || popupEntering) ? "none" : `transform ${POPUP_CLOSE_MS}ms cubic-bezier(0.32, 0, 0.15, 1), opacity ${POPUP_CLOSE_MS}ms ease`,
          }}
        >
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
          <button onClick={closePopup} style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

          <div style={{ display: "flex", gap: 12, marginBottom: 12, marginTop: 6 }}>
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
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>{selectedEvent.title}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}><ClockIcon size={13} /> {selectedEvent.date}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>
              <PinIcon size={13} />
              {canSeeExactAddress(selectedEvent) ? selectedEvent.venue : <>Zonă aproximativă <LockIcon size={12} /></>}
            </span>
            <span style={{ fontSize: 12, color: selectedEvent.color, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{formatPrice(selectedEvent.price)}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {selectedEvent.hostId && user && selectedEvent.hostId === user.id ? (
              // E propriul tău eveniment — n-are sens să "participi" la el, arătăm
              // în schimb statisticile (aprecieri/participanți).
              <button onClick={() => setInsightsEvent(selectedEvent)} style={{ flex: 2, padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: `linear-gradient(135deg, ${selectedEvent.color}, ${selectedEvent.color}cc)`, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                <InfoIcon size={15} /> Insights
              </button>
            ) : selectedEvent.isHomemade && !selectedEvent.location_visible ? (
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
                {attending[selectedEvent.id] ? <><CheckCircleIcon size={15} /> Participi</> : <><PlusIcon size={15} /> Particip</>}
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

      {insightsEvent && (
        <EventInsightsModal
          event={insightsEvent}
          rawId={insightsEvent.rawId}
          onClose={() => setInsightsEvent(null)}
          onViewProfile={onViewProfile}
        />
      )}
    </div>
  );
}
