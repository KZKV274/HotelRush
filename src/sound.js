/* Synthesized sound effects and a generative lobby-lounge music loop; no audio files needed */
let ctx = null, enabled = true;
export function setEnabled(on) { enabled = on; }
function getCtx() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}
// Browsers (iOS especially) only allow audio after a user gesture
export function unlock() {
  const c = getCtx(); if (!c) return;
  const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
}
function tone(freq, start, dur, { type = "sine", vol = 0.18, slide = 0, dest = null } = {}) {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const fxTone = (...a) => { if (enabled) tone(...a); };
// Reception desk bell
export const ding = () => { fxTone(1568, 0, 0.9, { vol: 0.16 }); fxTone(3136, 0, 0.5, { vol: 0.05 }); };
export const coin = () => { fxTone(988, 0, 0.09, { type: "square", vol: 0.06 }); fxTone(1319, 0.08, 0.22, { type: "square", vol: 0.06 }); };
export const angry = () => fxTone(320, 0, 0.45, { type: "sawtooth", vol: 0.07, slide: -180 });
export const error = () => fxTone(160, 0, 0.18, { type: "square", vol: 0.06 });
export const tap = () => fxTone(660, 0, 0.05, { vol: 0.06 });
export const ring = () => { for (let i = 0; i < 4; i++) fxTone(i % 2 ? 1180 : 1400, i * 0.07, 0.06, { type: "square", vol: 0.04 }); };
export const star = () => [784, 988, 1175, 1568].forEach((f, i) => fxTone(f, i * 0.08, 0.25, { vol: 0.08 }));
export const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => fxTone(f, i * 0.12, i === 3 ? 0.7 : 0.2, { type: "triangle", vol: 0.12 }));
export const fail = () => [392, 330, 262].forEach((f, i) => fxTone(f, i * 0.18, 0.3, { type: "triangle", vol: 0.1 }));

/* ---------- music: soft jazz chords, walking bass and brushes ---------- */
const DAY = [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]];   // Cmaj7 Am7 Dm7 G7
const NIGHT = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [55, 58, 62, 65]]; // Fmaj7 Em7 Dm7 Gm7
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let playing = false, night = false, master = null, timer = null, nextTime = 0, step = 0, noise = null;

export function music(on, isNight = false) {
  night = isNight;
  if (on === playing) return;
  const c = getCtx();
  if (on && !c) return;
  playing = on;
  if (on) {
    master = c.createGain(); master.gain.value = 0.0001;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
    master.connect(lp); lp.connect(c.destination);
    master.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 2.5);
    nextTime = c.currentTime + 0.15; step = 0;
    timer = setInterval(schedule, 100);
  } else {
    clearInterval(timer);
    if (master && c) { const m = master; m.gain.setTargetAtTime(0.0001, c.currentTime, 0.25); setTimeout(() => m.disconnect(), 1500); }
    master = null;
  }
}
function voice(freq, t, dur, type, vol, attack = 0.02) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function brush(t, vol) {
  if (!noise) { noise = ctx.createBuffer(1, 4096, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; f.type = "highpass"; f.frequency.value = 6000;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + 0.1);
}
function schedule() {
  if (!master || !ctx) return;
  const beat = night ? 0.78 : 0.6, prog = night ? NIGHT : DAY;
  while (nextTime < ctx.currentTime + 0.4) {
    const chord = prog[Math.floor(step / 4) % 4], b = step % 4;
    if (b === 0) chord.forEach((m, i) => voice(hz(m), nextTime + i * 0.012, beat * 3.9, "triangle", 0.035, 0.35));
    voice(hz(chord[0] - 12 + [0, 7, 12, 7][b]), nextTime, beat * 0.85, "sine", 0.09, 0.01);
    if (!night || b % 2) brush(nextTime + beat / 2, night ? 0.012 : 0.02);
    if (Math.random() < (night ? 0.25 : 0.35)) voice(hz(pick4(chord) + 12), nextTime + (Math.random() < 0.5 ? 0 : beat / 2), 0.5, "sine", 0.04, 0.01);
    nextTime += beat; step++;
  }
}
const pick4 = c => c[Math.floor(Math.random() * c.length)];
