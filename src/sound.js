/* Tiny synthesized sound effects, no audio files needed */
let ctx = null, enabled = true;
export function setEnabled(on) { enabled = on; }
function ac() {
  if (!enabled) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq, start, dur, { type = "sine", vol = 0.18, slide = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
// Reception desk bell
export const ding = () => { tone(1568, 0, 0.9, { vol: 0.16 }); tone(3136, 0, 0.5, { vol: 0.05 }); };
export const coin = () => { tone(988, 0, 0.09, { type: "square", vol: 0.06 }); tone(1319, 0.08, 0.22, { type: "square", vol: 0.06 }); };
export const angry = () => tone(320, 0, 0.45, { type: "sawtooth", vol: 0.07, slide: -180 });
export const error = () => tone(160, 0, 0.18, { type: "square", vol: 0.06 });
export const tap = () => tone(660, 0, 0.05, { vol: 0.06 });
export const ring = () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 1180 : 1400, i * 0.07, 0.06, { type: "square", vol: 0.04 }); };
export const star = () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.25, { vol: 0.08 }));
export const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.7 : 0.2, { type: "triangle", vol: 0.12 }));
export const fail = () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.3, { type: "triangle", vol: 0.1 }));
