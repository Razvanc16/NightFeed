import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { LightningIcon, HouseIcon, PlusIcon, CheckCircleIcon } from "./Icons";
import JoinRequestSheet from "./JoinRequestSheet";

const HeartMini = ({ filled, color }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={filled ? color : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// Card compact pentru grila de 4 — evenimente fără poză de copertă nu mai
// ocupă fiecare câte un slide întreg de swipe (un card doar cu gradient e
// vizual sărac pe tot ecranul); aici împart ecranul cu alte 3, cu acțiunile
// esențiale (like, particip) direct pe loc.
export default function MiniEventCard({ event, user, onOpenComments }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [attending, setAttending] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const attendBusyRef = useRef(false);

  const isJoinable = event.isPosted && event.type === "homemade" && !event.location_visible;
  const isOwnEvent = !!(user && event.organizer_id && event.organizer_id === user.id);

  useEffect(() => {
    let active = true;
    (async () => {
      const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("event_id", String(event.id));
      if (active) setLikeCount(count || 0);
      if (user) {
        const { data } = await supabase.from("likes").select("id").eq("event_id", String(event.id)).eq("user_id", user.id).maybeSingle();
        if (active) setLiked(!!data);
        if (isJoinable) {
          const rawId = (event.rawId || event.id).toString().replace("posted_", "");
          const { data: req } = await supabase.from("attendance_requests").select("status").eq("event_id", rawId).eq("requester_id", user.id).maybeSingle();
          if (active) setAttending(!!req);
        } else {
          const { data: att } = await supabase.from("attendances").select("id").eq("event_id", String(event.id)).eq("user_id", user.id).maybeSingle();
          if (active) setAttending(!!att);
        }
      }
    })();
    return () => { active = false; };
  }, [event.id, user?.id]);

  const toggleLike = async (e) => {
    e.stopPropagation();
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => c + (next ? 1 : -1));
    if (next) {
      await supabase.from("likes").upsert([{ event_id: String(event.id), user_id: user.id }], { onConflict: "event_id,user_id", ignoreDuplicates: true });
    } else {
      await supabase.from("likes").delete().eq("event_id", String(event.id)).eq("user_id", user.id);
    }
  };

  const toggleAttend = async (e) => {
    e.stopPropagation();
    if (!user || isOwnEvent) return;
    if (isJoinable) { setShowJoin(true); return; }
    if (attendBusyRef.current) return;
    const next = !attending;
    attendBusyRef.current = true;
    setAttending(next);
    if (next) {
      await supabase.from("attendances").upsert([{ event_id: String(event.id), user_id: user.id }], { onConflict: "event_id,user_id", ignoreDuplicates: true });
    } else {
      await supabase.from("attendances").delete().eq("event_id", String(event.id)).eq("user_id", user.id);
    }
    attendBusyRef.current = false;
  };

  return (
    <div
      onClick={() => onOpenComments(event)}
      style={{
        position: "relative", borderRadius: 16, overflow: "hidden", cursor: "pointer",
        background: event.bgColor || "#0f0f12", border: `1px solid ${event.color}30`,
        display: "flex", flexDirection: "column",
      }}
    >
      {event.cover_url ? (
        <img src={event.cover_url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: `${event.color}50` }}>
          {event.type === "official" ? <LightningIcon size={30} /> : <HouseIcon size={30} />}
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 45%, transparent 80%)" }} />

      <button onClick={toggleLike} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, zIndex: 1 }}>
        <HeartMini filled={liked} color={event.color} />
        {likeCount > 0 && <span style={{ fontSize: 9, color: "#fff", fontFamily: "'DM Mono', monospace", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}>{likeCount}</span>}
      </button>

      {!isOwnEvent && (
        <button onClick={toggleAttend} style={{ position: "absolute", bottom: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: attending ? event.color : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, backdropFilter: "blur(6px)" }}>
          {attending ? <CheckCircleIcon size={13} style={{ color: "#fff" }} /> : <PlusIcon size={13} style={{ color: "#fff" }} />}
        </button>
      )}

      <div style={{ position: "relative", marginTop: "auto", padding: "8px 10px", zIndex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: event.color, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>
          {event.type === "official" ? "Oficial" : "Neoficial"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", lineHeight: 1.25, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {event.title}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: "'DM Mono', monospace" }}>{event.price}</div>
      </div>

      {isJoinable && (
        <JoinRequestSheet event={event} user={user} open={showJoin} onClose={() => setShowJoin(false)} alreadyRequested={attending} />
      )}
    </div>
  );
}
