import { useEffect } from "react";

// Swipe de la marginea din stânga spre dreapta = back, ca pe iOS. Gestul
// trebuie să pornească aproape de marginea ecranului (nu oriunde pe pagină),
// altfel ar intra în conflict cu scroll orizontal sau alte gesturi din listă.
const EDGE_ZONE = 28; // px de la marginea stângă unde poate porni gestul
const MIN_DISTANCE = 80; // px minim tras spre dreapta ca să declanșeze back

export function useSwipeBack(ref, onBack, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !onBack) return;

    let startX = null;
    let startY = null;
    let tracking = false;

    const onTouchStart = (e) => {
      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE) { tracking = false; return; }
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };
    const onTouchMove = (e) => {
      if (!tracking || startX === null) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Dacă mișcarea e mai degrabă verticală, nu e gestul nostru — lăsăm
      // scroll-ul normal să se întâmple (la fel ca la swipe-down din comentarii).
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { tracking = false; }
    };
    const onTouchEnd = (e) => {
      if (!tracking || startX === null) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      tracking = false;
      startX = null;
      if (dx > MIN_DISTANCE && Math.abs(dy) < dx) onBack();
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
}
