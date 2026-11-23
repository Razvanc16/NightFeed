// Adresa la care trimit userul linkurile din emailuri (confirmare, resetare,
// cod de login) și redirectul de la Google. Mereu domeniul principal în
// producție — altfel, cine intra de pe nightfeed.vercel.app (ex: PWA instalat
// de acolo) primea linkuri spre vercel.app și rămânea logat pe alt domeniu.
// Local (localhost) păstrăm originea curentă, ca testele să rămână locale.
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const SITE_URL = isLocal ? window.location.origin : "https://nightfeed.ro";
