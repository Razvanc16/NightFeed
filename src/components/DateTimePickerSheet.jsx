import { useState, useRef, useEffect } from "react";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
const ITEM_H = 44;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;
const PAD = (WHEEL_H - ITEM_H) / 2;

const pad2 = (n) => String(n).padStart(2, "0");
const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// O coloană tip "rotiță" — scroll cu snap, exact ca cea de la setarea orei pe iPhone.
// Funcționează la fel pe touch (swipe) și pe desktop (scroll cu mouse-ul).
function Wheel({ items, value, onChange, format }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const settled = useRef(false);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = items.indexOf(value) * ITEM_H;
    settled.current = true;
  }, []);

  const handleScroll = () => {
    if (!settled.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.min(items.length - 1, Math.max(0, Math.round(ref.current.scrollTop / ITEM_H)));
      ref.current.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
      if (items[idx] !== value) onChange(items[idx]);
    }, 110);
  };

  return (
    <div ref={ref} onScroll={handleScroll} className="ntf-wheel" style={{ height: WHEEL_H, width: 64, overflowY: "scroll", scrollSnapType: "y mandatory" }}>
      <div style={{ height: PAD }} />
      {items.map((i) => (
        <div
          key={i}
          onClick={() => { ref.current.scrollTo({ top: items.indexOf(i) * ITEM_H, behavior: "smooth" }); onChange(i); }}
          style={{
            height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
            scrollSnapAlign: "center", fontSize: i === value ? 23 : 17, fontWeight: i === value ? 800 : 500,
            color: i === value ? "#fff" : "rgba(255,255,255,0.28)", fontFamily: "'DM Mono', monospace",
            transition: "color 0.15s, font-size 0.15s", cursor: "pointer",
          }}
        >
          {format(i)}
        </div>
      ))}
      <div style={{ height: PAD }} />
    </div>
  );
}

// Sheet unificat: calendar (nu se pot alege zile din trecut) + oră în format 24h
// (00–23), fără AM/PM. Se deschide la tap oriunde pe cardul din formular, nu doar
// pe o iconiță — spre deosebire de input-urile native de dată/oră din browser.
export default function DateTimePickerSheet({ initialDate, initialHour, initialMinute, onConfirm, onClose }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const base = initialDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(initialDate || null);
  const [hh, setHh] = useState(initialHour ?? 20);
  const [mm, setMm] = useState(initialMinute ?? 0);

  const today = startOfToday();
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const leadingBlanks = (monthStart.getDay() + 6) % 7; // Lu = 0 ... Du = 6
  const totalDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];
  const canGoPrev = monthStart.getFullYear() > today.getFullYear() || (monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() > today.getMonth());

  const handleConfirm = () => {
    if (!selectedDate) return;
    onConfirm(selectedDate, hh, mm);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <style>{`
        .ntf-wheel::-webkit-scrollbar { display: none; }
        .ntf-wheel { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      `}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "88vh", overflowY: "auto", background: "#0f0f12", borderRadius: "24px 24px 0 0", padding: "18px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.08)", animation: "slideUp 0.25s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>Anulează</button>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Dată și oră</div>
          <button onClick={handleConfirm} disabled={!selectedDate} style={{ background: "none", border: "none", color: selectedDate ? "#FF3366" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono', monospace", cursor: selectedDate ? "pointer" : "not-allowed" }}>Gata</button>
        </div>

        {/* Calendar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => canGoPrev && setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} disabled={!canGoPrev}
            style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: canGoPrev ? "#fff" : "rgba(255,255,255,0.15)", cursor: canGoPrev ? "pointer" : "default", fontSize: 14 }}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{capitalize(viewMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" }))}</div>
          <button onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontSize: 14 }}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", padding: "4px 0" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 22 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const disabled = day < today;
            const selected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            return (
              <button key={i} disabled={disabled} onClick={() => setSelectedDate(day)}
                style={{
                  aspectRatio: "1", borderRadius: 10,
                  border: selected ? "1px solid rgba(255,51,102,0.6)" : isToday ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                  background: selected ? "linear-gradient(135deg, #FF3366, #B44FFF)" : "transparent",
                  color: disabled ? "rgba(255,255,255,0.15)" : selected ? "#fff" : "rgba(255,255,255,0.8)",
                  fontSize: 13, fontWeight: selected ? 800 : 500, fontFamily: "'DM Sans', sans-serif",
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* Oră — format 24h (00–23), fără AM/PM */}
        <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <div style={{ position: "absolute", top: PAD, left: "50%", transform: "translateX(-50%)", width: 150, height: ITEM_H, borderRadius: 12, background: "linear-gradient(120deg, rgba(255,51,102,0.12), rgba(180,79,255,0.12))", border: "1px solid rgba(255,51,102,0.25)", pointerEvents: "none" }} />
          <Wheel items={Array.from({ length: 24 }, (_, i) => i)} value={hh} onChange={setHh} format={pad2} />
          <div style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>:</div>
          <Wheel items={Array.from({ length: 60 }, (_, i) => i)} value={mm} onChange={setMm} format={pad2} />
        </div>
      </div>
    </div>
  );
}
