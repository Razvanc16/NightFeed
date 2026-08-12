import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ClockIcon, CheckCircleIcon, CrossCircleIcon, InboxIcon, PersonIcon, OutboxIcon, LightningIcon, HouseIcon, PinIcon, MapIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";

export default function RequestsPage({ user, onClose }) {
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("incoming");

  useEffect(() => {
    if (!user) return;
    loadRequests();

    const channel = supabase
      .channel("requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_requests" },
        () => loadRequests()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const loadRequests = async () => {
    setLoading(true);
    // Cereri primite (eu sunt host)
    const { data: incoming } = await supabase
      .from("attendance_requests")
      .select("*, posted_events(title, type, date)")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    // Cereri trimise (eu sunt requester) — venue/lat/lng nu mai vin din embed
    // (coloane blocate la nivel de bază de date), ci separat din view-ul care
    // le dezvăluie doar pentru cererile acceptate.
    const { data: outgoing } = await supabase
      .from("attendance_requests")
      .select("*, posted_events(title, type, date)")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

    const acceptedEventIds = (outgoing || [])
      .filter(r => r.status === "accepted")
      .map(r => r.event_id);

    let addressByEventId = {};
    if (acceptedEventIds.length) {
      const { data: addresses } = await supabase
        .from("posted_events_feed")
        .select("id, venue, lat, lng")
        .in("id", acceptedEventIds);
      (addresses || []).forEach(a => { addressByEventId[String(a.id)] = a; });
    }

    setRequests(incoming || []);
    setMyRequests((outgoing || []).map(r => ({
      ...r,
      posted_events: { ...r.posted_events, ...addressByEventId[String(r.event_id)] },
    })));
    setLoading(false);
  };

  const handleDecision = async (requestId, status) => {
    const req = requests.find(r => r.id === requestId);
    await supabase.from("attendance_requests").update({ status }).eq("id", requestId);
    if (req) {
      const eventTitle = req.posted_events?.title || "eveniment";
      notifyUser({
        targetUserId: req.requester_id,
        title: status === "accepted" ? "Cerere acceptată!" : "Cerere refuzată",
        body: status === "accepted" ? `Ai fost acceptat la ${eventTitle}.` : `Cererea ta pentru ${eventTitle} a fost refuzată.`,
        type: "request",
        actorId: user.id,
      });
    }
    loadRequests();
  };

  const handleCancel = async (requestId) => {
    await supabase.from("attendance_requests").delete().eq("id", requestId);
    setMyRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const statusBadge = (status) => {
    const map = {
      pending: { label: "În așteptare", color: "#FFB800", bg: "rgba(255,184,0,0.15)", Icon: ClockIcon },
      accepted: { label: "Acceptat", color: "#00C864", bg: "rgba(0,200,100,0.15)", Icon: CheckCircleIcon },
      rejected: { label: "Refuzat", color: "#FF3366", bg: "rgba(255,51,102,0.15)", Icon: CrossCircleIcon },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
        <s.Icon size={12} /> {s.label}
      </span>
    );
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080808", zIndex: 300, overflowY: "auto", paddingBottom: 80, animation: "slideUp 0.3s ease-out" }}>
      {/* Header */}
      <div style={{ padding: "50px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
            Cereri participare
            {pendingCount > 0 && (
              <span style={{ marginLeft: 8, background: "#FF3366", color: "#fff", fontSize: 11, borderRadius: 20, padding: "2px 8px", fontFamily: "'DM Mono', monospace" }}>{pendingCount}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>Gestionează accesul la evenimentele tale</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Înapoi
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "14px 16px 8px", gap: 8 }}>
        {[
          { id: "incoming", label: "Primite", count: pendingCount },
          { id: "outgoing", label: "Trimise", count: 0 },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${activeTab === tab.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.08)"}`, background: activeTab === tab.id ? "rgba(255,51,102,0.15)" : "rgba(255,255,255,0.04)", cursor: "pointer", color: activeTab === tab.id ? "#FF3366" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {tab.label}
            {tab.count > 0 && <span style={{ background: "#FF3366", color: "#fff", fontSize: 10, borderRadius: 20, padding: "1px 6px" }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>Se încarcă...</div>
        ) : activeTab === "incoming" ? (
          requests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ marginBottom: 10, color: "rgba(255,255,255,0.25)", display: "flex", justifyContent: "center" }}><InboxIcon size={36} /></div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>Nicio cerere primită</div>
            </div>
          ) : requests.map(req => (
            <div key={req.id} style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,51,102,0.2)", border: "1px solid rgba(255,51,102,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF3366", flexShrink: 0 }}>
                  <PersonIcon size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{req.requester_username || "Utilizator"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    vrea să participe la <span style={{ color: "#FF3366" }}>{req.posted_events?.title}</span>
                  </div>
                  {req.message && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", marginTop: 6, padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: "2px solid rgba(255,51,102,0.4)" }}>
                      "{req.message}"
                    </div>
                  )}
                </div>
                <div>{statusBadge(req.status)}</div>
              </div>

              {req.status === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleDecision(req.id, "accepted")} style={{ flex: 1, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(0,200,100,0.15)", border: "1px solid rgba(0,200,100,0.3)", borderRadius: 10, color: "#00C864", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                    <CheckCircleIcon size={14} /> Acceptă
                  </button>
                  <button onClick={() => handleDecision(req.id, "rejected")} style={{ flex: 1, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.2)", borderRadius: 10, color: "#FF3366", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                    <CrossCircleIcon size={14} /> Refuză
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          myRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ marginBottom: 10, color: "rgba(255,255,255,0.25)", display: "flex", justifyContent: "center" }}><OutboxIcon size={36} /></div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>Nu ai trimis nicio cerere</div>
            </div>
          ) : myRequests.map(req => (
            <div key={req.id} style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: req.posted_events?.type === "official" ? "rgba(255,51,102,0.2)" : "rgba(255,184,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: req.posted_events?.type === "official" ? "#FF3366" : "#FFB800", flexShrink: 0 }}>
                  {req.posted_events?.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{req.posted_events?.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{req.posted_events?.date}</div>
                  <div style={{ marginTop: 6 }}>{statusBadge(req.status)}</div>
                </div>
              </div>

              {req.status === "pending" && (
                <button onClick={() => handleCancel(req.id)} style={{ marginTop: 10, width: "100%", padding: "9px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                  <CrossCircleIcon size={13} /> Anulează cererea
                </button>
              )}

              {req.status === "accepted" && req.posted_events?.venue && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.2)", borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#00C864", fontFamily: "'DM Mono', monospace", marginBottom: 4, fontWeight: 700 }}><PinIcon size={12} /> ADRESĂ EXACTĂ</div>
                  <div style={{ fontSize: 14, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{req.posted_events.venue}</div>
                  {req.posted_events.lat && (
                    <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${req.posted_events.lat},${req.posted_events.lng}`, "_blank")} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,200,100,0.2)", border: "1px solid rgba(0,200,100,0.3)", borderRadius: 8, padding: "6px 12px", color: "#00C864", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
                      <MapIcon size={13} /> Navighez
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
