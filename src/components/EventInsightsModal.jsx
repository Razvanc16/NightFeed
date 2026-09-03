import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import EventPeopleSheet from "./EventPeopleSheet";
import { CrossCircleIcon } from "./Icons";
import { formatPrice } from "../utils/eventTime";

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
      const [{ count: likes }, { count: attending }] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("event_id", prefixedId),
        isRequestBased
          ? supabase.from("attendance_requests").select("*", { count: "exact", head: true }).eq("event_id", rawId).eq("status", "accepted")
          : supabase.from("attendances").select("*", { count: "exact", head: true }).eq("event_id", prefixedId),
      ]);
      if (active) setStats({ likes: likes || 0, attending: attending || 0 });
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10350, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "backdropIn 0.2s ease-out" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f12", borderRadius: 24, padding: "22px 20px", width: "100%", maxWidth: 340, border: "1px solid rgba(255,255,255,0.1)", animation: "modalPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>{event.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 18 }}>{event.date} · {formatPrice(event.price) || "Gratuit"}</div>

          {!stats ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.3)" }}>Se încarcă...</div>
          ) : (
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <button onClick={() => setPeopleSheetFor({ source: "likes", eventId: prefixedId, title: "Aprecieri" })} style={{ flex: 1, padding: "14px 10px", borderRadius: 14, background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.2)", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{stats.likes}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Aprecieri</div>
              </button>
              <button onClick={() => setPeopleSheetFor({ source: isRequestBased ? "requests" : "attendances", eventId: prefixedId, title: "Participă" })} style={{ flex: 1, padding: "14px 10px", borderRadius: 14, background: "rgba(0,200,100,0.08)", border: "1px solid rgba(0,200,100,0.2)", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{stats.attending}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Participă</div>
              </button>
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
