import { SearchIcon, PersonIcon, MapIcon, PlayIcon, PlusIcon } from "./Icons";

const tabs = [
  { id: "feed", icon: PlayIcon, label: "Feed" },
  { id: "search", icon: SearchIcon, label: "Caută" },
  { id: "post", icon: PlusIcon, label: "Post" },
  { id: "map", icon: MapIcon, label: "Hartă" },
  { id: "profile", icon: PersonIcon, label: "Profil" },
];

export default function Navbar({ active, onChange }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 100,
        padding: "0 4px env(safe-area-inset-bottom, 0)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const isPost = tab.id === "post";
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              position: "relative",
              background: isPost
                ? "linear-gradient(135deg, #FF3366, #FF6B35)"
                : "none",
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
              transform: isPost ? "translateY(-8px)" : "none",
              transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <span
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: isPost ? 22 : 18,
                color: isPost
                  ? "#fff"
                  : isActive
                  ? "#FF3366"
                  : "rgba(255,255,255,0.65)",
                transition: "color 0.25s, transform 0.25s cubic-bezier(0.16,1,0.3,1)",
                transform: isActive && !isPost ? "translateY(-1px) scale(1.1)" : "none",
                lineHeight: 1,
              }}
            >
              <tab.icon size={18} />
            </span>
            {!isPost && (
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
