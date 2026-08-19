import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "../supabase";
import { CrossCircleIcon, CheckCircleIcon, WarningIcon } from "./Icons";

// Beep-uri sintetizate (Web Audio API) — fără fișier audio de încărcat, ok
// și offline. Succes: ton scurt, ascuțit. Eroare/deja scanat: ton mai jos, mai lung.
const beep = (kind) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const duration = kind === "success" ? 0.15 : 0.35;
    osc.frequency.value = kind === "success" ? 880 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch {}
};

const RESULT_STYLES = {
  success: { bg: "rgba(0,200,100,0.95)", Icon: CheckCircleIcon },
  warning: { bg: "rgba(255,184,0,0.95)", Icon: WarningIcon },
  error: { bg: "rgba(255,51,102,0.95)", Icon: CrossCircleIcon },
};

export default function CheckinScannerSheet({ event, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lockRef = useRef(false);
  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null); // { status, title, detail }

  const eventId = `posted_${event.id}`;

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !lockRef.current) {
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) handleDecoded(code.data);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(err => setCameraError(err?.name === "NotAllowedError" ? "Acces la cameră refuzat." : "Nu am putut porni camera."));

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleDecoded = async (token) => {
    lockRef.current = true;
    try {
      const { data, error } = await supabase.rpc("checkin_scan", { p_token: token, p_event_id: eventId });
      if (error) throw error;
      if (data.ok) {
        setResult({ status: "success", title: "Acces permis", detail: data.name });
        beep("success");
      } else if (data.reason === "already") {
        const t = data.checked_in_at ? new Date(data.checked_in_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : null;
        setResult({ status: "warning", title: "Bilet deja utilizat", detail: t ? `Intrat la ora ${t}` : "" });
        beep("warning");
      } else {
        setResult({ status: "error", title: "Cod invalid", detail: "Cod invalid sau pentru alt eveniment." });
        beep("error");
      }
    } catch {
      setResult({ status: "error", title: "Cod invalid", detail: "Nu am putut citi codul." });
      beep("error");
    }
    // Scanerul rămâne activ — după ce feedback-ul dispare, reia automat scanarea.
    setTimeout(() => {
      setResult(null);
      lockRef.current = false;
    }, 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 10400, display: "flex", flexDirection: "column", animation: "backdropIn 0.2s ease-out" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 16px", background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>Scanează bilete</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{event.title}</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "7px 12px", color: "#fff", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Închide
        </button>
      </div>

      {cameraError ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, gap: 12 }}>
          <WarningIcon size={36} style={{ color: "#FFB800" }} />
          <div style={{ color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>{cameraError}</div>
        </div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

          {/* Cadru de vizare — pur decorativ, jsQR scanează întregul frame */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(70vw, 280px)", height: "min(70vw, 280px)", border: "3px solid rgba(255,255,255,0.7)", borderRadius: 20, boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)" }} />
        </>
      )}

      {result && (
        <div style={{ position: "absolute", inset: 0, zIndex: 3, background: RESULT_STYLES[result.status].bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 30, animation: "tabEnter 0.2s ease-out" }}>
          {(() => { const Icon = RESULT_STYLES[result.status].Icon; return <Icon size={64} style={{ color: "#fff" }} />; })()}
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>{result.title}</div>
          {result.detail && <div style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>{result.detail}</div>}
        </div>
      )}
    </div>
  );
}
