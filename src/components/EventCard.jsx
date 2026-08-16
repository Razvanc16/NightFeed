import JoinRequestSheet from "./JoinRequestSheet";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { LightningIcon, HouseIcon, PinIcon, LockIcon, ClockIcon, KeyIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";

const HeartIcon = ({ filled, color, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={filled ? color : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const iconShadow = { filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" };

const CheckIcon = ({ color }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={iconShadow}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconShadow}>
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconShadow}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const CommentIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconShadow}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const isVideoUrl = (url) => !!url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

const MuteIcon = ({ muted }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" />
    {muted ? <line x1="23" y1="9" x2="17" y2="15" /> : null}
    {muted ? <line x1="17" y1="9" x2="23" y2="15" /> : null}
    {!muted && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
    {!muted && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
  </svg>
);

const PlayPauseIcon = ({ paused }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))" }}>
    {paused ? <polygon points="6 3 20 12 6 21 6 3" /> : <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>}
  </svg>
);

const HeartParticle = ({ x, y, id, color }) => (
  <div style={{ position: "absolute", left: x - 10, top: y - 10, pointerEvents: "none", animation: "floatHeart 1.2s ease-out forwards", zIndex: 100 }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  </div>
);

const BigHeart = ({ show, color }) => (
  <div style={{ position: "absolute", top: "50%", left: "50%", opacity: show ? 1 : 0, animation: show ? "heartFlyColor 0.9s cubic-bezier(0.2, 0.75, 0.3, 1) forwards" : "none", pointerEvents: "none", zIndex: 99 }}>
    <svg width="100" height="100" viewBox="0 0 24 24" fill={color} style={{ filter: `drop-shadow(0 6px 24px ${color}90)` }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  </div>
);

const BurstParticle = ({ x, y, color, angle }) => (
  <div
    style={{ position: "fixed", left: x, top: y, width: 6, height: 6, borderRadius: "50%", background: color, pointerEvents: "none", zIndex: 500, transform: "translate(-50%, -50%)" }}
    ref={el => {
      if (el) {
        el.animate([
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle * Math.PI / 180) * 50}px), calc(-50% + ${Math.sin(angle * Math.PI / 180) * 50}px)) scale(0)`, opacity: 0 },
        ], { duration: 500 + Math.random() * 200, easing: "ease-out", fill: "forwards" });
      }
    }}
  />
);

const Toast = ({ message, show, color }) => (
  <div style={{
    position: "fixed", bottom: 90, left: "50%",
    transform: `translateX(-50%) translateY(${show ? "0" : "20px"})`,
    opacity: show ? 1 : 0,
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    background: "rgba(20,20,20,0.95)", border: `1px solid ${color}60`,
    borderRadius: 20, padding: "10px 20px", color: "#fff", fontSize: 13,
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    zIndex: 300, backdropFilter: "blur(20px)",
    boxShadow: `0 4px 20px ${color}30`, whiteSpace: "nowrap", pointerEvents: "none",
  }}>
    {message}
  </div>
);

export default function EventCard({ event, isActive, user, onComment, onViewProfile, isFollowingOrganizer, onToggleFollowOrganizer }) {
  // Like-urile și attend-ul (pentru evenimente non-homemade) sunt acum în Supabase,
  // vizibile pentru toți userii, pe orice device.
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(event.likes);
  const [attending, setAttending] = useState(false);
  const [attendCount, setAttendCount] = useState(event.attending);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [hearts, setHearts] = useState([]);
  const [bigHeart, setBigHeart] = useState(false);
  const [burst, setBurst] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", color: "#fff" });
  const [btnAnim, setBtnAnim] = useState({ like: false, attend: false, share: false, comment: false });
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);
  const videoRef = useRef(null);
  const lastTap = useRef(0);
  const cardRef = useRef(null);
  const toastTimer = useRef(null);
  const attendBusyRef = useRef(false);
  const likeNotifyTimer = useRef(null);

  // Attend count (Supabase, shared) — la fel ca la likes: bază demo + count real + realtime
  useEffect(() => {
    let active = true;

    const loadAttendance = async () => {
      const { count } = await supabase
        .from("attendances")
        .select("*", { count: "exact", head: true })
        .eq("event_id", String(event.id));
      if (active) setAttendCount(event.attending + (count || 0));

      if (user) {
        const { data } = await supabase
          .from("attendances")
          .select("id")
          .eq("event_id", String(event.id))
          .eq("user_id", user.id)
          .maybeSingle();
        if (active) setAttending(!!data);
      } else {
        setAttending(false);
      }
    };
    loadAttendance();

    const channel = supabase
      .channel(`attendances:${event.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendances", filter: `event_id=eq.${event.id}` },
        () => setAttendCount(c => c + 1)
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "attendances", filter: `event_id=eq.${event.id}` },
        () => setAttendCount(c => Math.max(0, c - 1))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [event.id, user?.id]);

  // Evenimentele homemade postate (cu cerere de participare) nu foloseau
  // deloc tabelul attendances, deci contorul de participanți rămânea mereu
  // ascuns/gol pentru ele — aici numărăm cererile acceptate din
  // attendance_requests, tabelul pe care chiar îl folosesc.
  const isJoinRequestEvent = event.isPosted && event.type === "homemade";
  useEffect(() => {
    if (!isJoinRequestEvent) return;
    let active = true;
    const rawId = (event.rawId || event.id).toString().replace("posted_", "");

    const loadAccepted = async () => {
      const { count } = await supabase
        .from("attendance_requests")
        .select("*", { count: "exact", head: true })
        .eq("event_id", rawId)
        .eq("status", "accepted");
      if (active) setAcceptedCount(count || 0);
    };
    loadAccepted();

    const channel = supabase
      .channel(`accepted_requests:${rawId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_requests", filter: `event_id=eq.${rawId}` },
        loadAccepted
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [event.id, isJoinRequestEvent]);

  // Încarcă numărul real de like-uri + dacă userul curent a dat like, apoi ascultă live la schimbări
  useEffect(() => {
    let active = true;

    const loadLikes = async () => {
      const { count } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("event_id", String(event.id));
      if (active) setLikeCount(event.likes + (count || 0));

      if (user) {
        const { data } = await supabase
          .from("likes")
          .select("id")
          .eq("event_id", String(event.id))
          .eq("user_id", user.id)
          .maybeSingle();
        if (active) setLiked(!!data);
      } else {
        setLiked(false);
      }
    };
    loadLikes();

    const refreshCount = async () => {
      const { count } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("event_id", String(event.id));
      if (active) setLikeCount(event.likes + (count || 0));
    };

    const channel = supabase
      .channel(`likes:${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `event_id=eq.${event.id}` },
        refreshCount
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [event.id, user?.id]);

  // Video-ul redă doar cât timp cardul e cel activ din swipe — altfel ar
  // reda (și, dacă nu ar fi mut, ar suna) toate clipurile din feed deodată.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !videoPaused) v.play().catch(() => {});
    else v.pause();
  }, [isActive, videoPaused, event.cover_url]);

  const toggleVideoMute = (e) => {
    e.stopPropagation();
    setVideoMuted(m => !m);
  };

  const toggleVideoPause = (e) => {
    e.stopPropagation();
    setVideoPaused(p => !p);
  };

  // Ține apăsat pe video ca să meargă la 2x — dai drumul, revine la normal.
  const handleVideoHoldStart = (e) => {
    if (videoRef.current) videoRef.current.playbackRate = 2;
  };
  const handleVideoHoldEnd = (e) => {
    if (videoRef.current) videoRef.current.playbackRate = 1;
  };

  const showToast = (message, color) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, message, color });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2000);
  };

  const spawnBurst = (e, color) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const particles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i, x: cx, y: cy, color,
      angle: (360 / 8) * i + Math.random() * 20,
    }));
    setBurst(prev => [...prev, ...particles]);
    setTimeout(() => setBurst(prev => prev.filter(p => !particles.find(pp => pp.id === p.id))), 800);
  };

  const animateBtn = (key) => {
    setBtnAnim(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setBtnAnim(prev => ({ ...prev, [key]: false })), 400);
  };

  const setLikeInSupabase = async (newLiked) => {
    if (!user) {
      showToast("Autentifică-te pentru a da like!", "rgba(255,255,255,0.5)");
      return;
    }
    if (newLiked === liked) return; // deja în starea cerută — evită operații redundante
    setLiked(newLiked);
    // Optimistic și pe count, nu doar pe inimă — altfel numărul rămâne neschimbat
    // până vine evenimentul realtime (sau deloc, dacă realtime are vreo problemă).
    // refreshCount recorectează oricum, autoritar, la evenimentul din canal.
    setLikeCount(c => c + (newLiked ? 1 : -1));
    try {
      if (newLiked) {
        // upsert cu ignoreDuplicates: dacă cumva există deja, nu creează duplicate
        const { error } = await supabase.from("likes").upsert(
          [{ event_id: String(event.id), user_id: user.id }],
          { onConflict: "event_id,user_id", ignoreDuplicates: true }
        );
        if (error) throw error;
        if (event.organizer_id && event.organizer_id !== user.id) {
          // Debounce, nu trimitem imediat — spamul de like/unlike rapid (double-tap
          // repetat) trimitea o notificare la fiecare apăsare. Așteptăm puțin ca
          // starea să se stabilizeze; dacă dai unlike înainte să treacă timpul,
          // notificarea se anulează (vezi ramura else de mai jos).
          const likerName = user.user_metadata?.username || user.email?.split("@")[0] || "Cineva";
          clearTimeout(likeNotifyTimer.current);
          likeNotifyTimer.current = setTimeout(() => {
            notifyUser({
              targetUserId: event.organizer_id,
              title: "Like nou!",
              body: `${likerName} a apreciat ${event.title}.`,
              type: "like",
              actorId: user.id,
            });
          }, 2000);
        }
      } else {
        clearTimeout(likeNotifyTimer.current);
        const { error } = await supabase.from("likes").delete().eq("event_id", String(event.id)).eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (err) {
      setLiked(!newLiked); // revert dacă a eșuat
      setLikeCount(c => c + (newLiked ? -1 : 1));
      showToast("Eroare la like. Încearcă din nou.", "#FF3366");
    }
  };

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) triggerLike(e);
    lastTap.current = now;
  };

  const triggerLike = (e) => {
    if (!liked) {
      setLikeInSupabase(true);
    }
    setBigHeart(true);
    setTimeout(() => setBigHeart(false), 900);
    const rect = cardRef.current?.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - (rect?.left || 0);
    const y = clientY - (rect?.top || 0);
    const newHearts = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 80,
      y: y + (Math.random() - 0.5) * 80,
    }));
    setHearts(prev => [...prev, ...newHearts]);
    setTimeout(() => setHearts([]), 1400);
  };

  const handleLike = (e) => {
    e.stopPropagation();
    animateBtn("like");
    spawnBurst(e, event.color);
    setLikeInSupabase(!liked);
  };

  const setAttendInSupabase = async (newAttending) => {
    if (!user) {
      showToast("Autentifică-te ca să participi!", "rgba(255,255,255,0.5)");
      return;
    }
    // Fără astea două, apăsat rapid/repetat pe buton trimitea mai multe
    // insert-uri înainte ca starea "attending" să apuce să se actualizeze —
    // umfla artificial numărul de participanți cu participări duplicate.
    if (attendBusyRef.current) return;
    if (newAttending === attending) return;
    attendBusyRef.current = true;
    setAttending(newAttending);
    setAttendCount(c => c + (newAttending ? 1 : -1)); // optimistic, corectat de refreshCount la realtime
    try {
      if (newAttending) {
        const { error } = await supabase.from("attendances").upsert(
          [{ event_id: String(event.id), user_id: user.id }],
          { onConflict: "event_id,user_id", ignoreDuplicates: true }
        );
        if (error) throw error;
        showToast(`Ești pe lista pentru ${event.title}!`, event.color);
      } else {
        const { error } = await supabase.from("attendances").delete().eq("event_id", String(event.id)).eq("user_id", user.id);
        if (error) throw error;
        showToast(`Ai renunțat la ${event.title}`, "rgba(255,255,255,0.5)");
      }
    } catch (err) {
      setAttending(!newAttending);
      setAttendCount(c => c + (newAttending ? -1 : 1));
      showToast("Eroare. Încearcă din nou.", "#FF3366");
    }
    attendBusyRef.current = false;
  };

  const handleAttend = (e) => {
    e.stopPropagation();
    animateBtn("attend");
    spawnBurst(e, event.color);
    setAttendInSupabase(!attending);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    animateBtn("share");
    spawnBurst(e, "#fff");
    if (navigator.share) {
      navigator.share({ title: event.title, text: `${event.title} — ${event.venue} · ${event.date}`, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast("Link copiat!", event.color);
    }
  };

  const handleComment = (e) => {
    e.stopPropagation();
    animateBtn("comment");
    onComment && onComment();
  };

  const formatNum = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "k" : n;

  // Nu poți da "Particip" la propriul eveniment.
  const isOwnEvent = !!(user && event.organizer_id && event.organizer_id === user.id);

  const buttons = [
    { key: "like", onClick: handleLike, active: liked, label: formatNum(likeCount), icon: <HeartIcon filled={liked} color={event.color} size={32} /> },
    event.isPosted && event.type === "homemade"
      ? {
          key: "attend",
          onClick: isOwnEvent ? undefined : (e) => { e.stopPropagation(); animateBtn("attend"); setShowJoinRequest(true); },
          active: attending, disabled: isOwnEvent,
          title: isOwnEvent ? "Nu poți participa la propriul eveniment" : undefined,
          label: formatNum(acceptedCount),
          icon: attending ? <CheckIcon color={event.color} /> : <PlusIcon />,
        }
      : {
          key: "attend", onClick: isOwnEvent ? undefined : handleAttend, active: attending, disabled: isOwnEvent,
          title: isOwnEvent ? "Nu poți participa la propriul eveniment" : undefined,
          label: formatNum(attendCount), icon: attending ? <CheckIcon color={event.color} /> : <PlusIcon />,
        },
    { key: "comment", onClick: handleComment, active: false, icon: <CommentIcon /> },
    { key: "share", onClick: handleShare, active: false, icon: <ShareIcon /> },
  ];

  return (
    <div ref={cardRef} onClick={handleDoubleTap} style={{ width: "100%", height: "100%", position: "relative", background: event.bgColor, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none", cursor: "pointer", flexShrink: 0 }}>
      <style>{`
        @keyframes btnBounce { 0%{transform:scale(1)} 30%{transform:scale(0.85)} 60%{transform:scale(1.2)} 80%{transform:scale(0.95)} 100%{transform:scale(1)} }
        @keyframes heartFlyColor {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; filter: brightness(1) saturate(1) hue-rotate(0deg); }
          18% { transform: translate(-50%, -50%) scale(1.25); opacity: 1; filter: brightness(1.3) saturate(1.5) hue-rotate(18deg); }
          35% { transform: translate(-50%, -50%) scale(1); opacity: 1; filter: brightness(1) saturate(1) hue-rotate(0deg); }
          100% { transform: translate(-50%, -160%) scale(0.7); opacity: 0; filter: brightness(1.15) saturate(1.3) hue-rotate(-25deg); }
        }
      `}</style>

      {event.cover_url && (
        isVideoUrl(event.cover_url) ? (
          <>
            <video
              ref={videoRef}
              src={event.cover_url}
              muted={videoMuted}
              loop
              playsInline
              onTouchStart={handleVideoHoldStart}
              onTouchEnd={handleVideoHoldEnd}
              onMouseDown={handleVideoHoldStart}
              onMouseUp={handleVideoHoldEnd}
              onMouseLeave={handleVideoHoldEnd}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Sub butonul de filtre (fix, top-left, z-index mare) ca să nu se
                suprapună cu el — filtrele "câștigau" atingerea în locul lor. */}
            <div style={{ position: "absolute", top: 76, left: 16, zIndex: 3, display: "flex", gap: 8 }}>
              <button onClick={toggleVideoPause} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PlayPauseIcon paused={videoPaused} />
              </button>
              <button onClick={toggleVideoMute} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MuteIcon muted={videoMuted} />
              </button>
            </div>
          </>
        ) : (
          <img
            src={event.cover_url}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )
      )}

      {/* pointerEvents:none — altfel acest voal decorativ (fără niciun
          handler propriu) prindea el atingerile în locul video-ului de
          dedesubt, blocând ținut-apăsat-pentru-2x. */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${event.color}40 0%, transparent 70%)`, pointerEvents: "none" }} />
      {!event.cover_url && (
        <>
          <div style={{ position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)", width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle, ${event.color}30 0%, transparent 70%)`, filter: "blur(40px)", animation: isActive ? "pulse 3s ease-in-out infinite" : "none" }} />
          <div style={{ position: "absolute", top: "18%", left: "50%", transform: "translateX(-50%)", width: 120, height: 120, borderRadius: 28, background: `${event.color}20`, border: `1.5px solid ${event.color}50`, backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", color: event.color }}>
            {event.type === "official" ? <LightningIcon size={52} /> : <HouseIcon size={52} />}
          </div>
        </>
      )}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "65%", background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)", pointerEvents: "none" }} />

      {event.age_restricted && (
        <div style={{ position: "absolute", top: 20, right: 16, padding: "4px 10px", borderRadius: 20, background: "rgba(255,51,102,0.25)", border: "1px solid rgba(255,51,102,0.6)", backdropFilter: "blur(10px)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#FF3366", letterSpacing: "0.05em", fontFamily: "'DM Mono', monospace" }}>18+</span>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 64, padding: "0 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div
            onClick={() => { if (event.organizer_id && onViewProfile) onViewProfile(event.organizer_id); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: event.organizer_id ? "pointer" : "default", minWidth: 0 }}
          >
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: event.organizer_avatar ? "transparent" : `${event.color}30`, border: `1px solid ${event.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: event.color, fontFamily: "'DM Mono', monospace" }}>
              {event.organizer_avatar ? <img src={event.organizer_avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (event.organizer || "?").charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 11, color: event.color, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {event.organizer_username ? `@${event.organizer_username}` : event.organizer}{event.organizer_id && " ›"}
            </span>
          </div>
          {!isOwnEvent && event.organizer_id && onToggleFollowOrganizer && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFollowOrganizer(event.organizer_id); }}
              style={{ flexShrink: 0, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: isFollowingOrganizer ? "rgba(255,255,255,0.1)" : `${event.color}25`, border: `1px solid ${isFollowingOrganizer ? "rgba(255,255,255,0.2)" : event.color + "60"}`, color: isFollowingOrganizer ? "rgba(255,255,255,0.6)" : event.color, fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}
            >
              {isFollowingOrganizer ? "✓ Urmărești" : "+ Urmărește"}
            </button>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>{event.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}>
            <PinIcon size={13} />
            {event.type === "homemade" ? <>Zonă aproximativă <LockIcon size={12} /></> : event.venue}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace" }}><ClockIcon size={13} /> {event.date}</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, margin: 0, marginBottom: 12 }}>{event.description}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: event.type === "official" ? `${event.color}25` : "rgba(255,255,255,0.1)", border: `1px solid ${event.type === "official" ? event.color + "50" : "rgba(255,255,255,0.15)"}`, color: event.type === "official" ? event.color : "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {event.type === "official" ? <LightningIcon size={11} /> : <HouseIcon size={11} />}
            {event.type === "official" ? "Oficial" : "Neoficial"}
          </span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: `${event.color}25`, color: event.color, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{event.price}</span>
          {event.code && (
            <span
              onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(event.code); showToast("Cod copiat!", "#00C864"); }}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              title="Apasă pentru a copia codul"
            >
              <KeyIcon size={12} /> {event.code}
            </span>
          )}
        </div>
      </div>

      <div style={{ position: "absolute", right: 12, bottom: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {buttons.map(btn => (
          <button key={btn.key} onClick={btn.onClick} disabled={btn.disabled} title={btn.title} style={{ background: "none", border: "none", cursor: btn.disabled ? "default" : "pointer", opacity: btn.disabled ? 0.4 : 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 0 }}>
            <div style={{
              width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center",
              animation: btnAnim[btn.key] ? "btnBounce 0.4s ease-out" : "none",
            }}>
              {btn.icon}
            </div>
            {btn.label && (
              <span style={{ fontSize: 11, fontWeight: 700, color: btn.active ? event.color : "rgba(255,255,255,0.55)", fontFamily: "'DM Mono', monospace", transition: "color 0.2s" }}>
                {btn.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {burst.map(p => <BurstParticle key={p.id} x={p.x} y={p.y} color={p.color} angle={p.angle} />)}
      {hearts.map(h => <HeartParticle key={h.id} x={h.x} y={h.y} id={h.id} color={event.color} />)}
      <BigHeart show={bigHeart} color={event.color} />
      <Toast show={toast.show} message={toast.message} color={toast.color} />
      <JoinRequestSheet
        event={event}
        user={user}
        open={showJoinRequest}
        onClose={() => setShowJoinRequest(false)}
        alreadyRequested={false}
      />
    </div>
  );
}
