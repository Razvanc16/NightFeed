// Sunet propriu pentru notificările din aplicație — generat direct cu Web
// Audio (nu un fișier extern), ca NightFeed să nu sune ca notificarea
// implicită a telefonului sau a altor aplicații.
let audioCtx = null;

const getCtx = () => {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
};

// Browserele blochează pornirea audio-ului până la un gest real al userului
// (tap/click) — dacă abia atunci încercăm să creăm contextul, la prima
// notificare (declanșată de un eveniment realtime, nu de un tap) rămâne
// mut. De asta îl "trezim" o singură dată, la primul tap din aplicație.
export function primeNotificationAudio() {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    // best-effort
  }
}

export async function playNotificationSound() {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") return; // tot blocat — nu are rost să programăm sunet mut

    const now = ctx.currentTime;
    // Două tonuri scurte, ascendente — un "ding" distinct, nu genericul de sistem.
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.13 },     // C6
      { freq: 1567.98, start: 0.09, dur: 0.22 }, // G6
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.22, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch {
    // best-effort — dacă Web Audio nu e disponibil, pur și simplu nu sună
  }
}
