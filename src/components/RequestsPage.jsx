import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ClockIcon, CheckCircleIcon, CrossCircleIcon, InboxIcon, PersonIcon, OutboxIcon, LightningIcon, HouseIcon, PinIcon, MapIcon, TicketIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";
import { TicketQR } from "./MyTicketsPage";
import { isEventExpired } from "../utils/eventTime";

export default function RequestsPage({ user, onClose }) {
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("incoming");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | accepted | rejected
  const [openTicket, setOpenTicket] = useState(null);

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
      .select("*, posted_events(title, type, date, event_date, archived)")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    // Cereri trimise (eu sunt requester) — venue/lat/lng nu mai vin din embed
    // (coloane blocate la nivel de bază de date), ci separat din view-ul care
    // le dezvăluie doar pentru cererile acceptate.
    const { data: outgoing } = await supabase
      .from("attendance_requests")
      .select("*, posted_events(title, type, date, event_date, archived)")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

    const acceptedEventIds = (outgoing || [])
      .filter(r => r.status === "accepted")
      .map(r => r.event_id);

    let addressByEventId = {};
    let checkinByEventId = {};
    if (acceptedEventIds.length) {
      const { data: addresses } = await supabase
        .from("posted_events_feed")
        .select("id, venue, lat, lng")
        .in("id", acceptedEventIds);
      (addresses || []).forEach(a => { addressByEventId[String(a.id)] = a; });

      // Biletul (token QR) apărut automat la acceptare — vezi triggerul
      // checkin_create_from_request din migrația event_checkins.
      const { data: checkins } = await supabase
        .from("event_checkins")
        .select("event_id, token, checked_in")
        .eq("user_id", user.id)
        .in("event_id", acceptedEventIds.map(id => `posted_${id}`));
      (checkins || []).forEach(c => { checkinByEventId[c.event_id.replace("posted_", "")] = c; });
    }

    // Aceeași curățare ca la "Cereri trimise" — fără ea, cererile către
    // evenimente șterse/arhivate/expirate rămâneau agățate în "Primite" la
    // nesfârșit (era exact ce vedea hostul: participanți acceptați la
    // evenimente care nu mai există).
    setRequests((incoming || []).filter(r => r.posted_events?.title && !r.posted_events.archived && !isEventExpired(r.posted_events)));
    setMyRequests((outgoing || [])
      // Ascundem cererile către evenimente care nu mai există (șterse — embed-ul
      // FK vine null), arhivate de host sau deja trecute — nu mai e nimic de
      // făcut cu ele, doar aglomerau lista de "Cereri trimise".
      .filter(r => r.posted_events?.title && !r.posted_events.archived && !isEventExpired(r.posted_events))
      .map(r => ({
        ...r,
        posted_events: { ...r.posted_events, ...addressByEventId[String(r.event_id)] },
        checkin: checkinByEventId[String(r.event_id)] || null,
      })));
    setLoading(false);
  };

  const handleDecision = async (requestId, status) => {
    const req = requests.find(r => r.id === requestId);
    const { error } = await supabase.from("attendance_requests").update({ status }).eq("id", requestId);
    // Fără verificarea asta, un update eșuat (rețea, RLS) tot trimitea
    // notificarea "Cerere acceptată!" — participantul credea că are bilet și
    // adresă, deși statusul nu s-a schimbat deloc în bază.
    if (error) { alert("Eroare: " + error.message); return; }
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
  const filteredRequests = statusFilter === "all" ? requests : requests.filter(r => r.status === statusFilter);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080808", zIndex: 300, overflowY: "auto", paddingBottom: 80, animation: "slideUp 0.3s ease-out" }}>
      {/* Header */}
      <div style={{ padding: "50px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
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

      {/* Filtru pe status — altfel cererile acceptate/refuzate se pierd în
          aceeași listă cu cele în așteptare, greu de găsit "cine e acceptat". */}
      {activeTab === "incoming" && (
        <div style={{ display: "flex", padding: "0 16px 8px", gap: 6, overflowX: "auto" }}>
          {[
            { id: "all", label: "Toate" },
            { id: "pending", label: "În așteptare" },
            { id: "accepted", label: "Acceptați" },
            { id: "rejected", label: "Refuzați" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                border: `1px solid ${statusFilter === f.id ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.08)"}`,
                background: statusFilter === f.id ? "rgba(255,51,102,0.15)" : "rgba(255,255,255,0.04)",
                color: statusFilter === f.id ? "#FF3366" : "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>Se încarcă...</div>
        ) : activeTab === "incoming" ? (
          filteredRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ marginBottom: 10, color: "rgba(255,255,255,0.25)", display: "flex", justifyContent: "center" }}><InboxIcon size={36} /></div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                {statusFilter === "all" ? "Nicio cerere primită" : statusFilter === "accepted" ? "Niciun participant acceptat încă" : statusFilter === "pending" ? "Nicio cerere în așteptare" : "Nicio cerere refuzată"}
              </div>
            </div>
          ) : filteredRequests.map(req => (
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
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>{req.posted_events?.title}</div>
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

              {req.status === "accepted" && req.checkin && (
                <button onClick={() => setOpenTicket(req)} style={{ marginTop: 10, width: "100%", padding: "9px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.25)", borderRadius: 10, color: "#FF3366", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                  <TicketIcon size={13} /> {req.checkin.checked_in ? "Ai intrat — vezi biletul" : "Vezi biletul"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {openTicket && (
        <div onClick={() => setOpenTicket(null)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "backdropIn 0.2s ease-out" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f12", borderRadius: 24, padding: "24px", width: "100%", maxWidth: 320, textAlign: "center", border: "1px solid rgba(255,255,255,0.1)", animation: "modalPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>{openTicket.posted_events?.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 20 }}>Arată codul la intrare</div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <TicketQR token={openTicket.checkin.token} />
            </div>

            {openTicket.checkin.checked_in ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 14px", borderRadius: 20, background: "rgba(0,200,100,0.15)", color: "#00C864", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>
                <CheckCircleIcon size={14} /> Ai intrat deja
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif" }}>Nescanat încă</div>
            )}

            <button onClick={() => setOpenTicket(null)} style={{ marginTop: 20, width: "100%", padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <CrossCircleIcon size={13} /> Închide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
