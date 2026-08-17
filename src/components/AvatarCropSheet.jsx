import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, CrossCircleIcon } from "./Icons";

const VIEWPORT = 260; // px, fix — dimensiunea zonei circulare de previzualizare
const OUTPUT = 500; // px — dimensiunea finală a pozei de profil exportate

export default function AvatarCropSheet({ file, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleImgLoad = (e) => {
    setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // "cover" la zoom=1 — imaginea acoperă mereu tot cercul, indiferent de
  // proporțiile ei; zoom-ul suplimentar (1x-3x) se aplică peste asta.
  const baseScale = natural.w && natural.h ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const totalScale = baseScale * zoom;
  const dispW = natural.w * totalScale;
  const dispH = natural.h * totalScale;
  const maxOffsetX = Math.max(0, (dispW - VIEWPORT) / 2);
  const maxOffsetY = Math.max(0, (dispH - VIEWPORT) / 2);

  const clamp = (val, max) => Math.min(max, Math.max(-max, val));

  const setClampedOffset = (x, y) => {
    setOffset({ x: clamp(x, maxOffsetX), y: clamp(y, maxOffsetY) });
  };

  const handlePointerDown = (e) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, origin: offset };
    e.target.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragState.current) return;
    const { startX, startY, origin } = dragState.current;
    setClampedOffset(origin.x + (e.clientX - startX), origin.y + (e.clientY - startY));
  };
  const handlePointerUp = () => { dragState.current = null; };

  const handleZoomChange = (newZoom) => {
    // Re-clampăm offsetul existent la noile limite (imaginea s-a putut micșora
    // dacă dai zoom out) — cu limitele calculate din newZoom, nu din cel vechi
    // încă prezent în closure la momentul acestui apel.
    const newTotalScale = baseScale * newZoom;
    const nMaxX = Math.max(0, (natural.w * newTotalScale - VIEWPORT) / 2);
    const nMaxY = Math.max(0, (natural.h * newTotalScale - VIEWPORT) / 2);
    setZoom(newZoom);
    setOffset({ x: clamp(offset.x, nMaxX), y: clamp(offset.y, nMaxY) });
  };

  const handleConfirm = () => {
    const srcSize = VIEWPORT / totalScale;
    const srcX = (dispW / 2 - VIEWPORT / 2 - offset.x) / totalScale;
    const srcY = (dispH / 2 - VIEWPORT / 2 - offset.y) / totalScale;

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
      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", marginBottom: 24 }}>Ajustează poza</div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: VIEWPORT, height: VIEWPORT, borderRadius: "50%", overflow: "hidden",
          position: "relative", background: "#111", cursor: "grab", touchAction: "none",
          border: "2px solid rgba(255,51,102,0.5)", boxShadow: "0 0 0 4000px rgba(0,0,0,0.75)",
        }}
      >
        {imgUrl && (
          <img
            src={imgUrl}
            onLoad={handleImgLoad}
            draggable={false}
            style={{
              position: "absolute",
              left: VIEWPORT / 2 + offset.x - dispW / 2,
              top: VIEWPORT / 2 + offset.y - dispH / 2,
              width: dispW, height: dispH,
              userSelect: "none", pointerEvents: "none",
            }}
          />
        )}
      </div>

      <input
        type="range" min="1" max="3" step="0.01" value={zoom}
        onChange={(e) => handleZoomChange(Number(e.target.value))}
        style={{ width: VIEWPORT, marginTop: 24, accentColor: "#FF3366" }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 32, width: "100%", maxWidth: 320 }}>
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
