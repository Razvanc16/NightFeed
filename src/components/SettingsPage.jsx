import {
  BellIcon, BellOffIcon, DocumentIcon, TrashIcon, LogoutIcon, ChevronRightIcon, PencilIcon, TicketIcon, ClockIcon, HeartOutlineIcon, EnvelopeIcon, ShieldIcon,
} from "./Icons";

const NOTIF_PREF_TYPES = [
  { key: "notif_likes", label: "Like-uri" },
  { key: "notif_comments", label: "Comentarii" },
  { key: "notif_requests", label: "Cereri de participare" },
  { key: "notif_followers", label: "Urmăritori noi" },
];

// danger=true — nu doar text roșu (ușor de confundat cu "Ieși din cont", care
// unele obiceiuri de la alte aplicații îl asociază tot cu roșu), ci un fundal
// și un chenar roșiatice distincte, plus un subtitlu explicit, ca rândul de
// ștergere definitivă să nu semene vizual cu un rând normal din listă.
const Row = ({ icon, label, subtitle, onClick, color, disabled, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%", padding: "13px 14px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
      background: danger ? "rgba(255,51,102,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${danger ? "rgba(255,51,102,0.3)" : "rgba(255,255,255,0.07)"}`,
      color: color || "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, textAlign: "left",
    }}
  >
    {icon}
    <span style={{ flex: 1 }}>
      <div>{label}</div>
      {subtitle && <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,51,102,0.6)", marginTop: 2 }}>{subtitle}</div>}
    </span>
    <ChevronRightIcon size={14} style={{ opacity: 0.3 }} />
  </button>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", margin: "20px 4px 8px" }}>
    {children}
  </div>
);

export default function SettingsPage({
  onClose, onEditProfile, onShowLegal, onShowLiked, onDeleteAccount, onLogout,
  onShowTickets, onShowHistory,
  profile, pushStatus, pushBusy, onTogglePush, onToggleNotifPref,
  isAdmin, onShowAdmin,
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10100, background: "#080808", overflowY: "auto", animation: "pageSlideInRight 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Setări</div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Închide
        </button>
      </div>

      <div style={{ padding: "4px 16px 60px" }}>
        <SectionLabel>Cont</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row icon={<PencilIcon size={15} />} label="Editează profilul" onClick={onEditProfile} />
          <Row icon={<HeartOutlineIcon size={16} />} label="Evenimente apreciate" onClick={onShowLiked} />
          <Row icon={<TicketIcon size={16} />} label="Biletele mele" onClick={onShowTickets} />
          <Row icon={<ClockIcon size={16} />} label="Istoricul meu" onClick={onShowHistory} />
        </div>

        <SectionLabel>Notificări</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pushStatus !== "unsupported" && (
            <button
              onClick={onTogglePush}
              disabled={pushBusy || pushStatus === "denied" || pushStatus === "checking"}
              style={{
                width: "100%", textAlign: "left", padding: "13px 14px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
                background: pushStatus === "subscribed" ? "rgba(0,200,100,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${pushStatus === "subscribed" ? "rgba(0,200,100,0.25)" : "rgba(255,255,255,0.07)"}`,
                color: pushStatus === "subscribed" ? "#00C864" : "rgba(255,255,255,0.75)",
                fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                cursor: (pushBusy || pushStatus === "denied" || pushStatus === "checking") ? "default" : "pointer",
                opacity: pushStatus === "denied" ? 0.5 : 1,
              }}
            >
              {pushStatus === "subscribed" ? <BellIcon size={16} /> : <BellOffIcon size={16} />}
              {pushStatus === "subscribed" ? "Notificări activate" : pushStatus === "denied" ? "Notificări blocate din browser" : "Activează notificările"}
            </button>
          )}
          {pushStatus === "subscribed" && profile && (
            <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              {NOTIF_PREF_TYPES.map(({ key, label }) => {
                const on = profile[key] ?? true;
                return (
                  <button
                    key={key}
                    onClick={() => onToggleNotifPref(key)}
                    style={{ width: "100%", padding: "9px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
                    <div style={{ width: 34, height: 19, borderRadius: 10, background: on ? "#00C864" : "rgba(255,255,255,0.12)", position: "relative", transition: "background 0.2s" }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <SectionLabel>Legal</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row icon={<DocumentIcon size={16} />} label="Confidențialitate & Termeni" onClick={onShowLegal} />
          <Row icon={<EnvelopeIcon size={16} />} label="contact@nightfeed.ro" onClick={() => { window.location.href = "mailto:contact@nightfeed.ro"; }} />
        </div>

        {isAdmin && (
          <>
            <SectionLabel>Echipă</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Row icon={<ShieldIcon size={15} />} label="Admin" color="#FF3366" onClick={onShowAdmin} />
            </div>
          </>
        )}

        <SectionLabel>Zonă periculoasă</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row icon={<LogoutIcon size={16} />} label="Ieși din cont" onClick={onLogout} />
          <Row icon={<TrashIcon size={16} />} label="Șterge contul" subtitle="Definitiv — nu poate fi anulat" onClick={onDeleteAccount} color="#FF3366" danger />
        </div>
      </div>
    </div>
  );
}
