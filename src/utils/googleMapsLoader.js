// Cheia Google Maps — la fel ca la Supabase (src/supabase.js), o ținem direct
// în cod, nu într-un .env: proiectul ăsta n-a folosit niciodată variabile de
// mediu, iar cheia Maps JS e oricum vizibilă în bundle-ul public indiferent
// unde stă (nu e un secret de server). Securitatea reală vine din restricția
// de HTTP referrer pusă în Google Cloud Console, nu din ascunderea cheii.
//
// Cum obții o cheie:
//   1. console.cloud.google.com → creează un proiect (sau folosește unul
//      existent) → activează facturarea (Google cere un card, dar planul
//      gratuit de $200/lună acoperă cu mult traficul unei aplicații mici).
//   2. APIs & Services → Library → activează "Maps JavaScript API".
//   3. APIs & Services → Credentials → Create Credentials → API Key.
//   4. Editează cheia creată → "Application restrictions" → "Websites" →
//      adaugă domeniul aplicației (ex: nightfeed.ro/*, *.vercel.app/*, și
//      localhost/* cât timp testezi local) — altfel oricine îți poate folosi
//      cheia și îți consumă bugetul.
//   5. Lipește cheia mai jos, în locul textului "PASTE_YOUR_KEY_HERE".
export const GOOGLE_MAPS_API_KEY = "AIzaSyB3xiE9KACBGEUE5IeY3hWhgy5Yu5V4RU4";

let loadPromise = null;

// Încarcă scriptul o singură dată, indiferent de câte componente montează/
// demontează harta (Feed ↔ Hartă ↔ PostPage — toate trei o pot cere).
export function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "PASTE_YOUR_KEY_HERE") {
      reject(new Error("Lipsește cheia Google Maps — vezi src/utils/googleMapsLoader.js"));
      return;
    }
    // "callback=" (nu "loading=async") — varianta clasică, în care tot
    // namespace-ul google.maps (Map, Marker, Circle, GroundOverlay,
    // ControlPosition, Size, Point etc.) e garantat complet populat până
    // se declanșează callback-ul. Cu loading=async, doar Map/Marker sunt
    // disponibile imediat — restul (ex. ControlPosition) rămâne undefined
    // până apelezi explicit google.maps.importLibrary(), ceea ce am
    // descoperit abia la testare live (crash: "Cannot read properties of
    // undefined (reading 'RIGHT_BOTTOM')").
    window.__nightfeedGoogleMapsCallback = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker&callback=__nightfeedGoogleMapsCallback`;
    script.async = true;
    script.onerror = () => reject(new Error("Nu s-a putut încărca Google Maps."));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Stil dark unificat pentru toate hărțile din aplicație (Hartă + pickerul de
// pin din PostPage) — echivalentul temei cartodb-dark-matter folosite înainte
// cu Leaflet, ca tranziția să nu schimbe brusc identitatea vizuală a aplicației.
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0d0d10" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0d10" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a92" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a30" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e1e24" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#141418" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2a32" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#6a6a72" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050507" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a4a52" }] },
];

// SVG-uri pure (nu foreignObject+HTML) codate ca data URI — mai fiabil cross-
// browser pentru icoane de marker, care Google Maps le randează ca <img>.
export const svgIconUrl = (inner, w, h) =>
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`);

// Marker tip "pin" (cerc colorat + iconiță + vârf triunghiular jos) — folosit
// atât pentru evenimentele oficiale, cât și pentru cele homemade cu adresă
// vizibilă/departe de zoom-ul de detaliu.
export const buildPinIconUrl = (color, isMarkedActive, innerIconSvg) => svgIconUrl(`
  <circle cx="18" cy="18" r="16.5" fill="${color}" stroke="${isMarkedActive ? "#ffffff" : color}" stroke-opacity="${isMarkedActive ? 1 : 0.7}" stroke-width="3"/>
  <g transform="translate(10,10)">${innerIconSvg}</g>
  <path d="M12,40 L18,44 L24,40 Z" fill="${color}"/>
`, 36, 44);

// Iconița de casă ancorată geografic (folosită la zoom apropiat pe evenimente
// homemade cu adresă ascunsă) — separată de pin, ca să poată fi un
// GroundOverlay (scalează cu harta, nu rămâne fixă în pixeli ca un marker).
export const buildHouseOverlayUrl = (color) => svgIconUrl(
  `<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="${color}"/>`, 24, 24
);

export const userLocationIconUrl = svgIconUrl(
  `<circle cx="8" cy="8" r="8" fill="rgba(79,195,247,0.3)"/><circle cx="8" cy="8" r="5.5" fill="#4FC3F7" stroke="#fff" stroke-width="2"/>`,
  16, 16
);
