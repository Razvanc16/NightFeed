import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, CrossCircleIcon } from "./Icons";

const VIEWPORT = 300; // px, fix — zona în care se vede poza întreagă
const OUTPUT = 500; // px — dimensiunea finală a pozei de profil exportate

export default function AvatarCropSheet({ file, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState({ x: VIEWPORT / 2, y: VIEWPORT / 2 });
  const dragState = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Poza rămâne întreagă și fixă ("contain" — se vede tot, cu bare goale pe
  // laturile mai scurte dacă nu e pătrată) — userul mișcă doar cercul peste ea,
  // nu invers.
  const dispScale = natural.w && natural.h ? Math.min(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const dispW = natural.w * dispScale;
  const dispH = natural.h * dispScale;
  const imgLeft = (VIEWPORT - dispW) / 2;
  const imgTop = (VIEWPORT - dispH) / 2;

  // Cercul are dimensiune fixă, suficient de mic încât să încapă și să se
  // poată mișca liber în interiorul pozei, indiferent de proporțiile ei.
  const circleSize = Math.min(dispW, dispH) * 0.85;

  const handleImgLoad = (e) => {
    setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight });
  };

  // Repoziționează cercul la centrul pozei de fiecare dată când se încarcă o
  // poză nouă (dimensiunile ei, deci și limitele de mai jos, se schimbă).
  useEffect(() => {
    if (!natural.w) return;
    setCenter({ x: VIEWPORT / 2, y: VIEWPORT / 2 });
  }, [natural.w, natural.h]);

  const clampCenter = (x, y) => ({
    x: Math.min(imgLeft + dispW - circleSize / 2, Math.max(imgLeft + circleSize / 2, x)),
    y: Math.min(imgTop + dispH - circleSize / 2, Math.max(imgTop + circleSize / 2, y)),
  });

  const handlePointerDown = (e) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, origin: center };
    e.target.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragState.current) return;
    const { startX, startY, origin } = dragState.current;
    setCenter(clampCenter(origin.x + (e.clientX - startX), origin.y + (e.clientY - startY)));
  };
  const handlePointerUp = () => { dragState.current = null; };

  const handleConfirm = () => {
    const srcSize = circleSize / dispScale;
    const srcX = (center.x - circleSize / 2 - imgLeft) / dispScale;
    const srcY = (center.y - circleSize / 2 - imgTop) / dispScale;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);
      canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.9);
    };
    img.src = imgUrl;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10300, background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, animation: "tabEnter 0.25s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>Ajustează poza</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 20 }}>Trage cercul peste zona pe care vrei s-o păstrezi</div>

      <div style={{ width: VIEWPORT, height: VIEWPORT, position: "relative", background: "#111", borderRadius: 16, overflow: "hidden" }}>
        {imgUrl && (
          <img
            src={imgUrl}
            onLoad={handleImgLoad}
            draggable={false}
            style={{ position: "absolute", left: imgLeft, top: imgTop, width: dispW, height: dispH, userSelect: "none", pointerEvents: "none" }}
          />
        )}

        {natural.w > 0 && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{
              position: "absolute",
              left: center.x - circleSize / 2, top: center.y - circleSize / 2,
              width: circleSize, height: circleSize, borderRadius: "50%",
              border: "2px solid #FF3366", boxShadow: "0 0 0 2000px rgba(0,0,0,0.6)",
              cursor: "grab", touchAction: "none",
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 28, width: "100%", maxWidth: 320 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <CrossCircleIcon size={15} /> Anulează
        </button>
        <button
          onClick={handleConfirm}
          style={{ flex: 1, padding: "13px", borderRadius: 14, background: "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <CheckCircleIcon size={15} /> Salvează
        </button>
      </div>
    </div>
  );
}
