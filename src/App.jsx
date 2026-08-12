import { useState, useRef, useEffect } from "react";
import EventCard from "./components/EventCard";
import FilterDrawer from "./components/FilterDrawer";
import Navbar from "./components/Navbar";
import ProgressDots from "./components/ProgressDots";
import ProfilePage from "./components/ProfilePage";
import MapPage from "./components/MapPage";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import SearchPage from "./components/SearchPage";
import PublicProfilePage from "./components/PublicProfilePage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import PostPage from "./components/PostPage";
import CommentsSheet from "./components/CommentsSheet";
import { supabase } from "./supabase";
import { events as staticEvents } from "./data/events";
import { filterActiveEvents } from "./utils/eventTime";
import { playNotificationSound, primeNotificationAudio } from "./utils/notificationSound";
import { setAppVisible } from "./utils/appVisibility";
import { MoonIcon, FilterIcon, BellIcon } from "./components/Icons";

const filterLabels = { all: "Toate", official: "Oficial", homemade: "Homemade", today: "Azi", weekend: "Weekend", free: "Gratuit" };

const filterFn = (event, filter) => {
  if (filter === "all") return true;
  if (filter === "official") return event.type === "official";
  if (filter === "homemade") return event.type === "homemade";
  if (filter === "today") {
    // Evenimentele postate au acum o dată reală (event_date) — o folosim când există,
    // altfel rămânem pe potrivirea de text de dinainte (evenimentele statice/vechi).
    if (event.event_date) {
      const d = new Date(event.event_date);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    return event.date?.toLowerCase().includes("azi");
  }
  if (filter === "weekend") {
    if (event.event_date) {
      const day = new Date(event.event_date).getDay(); // 0 = duminică, 5/6 = vineri/sâmbătă
      return day === 0 || day === 5 || day === 6;
    }
    return event.date?.toLowerCase().includes("weekend") || event.date?.toLowerCase().includes("sâmbătă");
  }
  if (filter === "free") return event.price === "Gratuit";
  return true;
};

// Convert Supabase posted_event to same format as static events
const convertPostedEvent = (e, organizerMap = {}) => ({
  id: `posted_${e.id}`,
  type: e.type || "homemade",
  title: e.title,
  venue: e.venue || "Locație necunoscută",
  date: e.date || "Data necunoscută",
  event_date: e.event_date || null,
  age_restricted: !!e.age_restricted,
  price: e.price || "Gratuit",
  likes: 0,
  attending: 0,
  tags: e.tags ? e.tags.split(",").map(t => t.trim()) : [],
  color: e.type === "official" ? "#FF3366" : "#FFB800",
  bgColor: e.type === "official" ? "#1a0010" : "#110d00",
  description: e.description || "",
  organizer: organizerMap[e.user_id] || "Utilizator NightFeed",
  cover_url: e.cover_url,
  ticket_link: e.ticket_link,
  code: e.code,
  organizer_id: e.user_id,
  isPosted: true,
});

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authScreen, setAuthScreen] = useState(null); // null = landing, "login" | "register" = AuthPage
  const [viewingProfile, setViewingProfile] = useState(null); // user_id of profile being viewed publicly

  // Când intri în login/register, împingem o intrare în istoricul browserului,
  // ca săgeata "Back" a browserului să te aducă înapoi la landing, nu să te scoată din site.
  const openAuthScreen = (mode) => {
    setAuthScreen(mode);
    window.history.pushState({ authScreen: mode }, "");
  };

  useEffect(() => {
    const handlePop = () => {
      // La "Back", dacă eram în login/register, revenim la landing
      setAuthScreen(null);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("feed");
  const [activeFilter, setActiveFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [commentsEvent, setCommentsEvent] = useState(null);
  const [postedEvents, setPostedEvents] = useState([]);
  const [notifToast, setNotifToast] = useState(null); // { title, body } — rămâne montat în timpul ieșirii
  const [notifToastShow, setNotifToastShow] = useState(false); // controlează animația de intrare/ieșire
  const feedRef = useRef(null);
  const recoveryModeRef = useRef(false);
  const notifToastTimer = useRef(null);
  const notifToastHideTimer = useRef(null);

  // Pull-to-refresh pe feed: trage în jos cât ești pe primul eveniment (scrollTop 0)
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const PULL_THRESHOLD = 70;
  const PULL_MAX = 110;

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

  // Browserele blochează sunetul până la un tap real al userului — "trezim"
  // Web Audio la primul tap din aplicație, ca sunetul de notificare să nu
  // rămână mut când vine un eveniment realtime (nu un tap direct).
  useEffect(() => {
    const unlock = () => primeNotificationAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  // Scriem în IndexedDB dacă tab-ul e vizibil chiar acum — sw.js citește de
  // acolo la fiecare push, ca să nu mai arate bannerul de sistem cât timp
  // notificarea oricum apare deja ca toast în aplicație. Nu ne bazăm doar pe
  // postMessage/clients.matchAll: service worker-ul poate fi repornit de
  // browser între timp (își pierde orice variabilă ținută în memorie), iar
  // clients.matchAll().visibilityState nu raportează corect peste tot (mai
  // ales pe PWA instalat standalone pe Android) — IndexedDB supraviețuiește
  // repornirii SW-ului și e citit direct, nu memorat.
  //
  // Trimitem din nou periodic (heartbeat) cât timp ești vizibil, ca sw.js să
  // poată ignora un semnal prea vechi (tab uitat deschis, dar de fapt închis
  // de mult) fără să rateze un tab chiar activ.
  useEffect(() => {
    const sync = () => setAppVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("pagehide", () => setAppVisible(false));
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, 15000);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      clearInterval(heartbeat);
    };
  }, []);

  const dismissNotifToast = () => {
    clearTimeout(notifToastTimer.current);
    clearTimeout(notifToastHideTimer.current);
    setNotifToastShow(false);
    notifToastHideTimer.current = setTimeout(() => setNotifToast(null), 350);
  };

  const showNotifToast = (data) => {
    clearTimeout(notifToastTimer.current);
    clearTimeout(notifToastHideTimer.current);
    setNotifToast(data);
    setNotifToastShow(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setNotifToastShow(true)));
    notifToastTimer.current = setTimeout(dismissNotifToast, 4000);
  };

  // Cât timp ai tab-ul NightFeed deschis și vizibil, notificările noi apar
  // direct în aplicație (toast + sunet propriu) — service worker-ul (sw.js)
  // știe să nu mai dubleze cu bannerul de sistem în acest caz.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`app_notifications:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          if (document.visibilityState !== "visible") return;
          playNotificationSound();
          let avatarUrl = null;
          if (payload.new.actor_id) {
            const { data } = await supabase.from("profiles").select("avatar_url").eq("user_id", payload.new.actor_id).maybeSingle();
            avatarUrl = data?.avatar_url || null;
          }
          showNotifToast({ title: payload.new.title, body: payload.new.body, avatarUrl });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const loadPostedEvents = async () => {
    const { data, error } = await supabase
      .from("posted_events_feed")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return;

    // Numele reale ale organizatorilor, ca să nu mai arate generic "Utilizator
    // NightFeed" pe fiecare card — la fel cum se face deja în Căutare.
    const hostIds = [...new Set(data.map(e => e.user_id).filter(Boolean))];
    let organizerMap = {};
    if (hostIds.length > 0) {
      const [{ data: profiles }, { data: usernames }] = await Promise.all([
        supabase.from("profiles").select("user_id, nume, prenume").in("user_id", hostIds),
        supabase.from("usernames").select("user_id, username").in("user_id", hostIds),
      ]);
      const unameMap = Object.fromEntries((usernames || []).map(u => [u.user_id, u.username]));
      organizerMap = Object.fromEntries((profiles || []).map(p => [
        p.user_id,
        [p.prenume, p.nume].filter(Boolean).join(" ") || unameMap[p.user_id] || "",
      ]));
    }

    setPostedEvents(filterActiveEvents(data).map(e => convertPostedEvent(e, organizerMap)));
  };

  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);

  const setPull = (v) => { pullDistanceRef.current = v; setPullDistance(v); };

  const doRefresh = async () => {
    setRefreshing(true);
    const start = Date.now();
    await loadPostedEvents();
    // durată minimă ca animația să se vadă, nu doar să clipească dacă fetch-ul e instant
    const elapsed = Date.now() - start;
    if (elapsed < 700) await new Promise((r) => setTimeout(r, 700 - elapsed));
    setRefreshing(false);
    setPull(0);
  };

  // Ascultătorii de touch se atașează manual (nu prin props JSX), ca touchmove
  // să poată fi non-pasiv — altfel preventDefault() nu ar avea efect și browserul
  // ar declanșa propriul pull-to-refresh nativ (recarcă toată pagina) în paralel.
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const onTouchStart = (e) => {
      if (feed.scrollTop <= 0 && !refreshingRef.current) {
        pullStartY.current = e.touches[0].clientY;
      } else {
        pullStartY.current = null;
      }
    };
    const onTouchMove = (e) => {
      if (pullStartY.current === null) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 6 && feed.scrollTop <= 0) {
        e.preventDefault();
        setPull(Math.min(delta * 0.5, PULL_MAX));
      } else if (delta <= 0) {
        pullStartY.current = null;
        setPull(0);
      }
    };
    const onTouchEnd = () => {
      if (pullStartY.current === null) return;
      pullStartY.current = null;
      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        setPull(PULL_THRESHOLD);
        doRefresh();
      } else {
        setPull(0);
      }
    };

    feed.addEventListener("touchstart", onTouchStart, { passive: true });
    feed.addEventListener("touchmove", onTouchMove, { passive: false });
    feed.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      feed.removeEventListener("touchstart", onTouchStart);
      feed.removeEventListener("touchmove", onTouchMove);
      feed.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Filtrarea de mai sus rulează o singură dată, la încărcare — dacă rămâi cu
  // aplicația deschisă și trece ora unei petreceri între timp, ea nu dispărea din
  // feed decât la un reload. Verificăm din nou periodic și o scoatem live.
  useEffect(() => {
    const interval = setInterval(() => {
      setPostedEvents(prev => filterActiveEvents(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
    // Dacă ești pe ecranul de creare eveniment și apeși pe orice alt buton din
    // meniul de jos, renunțăm direct la creare — nu mai trebuie neapărat să
    // apeși "Închide" din colțul din dreapta sus.
    if (showPost) setShowPost(false);
    setActiveTab(tab);
  };

  // Deschide un eveniment specific (din Căutare sau cod) — comută pe feed și
  // derulează exact la el.
  const openSpecificEvent = (event) => {
    const idx = filtered.findIndex(e => e.id === event.id || e.rawId === event.rawId);
    setActiveTab("feed");
    setTimeout(() => {
      if (feedRef.current && idx >= 0) {
        feedRef.current.scrollTo({ top: idx * feedRef.current.clientHeight, behavior: "instant" });
        setCurrentIndex(idx);
      }
    }, 50);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #000; overflow: hidden; font-family: 'DM Sans', 'Inter', sans-serif; }
        #root { width: 100vw; height: 100dvh; position: relative; overflow: hidden; }

        /* Feedback tactil subtil pe toate butoanele — se "apasă" ușor la click */
        button { transition: transform 0.12s ease; }
        button:active { transform: scale(0.95); }

        @keyframes floatHeart { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-80px) scale(0.5);opacity:0} }
        @keyframes bigHeartPop { 0%{transform:translate(-50%,-50%) scale(0.2);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.2);opacity:1} 100%{transform:translate(-50%,-50%) scale(1);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:translateX(-50%) scale(1)} 50%{opacity:0.8;transform:translateX(-50%) scale(1.1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tabEnter { from{opacity:0;transform:translateY(12px) scale(0.99)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ptrSpin { to { transform: rotate(360deg); } }
        @keyframes ptrPop { 0%{transform:scale(1)} 50%{transform:scale(1.22)} 100%{transform:scale(1)} }
        @keyframes toastGlow { 0%,100%{box-shadow:0 10px 34px rgba(255,51,102,0.22), 0 0 0 1px rgba(255,51,102,0.18) inset} 50%{box-shadow:0 10px 34px rgba(180,79,255,0.3), 0 0 0 1px rgba(180,79,255,0.25) inset} }
        @keyframes toastIconPop { 0%{transform:scale(0.3) rotate(-25deg);opacity:0} 55%{transform:scale(1.15) rotate(6deg);opacity:1} 100%{transform:scale(1) rotate(0deg)} }
      `}</style>

      {recoveryMode ? (
        // Link de resetare parolă — ecran dedicat, prioritate maximă, nimic altceva nu se randează
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#080808" }}>
          <ResetPasswordPage onDone={() => setRecoveryMode(false)} />
        </div>
      ) : (
        <>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
          {/* AUTH GATE — landing întâi, apoi login/register */}
          {!authLoading && !user && !showSplash && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9997 }}>
              {authScreen === null ? (
                <LandingPage
                  onNewUser={() => openAuthScreen("register")}
                  onExistingUser={() => openAuthScreen("login")}
                />
              ) : (
                <AuthPage onAuth={(u) => setUser(u)} initialMode={authScreen} onBack={() => window.history.back()} />
              )}
            </div>
          )}

          {authLoading && !showSplash && (
            <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
              <div style={{ color: "rgba(255,255,255,0.6)", animation: "pulse 1s ease-in-out infinite" }}><MoonIcon size={32} /></div>
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

          {/* PUBLIC PROFILE — overlay peste tot când vizitezi profilul cuiva */}
          {viewingProfile && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9996, background: "#080808", animation: "tabEnter 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
              <PublicProfilePage
                profileUserId={viewingProfile}
                currentUser={user}
                onBack={() => setViewingProfile(null)}
                onOpenEvent={(event) => { setViewingProfile(null); openSpecificEvent(event); }}
                onViewProfile={(uid) => setViewingProfile(uid)}
              />
            </div>
          )}

          {/* SEARCH PAGE */}
          {activeTab === "search" && (
            <div style={{ position: "fixed", inset: 0, height: "calc(100dvh - 64px)", zIndex: 10, animation: "tabEnter 0.45s cubic-bezier(0.16,1,0.3,1)" }}>
              <SearchPage onOpenEvent={openSpecificEvent} />
            </div>
          )}

          {/* MAP PAGE — rămâne montată (doar ascunsă), nu demontată la schimbarea
              tab-ului: altfel, la fiecare vizită se distrugea și recrea de la zero
              harta Leaflet (re-cerea locația GPS, redescărca toate tile-urile de pe
              internet, reconstruia toate marker-ele), ceea ce o făcea să se simtă
              foarte lentă. Exact ca la Feed, care are același tipar. */}
          <div style={{ display: activeTab === "map" ? "block" : "none", position: "fixed", inset: 0, height: "calc(100dvh - 64px)", zIndex: 10 }}>
            <MapPage user={user} isActive={activeTab === "map"} />
          </div>

          {/* PROFILE PAGE */}
          {activeTab === "profile" && (
            <div style={{ position: "fixed", inset: 0, height: "calc(100dvh - 64px)", zIndex: 10, animation: "tabEnter 0.45s cubic-bezier(0.16,1,0.3,1)" }}>
              {user
                ? <ProfilePage user={user} onLogout={() => { supabase.auth.signOut(); setUser(null); }} onViewProfile={(uid) => setViewingProfile(uid)} />
                : <AuthPage onAuth={(u) => setUser(u)} />
              }
            </div>
          )}

          {/* FEED */}
          <div style={{ display: activeTab === "feed" && !showPost ? "block" : "none", position: "relative" }}>
            {(pullDistance > 0 || refreshing) && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 90, zIndex: 5, pointerEvents: "none",
                display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 12,
                opacity: Math.min(pullDistance / 24, 1),
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", position: "relative",
                  background: "rgba(10,10,12,0.9)", border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(255,51,102,0.25)",
                  animation: !refreshing && pullDistance >= PULL_THRESHOLD ? "ptrPop 0.4s ease-out" : "none",
                }}>
                  <svg width="42" height="42" viewBox="0 0 42 42" style={{ position: "absolute", inset: 0, animation: refreshing ? "ptrSpin 0.9s linear infinite" : "none" }}>
                    <defs>
                      <linearGradient id="ptrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FF3366" />
                        <stop offset="100%" stopColor="#B44FFF" />
                      </linearGradient>
                    </defs>
                    <circle cx="21" cy="21" r="17" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                    <circle
                      cx="21" cy="21" r="17" fill="none" stroke="url(#ptrGrad)" strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 17}
                      strokeDashoffset={refreshing ? 2 * Math.PI * 17 * 0.25 : 2 * Math.PI * 17 * (1 - Math.min(pullDistance / PULL_THRESHOLD, 1))}
                      transform="rotate(-90 21 21)"
                      style={{ transition: pullStartY.current ? "none" : "stroke-dashoffset 0.25s ease-out" }}
                    />
                  </svg>
                  <div style={{
                    display: "flex", color: pullDistance >= PULL_THRESHOLD || refreshing ? "#FF3366" : "rgba(255,255,255,0.5)",
                    transform: `scale(${refreshing ? 1 : 0.6 + Math.min(pullDistance / PULL_THRESHOLD, 1) * 0.4}) rotate(${refreshing ? 0 : Math.min(pullDistance / PULL_THRESHOLD, 1) * 360}deg)`,
                    transition: pullStartY.current ? "none" : "transform 0.25s ease-out, color 0.2s",
                  }}>
                    <MoonIcon size={18} />
                  </div>
                </div>
              </div>
            )}
            <div ref={feedRef} style={{
              width: "100%", height: "calc(100dvh - 64px)", overflowY: "scroll", scrollSnapType: "y mandatory", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch",
              // transform: "none" cât timp nu tragem — orice valoare de transform
              // (chiar translateY(0px)) creează un nou "containing block" pentru
              // copiii cu position:fixed din interior (ex: sheet-ul "Cer să
              // particip" din EventCard), rupându-le poziționarea pe tot ecranul.
              transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : "none",
              transition: pullStartY.current ? "none" : "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              {filtered.length === 0 ? (
                <div style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center", overflow: "hidden" }}>
                  {/* Orbi subtili în fundal, ca pe landing */}
                  <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", top: "20%", left: "-60px", background: "radial-gradient(circle, rgba(255,51,102,0.25), transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />
                  <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", bottom: "15%", right: "-80px", background: "radial-gradient(circle, rgba(180,79,255,0.22), transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />

                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: 24, margin: "0 auto 24px",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)",
                    }}><MoonIcon size={36} /></div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
                      Liniște deocamdată
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 320, marginBottom: 28 }}>
                      {activeFilter !== "all"
                        ? "Niciun eveniment pentru acest filtru. Încearcă altul sau postează tu ceva."
                        : "Niciun eveniment încă. Fii primul care aprinde noaptea — postează un eveniment."}
                    </div>
                    <button onClick={() => setShowPost(true)} style={{
                      padding: "14px 28px", borderRadius: 30, border: "none", cursor: "pointer",
                      background: "linear-gradient(120deg, #FF3366, #B44FFF)", color: "#fff",
                      fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                      boxShadow: "0 8px 30px rgba(255,51,102,0.35)",
                    }}>
                      + Postează primul eveniment
                    </button>
                  </div>
                </div>
              ) : (
                filtered.map((event, i) => (
                  <div key={event.id} style={{ width: "100%", height: "calc(100dvh - 64px)", scrollSnapAlign: "start", scrollSnapStop: "always", flexShrink: 0 }}>
                    <EventCard event={event} isActive={i === currentIndex} user={user} onComment={() => setCommentsEvent(event)} onViewProfile={(uid) => setViewingProfile(uid)} />
                  </div>
                ))
              )}
            </div>

            {filtered.length > 1 && <ProgressDots total={filtered.length} current={currentIndex} color={filtered[currentIndex]?.color} />}

            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                position: "fixed", top: "calc(20px + env(safe-area-inset-top, 0px))", left: 16, zIndex: 50,
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: activeFilter !== "all" ? "9px 10px 9px 14px" : "10px",
                borderRadius: 22,
                background: activeFilter !== "all" ? "linear-gradient(120deg, rgba(255,51,102,0.25), rgba(180,79,255,0.25))" : "rgba(255,255,255,0.08)",
                border: `1px solid ${activeFilter !== "all" ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.14)"}`,
                boxShadow: activeFilter !== "all" ? "0 6px 22px rgba(255,51,102,0.3)" : "0 2px 12px rgba(0,0,0,0.25)",
                backdropFilter: "blur(14px)",
                transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <FilterIcon size={17} style={{ color: activeFilter !== "all" ? "#fff" : "rgba(255,255,255,0.85)", flexShrink: 0 }} />
              {activeFilter !== "all" && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                    {filterLabels[activeFilter] || activeFilter}
                  </span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setActiveFilter("all"); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, lineHeight: 1, marginLeft: 2 }}
                  >
                    ×
                  </span>
                </>
              )}
            </button>

            <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} active={activeFilter} onChange={setActiveFilter} />
          </div>

          <CommentsSheet event={commentsEvent} user={user} open={!!commentsEvent} onClose={() => setCommentsEvent(null)} />
          <Navbar active={activeTab} onChange={handleTabChange} />

          {notifToast && (
            <div
              onClick={dismissNotifToast}
              style={{
                position: "fixed", top: "calc(16px + env(safe-area-inset-top, 0px))", left: "50%",
                zIndex: 9998, maxWidth: "88vw", width: 340, cursor: "pointer",
                opacity: notifToastShow ? 1 : 0,
                transform: `translateX(-50%) translateY(${notifToastShow ? 0 : -28}px) scale(${notifToastShow ? 1 : 0.9})`,
                transition: "opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <div style={{
                position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 10,
                background: "rgba(15,15,18,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
                padding: "12px 14px", backdropFilter: "blur(20px)",
                animation: notifToastShow ? "toastGlow 2.2s ease-in-out infinite" : "none",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", overflow: "hidden",
                  background: notifToast.avatarUrl ? "transparent" : "linear-gradient(135deg, #FF3366, #B44FFF)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff",
                  animation: notifToastShow ? "toastIconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both" : "none",
                }}>
                  {notifToast.avatarUrl ? <img src={notifToast.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BellIcon size={16} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{notifToast.title}</div>
                  {notifToast.body && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{notifToast.body}</div>
                  )}
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{
                    height: "100%", background: "linear-gradient(90deg, #FF3366, #B44FFF)",
                    width: notifToastShow ? "0%" : "100%",
                    transition: notifToastShow ? "width 4s linear" : "none",
                  }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
