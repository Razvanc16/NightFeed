// Poza de profil mărită, tip Instagram — tap pe avatar oriunde în aplicație
// deschide asta; tap oriunde pe ea (fundal sau poză) o închide la loc.
export default function PhotoViewerModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10500, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30, animation: "tabEnter 0.2s ease-out" }}>
      <img src={src} style={{ width: "min(80vw, 320px)", height: "min(80vw, 320px)", borderRadius: "50%", objectFit: "cover", boxShadow: "0 0 60px rgba(255,51,102,0.25)" }} />
    </div>
  );
}
