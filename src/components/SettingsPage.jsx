import {
  BellIcon, BellOffIcon, DocumentIcon, TrashIcon, LogoutIcon, ChevronRightIcon, HeartOutlineIcon, PencilIcon, TicketIcon, ClockIcon,
} from "./Icons";

const NotifRow = ({ label, onClick, count }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%", padding: "13px 14px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      color: "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      cursor: "pointer", textAlign: "left",
    }}
  >
    <BellIcon size={16} />
    <span style={{ flex: 1 }}>{label}</span>
    {count > 0 && (
      <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "#FF3366", color: "#fff", fontSize: 10, fontWeight: 800, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
        {count > 9 ? "9+" : count}
      </span>
    )}
    <ChevronRightIcon size={14} style={{ opacity: 0.3 }} />
  </button>
);

const NOTIF_PREF_TYPES = [
  { key: "notif_likes", label: "Like-uri" },
  { key: "notif_comments", label: "Comentarii" },
  { key: "notif_requests", label: "Cereri de participare" },
  { key: "notif_followers", label: "Urmăritori noi" },
];

const Row = ({ icon, label, onClick, color, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%", padding: "13px 14px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      color: color || "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, textAlign: "left",
    }}
  >
    {icon}
    <span style={{ flex: 1 }}>{label}</span>
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
  onShowNotifications, unreadNotifCount, onShowTickets, onShowHistory,
  profile, pushStatus, pushBusy, onTogglePush, onToggleNotifPref,
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10100, background: "#080808", overflowY: "auto", animation: "tabEnter 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ padding: "50px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>Setări</div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Închide
        </button>
      </div>

      <div style={{ padding: "4px 16px 60px" }}>
        <SectionLabel>Cont</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row icon={<PencilIcon size={15} />} label="Editează profilul" onClick={onEditProfile} />
          <NotifRow label="Notificări" onClick={onShowNotifications} count={unreadNotifCount} />
          <Row icon={<HeartOutlineIcon size={16} />} label="Evenimente apreciate" onClick={onShowLiked} />
          <Row icon={<TicketIcon size={16} />} label="Biletele mele" onClick={onShowTickets} />
          <Row icon={<ClockIcon size={16} />} label="Istoricul meu" onClick={onShowHistory} />
          <Row icon={<LogoutIcon size={16} />} label="Ieși din cont" onClick={onLogout} />
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
        </div>

        <SectionLabel>Zonă periculoasă</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row icon={<TrashIcon size={16} />} label="Șterge contul" onClick={onDeleteAccount} color="#FF3366" />
        </div>
      </div>
    </div>
  );
}
