import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { CheckCircleIcon, WarningIcon } from "./Icons";

const EVENT_REASONS = [
  "Îmi apare fața / date personale fără acord",
  "Conținut ilegal sau înșelător",
  "Hărțuire sau spam",
  "Altceva",
];

const USER_REASONS = [
  "Cont fals / se dă drept altcineva",
  "Hărțuire sau amenințări",
  "Conținut ilegal sau înșelător",
  "Altceva",
];

// event XOR reportedUser ({ id, name }) — același sheet servește raportarea
// unui eveniment și raportarea unui cont, ca să nu dublăm tot UI-ul ăsta.
export default function ReportSheet({ event, reportedUser, user, open, onClose }) {
  const target = event || reportedUser;
  const isUserReport = !event && !!reportedUser;
  const REASONS = isUserReport ? USER_REASONS : EVENT_REASONS;
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Reset la fiecare deschidere, nu la închidere — înainte, reset-ul se
  // întâmpla fie niciodată (la "Anulează"/backdrop, lăsa reason/details
  // "murdare" pentru următoarea raportare, chiar și pe alt eveniment), fie
  // exact în același moment cu onClose() după trimitere (bifa verde sărea
  // vizibil înapoi la formular cât timp sheet-ul încă aluneca spre ieșire).
  useEffect(() => {
    if (open) {
      setReason(null);
      setDetails("");
      setSent(false);
    }
  }, [open]);

  const handleSend = async () => {
    if (!user) { alert("Trebuie să fii autentificat!"); return; }
    if (!reason) return;
    setSending(true);
    const { error } = await supabase.from("reports").insert([{
      reporter_id: user.id,
      event_id: event?.id ? String(event.id) : null,
      reported_user_id: isUserReport ? reportedUser.id : null,
      reason,
      details: details.trim() || null,
    }]);
    if (!error) {
      setSent(true);
      setTimeout(onClose, 1500);
    } else {
      alert("Eroare: " + error.message);
    }
    setSending(false);
  };

  if (!target) return null;

  return (
    <>
      {/* touchAction:none — vezi JoinRequestSheet pentru explicația completă
          (fără el, swipe-ul pe backdrop scrolează feed-ul de dedesubt). */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: open ? "blur(4px)" : "none", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.3s", zIndex: 400, touchAction: "none" }} />

      {/* maxHeight + overflowY:auto — pe telefoane mici, 4 motive + textarea +
          butoane pot depăși înălțimea ecranului; fără scroll intern propriu,
          conținutul care depășea "spărgea" vizual colțurile rotunjite ale
          sheet-ului la orice încercare de scroll (glitch raportat). touchAction
          "pan-y" (nu "none") ca scroll-ul vertical să rămână local sheet-ului,
          nu să scurgă spre feed-ul de dedesubt. */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "85vh", overflowY: "auto", background: "rgba(10,10,12,0.98)", borderTop: "2px solid rgba(255,184,0,0.3)", borderRadius: "24px 24px 0 0", transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.35s cubic-bezier(0.32, 0, 0.15, 1)", zIndex: 401, padding: "16px 20px", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))", touchAction: "pan-y" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ marginBottom: 12, color: "#00C864", display: "flex", justifyContent: "center" }}><CheckCircleIcon size={44} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Raportare trimisă</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>O verificăm cât mai curând.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#FFB800" }}><WarningIcon size={18} /></span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{isUserReport ? "Raportează utilizator" : "Raportează"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>{isUserReport ? reportedUser.name : event.title}</div>
              </div>
            </div>

            <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, background: reason === r ? "rgba(255,184,0,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${reason === r ? "rgba(255,184,0,0.4)" : "rgba(255,255,255,0.1)"}`, color: reason === r ? "#FFB800" : "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: reason === r ? 700 : 400, cursor: "pointer" }}
                >
                  {r}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Detalii (opțional)</div>
              <textarea
                placeholder="Orice detaliu care ne ajută să înțelegem situația..."
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Anulează</button>
              <button onClick={handleSend} disabled={sending || !reason} style={{ flex: 2, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: !reason ? "rgba(255,184,0,0.25)" : sending ? "rgba(255,184,0,0.4)" : "linear-gradient(135deg, #FFB800, #FF6B35)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: (sending || !reason) ? "not-allowed" : "pointer" }}>
                {sending ? "Se trimite..." : "Trimite raportarea"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
