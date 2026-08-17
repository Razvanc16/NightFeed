import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../supabase";
import { TicketIcon, LightningIcon, HouseIcon, CheckCircleIcon, ClockIcon, CrossCircleIcon } from "./Icons";

export const TicketQR = ({ token }) => {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(token, { width: 260, margin: 1, color: { dark: "#080808", light: "#ffffff" } })
      .then(url => { if (active) setDataUrl(url); });
    return () => { active = false; };
  }, [token]);

  if (!dataUrl) return <div style={{ width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>Se generează...</div>;
  return <img src={dataUrl} alt="Cod QR" style={{ width: 260, height: 260, borderRadius: 12 }} />;
};

export default function MyTicketsPage({ user, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTicket, setOpenTicket] = useState(null);

  const loadTickets = async () => {
    const { data: checkins } = await supabase
      .from("event_checkins")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const ids = (checkins || []).map(c => c.event_id.replace("posted_", ""));
    let eventById = {};
    if (ids.length) {
      const { data: events } = await supabase.from("posted_events_feed").select("id, title, date, type").in("id", ids);
      (events || []).forEach(e => { eventById[String(e.id)] = e; });
    }

    setTickets((checkins || []).map(c => ({ ...c, event: eventById[c.event_id.replace("posted_", "")] })));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadTickets();

    // Live — dacă hostul te scanează cât timp te uiți la bilet, vezi imediat
    // statusul "Verificat", fără să iasă și să reintre în ecran.
    const channel = supabase
      .channel(`my_tickets_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_checkins", filter: `user_id=eq.${user.id}` }, () => loadTickets())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080808", zIndex: 300, overflowY: "auto", paddingBottom: 80, animation: "slideUp 0.3s ease-out" }}>
      <div style={{ padding: "50px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>Biletele mele</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>Codul QR pentru intrarea la evenimente</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Înapoi
        </button>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>Se încarcă...</div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ marginBottom: 10, color: "rgba(255,255,255,0.25)", display: "flex", justifyContent: "center" }}><TicketIcon size={36} /></div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>Niciun bilet încă — participă la un eveniment ca să primești unul.</div>
          </div>
        ) : tickets.map(t => (
          <button
            key={t.id}
            onClick={() => setOpenTicket(t)}
            style={{ textAlign: "left", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: t.event?.type === "official" ? "rgba(255,51,102,0.2)" : "rgba(255,184,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: t.event?.type === "official" ? "#FF3366" : "#FFB800", flexShrink: 0 }}>
              {t.event?.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.event?.title || "Eveniment"}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{t.event?.date}</div>
            </div>
            {t.checked_in ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(0,200,100,0.15)", color: "#00C864", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                <CheckCircleIcon size={12} /> Verificat
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                <ClockIcon size={12} /> Neintrat
              </span>
            )}
          </button>
        ))}
      </div>

      {openTicket && (
        <div onClick={() => setOpenTicket(null)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f12", borderRadius: 24, padding: "24px", width: "100%", maxWidth: 320, textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>{openTicket.event?.title || "Eveniment"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 20 }}>Arată codul la intrare</div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <TicketQR token={openTicket.token} />
            </div>

            {openTicket.checked_in ? (
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
