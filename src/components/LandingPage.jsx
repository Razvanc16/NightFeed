export default function LandingPage({ onNewUser, onExistingUser }) {
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: "#060608", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "0 28px",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes lpFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.1)} }
        @keyframes lpFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,40px) scale(1.06)} }
        @keyframes lpPopIn { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes lpFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ position: "absolute", width: 440, height: 440, borderRadius: "50%", top: "-140px", left: "-120px", background: "radial-gradient(circle, rgba(255,51,102,0.35), transparent 70%)", filter: "blur(70px)", animation: "lpFloat1 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", bottom: "-160px", right: "-130px", background: "radial-gradient(circle, rgba(180,79,255,0.3), transparent 70%)", filter: "blur(70px)", animation: "lpFloat2 18s ease-in-out infinite", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{
          width: 76, height: 76, borderRadius: 24,
          background: "linear-gradient(135deg, #FF3366, #FF6B35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 22, boxShadow: "0 0 50px rgba(255,51,102,0.45)",
          animation: "lpPopIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="8" fill="white" opacity="0.9" />
            <circle cx="20" cy="20" r="14" stroke="white" strokeWidth="2" opacity="0.4" />
            <circle cx="20" cy="20" r="20" stroke="white" strokeWidth="1" opacity="0.15" />
          </svg>
        </div>

        <div style={{
          fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 30, color: "#fff",
          letterSpacing: "-0.02em", marginBottom: 12,
          opacity: 0, animation: "lpFadeUp 0.7s 0.1s forwards",
        }}>
          Night<span style={{ color: "#FF3366" }}>Feed</span>
        </div>

        <div style={{
          fontFamily: "'Inter', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.6)",
          lineHeight: 1.6, marginBottom: 40,
          opacity: 0, animation: "lpFadeUp 0.7s 0.22s forwards",
        }}>
          Evenimente, petreceri homemade și cluburi din orașul tău — într-un feed care se mișcă în ritmul tău.
        </div>

        <div style={{
          width: "100%", display: "flex", flexDirection: "column", gap: 12,
          opacity: 0, animation: "lpFadeUp 0.7s 0.34s forwards",
        }}>
          <button
            onClick={onNewUser}
            style={{
              width: "100%", padding: "16px", borderRadius: 40, border: "none", cursor: "pointer",
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 16,
              background: "linear-gradient(120deg,#FF3366,#B44FFF)", color: "#fff",
              boxShadow: "0 8px 34px rgba(255,51,102,0.4)",
            }}
          >
            Sunt utilizator nou
          </button>
          <button
            onClick={onExistingUser}
            style={{
              width: "100%", padding: "16px", borderRadius: 40, cursor: "pointer",
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 16,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", backdropFilter: "blur(10px)",
            }}
          >
            Am cont
          </button>
        </div>
      </div>
    </div>
  );
}
