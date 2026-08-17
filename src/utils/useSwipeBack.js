import { useEffect, useRef, useState } from "react";

// Swipe spre dreapta = back, ca pe Instagram/iOS. Pornește de ORIUNDE pe
// ecran (nu doar de la marginea din stânga) — zona îngustă de 28px era
// imposibil de nimerit precis pe telefon. Nu intră în conflict cu scroll-ul
// vertical al listei, fiindcă onTouchMove renunță la gest imediat ce mișcarea
// e mai degrabă verticală decât orizontală. Pagina urmărește degetul live
// (translateX) — dacă tragi destul SAU tragi rapid (flick scurt), tranziția
// se termină spre onBack; altfel sare înapoi la loc.
const DISTANCE_THRESHOLD = 70; // px — suficient tras, indiferent de viteză
const FLICK_DISTANCE = 30; // px — prag mai mic dacă gestul e rapid
const FLICK_VELOCITY = 0.55; // px/ms

export function useSwipeBack(ref, onBack, enabled = true) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const stateRef = useRef({ startX: 0, startY: 0, tracking: false, lastX: 0, lastT: 0, velocity: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !onBack) return;

    const onTouchStart = (e) => {
      const touch = e.touches[0];
      const now = Date.now();
      stateRef.current = { startX: touch.clientX, startY: touch.clientY, tracking: true, lastX: touch.clientX, lastT: now, velocity: 0 };
    };
    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (!s.tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - s.startX;
      const dy = touch.clientY - s.startY;
      // Dacă mișcarea e mai degrabă verticală, nu e gestul nostru — lăsăm
      // scroll-ul normal să se întâmple (la fel ca la swipe-down din comentarii).
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { s.tracking = false; setDragging(false); setDragX(0); return; }
      if (dx > 0) {
        const now = Date.now();
        const dt = now - s.lastT;
        if (dt > 0) s.velocity = (touch.clientX - s.lastX) / dt;
        s.lastX = touch.clientX;
        s.lastT = now;
        setDragging(true);
        setDragX(dx);
      }
    };
    const onTouchEnd = () => {
      const s = stateRef.current;
      if (!s.tracking) return;
      s.tracking = false;
      setDragging(false);
      const shouldComplete = (current) => current > DISTANCE_THRESHOLD || (current > FLICK_DISTANCE && s.velocity > FLICK_VELOCITY);
      setDragX(current => {
        if (shouldComplete(current)) {
          // Lăsăm valoarea (pagina rămâne "trasă") — onBack schimbă ecranul,
          // deci acest component se demontează oricum imediat după.
          onBack();
          return current;
        }
        return 0; // sub prag — sare înapoi la loc (tranziția CSS de mai jos animă asta)
      });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onBack, enabled]);

  return {
    dragX,
    // Stil gata de aplicat pe containerul care trebuie să urmărească degetul.
    style: {
      transform: `translateX(${dragX}px)`,
      transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.32, 0, 0.15, 1)",
    },
  };
}
