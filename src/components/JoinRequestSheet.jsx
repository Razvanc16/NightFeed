import { useState } from "react";
import { supabase } from "../supabase";
import { CheckCircleIcon, RocketIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";

export default function JoinRequestSheet({ event, user, open, onClose, alreadyRequested }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(alreadyRequested);

  const handleSend = async () => {
    if (!user) { alert("Trebuie să fii autentificat!"); return; }
    setSending(true);

    const username = [user.user_metadata?.prenume, user.user_metadata?.nume].filter(Boolean).join(" ") || user.email?.split("@")[0] || "User";
    // upsert, nu insert simplu — apăsat rapid/repetat pe "Trimite cererea"
    // crea mai multe cereri pentru același eveniment.
    const rawId = (event.rawId || event.id).toString().replace('posted_', '');
    const { error } = await supabase.from("attendance_requests").upsert([{
      event_id: rawId,
      requester_id: user.id,
      requester_username: username,
      host_id: event.organizer_id,
      status: "pending",
      message: message.trim() || null,
    }], { onConflict: "event_id,requester_id" });

    if (!error) {
      setSent(true);
      if (event.organizer_id) {
        notifyUser({
          targetUserId: event.organizer_id,
          title: "Cerere nouă de participare",
          body: `${username} vrea să participe la ${event.title}.`,
          type: "request",
          actorId: user.id,
          eventId: `posted_${rawId}`,
        });
      }
      setTimeout(() => onClose(), 1500);
    } else {
      alert("Eroare: " + error.message);
    }
    setSending(false);
  };

  if (!event) return null;

  return (
    <>
      {/* touchAction:none — fără el, sheet-ul (deși position:fixed) rămâne
          descendent în DOM din containerul scrollabil al feed-ului, iar un
          swipe pe backdrop/sheet era interpretat de browser ca pan nativ pe
          acel ancestor scrollabil, scrolând feed-ul pe sub modal. */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: open ? "blur(4px)" : "none", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.3s", zIndex: 400, touchAction: "none" }} />

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,10,12,0.98)", borderTop: `2px solid ${event.color || "#FF3366"}40`, borderRadius: "24px 24px 0 0", transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.35s cubic-bezier(0.32, 0, 0.15, 1)", zIndex: 401, padding: "16px 20px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))", touchAction: "none" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ marginBottom: 12, color: "#00C864", display: "flex", justifyContent: "center" }}><CheckCircleIcon size={44} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Cerere trimisă!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>Host-ul te va notifica după ce decide.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Cer să particip</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>{event.title}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Mesaj pentru host (opțional)</div>
              <textarea
                placeholder="Scrie un mesaj pentru host..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Anulează</button>
              <button onClick={handleSend} disabled={sending} style={{ flex: 2, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: sending ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: sending ? "not-allowed" : "pointer" }}>
                {sending ? "Se trimite..." : <>Trimite cererea <RocketIcon size={15} /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
