import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import EventPeopleSheet from "./EventPeopleSheet";
import { CrossCircleIcon, HeartOutlineIcon, ConfettiIcon, EyeIcon, SpeechBubbleIcon, TicketIcon, ChevronRightIcon } from "./Icons";
import { formatPrice } from "../utils/eventTime";

// Un rând de statistică — aceeași "siglă" (cerc colorat + iconiță) pentru
// fiecare, unele clickabile (deschid lista de useri), altele doar afișaj.
const StatRow = ({ icon: Icon, color, label, value, onClick }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: onClick ? "pointer" : "default", textAlign: "left" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, color }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{value}</div>
      {onClick && <ChevronRightIcon size={14} style={{ color: "rgba(255,255,255,0.25)" }} />}
    </Tag>
  );
};

// Statistici rapide pentru un eveniment (câte aprecieri, câți participanți),
// cu acces la listele complete — folosit atât din Profil (Postate/Arhivă),
// cât și din Hartă (popup-ul hostului pe propriul eveniment).
// `rawId`: uuid-ul brut din posted_events — separat de `event.id`, care are
// convenții diferite de prefixare în Profil vs Hartă.
export default function EventInsightsModal({ event, rawId, onClose, onViewProfile, onOpenEvent }) {
  const [stats, setStats] = useState(null);
  const [peopleSheetFor, setPeopleSheetFor] = useState(null);

  const prefixedId = `posted_${rawId}`;
  const isRequestBased = event.type === "homemade" && !event.location_visible;

  useEffect(() => {
    let active = true;
    setStats(null);
    (async () => {
      const [{ count: likes }, { count: attending }, { count: comments }, { count: checkinsTotal }, { count: checkinsScanned }, { count: views }] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("event_id", prefixedId),
        isRequestBased
          ? supabase.from("attendance_requests").select("*", { count: "exact", head: true }).eq("event_id", rawId).eq("status", "accepted")
          : supabase.from("attendances").select("*", { count: "exact", head: true }).eq("event_id", prefixedId),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("event_id", prefixedId),
        supabase.from("event_checkins").select("*", { count: "exact", head: true }).eq("event_id", prefixedId),
        supabase.from("event_checkins").select("*", { count: "exact", head: true }).eq("event_id", prefixedId).eq("checked_in", true),
        // event_views ține un rând per user unic (primary key event_id+user_id) —
        // count(*) e deja numărul de persoane unice, nu de vizionări brute.
        supabase.from("event_views").select("*", { count: "exact", head: true }).eq("event_id", rawId),
      ]);
      if (active) setStats({
        likes: likes || 0,
        attending: attending || 0,
        comments: comments || 0,
        checkinsTotal: checkinsTotal || 0,
        checkinsScanned: checkinsScanned || 0,
        views: views || 0,
      });
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10350, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "backdropIn 0.2s ease-out" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f12", borderRadius: 24, padding: "22px 20px", width: "100%", maxWidth: 380, border: "1px solid rgba(255,255,255,0.1)", animation: "modalPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>{event.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 18 }}>{event.date} · {formatPrice(event.price) || "Gratuit"}</div>

          {!stats ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.3)" }}>Se încarcă...</div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <StatRow icon={HeartOutlineIcon} color="#FF3366" label="Aprecieri" value={stats.likes} onClick={() => setPeopleSheetFor({ source: "likes", eventId: prefixedId, title: "Aprecieri" })} />
              <StatRow icon={ConfettiIcon} color="#00C864" label="Participă" value={stats.attending} onClick={() => setPeopleSheetFor({ source: isRequestBased ? "requests" : "attendances", eventId: prefixedId, title: "Participă" })} />
              <StatRow icon={EyeIcon} color="#4FC3F7" label="Vizualizări" value={stats.views} />
              <StatRow icon={SpeechBubbleIcon} color="#B44FFF" label="Comentarii" value={stats.comments} />
              {stats.checkinsTotal > 0 && (
                <StatRow icon={TicketIcon} color="#FFB800" label="Bilete scanate la intrare" value={`${stats.checkinsScanned}/${stats.checkinsTotal}`} />
              )}
            </div>
          )}

          <button onClick={onClose} style={{ marginTop: 12, width: "100%", padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CrossCircleIcon size={13} /> Închide
          </button>
        </div>
      </div>

      {peopleSheetFor && (
        <EventPeopleSheet
          title={peopleSheetFor.title}
          source={peopleSheetFor.source}
          eventId={peopleSheetFor.eventId}
          onClose={() => setPeopleSheetFor(null)}
          onViewProfile={(uid) => { setPeopleSheetFor(null); onClose(); onViewProfile && onViewProfile(uid); }}
          onOpenEvent={onOpenEvent ? () => { setPeopleSheetFor(null); onClose(); onOpenEvent(prefixedId); } : undefined}
        />
      )}
    </>
  );
}
