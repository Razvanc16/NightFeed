import { useEffect, useRef } from "react";

export default function SplashScreen({ onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.5,
      color: ["#FF3366", "#FF6B35", "#B44FFF", "#00E5FF", "#FFB800"][Math.floor(Math.random() * 5)],
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    draw();

    const timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      onDone();
    }, 2200);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      animation: "fadeOutSplash 0.5s ease-in 1.8s forwards",
    }}>
      <style>{`
        @keyframes fadeOutSplash {
          from { opacity: 1; }
          to { opacity: 0; pointer-events: none; }
        }
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, opacity: 0.6 }} />

      {/* Logo */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 16,
      }}>
        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: "linear-gradient(135deg, #FF3366, #FF6B35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 60px rgba(255,51,102,0.5)",
          animation: "popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both",
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
            <path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z" />
          </svg>
        </div>

        {/* Name */}
        <div style={{
          fontSize: 36, fontWeight: 900,
          fontFamily: "'Syne', sans-serif",
          letterSpacing: "-0.03em",
          color: "#fff",
          animation: "slideUpFade 0.5s ease-out 0.5s both",
        }}>
          Night<span style={{ color: "#FF3366" }}>Feed</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.45)",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          animation: "slideUpFade 0.5s ease-out 0.7s both",
        }}>
        </div>

        {/* Loading dots */}
        <div style={{
          display: "flex", gap: 6, marginTop: 16,
          animation: "slideUpFade 0.5s ease-out 0.9s both",
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "#FF3366",
              animation: `pulseDot 1s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
