import { useState, useEffect } from "react";

// Prag de la care aplicația trece în layout "desktop" (sidebar în stânga +
// card din feed centrat, cu butoanele de acțiune lângă el, nu suprapuse
// peste poză/video ca pe mobil) — mouse ca input principal + fereastră
// destul de lată încât sidebar + card + coloana de acțiuni să încapă
// confortabil, nu doar "are un mouse conectat".
export const DESKTOP_SIDEBAR_WIDTH = 88;
export const DESKTOP_CARD_WIDTH = 440;

export function useIsDesktopNav() {
  const [isDesktopNav, setIsDesktopNav] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (min-width: 900px)");
    setIsDesktopNav(mq.matches);
    const onChange = (e) => setIsDesktopNav(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktopNav;
}
