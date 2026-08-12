// Sunet propriu pentru notificările din aplicație — generat direct cu Web
// Audio (nu un fișier extern), ca NightFeed să nu sune ca notificarea
// implicită a telefonului sau a altor aplicații.
let audioCtx = null;

export function playNotificationSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    // Două tonuri scurte, ascendente — un "ding" distinct, nu genericul de sistem.
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.13 },     // C6
      { freq: 1567.98, start: 0.09, dur: 0.22 }, // G6
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.22, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch {
    // best-effort — dacă Web Audio nu e disponibil, pur și simplu nu sună
  }
}
