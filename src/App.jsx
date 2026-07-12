import { useState, useRef, useEffect } from "react";
import EventCard from "./components/EventCard";
import FilterDrawer from "./components/FilterDrawer";
import Navbar from "./components/Navbar";
import ProgressDots from "./components/ProgressDots";
import ProfilePage from "./components/ProfilePage";
import MapPage from "./components/MapPage";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import PostPage from "./components/PostPage";
import CommentsSheet from "./components/CommentsSheet";
import { supabase } from "./supabase";
import { events as staticEvents } from "./data/events";

const filterFn = (event, filter) => {
  if (filter === "all") return true;
  if (filter === "official") return event.type === "official";
  if (filter === "homemade") return event.type === "homemade";
  if (filter === "today") return event.date?.toLowerCase().includes("azi");
  if (filter === "weekend") return event.date?.toLowerCase().includes("weekend") || event.date?.toLowerCase().includes("sâmbătă");
  if (filter === "free") return event.price === "Gratuit";
  return true;
};

// Convert Supabase posted_event to same format as static events
const convertPostedEvent = (e) => ({
  id: `posted_${e.id}`,
  type: e.type || "homemade",
  title: e.title,
  venue: e.venue || "Locație necunoscută",
  date: e.date || "Data necunoscută",
  price: e.price || "Gratuit",
  likes: 0,
  attending: 0,
  tags: e.tags ? e.tags.split(",").map(t => t.trim()) : [],
  color: e.type === "official" ? "#FF3366" : "#FFB800",
  bgColor: e.type === "official" ? "#1a0010" : "#110d00",
  description: e.description || "",
  organizer: "Utilizator NightFeed",
  cover_url: e.cover_url,
  ticket_link: e.ticket_link,
  isPosted: true,
});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("feed");
  const [activeFilter, setActiveFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [commentsEvent, setCommentsEvent] = useState(null);
  const [postedEvents, setPostedEvents] = useState([]);
  const feedRef = useRef(null);
  const recoveryModeRef = useRef(false);

  // Combine static + posted events
  const allEvents = [...staticEvents, ...postedEvents];
  const filtered = allEvents.filter(e => filterFn(e, activeFilter));

  useEffect(() => {
    recoveryModeRef.current = recoveryMode;
  }, [recoveryMode]);

  // Check auth session
  useEffect(() => {
    // Verificăm ÎNAINTE de orice altceva dacă venim de pe un link de recovery
    // (Supabase pune "type=recovery" în URL). Dacă da, blocăm imediat orice logare
    // automată — altfel getSession() de mai jos apucă să te logheze normal, înainte
    // ca evenimentul PASSWORD_RECOVERY să apuce să fie procesat.
    const isRecoveryLink =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery");

    if (isRecoveryLink) {
      setRecoveryMode(true);
      setAuthLoading(false);
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setUser(data.session.user);
        setAuthLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Link-ul de resetare a parolei declanșează acest eveniment — nu logăm userul
      // automat, ci îl trimitem pe un ecran dedicat de "setează parolă nouă".
      if (_event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setAuthLoading(false);
        return;
      }
      // Delogarea trebuie procesată IMEDIAT, indiferent dacă suntem în recovery mode —
      // altfel, după ce ResetPasswordPage face signOut(), aplicația nu află de asta și
      // rămâne cu sesiunea veche "agățată" în memorie.
      if (_event === "SIGNED_OUT") {
        setUser(null);
        setAuthLoading(false);
        return;
      }
      // Cât timp suntem în ecranul de recovery, ignorăm alte evenimente (ex: SIGNED_IN
      // generat de sesiunea temporară de recovery).
      if (recoveryModeRef.current) return;

      setUser(session?.user || null);
      setAuthLoading(false);
      // When user logs in, switch to profile tab so they can complete their profile
      if (session?.user && _event === "SIGNED_IN") {
        setActiveTab("profile");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load posted events from Supabase
  useEffect(() => {
    loadPostedEvents();
  }, []);

  const loadPostedEvents = async () => {
    const { data, error } = await supabase
      .from("posted_events")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPostedEvents(data.map(convertPostedEvent));
  };

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const handleScroll = () => {
      const index = Math.round(feed.scrollTop / feed.clientHeight);
      setCurrentIndex(Math.min(index, filtered.length - 1));
    };
    feed.addEventListener("scroll", handleScroll, { passive: true });
    return () => feed.removeEventListener("scroll", handleScroll);
  }, [filtered.length]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: "instant" });
      setCurrentIndex(0);
    }
  }, [activeFilter]);

  const handleTabChange = (tab) => {
    if (tab === "post") { setShowPost(true); return; }
    setActiveTab(tab);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #000; overflow: hidden; font-family: 'DM Sans', sans-serif; }
        #root { width: 100vw; height: 100dvh; position: relative; overflow: hidden; }
        @keyframes floatHeart { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-80px) scale(0.5);opacity:0} }
        @keyframes bigHeartPop { 0%{transform:translate(-50%,-50%) scale(0.2);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.2);opacity:1} 100%{transform:translate(-50%,-50%) scale(1);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:translateX(-50%) scale(1)} 50%{opacity:0.8;transform:translateX(-50%) scale(1.1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {recoveryMode ? (
        // Link de resetare parolă — ecran dedicat, prioritate maximă, nimic altceva nu se randează
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#080808" }}>
          <ResetPasswordPage onDone={() => setRecoveryMode(false)} />
        </div>
      ) : (
        <>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
          {/* AUTH GATE — dacă nu ești logat, arată login */}
          {!authLoading && !user && !showSplash && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9997 }}>
              <AuthPage onAuth={(u) => setUser(u)} />
            </div>
          )}

          {authLoading && !showSplash && (
            <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
              <div style={{ fontSize: 32, animation: "pulse 1s ease-in-out infinite" }}>🌙</div>
            </div>
          )}

          {/* POST PAGE */}
          {showPost && (
            <div style={{ position: "fixed", inset: 0, height: "calc(100dvh - 64px)", zIndex: 20, animation: "slideUp 0.3s ease-out" }}>
              {user
                ? <PostPage user={user} onClose={() => { setShowPost(false); loadPostedEvents(); }} />
                : <AuthPage onAuth={(u) => setUser(u)} />
              }
            </div>
          )}

          {/* MAP PAGE */}
          {activeTab === "map" && (
            <div style={{ position: "fixed", inset: 0, height: "calc(100dvh - 64px)", zIndex: 10 }}>
              <MapPage user={user} />
            </div>
          )}

          {/* PROFILE PAGE */}
          {activeTab === "profile" && (
            <div style={{ position: "fixed", inset: 0, height: "calc(100dvh - 64px)", zIndex: 10, animation: "slideUp 0.3s ease-out" }}>
              {user
                ? <ProfilePage user={user} onLogout={() => { supabase.auth.signOut(); setUser(null); }} />
                : <AuthPage onAuth={(u) => setUser(u)} />
              }
            </div>
          )}

          {/* FEED */}
          <div style={{ display: activeTab === "feed" && !showPost ? "block" : "none" }}>
            <div ref={feedRef} style={{ width: "100%", height: "calc(100dvh - 64px)", overflowY: "scroll", scrollSnapType: "y mandatory", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}>
              {filtered.length === 0 ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", gap: 12 }}>
                  <span style={{ fontSize: 48 }}>🌙</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16 }}>Niciun eveniment găsit</span>
                </div>
              ) : (
                filtered.map((event, i) => (
                  <div key={event.id} style={{ width: "100%", height: "calc(100dvh - 64px)", scrollSnapAlign: "start", scrollSnapStop: "always", flexShrink: 0 }}>
                    <EventCard event={event} isActive={i === currentIndex} user={user} onComment={() => setCommentsEvent(event)} />
                  </div>
                ))
              )}
            </div>

            {filtered.length > 1 && <ProgressDots total={filtered.length} current={currentIndex} color={filtered[currentIndex]?.color} />}

            <button onClick={() => setDrawerOpen(true)} style={{ position: "fixed", top: 20, right: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, width: 40, height: 40, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, backdropFilter: "blur(10px)", zIndex: 50, padding: 0 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: i===1?14:18, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.8)" }} />)}
            </button>

            {activeFilter !== "all" && (
              <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", padding: "5px 14px", borderRadius: 20, background: "rgba(255,51,102,0.2)", border: "1px solid rgba(255,51,102,0.4)", backdropFilter: "blur(10px)", zIndex: 50, display: "flex", alignItems: "center", gap: 6, animation: "fadeIn 0.3s ease-out" }}>
                <span style={{ fontSize: 10, color: "#FF3366", fontWeight: 700, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{activeFilter}</span>
                <button onClick={() => setActiveFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,51,102,0.7)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            )}

            <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} active={activeFilter} onChange={setActiveFilter} />
          </div>

          <CommentsSheet event={commentsEvent} user={user} open={!!commentsEvent} onClose={() => setCommentsEvent(null)} />
          <Navbar active={activeTab} onChange={handleTabChange} />
        </>
      )}
    </>
  );
}
