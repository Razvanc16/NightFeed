import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Banner "Instalează aplicația" — pe Android/Chrome folosește promptul nativ
// (beforeinstallprompt), pe iPhone arată pașii din Safari (Apple nu oferă
// un buton programatic). Nu apare dacă aplicația rulează deja instalată,
// pe desktop, sau dacă userul l-a închis în ultimele 14 zile.

const DISMISS_KEY = "nf_install_dismissed_at";
const DISMISS_DAYS = 14;

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isTouchPhone = () => window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth < 900;

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 86400000;
  } catch { return false; }
}

const ShareGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-3px" }}>
    <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [ios] = useState(isIOS);
  const [iosSteps, setIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isTouchPhone() || recentlyDismissed()) return;

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Așteptăm puțin — nu-l aruncăm în fața userului din prima secundă.
    const t = setTimeout(() => setShow(true), 12000);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); clearTimeout(t); };
  }, []);

  // Pe Android fără promptul nativ disponibil (ex: Firefox) nu avem ce oferi.
  const canShow = show && (ios || deferred);

  const dismiss = () => {
    setShow(false);
    setIosSteps(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignorăm */ }
  };

  const install = async () => {
    if (ios) { setIosSteps(true); return; }
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === "accepted") setShow(false); else dismiss();
  };

  return (
    <AnimatePresence>
      {canShow && (
        <motion.div
          key="install"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed", left: 12, right: 12, zIndex: 9990,
            bottom: "calc(86px + env(safe-area-inset-bottom, 0px))",
            background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18,
            padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/icon-192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Pune NightFeed pe ecran</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Se deschide ca o aplicație și primești notificări.</div>
            </div>
            <button onClick={dismiss} aria-label="Închide" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 4 }}>×</button>
          </div>

          <AnimatePresence initial={false}>
            {iosSteps && (
              <motion.ol
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden", margin: "12px 0 0", padding: "0 0 0 20px", color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.7 }}
              >
                <li>Apasă <b style={{ color: "#fff" }}>Share</b> <ShareGlyph /> în bara de jos din Safari</li>
                <li>Alege <b style={{ color: "#fff" }}>Adaugă pe ecranul principal</b></li>
                <li>Apasă <b style={{ color: "#fff" }}>Adaugă</b> și deschide NightFeed de pe iconiță</li>
              </motion.ol>
            )}
          </AnimatePresence>

          {!iosSteps && (
            <button
              onClick={install}
              style={{
                marginTop: 12, width: "100%", height: 42, borderRadius: 12, border: "none", cursor: "pointer",
                background: "#fff", color: "#000", fontSize: 14, fontWeight: 600,
              }}
            >
              {ios ? "Arată-mi cum" : "Instalează"}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
