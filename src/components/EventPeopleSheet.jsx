import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { MoonIcon, HeartOutlineIcon, ConfettiIcon, ChevronRightIcon } from "./Icons";

// Listă de oameni (cine a apreciat / cine participă) pentru un eveniment —
// același tipar ca FollowListSheet, doar sursa de user_id-uri diferă.
// `source`: "likes" | "attendances" — tabelul direct — sau "requests", pentru
// evenimentele neoficiale cu cerere de aprobare (attendance_requests, doar
// cele acceptate; event_id acolo e uuid-ul brut, fără prefixul "posted_").
// `onOpenEvent` — opțional; dacă e dat, afișează sus-dreapta un buton spre
// postarea propriu-zisă (lista de oameni, spre deosebire de CommentsSheet,
// e un ecran plin — postarea nu se mai vede deloc pe sub ea).
export default function EventPeopleSheet({ title, source, eventId, onClose, onViewProfile, onOpenEvent }) {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);

  useEffect(() => {
    if (!eventId || !source) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, source]);

  const load = async () => {
    setLoading(true);
    let ids = [];
    if (source === "requests") {
      const rawId = String(eventId).replace("posted_", "");
      const { data } = await supabase.from("attendance_requests").select("requester_id").eq("event_id", rawId).eq("status", "accepted");
      ids = [...new Set((data || []).map(r => r.requester_id))];
    } else {
      const { data } = await supabase.from(source).select("user_id").eq("event_id", String(eventId));
      ids = [...new Set((data || []).map(r => r.user_id))];
    }

    if (ids.length === 0) { setPeople([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids);
    const merged = ids
      .map(id => {
        const p = (profiles || []).find(pr => pr.user_id === id);
        return {
          user_id: id,
          displayName: p ? [p.prenume, p.nume].filter(Boolean).join(" ") : "",
          avatar_url: p?.avatar_url || null,
        };
      })
      .filter(p => p.displayName);
    setPeople(merged);
    setLoading(false);
  };

  const EmptyIcon = source === "likes" ? HeartOutlineIcon : ConfettiIcon;
  const emptyText = source === "likes" ? "Nimeni nu a apreciat încă." : "Nimeni nu participă încă.";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10350, background: "#080808", animation: "tabEnter 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 14px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>← Înapoi</button>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        </div>
        {onOpenEvent && (
          <button onClick={onOpenEvent} style={{ flexShrink: 0, background: "rgba(255,51,102,0.12)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 30, padding: "8px 12px", color: "#FF3366", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 2 }}>
            Postarea <ChevronRightIcon size={13} />
          </button>
        )}
      </div>

      <div style={{ height: "calc(100% - 76px)", overflowY: "auto", padding: "12px 16px 40px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.5)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={28} /></div>
          </div>
        ) : people.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(255,255,255,0.4)" }}>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}><EmptyIcon size={32} /></div>
            <div style={{ fontSize: 14 }}>{emptyText}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {people.map(p => (
              <button
                key={p.user_id}
                onClick={() => { onViewProfile && onViewProfile(p.user_id); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: p.avatar_url ? "transparent" : "linear-gradient(135deg, #FF3366, #B44FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>
                  {p.avatar_url ? <img src={p.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.displayName || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.displayName || "Utilizator"}</div>
                </div>
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 16 }}>›</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
