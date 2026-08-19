import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { formatEventDateTime, isEventExpired } from "../utils/eventTime";
import { HeartOutlineIcon, ConfettiIcon, LightningIcon, HouseIcon, MoonIcon } from "./Icons";

// Istoric complet — spre deosebire de tab-urile "Particip"/"Apreciate" din
// profil (care arată doar evenimente încă active, nearhivate), aici apar
// TOATE, inclusiv cele trecute sau arhivate de host între timp.
export default function MyHistoryPage({ user, onClose, onOpenEvent }) {
  const [tab, setTab] = useState("attending"); // "attending" | "liked"
  const [attending, setAttending] = useState([]);
  const [liked, setLiked] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [{ data: myAttendances }, { data: myLikes }] = await Promise.all([
      supabase.from("attendances").select("event_id").eq("user_id", user.id),
      supabase.from("likes").select("event_id").eq("user_id", user.id),
    ]);
    const attendIds = [...new Set((myAttendances || []).map(r => r.event_id.replace("posted_", "")))];
    const likeIds = [...new Set((myLikes || []).map(r => r.event_id.replace("posted_", "")))];
    const allIds = [...new Set([...attendIds, ...likeIds])];

    let byId = {};
    if (allIds.length) {
      const { data } = await supabase.from("posted_events").select("id, title, type, event_date, price, archived").in("id", allIds);
      (data || []).forEach(e => { byId[e.id] = e; });
    }

    const byDateDesc = (a, b) => new Date(b.event_date || 0) - new Date(a.event_date || 0);
    setAttending(attendIds.map(id => byId[id]).filter(Boolean).sort(byDateDesc));
    setLiked(likeIds.map(id => byId[id]).filter(Boolean).sort(byDateDesc));
    setLoading(false);
  };

  const list = tab === "attending" ? attending : liked;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080808", zIndex: 300, overflowY: "auto", paddingBottom: 80, animation: "slideUp 0.3s ease-out" }}>
      <div style={{ padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>Istoricul meu</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>Inclusiv evenimente trecute sau arhivate</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Înapoi
        </button>
      </div>

      <div style={{ display: "flex", padding: "14px 16px 8px", gap: 8 }}>
        {[
          { id: "attending", label: "Particip", icon: ConfettiIcon },
          { id: "liked", label: "Apreciate", icon: HeartOutlineIcon },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${tab === t.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.08)"}`, background: tab === t.id ? "rgba(255,51,102,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", color: tab === t.id ? "#FF3366" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.5)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={28} /></div>
          </div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
              {tab === "attending" ? <ConfettiIcon size={28} /> : <HeartOutlineIcon size={28} />}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Nimic încă.</div>
          </div>
        ) : list.map(event => {
          const inactive = event.archived || isEventExpired(event);
          const openable = !inactive && !!onOpenEvent;
          return (
            <div
              key={event.id}
              onClick={() => openable && onOpenEvent(`posted_${event.id}`)}
              style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", display: "flex", alignItems: "center", gap: 12, cursor: openable ? "pointer" : "default", opacity: inactive ? 0.7 : 1 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: event.type === "official" ? "rgba(255,51,102,0.2)" : "rgba(255,184,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: event.type === "official" ? "#FF3366" : "#FFB800", flexShrink: 0 }}>
                {event.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                  {(event.event_date && formatEventDateTime(event.event_date)) || "Data necunoscută"} · {event.price || "Gratuit"}
                </div>
              </div>
              {inactive && (
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 9px", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>
                  {event.archived ? "Arhivat" : "Trecut"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
