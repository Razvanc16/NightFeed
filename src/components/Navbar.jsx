import { PersonIcon, MapIcon, PlayIcon, PlusIcon, BellIcon } from "./Icons";
import { useIsDesktopNav, DESKTOP_SIDEBAR_WIDTH } from "../utils/desktopLayout";

const tabs = [
  { id: "feed", icon: PlayIcon, label: "Feed" },
  { id: "map", icon: MapIcon, label: "Hartă" },
  { id: "post", icon: PlusIcon, label: "Post" },
  { id: "notifications", icon: BellIcon, label: "Notificări" },
  { id: "profile", icon: PersonIcon, label: "Profil" },
];

export default function Navbar({ active, onChange, badges = {}, hidden = false }) {
  // Pe desktop (mouse + fereastră lată) bara devine sidebar în stânga, nu
  // bară jos — ca pe TikTok/Instagram web, unde spațiul lat orizontal nu are
  // rost irosit sub un feed vertical îngust.
  const isDesktopNav = useIsDesktopNav();
  return (
    <div
      style={isDesktopNav ? {
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: DESKTOP_SIDEBAR_WIDTH,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        zIndex: 100,
      } : {
        // Bară "plutitoare", gen pilulă (ca la App Store) — nu mai ocupă toată
        // lățimea ecranului, doar cât are nevoie pentru cele 5 iconițe,
        // centrată și ridicată puțin de la marginea de jos.
        position: "fixed",
        left: "50%",
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        // La scroll în jos (Hartă/Notificări/Profil — vezi App.jsx), bara
        // alunecă sub ecran, ca pe Instagram; la scroll în sus revine.
        transform: `translateX(-50%) translateY(${hidden ? "140%" : "0"})`,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        borderRadius: 999,
        // Și mai transparentă (0.26) — la teste tot părea prea opacă.
        background: "rgba(20,18,22,0.26)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const isPost = tab.id === "post";
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            title={tab.label}
            aria-label={tab.label}
            style={isDesktopNav ? {
              position: "relative",
              background: isPost ? "linear-gradient(135deg, #FF3366, #FF6B35)" : "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: isPost ? 0 : 3,
              padding: isPost ? 0 : "6px 14px",
              borderRadius: isPost ? "50%" : 14,
              width: isPost ? 44 : "auto",
              height: isPost ? 44 : "auto",
              justifyContent: "center",
              boxShadow: isPost ? "0 4px 20px rgba(255,51,102,0.4)" : "none",
              transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
            } : {
              // Fără etichetă text pe bara de jos — doar iconița, cu un fundal
              // rotunjit ("pilulă") pe tab-ul activ, gen App Store.
              position: "relative",
              background: isPost
                ? "linear-gradient(135deg, #FF3366, #FF6B35)"
                : isActive
                ? "rgba(255,255,255,0.14)"
                : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Butoanele normale sunt late și scunde (ovale), nu pătrate —
              // Post rămâne cerc, puțin ridicat deasupra rândului, ca un FAB.
              width: isPost ? 50 : 58,
              height: isPost ? 50 : 38,
              borderRadius: isPost ? 25 : 19,
              boxShadow: isPost ? "0 4px 16px rgba(255,51,102,0.4)" : "none",
              transform: isPost ? "translateY(-4px)" : "none",
              transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <span
              style={{
                position: "relative",
                zIndex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isPost ? (isDesktopNav ? 22 : 20) : 18,
                color: isPost
                  ? "#fff"
                  : isActive
                  ? "#FF3366"
                  : "rgba(255,255,255,0.65)",
                transition: "color 0.25s, transform 0.25s cubic-bezier(0.16,1,0.3,1)",
                transform: isActive && !isPost ? "scale(1.1)" : "none",
                lineHeight: 1,
              }}
            >
              <tab.icon size={isPost ? (isDesktopNav ? 22 : 21) : isDesktopNav ? 18 : 19} />
              {!!badges[tab.id] && (
                <span style={{ position: "absolute", top: -6, right: -9, minWidth: 17, height: 17, padding: "0 3px", borderRadius: 9, background: "#FF3366", border: "1.5px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, color: "#fff", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>
                  {badges[tab.id] > 9 ? "9+" : badges[tab.id]}
                </span>
              )}
            </span>
            {/* Eticheta rămâne doar pe sidebar-ul de desktop (spațiu vertical
                din belșug) — pe bara de jos, acum "pilulă" cu doar iconițe. */}
            {!isPost && isDesktopNav && (
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 10,
                  color: isActive ? "#FF3366" : "rgba(255,255,255,0.55)",
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.05em",
                  transition: "color 0.25s",
                }}
              >
                {tab.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
