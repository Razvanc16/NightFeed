import { useEffect, useRef, useState } from "react";

export default function LandingPage({ onNewUser, onExistingUser }) {
  const orbsRef = useRef(null);
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleMove = (e) => {
      if (!orbsRef.current) return;
      const cx = (e.clientX / window.innerWidth - 0.5);
      const cy = (e.clientY / window.innerHeight - 0.5);
      const orbs = orbsRef.current.children;
      for (let i = 0; i < orbs.length; i++) {
        const depth = (i + 1) * 16;
        orbs[i].style.transform = `translate(${cx * depth}px, ${cy * depth}px)`;
      }
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    setScrolled(scrollRef.current.scrollTop > 120);
  };

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, root: scrollRef.current });
    const els = scrollRef.current?.querySelectorAll(".lp-reveal");
    els?.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={scrollRef} onScroll={handleScroll} style={{
      width: "100%", height: "100%", position: "relative",
      background: "#060608", overflowY: "auto", overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500;1,600&family=Inter:wght@400;500;600;700&family=Syne:wght@700;800;900&display=swap');
        @keyframes lpFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.1)} }
        @keyframes lpFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,40px) scale(1.06)} }
        @keyframes lpFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,30px) scale(1.12)} }
        @keyframes lpFadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        .lp-reveal { opacity: 0; transform: translateY(40px); transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      <div ref={orbsRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", top: "-140px", left: "-120px", background: "radial-gradient(circle, rgba(255,51,102,0.38), transparent 70%)", filter: "blur(70px)", animation: "lpFloat1 15s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", bottom: "-160px", right: "-140px", background: "radial-gradient(circle, rgba(180,79,255,0.32), transparent 70%)", filter: "blur(70px)", animation: "lpFloat2 19s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", top: "40%", left: "50%", background: "radial-gradient(circle, rgba(0,229,255,0.16), transparent 70%)", filter: "blur(80px)", animation: "lpFloat3 17s ease-in-out infinite" }} />
      </div>

      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: scrolled ? "14px 24px" : "20px 24px",
        background: scrolled ? "rgba(6,6,8,0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 20, color: "#fff",
          opacity: scrolled ? 1 : 0, transform: scrolled ? "translateX(0)" : "translateX(-10px)",
          transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
        }}>
          Night<span style={{ color: "#FF3366" }}>Feed</span>
        </div>

        <div style={{
          display: "flex", gap: 10,
          opacity: scrolled ? 1 : 0,
          transform: scrolled ? "translateY(0)" : "translateY(-12px)",
          pointerEvents: scrolled ? "auto" : "none",
          transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <button onClick={onExistingUser} style={navBtnGhost}>Am cont</button>
          <button onClick={onNewUser} style={navBtnPrimary}>Sunt nou</button>
        </div>
      </div>

      <div style={{
        minHeight: "100%", position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "0 28px",
      }}>
        <div style={{ maxWidth: 520 }}>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: 12, letterSpacing: 4,
            textTransform: "uppercase", color: "#FF3366", border: "1px solid rgba(255,51,102,0.3)",
            borderRadius: 40, padding: "8px 18px", display: "inline-block", marginBottom: 34,
            background: "rgba(255,51,102,0.05)", backdropFilter: "blur(10px)",
            opacity: 0, animation: "lpFadeUp 0.9s 0.15s forwards",
          }}>
            Nightlife · redefinit
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontWeight: 800,
            fontSize: "clamp(46px, 12vw, 82px)", lineHeight: 1.0, letterSpacing: "-0.02em",
            color: "#fff", marginBottom: 26, opacity: 0, animation: "lpFadeUp 1s 0.3s forwards",
          }}>
            Unde începe<br/>
            <span style={{ fontStyle: "italic", fontWeight: 500, background: "linear-gradient(120deg,#FF3366,#B44FFF 60%,#00E5FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              noaptea ta
            </span>
          </h1>

          <p style={{
            fontFamily: "'Inter', sans-serif", fontSize: "clamp(15px,4vw,18px)",
            color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 40,
            opacity: 0, animation: "lpFadeUp 1s 0.45s forwards",
          }}>
            Descoperă evenimente, petreceri homemade și cluburi din orașul tău. Totul într-un feed care se mișcă în ritmul tău.
          </p>

          <div style={{
            display: "flex", flexDirection: "column", gap: 12,
            opacity: scrolled ? 0 : 1,
            transform: scrolled ? "translateY(20px)" : "translateY(0)",
            pointerEvents: scrolled ? "none" : "auto",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
            animation: "lpFadeUp 1s 0.6s forwards",
          }}>
            <button onClick={onNewUser} style={heroBtnPrimary}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
              Sunt utilizator nou
            </button>
            <button onClick={onExistingUser} style={heroBtnGhost}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>
              Am deja cont
            </button>
          </div>

          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: 2,
            textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginTop: 48,
            opacity: scrolled ? 0 : 1, transition: "opacity 0.4s",
          }}>
            Scroll ↓
          </div>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto", padding: "40px 28px 120px" }}>
        <div className="lp-reveal" style={{ marginBottom: 80 }}>
          <div style={sectionLabel}>Ce te așteaptă</div>
          <div style={sectionTitle}>O experiență construită<br/>pentru noapte.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 100 }}>
          {[
            { icon: "⚡", title: "Feed vertical", desc: "Descoperă evenimente în stil TikTok — swipe, like, participă. Un flux nesfârșit de noapte." },
            { icon: "🗺️", title: "Hartă interactivă", desc: "Vezi ce se întâmplă în jurul tău pe o hartă de noapte, cu locații și zone de petrecere." },
            { icon: "🏠", title: "Evenimente homemade", desc: "Organizează-ți propria petrecere. Adresa rămâne privată până accepți invitații." },
          ].map((f, i) => (
            <div key={i} className="lp-reveal" style={{ ...card, transitionDelay: `${i * 0.1}s` }}>
              <div style={{ fontSize: 38, marginBottom: 18 }}>{f.icon}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff", marginBottom: 10 }}>{f.title}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="lp-reveal" style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={sectionLabel}>Comunitate</div>
          <div style={{ ...sectionTitle, margin: "0 auto 20px" }}>Nu doar evenimente.<br/>Oameni.</div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 17, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
            Comentează, cere să participi, cunoaște organizatori. NightFeed conectează oamenii dincolo de ecran — în cluburi, la petreceri, în oraș.
          </p>
        </div>

        <div className="lp-reveal" style={{ textAlign: "center", marginTop: 100 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "clamp(32px,7vw,60px)", color: "#fff", lineHeight: 1.1, marginBottom: 30 }}>
            Noaptea nu te așteaptă.
          </div>
          <button onClick={onNewUser} style={heroBtnPrimary}>Începe acum</button>
        </div>
      </div>
    </div>
  );
}

const heroBtnPrimary = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16,
  padding: "16px 32px", borderRadius: 40, border: "none", cursor: "pointer",
  background: "linear-gradient(120deg,#FF3366,#B44FFF)", color: "#fff",
  boxShadow: "0 8px 40px rgba(255,51,102,0.4)", transition: "transform 0.3s",
};
const heroBtnGhost = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16,
  padding: "16px 32px", borderRadius: 40, cursor: "pointer",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff", backdropFilter: "blur(10px)", transition: "transform 0.3s, background 0.3s",
};
const navBtnPrimary = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14,
  padding: "9px 18px", borderRadius: 30, border: "none", cursor: "pointer",
  background: "linear-gradient(120deg,#FF3366,#B44FFF)", color: "#fff",
};
const navBtnGhost = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14,
  padding: "9px 18px", borderRadius: 30, cursor: "pointer",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff",
};
const sectionLabel = {
  fontFamily: "'Inter', sans-serif", fontSize: 12, letterSpacing: 4,
  textTransform: "uppercase", color: "#FF3366", marginBottom: 16, fontWeight: 500,
};
const sectionTitle = {
  fontFamily: "'Inter', sans-serif", fontWeight: 800,
  fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.05, letterSpacing: "-0.02em",
  color: "#fff", maxWidth: 500,
};
const card = {
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24, padding: 30, backdropFilter: "blur(20px)",
};
