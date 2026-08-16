import { SparkleIcon, LightningIcon, HouseIcon, FireIcon, ConfettiIcon, TagIcon } from "./Icons";

const filters = [
  { id: "all", label: "Toate", icon: SparkleIcon },
  { id: "official", label: "Oficial", icon: LightningIcon },
  { id: "homemade", label: "Neoficial", icon: HouseIcon },
  { id: "today", label: "Azi", icon: FireIcon },
  { id: "weekend", label: "Weekend", icon: ConfettiIcon },
  { id: "free", label: "Gratuit", icon: TagIcon },
];

export default function FilterDrawer({ open, onClose, active, onChange }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: open ? "blur(4px)" : "none",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s, backdrop-filter 0.3s",
          zIndex: 200,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 240,
          background: "rgba(10,10,12,0.97)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(30px)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.35s cubic-bezier(0.32, 0, 0.15, 1)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          padding: "60px 0 40px",
        }}
      >
        {/* Logo in drawer */}
        <div
          style={{
            padding: "0 24px 32px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#fff",
              fontFamily: "'Syne', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Night<span style={{ color: "#FF3366" }}>Feed</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'DM Mono', monospace",
              marginTop: 4,
            }}
          >
            București · 2026
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: "24px 16px 0" }}>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontFamily: "'DM Mono', monospace",
              marginBottom: 12,
              paddingLeft: 8,
            }}
          >
            Filtre
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => { onChange(f.id); onClose(); }}
                style={{
                  background: active === f.id ? "rgba(255,51,102,0.15)" : "transparent",
                  border: `1px solid ${active === f.id ? "rgba(255,51,102,0.4)" : "transparent"}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span style={{ width: 24, display: "flex", justifyContent: "center", color: active === f.id ? "#FF3366" : "rgba(255,255,255,0.7)" }}><f.icon size={17} /></span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: active === f.id ? 700 : 400,
                    color: active === f.id ? "#FF3366" : "rgba(255,255,255,0.7)",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "color 0.15s",
                  }}
                >
                  {f.label}
                </span>
                {active === f.id && (
                  <div
                    style={{
                      marginLeft: "auto",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#FF3366",
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "auto",
            padding: "24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              fontFamily: "'DM Mono', monospace",
              lineHeight: 1.6,
            }}
          >
            NightFeed MVP v0.1
            <br />
            Proiect licență ASE CSIE
          </div>
        </div>
      </div>
    </>
  );
}
