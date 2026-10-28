/* Hotel Rush gameplay: career, shifts, guests and staff in the 3D lobby, and the interface around it */
import * as THREE from "three";
import { SPOT, SLOTS, CHARS } from "./world.js";
import { FLOORS, TYPE_SHORT, TYPE_NAME, PRICE, WEIGHT, ISSUES, QUESTIONS, NIGHT_QUESTIONS } from "./data.js";
import * as sfx from "./sound.js";

const SAVE_KEY = "hotelrush_save";
const SHIFT = 150, DESK = 4, FIX = 5, MAX_CALLS = 2;
const RECEPTIONIST = "male-e", TECH = "male-f", MAIDS = ["female-b", "female-d", "female-a", "female-f"];
const GUESTS = CHARS.filter(c => c !== RECEPTIONIST);
const BAG_COLORS = [0xc0392b, 0x2e86de, 0x27ae60, 0x8e44ad, 0xf39c12, 0x34495e, 0xe84393];
const V = (x, z) => new THREE.Vector3(x, 0, z);
const MAID_HOME = [[-3.35, -2.05], [-3.0, -2.45], [-3.45, -1.55], [-2.95, -1.8]].map(([x, z]) => V(x, z));
const TECH_HOME = V(-3.4, -0.85);
const BACK_LANE = [V(-2.9, -2.3), V(2.0, -2.3)];
const FRONT_TURN = V(0.3, 2.3);
const MID = V(1.0, -0.35); // between the lift and the queue, clear of the counter
const SIDEWALK_N = V(5.1, -6), SIDEWALK_S = V(5.1, 6.5), TAXI_DOOR = V(6.05, 2.4);

const cleanTime = l => [7, 5.5, 4][l];
const coffeeMul = l => [1, 1.2, 1.4][l];
export const UPGRADES = {
  maid: { icon: "broom", name: "Ещё горничная", now: l => `Горничных: ${2 + l}`, next: l => `станет ${3 + l}`, prices: [900, 2000] },
  speed: { icon: "bolt", name: "Быстрая уборка", now: l => `Уборка ${String(cleanTime(l)).replace(".", ",")} с`, next: l => `станет ${String(cleanTime(l + 1)).replace(".", ",")} с`, prices: [700, 1600] },
  coffee: { icon: "cup", name: "Кофемашина в лобби", now: l => (l ? `Терпение +${l * 20}%` : "Нет"), next: l => `терпение гостей +${(l + 1) * 20}%`, prices: [800, 1800] },
  floor: { icon: "building", name: "Новый этаж", now: l => `Номеров: ${8 + 4 * l}`, next: l => `станет ${12 + 4 * l}`, prices: [1200, 2600] },
};
const isNight = day => day % 3 === 0;
const goalFor = day => Math.round((isNight(day) ? 280 + 65 * (day - 1) : 450 + 170 * (day - 1)) / 10) * 10;

// Achievements: id, title, description, test against the career save
const ACHIEVEMENTS = [
  ["first", "Добро пожаловать", "Заселить первого гостя", s => s.stats.served >= 1],
  ["g50", "Гостеприимный", "Заселить 50 гостей", s => s.stats.served >= 50],
  ["g250", "Легенда ресепшена", "Заселить 250 гостей", s => s.stats.served >= 250],
  ["vip10", "Для особых гостей", "Заселить 10 VIP", s => s.stats.vips >= 10],
  ["up25", "Щедрый апгрейд", "25 раз заселить в люкс не-люксового гостя", s => s.stats.upgrades >= 25],
  ["smart", "Знаток отеля", "Правильно ответить на 50 вопросов", s => s.stats.answers >= 50],
  ["fixer", "Мастер на все руки", "Починить 30 поломок", s => s.stats.fixes >= 30],
  ["perfect", "Пять звёзд", "Пройти смену, не потеряв ни одной звезды", s => s.stats.perfect >= 1],
  ["owl", "Сова", "Пройти ночную смену", s => s.stats.nights >= 1],
  ["day10", "Ветеран", "Дойти до 10-го дня", s => s.day >= 10],
  ["rich", "Магнат", "Накопить 10 000 в кошельке", s => s.wallet >= 10000],
  ["full", "Отель мечты", "Купить все улучшения", s => Object.entries(UPGRADES).every(([k, u]) => s.up[k] >= u.prices.length)],
];

/* ---------- icons ---------- */
const P = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5h4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  broom: '<path d="M14 3l-4 9M7 12h7l2 9H5z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L13 18l-3 3-4-4 3-3 6.7-6.7a4 4 0 0 0-1-1z"/>',
  bag: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V5h6v3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  cup: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 2v3M12 2v3"/>',
  building: '<path d="M4 21V5l8-3 8 3v16M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3M7 12a2 2 0 1 0 0-.1"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6"/>',
  music: '<path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z"/>',
  vibe: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>',
  gfx: '<path d="M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10"/>',
  warn: '<path d="M12 3 2 20h20zM12 10v4M12 17v.01"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
  heart: '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>',
  angry: '<path d="M7 17a5 5 0 1 1 1-9.9A6 6 0 0 1 19 9a4 4 0 0 1-1 8zM9 12l2 1M15 12l-2 1M10 15h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
};
export const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;

/* ---------- save ---------- */
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch {}
  // First launch: continue the career from the FrontDesk mini game (same site, same storage)
  if (!s) { try { const fd = JSON.parse(localStorage.getItem("frontdesk_game_v2") || "null"); if (fd && fd.day > 1) s = { ...fd, imported: true }; } catch {} }
  s = { day: 1, wallet: 0, best: 0, guests: 0, passed: 0, seenHelp: false, tutorialDone: false, ...(s || {}) };
  s.up = { maid: 0, speed: 0, coffee: 0, floor: 0, ...(s.up || {}) };
  s.settings = { sound: s.sound !== false, music: true, vibe: true, quality: "high", ...(s.settings || {}) };
  s.stats = { served: s.guests || 0, vips: 0, upgrades: 0, answers: 0, fixes: 0, perfect: 0, nights: 0, ...(s.stats || {}) };
  s.ach = { ...(s.ach || {}) };
  if (s.day > 1) s.tutorialDone = true;
  return s;
}

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pick = xs => xs[Math.floor(Math.random() * xs.length)];
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const uid = () => Math.random().toString(36).slice(2, 9);

export class Game {
  constructor(world) {
    this.world = world;
    this.save = loadSave();
    sfx.setEnabled(this.save.settings.sound);
    world.setQuality(this.save.settings.quality);
    this.g = null;
    this.sel = null;
    this.tut = null;
    this.staff = { maids: [], tech: null, receptionist: null };
    this.calls = [];
    this.bindInput();
    this.setupLobby();
    this.showHub();
  }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch {} }
  vibrate(p) { if (this.save.settings.vibe) try { navigator.vibrate && navigator.vibrate(p); } catch {} }
  musicNow() { sfx.music(this.save.settings.music && this.audioReady, isNight(this.g ? this.g.day : this.save.day)); }

  /* ---------- lobby & staff ---------- */
  setupLobby() {
    const w = this.world, night = isNight(this.save.day);
    w.setNight(night);
    w.setCoffee(this.save.up.coffee > 0);
    if (!this.staff.receptionist) {
      this.staff.receptionist = w.spawn(RECEPTIONIST, SPOT.receptionist);
      this.staff.receptionist.face(SLOTS[0].clone().add(V(0.5, 0)));
    }
    const want = 2 + this.save.up.maid;
    while (this.staff.maids.length < want) {
      const i = this.staff.maids.length, a = w.spawn(MAIDS[i], MAID_HOME[i], { hat: "maid", cart: true });
      a.face(V(0, 0));
      this.staff.maids.push({ actor: a, home: MAID_HOME[i], busy: false });
    }
    if (!this.staff.tech) {
      const a = w.spawn(TECH, TECH_HOME, { hat: "tech", toolbox: true });
      a.face(V(0, 1));
      this.staff.tech = { actor: a, home: TECH_HOME, busy: false };
    }
    w.setKeys(Array.from({ length: 8 + 4 * this.save.up.floor }, () => true));
  }
  resetStaff() {
    const want = 2 + this.save.up.maid;
    for (const m of [...this.staff.maids, this.staff.tech]) {
      m.busy = false; m.actor.path = []; m.actor.root.position.copy(m.home); m.actor.play("idle"); m.actor.face(V(0, 0));
      m.actor.root.visible = m === this.staff.tech ? this.save.day >= 3 : this.staff.maids.indexOf(m) < want;
    }
  }
  bossNod() {
    const r = this.staff.receptionist;
    r.play("interact-right", { once: true, then: () => r.play("idle") });
  }

  /* ---------- shift ---------- */
  start() {
    const day = this.save.day, night = isNight(day);
    this.clearGuests();
    this.setupLobby();
    this.resetStaff();
    const rooms = FLOORS.slice(0, 2 + this.save.up.floor).flat().map(([num, type]) => ({ num, type, state: "free", from: 0, until: 0, due: false, issue: "", fixUntil: 0 }));
    // The hotel is never empty: morning check-outs by day, sleeping guests at night
    rooms.forEach(r => { if (Math.random() < (night ? 0.45 : 0.4)) Object.assign(r, { state: "occupied", from: -30, until: night ? 999 : 6 + Math.random() * 40 }); });
    this.g = {
      day, night, goal: goalFor(day), t: 0, money: 0, stars: 5, served: 0, checkouts: 0, answers: 0, upgrades: 0, vips: 0, fixes: 0, lost: 0, streak: 0,
      nextSpawn: 1.2, nextIssue: 20, asked: new Set(), paused: false, over: false, clockAt: -1,
      rooms, desk: [], pendingOut: [], maxMaids: 2 + this.save.up.maid, clean: cleanTime(this.save.up.speed), coffee: coffeeMul(this.save.up.coffee),
      msg: night ? "Ночь: почти все спят, заездов мало, зато вопросы странные" : "Нажми на гостя, потом на подходящий номер",
    };
    this.tut = this.save.tutorialDone ? null : "pickGuest";
    this.calls = [];
    this.sel = null;
    this.world.setMenuView(false);
    this.closeOverlay();
    this.renderHud(); this.renderPanel();
    this.musicNow();
  }
  clearGuests() {
    for (const a of [...this.world.actors]) if (a.isGuest) a.remove();
    this.calls.forEach(c => c.label && c.label.remove());
    this.calls = [];
  }
  get active() { return this.g && !this.g.over && !this.g.paused && !this.question; }

  patience() {
    const g = this.g, p = Math.min(1, g.t / SHIFT);
    return (24 - 9 * p) * Math.max(0.8, 1 - 0.02 * (g.day - 1)) * g.coffee * (g.night ? 1.3 : 1) * (this.tut ? 1.4 : 1);
  }

  tick(dt) {
    const g = this.g;
    if (!this.active) return;
    g.t += dt;
    let panel = false;
    // the wall clock runs through the working hours of the shift
    if (g.t - g.clockAt > 0.5) { g.clockAt = g.t; this.world.setClock((g.night ? 20 * 60 : 8 * 60) + g.t / SHIFT * 12 * 60); }
    for (const r of g.rooms) {
      if (r.state === "occupied" && !r.due && g.t >= r.until) { r.due = true; g.pendingOut.push(r.num); panel = true; }
      if (r.state === "cleaning" && g.t >= r.until) { r.state = "free"; panel = true; if (this.tut === "clean") this.tutorial("smart"); }
      if (r.fixUntil && g.t >= r.fixUntil) { r.fixUntil = 0; r.issue = ""; g.fixes++; this.save.stats.fixes++; g.money += 10; this.flash(`В ${r.num} всё починили, гость благодарит (+10)`, "good"); panel = true; this.renderHud(); }
    }
    while (g.pendingOut.length && g.desk.length < DESK) { this.spawnGuest({ kind: "out", room: g.pendingOut.shift() }); panel = true; }
    for (const x of [...g.desk]) {
      if (x.state !== "waiting") continue;
      x.patience -= dt;
      if (x.patience <= 0) { this.leaveAngry(x); panel = true; }
    }
    for (const c of [...this.calls]) {
      c.patience -= dt;
      if (c.patience <= 0) {
        this.calls = this.calls.filter(y => y !== c); c.label.remove();
        g.rooms.find(r => r.num === c.room).issue = "";
        this.lose(1, `В ${c.room} так и не починили — минус звезда`, this.world.toScreen(SPOT.phone));
        panel = true;
      }
    }
    if (g.t >= g.nextSpawn) {
      if (g.desk.length < DESK) { this.spawnNew(); panel = true; }
      const diff = Math.max(0.65, 1 - 0.04 * (g.day - 1)), p = Math.min(1, g.t / SHIFT);
      g.nextSpawn = g.t + ((6 - 3.5 * p) * diff + Math.random() * 1.5) * (g.night ? 1.7 : 1) * (this.tut ? 1.5 : 1);
    }
    if (g.day >= 3 && g.t >= g.nextIssue) {
      const cand = g.rooms.filter(r => r.state === "occupied" && !r.due && !r.issue);
      if (cand.length && this.calls.length < MAX_CALLS) { this.addCall(pick(cand)); panel = true; }
      g.nextIssue = g.t + (14 + Math.random() * 14) * (g.night ? 1.5 : 1);
    }
    if (g.stars <= 0 || g.t >= SHIFT) return this.finish();
    if (this.tut === "pickGuest" && g.desk.some(x => x.kind === "in" && x.state === "waiting")) panel = true;
    if (this.tut === "pickGuest" || this.tut === "checkout") this.tutorialCheck();
    if (panel) this.renderPanel();
    this.updateLive();
  }

  /* ---------- tutorial for the very first shift ---------- */
  tutorial(step) {
    this.tut = step;
    if (step === "done") { this.tut = null; this.save.tutorialDone = true; this.persist(); }
    this.g && this.g.desk.forEach(x => this.labelGuest(x));
    this.renderPanel();
  }
  tutorialCheck() {
    const g = this.g;
    if (this.tut === "checkout" && !g.desk.some(x => x.kind === "out") && g.rooms.some(r => r.state === "occupied" && !r.due)) {
      // bring a check-out forward so the player sees one early
      const r = g.rooms.find(x => x.state === "occupied" && !x.due && x.until < 900);
      if (r && r.until - g.t > 4) r.until = g.t + 2;
    }
  }
  tutHint() {
    return {
      pickGuest: "Обучение 1/5 · Нажми на гостя у стойки (или на облачко над ним)",
      pickRoom: "Обучение 2/5 · Теперь нажми на подсвеченный зелёным номер — гость заселится",
      checkout: "Обучение 3/5 · Скоро спустится гость с чемоданом — нажми на него, чтобы оформить выезд",
      clean: "Обучение 4/5 · Номер стал грязным: нажми на него, горничная поедет убирать",
      smart: "Обучение 5/5 · Совет: можно сразу нажать на свободный номер — заселится подходящий гость из очереди",
    }[this.tut];
  }

  /* ---------- guests ---------- */
  spawnNew() {
    const g = this.g;
    if (!this.tut && Math.random() < (g.night ? 0.4 : 0.18)) {
      const pool = g.night ? NIGHT_QUESTIONS : QUESTIONS;
      let i = Math.floor(Math.random() * pool.length);
      for (let k = 0; k < pool.length && g.asked.has(i); k++) i = (i + 1) % pool.length;
      g.asked.add(i);
      return this.spawnGuest({ kind: "ask", q: pool[i][0], answers: pool[i][1] });
    }
    let r = Math.random() * Object.values(WEIGHT).reduce((a, b) => a + b, 0), type = "twin";
    for (const [k, w] of Object.entries(WEIGHT)) { if ((r -= w) <= 0) { type = k; break; } }
    if (this.tut) type = pick(["twin", "double"]);
    this.spawnGuest({ kind: "in", type, vip: !this.tut && g.day >= 2 && Math.random() < 0.12 });
  }
  spawnGuest(spec) {
    const g = this.g, w = this.world;
    const fromLift = spec.kind !== "in";
    const max = this.patience() * (spec.vip ? 0.55 : 1) + (spec.kind === "out" ? 4 : 0);
    const x = { id: uid(), ...spec, patience: max, max, state: "arriving" };
    g.desk.push(x);
    const go = (start, path) => {
      const actor = w.spawn(pick(GUESTS), start, { luggage: spec.kind === "ask" ? null : pick(BAG_COLORS), crown: spec.vip });
      actor.isGuest = true; actor.pickable = true; actor.guest = x;
      actor.labelLift = g.desk.indexOf(x) % 2 ? 34 : 0;
      x.actor = actor;
      this.labelGuest(x);
      // the queue may have moved while the guest was on the way
      actor.walkTo(path.concat([SLOTS[Math.max(0, g.desk.indexOf(x))]]), () => this.arrived(x));
    };
    if (fromLift) { w.liftCycle(); go(SPOT.elevator, [SPOT.elevatorFront, MID]); }
    else {
      // new guests arrive by taxi, or walk along the sidewalk
      const viaTaxi = Math.random() < 0.6 && w.taxiArrive(() => { if (this.g === g && !g.over && x.state === "arriving" && g.desk.includes(x)) go(TAXI_DOOR, [SPOT.entrance, SPOT.door, FRONT_TURN]); });
      if (!viaTaxi) { const from = Math.random() < 0.5 ? SIDEWALK_N : SIDEWALK_S; go(from, [V(5.1, 2.4), SPOT.door, FRONT_TURN]); }
    }
  }
  arrived(x) {
    if (x.state !== "arriving") return;
    x.state = "waiting";
    x.actor.face(SPOT.receptionist);
    if (this.tut === "pickGuest" || this.tut === "checkout") this.renderPanel();
  }
  labelGuest(x) {
    if (!x.actor) return;
    const tag = x.kind === "in" ? `${x.vip ? ic("crown", "gold") : ""}<b>${TYPE_SHORT[x.type]}</b>` : x.kind === "out" ? `${ic("bag")}<b>${x.room}</b>` : `<b class="q">?</b>`;
    const hint = (this.tut === "pickGuest" && x.kind === "in") || (this.tut === "checkout" && x.kind === "out");
    const el = x.actor.setLabel(`<span class="tag">${tag}</span><i class="pat"><i></i></i>`, `k-${x.kind} ${x.vip ? "vip" : ""} ${this.sel === x.id ? "sel" : ""} ${hint ? "hint" : ""}`);
    el.dataset.guest = x.id;
    x.patEl = el.querySelector(".pat i");
  }
  // Move everybody to their place in the queue after someone leaves
  reflow() {
    this.g.desk.forEach((x, i) => {
      if (!x.actor) return;
      const target = SLOTS[i], a = x.actor;
      a.labelLift = i % 2 ? 34 : 0;
      if (x.state === "arriving" && a.path.length) a.path[a.path.length - 1] = target.clone();
      else if (a.root.position.distanceTo(target) > 0.05) a.walkTo(target, () => a.face(SPOT.receptionist));
    });
  }
  removeFromDesk(x) {
    this.g.desk = this.g.desk.filter(y => y !== x);
    if (this.sel === x.id) this.select(null);
    x.state = "leaving";
    if (x.actor) { x.actor.pickable = false; x.actor.clearLabel(); }
    this.reflow();
  }
  exitTo(x, where, run = false) {
    const a = x.actor;
    if (!a) return;
    const out = Math.random() < 0.5 ? SIDEWALK_N : SIDEWALK_S;
    const path = where === "lift" ? [MID, SPOT.elevatorFront, SPOT.elevator] : [FRONT_TURN, SPOT.door, V(5.1, 2.4), out];
    if (where === "lift") setTimeout(() => this.world.liftCycle(), 900);
    a.walkTo(path, () => a.remove(), run ? 3 : undefined);
  }
  leaveAngry(x) {
    const g = this.g, pos = x.actor ? x.actor.screenPos(0.9) : null;
    this.removeFromDesk(x);
    if (x.kind === "out") Object.assign(g.rooms.find(r => r.num === x.room), { state: "dirty", due: false, issue: "", fixUntil: 0 });
    this.lose(x.vip ? 2 : 1, x.kind === "out" ? `Гость из ${x.room} ушёл, не дождавшись выезда` : x.vip ? "VIP-гость ушёл — минус две звезды!" : "Гость ушёл недовольным — минус звезда", pos, true);
    if (x.actor) x.actor.play("emote-no", { once: true, then: () => this.exitTo(x, x.kind === "ask" ? "lift" : "out", true) });
  }
  lose(stars, msg, pos, angry) {
    const g = this.g;
    g.stars -= stars; g.lost++; g.streak = 0;
    this.flash(msg, "bad");
    if (pos) { this.fx(pos, `−${stars}★`, "bad"); if (angry) this.fx({ x: pos.x + 18, y: pos.y - 18 }, ic("angry"), "emo angry"); }
    sfx.angry(); this.vibrate(120);
    this.renderHud();
  }
  served(pos) {
    const g = this.g;
    if (++g.streak < 6) return;
    g.streak = 0;
    if (g.stars < 5) { g.stars++; sfx.star(); this.fx(pos, "+1★", "star"); this.flash("Шесть гостей подряд без потерь — звезда вернулась!", "good"); this.renderHud(); }
  }

  /* ---------- actions ---------- */
  tapGuest(x) {
    const g = this.g;
    if (!g || g.over || x.state === "leaving") return;
    sfx.tap();
    if (x.kind === "out") return this.checkout(x);
    if (x.kind === "ask") return this.ask(x);
    this.select(this.sel === x.id ? null : x.id);
    if (this.tut === "pickGuest" && this.sel) this.tutorial("pickRoom");
  }
  select(id) {
    this.sel = id;
    const x = this.g && this.g.desk.find(y => y.id === id);
    this.world.selected = x && x.actor ? x.actor : null;
    if (this.g) this.g.desk.forEach(y => this.labelGuest(y));
    this.renderPanel();
  }
  fits(x, r) { return r.state === "free" && (r.type === x.type || r.type === "suite"); }
  canFit(x) { return this.g.rooms.some(r => this.fits(x, r)); }
  tapRoom(num) {
    const g = this.g;
    if (!g || g.over) return;
    const room = g.rooms.find(r => r.num === num);
    let x = g.desk.find(y => y.id === this.sel);
    if (room.state === "dirty") return this.sendMaid(room);
    // Smart check-in: tapping a free room seats the best waiting guest who fits it
    if (!x && room.state === "free") {
      const cand = g.desk.filter(y => y.kind === "in" && y.state !== "leaving" && this.fits(y, room))
        .sort((a, b) => (b.type === room.type) - (a.type === room.type) || (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || a.patience / a.max - b.patience / b.max);
      x = cand[0];
      if (!x) { sfx.error(); return this.flash(`В очереди нет гостя для ${TYPE_SHORT[room.type]}`); }
    }
    if (!x) { sfx.error(); return this.flash(room.state === "cleaning" ? "Номер убирают" : room.issue ? `В ${num}: ${room.issue}` : "Номер занят"); }
    if (room.state !== "free") { sfx.error(); return this.flash(room.state === "cleaning" ? "Номер ещё убирают" : "Этот номер занят"); }
    if (!this.fits(x, room)) { sfx.error(); return this.flash(`Гость хочет ${TYPE_SHORT[x.type]}, а это ${TYPE_SHORT[room.type]}`); }
    this.checkin(x, room);
  }
  checkin(x, room) {
    const g = this.g, upgrade = room.type === "suite" && x.type !== "suite", pay = PRICE[x.type] * (x.vip ? 3 : 1);
    const stay = g.night ? 60 + Math.random() * 60 : 22 + Math.random() * 20;
    Object.assign(room, { state: "occupied", due: false, from: g.t, until: g.t + stay, issue: "", fixUntil: 0 });
    g.money += pay; g.served++;
    this.save.stats.served++;
    if (x.vip) { g.vips++; this.save.stats.vips++; }
    const pos = x.actor ? x.actor.screenPos(0.9) : this.world.toScreen(SLOTS[0]);
    this.removeFromDesk(x);
    this.bossNod();
    sfx.ding(); sfx.coin(); this.vibrate(15);
    this.fx(pos, `+${pay}`, "coin");
    this.fx({ x: pos.x - 20, y: pos.y - 14 }, ic("heart"), "emo heart");
    if (upgrade) { g.upgrades++; this.save.stats.upgrades++; if (g.stars < 5) { g.stars++; this.fx({ x: pos.x, y: pos.y - 26 }, "+1★", "star"); } this.flash(`Апгрейд в люкс ${room.num}! Гость в восторге`, "good"); }
    else this.flash(`${x.vip ? "VIP заселён" : "Заселён"} в ${room.num}, +${pay}`, "good");
    this.served(pos);
    if (x.actor) x.actor.play("emote-yes", { once: true, then: () => this.exitTo(x, "lift") });
    if (this.tut === "pickGuest" || this.tut === "pickRoom") this.tutorial("checkout");
    else if (this.tut === "smart") this.tutorial("done");
    this.checkAchievements();
    this.renderHud(); this.renderPanel();
  }
  checkout(x) {
    const g = this.g, room = g.rooms.find(r => r.num === x.room), tip = 5 + Math.floor(Math.random() * 16);
    Object.assign(room, { state: "dirty", due: false, issue: "", fixUntil: 0 });
    this.calls.filter(c => c.room === x.room).forEach(c => { c.label.remove(); });
    this.calls = this.calls.filter(c => c.room !== x.room);
    g.money += tip; g.checkouts++;
    const pos = x.actor.screenPos(0.9);
    this.removeFromDesk(x);
    this.bossNod(); sfx.coin();
    this.fx(pos, `+${tip}`, "coin");
    this.flash(`${x.room} выехал, чаевые +${tip}. Номер нужно убрать`);
    this.served(pos);
    x.actor.play("emote-yes", { once: true, then: () => this.exitTo(x, "out") });
    if (this.tut === "checkout") this.tutorial("clean");
    this.renderHud(); this.renderPanel();
  }
  ask(x) {
    this.question = { x, order: [0, 1, 2].sort(() => Math.random() - 0.5) };
    this.bossNod();
    this.showQuestion();
  }
  answer(i) {
    const g = this.g, { x } = this.question;
    this.question = null;
    this.closeOverlay();
    const pos = x.actor.screenPos(0.9);
    this.removeFromDesk(x);
    if (i === 0) {
      g.money += 15; g.answers++; this.save.stats.answers++; sfx.coin(); this.fx(pos, "+15", "coin");
      this.flash("Отличный ответ! +15", "good"); this.served(pos);
      x.actor.play("emote-yes", { once: true, then: () => this.exitTo(x, "lift") });
    } else {
      this.lose(1, `Лучше было: «${x.answers[0]}»`, pos);
      x.actor.play("emote-no", { once: true, then: () => this.exitTo(x, "lift") });
    }
    this.checkAchievements();
    this.renderPanel();
  }
  decline() {
    const x = this.g.desk.find(y => y.id === this.sel);
    if (!x) return;
    this.removeFromDesk(x);
    this.flash("Извинились и подсказали другой отель — гость ушёл без обид");
    this.exitTo(x, "out");
    this.renderPanel();
  }
  sendMaid(room) {
    const g = this.g, maid = this.staff.maids.slice(0, g.maxMaids).find(m => !m.busy);
    if (!maid) { sfx.error(); return this.flash("Все горничные заняты — подожди"); }
    maid.busy = true;
    const path = [...BACK_LANE, SPOT.elevator];
    const walk = this.pathTime(maid.actor, path);
    Object.assign(room, { state: "cleaning", from: g.t, until: g.t + walk + g.clean });
    sfx.tap();
    this.flash(`Горничная поехала в ${room.num}`);
    maid.actor.walkTo(path, () => {
      this.world.liftCycle(); maid.actor.root.visible = false;
      this.after(g.clean, () => this.comeBack(maid));
    });
    this.renderPanel();
  }
  pathTime(actor, path) {
    let d = 0, p = actor.root.position.clone();
    for (const q of path) { d += p.distanceTo(q); p = q; }
    return d / actor.speed;
  }
  comeBack(member) {
    member.actor.root.visible = true;
    this.world.liftCycle();
    member.actor.root.position.copy(SPOT.elevator);
    member.actor.walkTo([BACK_LANE[1], BACK_LANE[0], member.home], () => { member.busy = false; member.actor.face(V(0, 0)); this.renderPanel(); });
  }
  // Game-time delay: frozen while paused
  after(sec, fn) { (this.timers ||= []).push({ at: this.g.t + sec, fn, shift: this.g }); }
  runTimers() {
    if (!this.timers || !this.g) return;
    const due = this.timers.filter(t => t.shift === this.g && this.g.t >= t.at);
    this.timers = this.timers.filter(t => !due.includes(t) && t.shift === this.g);
    due.forEach(t => t.fn());
  }

  addCall(room) {
    room.issue = pick(ISSUES);
    const max = this.patience() * 1.1;
    const c = { id: uid(), room: room.num, text: room.issue, patience: max, max };
    c.label = document.createElement("button");
    c.label.className = "bubble call";
    c.label.dataset.call = c.id;
    c.label.innerHTML = `<span class="tag">${ic("phone")}<b>${room.num}</b></span><small>${esc(room.issue)}</small><i class="pat"><i></i></i>`;
    this.world.labels.appendChild(c.label);
    c.patEl = c.label.querySelector(".pat i");
    this.calls.push(c);
    sfx.ring();
    this.flash(`Звонок из ${room.num}: ${room.issue}`);
  }
  tapCall(c) {
    const g = this.g, tech = this.staff.tech;
    if (tech.busy) { sfx.error(); return this.flash("Техник занят — подожди"); }
    tech.busy = true;
    this.calls = this.calls.filter(y => y !== c); c.label.remove();
    const room = g.rooms.find(r => r.num === c.room);
    const path = [V(-2.9, -2.3), BACK_LANE[1], SPOT.elevator];
    room.fixUntil = g.t + this.pathTime(tech.actor, path) + FIX;
    this.bossNod(); sfx.tap();
    this.flash(`Техник пошёл в ${c.room}: ${c.text}`);
    tech.actor.walkTo(path, () => { this.world.liftCycle(); tech.actor.root.visible = false; this.after(FIX, () => this.comeBack(tech)); });
    this.renderPanel();
  }

  finish() {
    const g = this.g;
    if (g.over) return;
    g.over = true; g.stars = Math.max(0, g.stars);
    g.failed = g.stars <= 0;
    g.passed = !g.failed && g.money >= g.goal;
    g.earned = g.failed ? Math.floor(g.money / 2) : g.money;
    g.record = !g.failed && g.money > this.save.best;
    this.save.wallet += g.earned; this.save.guests += g.served;
    if (g.record) this.save.best = g.money;
    if (g.passed) {
      this.save.day++; this.save.passed++;
      if (g.night) this.save.stats.nights++;
      if (g.stars === 5) this.save.stats.perfect++;
    }
    if (this.tut) { this.save.tutorialDone = true; this.tut = null; }
    this.persist();
    this.select(null);
    g.passed ? sfx.fanfare() : sfx.fail();
    this.renderHud(); this.renderPanel();
    this.showResult();
    this.checkAchievements();
  }

  checkAchievements() {
    const s = this.save, fresh = ACHIEVEMENTS.filter(([id, , , test]) => !s.ach[id] && test(s));
    if (!fresh.length) return;
    fresh.forEach(([id]) => { s.ach[id] = Date.now(); });
    this.persist();
    fresh.forEach(([, title, desc], i) => setTimeout(() => this.achToast(title, desc), 400 + i * 2600));
  }
  achToast(title, desc) {
    const el = document.createElement("div");
    el.className = "ach-toast";
    el.innerHTML = `<span class="ach-ic">${ic("trophy")}</span><div><small>Достижение</small><b>${esc(title)}</b><span>${esc(desc)}</span></div>`;
    document.body.appendChild(el);
    sfx.star();
    setTimeout(() => el.classList.add("out"), 2200);
    setTimeout(() => el.remove(), 2700);
  }

  /* ---------- interface ---------- */
  flash(msg, tone = "") { if (this.g) { this.g.msg = msg; this.g.msgTone = tone; } const el = $("#msg"); if (el && !this.tut) { el.textContent = msg; el.className = "msg " + tone; } }
  fx(pos, html, cls) {
    const el = document.createElement("div");
    el.className = "fx " + cls; el.innerHTML = html;
    el.style.left = pos.x + "px"; el.style.top = pos.y + "px";
    $("#fx").appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  renderHud() {
    const g = this.g, hud = $("#hud-top");
    if (!g) { hud.innerHTML = ""; return; }
    const pct = Math.min(100, g.money / g.goal * 100);
    hud.innerHTML = `
      <div class="hud-pill"><span id="hudTime">${ic("clock")} ${mmss(SHIFT - g.t)}</span></div>
      <div class="hud-pill money ${g.money >= g.goal ? "done" : ""}">${ic("coin")}<b>${g.money}</b><small>/ ${g.goal}</small><i class="goal"><i style="width:${pct}%"></i></i></div>
      <div class="hud-pill stars">${[0, 1, 2, 3, 4].map(i => ic("star", i < g.stars ? "on" : "off")).join("")}</div>
      <button class="hud-pill icon" data-a="pause" aria-label="Пауза">${ic("pause")}</button>
      <div class="hud-day">${g.night ? ic("moon") + " Ночная смена" : ic("sun") + " Дневная смена"} · День ${g.day}</div>`;
  }
  renderPanel() {
    const g = this.g, panel = $("#panel");
    if (!g) { panel.innerHTML = ""; panel.className = ""; return; }
    const sel = g.desk.find(y => y.id === this.sel);
    const maidsFree = this.staff.maids.slice(0, g.maxMaids).filter(m => !m.busy).length;
    let msg = g.msg, tone = g.msgTone || "";
    if (sel) { msg = this.canFit(sel) ? `${sel.vip ? "VIP платит втрое! " : ""}Гость хочет ${TYPE_SHORT[sel.type]} (${TYPE_NAME[sel.type].toLowerCase()}) — выбери номер. Люкс подойдёт всем` : `Свободных ${TYPE_SHORT[sel.type]} и люкса нет — подожди уборку или извинись`; tone = ""; }
    if (this.tut) { msg = this.tutHint(); tone = "hint"; }
    panel.className = g.night ? "night" : "";
    panel.innerHTML = `
      <div id="msg" class="msg ${tone}">${esc(msg)}</div>
      ${sel ? `<button class="decline" data-a="decline">Извиниться: мест нет</button>` : ""}
      <div class="rooms ${g.rooms.length > 8 ? "many" : ""}">${g.rooms.map(r => this.roomTile(r, sel)).join("")}</div>
      <div class="staffbar">
        <span>${ic("broom")} Горничные: ${Array.from({ length: g.maxMaids }, (_, i) => `<i class="dot ${i < maidsFree ? "on" : ""}"></i>`).join("")}</span>
        ${g.day >= 3 ? `<span>${ic("wrench")} Техник: ${this.staff.tech.busy ? "занят" : "свободен"}</span>` : ""}
        ${g.pendingOut.length ? `<span class="warn">${ic("bag")} Ждут выезда: ${g.pendingOut.length}</span>` : ""}
      </div>`;
    this.world.setKeys(g.rooms.map(r => r.state !== "occupied"));
  }
  roomTile(r, sel) {
    const g = this.g;
    const fits = sel && this.fits(sel, r);
    const hint = (this.tut === "pickRoom" && fits) || (this.tut === "clean" && r.state === "dirty");
    const label = { free: "Свободен", occupied: r.due ? "Выезжает" : r.until > 900 ? "Спят" : "Занят", dirty: "Грязный", cleaning: "Уборка" }[r.state];
    const icon = { free: ic("check"), occupied: r.due ? ic("bag") : ic("bed"), dirty: ic("broom"), cleaning: ic("broom") }[r.state];
    let bar = "";
    if (r.state === "occupied" && r.until < 900 && !r.due) bar = `<i class="bar"><i id="rb-${r.num}" style="width:${Math.max(0, (r.until - g.t) / (r.until - r.from) * 100)}%"></i></i>`;
    if (r.state === "cleaning") bar = `<i class="bar clean"><i id="rb-${r.num}" style="width:${Math.min(100, (g.t - r.from) / (r.until - r.from) * 100)}%"></i></i>`;
    const badge = r.fixUntil ? `<span class="badge">${ic("wrench")}</span>` : r.issue ? `<span class="badge warn">${ic("warn")}</span>` : "";
    return `<button class="room st-${r.state} ${r.due ? "due" : ""} ${fits ? "fits" : ""} ${hint ? "hint" : ""}" data-room="${r.num}">
      <span class="rn">${r.num}</span><span class="rt">${TYPE_SHORT[r.type]}</span><span class="rs">${icon}${label}</span>${badge}${bar}</button>`;
  }
  // Every frame: timers, patience bars, labels for phone calls
  updateLive() {
    const g = this.g;
    const t = $("#hudTime"); if (t) t.innerHTML = `${ic("clock")} ${mmss(SHIFT - g.t)}`;
    for (const x of g.desk) if (x.patEl) { const p = x.state === "arriving" ? 100 : Math.max(0, x.patience / x.max * 100); x.patEl.style.width = p + "%"; x.patEl.className = p < 30 ? "low" : ""; }
    for (const r of g.rooms) {
      const el = document.getElementById("rb-" + r.num);
      if (!el) continue;
      el.style.width = (r.state === "cleaning" ? Math.min(100, (g.t - r.from) / (r.until - r.from) * 100) : Math.max(0, (r.until - g.t) / (r.until - r.from) * 100)) + "%";
    }
    this.calls.forEach((c, i) => {
      const p = this.world.toScreen(SPOT.phone);
      c.label.style.transform = `translate(${p.x + i * 8}px, ${p.y - i * 46}px) translate(-50%, -100%)`;
      c.patEl.style.width = Math.max(0, c.patience / c.max * 100) + "%";
    });
  }

  /* ---------- overlays ---------- */
  overlay(html, cls = "") { const o = $("#overlay"); o.className = "show " + cls; o.innerHTML = html; }
  closeOverlay() { const o = $("#overlay"); o.className = ""; o.innerHTML = ""; }
  showHub(tab = "career") {
    const s = this.save, night = isNight(s.day);
    this.g = null; this.question = null; this.clearGuests(); this.setupLobby(); this.resetStaff();
    this.world.setMenuView(true);
    this.world.setClock(night ? 23 * 60 + 15 : 9 * 60 + 40);
    this.decorGuests();
    this.renderHud(); this.renderPanel();
    this.musicNow();
    const got = ACHIEVEMENTS.filter(([id]) => s.ach[id]).length;
    const ups = Object.entries(UPGRADES).map(([k, u]) => {
      const l = s.up[k], price = u.prices[l], max = price === undefined;
      return `<div class="up"><span class="up-ic">${ic(u.icon)}</span><div class="up-body"><b>${u.name}</b><small>${u.now(l)}${max ? " · максимум" : ` → ${u.next(l)}`}</small><span class="lvl">${u.prices.map((_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</span></div>
        ${max ? `<span class="up-max">${ic("check")}</span>` : `<button class="btn small ${s.wallet < price ? "ghost" : ""}" data-buy="${k}" ${s.wallet < price ? "disabled" : ""}>${ic("coin")} ${price}</button>`}</div>`;
    }).join("");
    const achs = ACHIEVEMENTS.map(([id, title, desc]) => `<div class="ach ${s.ach[id] ? "got" : ""}"><span class="ach-ic">${ic(s.ach[id] ? "trophy" : "lock")}</span><b>${esc(title)}</b><small>${esc(desc)}</small></div>`).join("");
    const toggle = (key, icon, label, on) => `<button class="tgl ${on ? "on" : ""}" data-set="${key}">${ic(icon)}<span>${label}</span><i></i></button>`;
    const tabs = `<div class="tabs">${[["career", "Смена"], ["ups", "Отель"], ["ach", `Награды <small>${got}/${ACHIEVEMENTS.length}</small>`], ["opts", "Настройки"]].map(([id, l]) => `<button class="${tab === id ? "on" : ""}" data-tab="${id}">${l}</button>`).join("")}</div>`;
    const body = {
      career: `<div class="day-card ${night ? "night" : ""}">
          <div class="day-kind">${night ? ic("moon") + " Ночная смена" : ic("sun") + " Дневная смена"}</div>
          <div class="day-num">День ${s.day}</div>
          <p>${night ? "Почти все гости спят, заездов мало, зато вопросы странные." : "Утром выезды, днём заезды."}${s.day === 2 ? " Сегодня впервые приедут VIP-гости." : s.day === 3 ? " С сегодняшнего дня гости звонят с жалобами." : ""}</p>
          <div class="goal-line">${ic("trophy")} Цель смены: <b>${goalFor(s.day)}</b> ${ic("coin")}</div>
          <button class="btn big" data-a="start">${s.tutorialDone ? "Начать смену" : "Начать первую смену"}</button>
        </div>
        <div class="wallet"><span>${ic("coin")} Кошелёк: <b>${s.wallet}</b></span><span>Рекорд смены: <b>${s.best}</b></span></div>
        <div class="statline"><span>Дней пройдено <b>${s.passed}</b></span><span>Гостей <b>${s.stats.served}</b></span><span>VIP <b>${s.stats.vips}</b></span></div>
        ${s.imported ? `<p class="note">Карьера продолжена из мини-игры FrontDesk.</p>` : ""}
        <details class="help"><summary>Как играть</summary><ul>
          <li><b>Заселение.</b> Нажми на гостя (или облачко над ним), потом на подсвеченный номер его типа. Или сразу нажми на свободный номер — заселится подходящий гость из очереди.</li>
          <li><b>Люкс</b> подходит всем — это апгрейд и +звезда.</li>
          <li><b>VIP</b> в короне (со 2-го дня) платит втрое, но ждёт недолго. Ушёл — минус две звезды.</li>
          <li><b>Выезд.</b> Гость с чемоданом спускается на лифте — нажми на него, получишь чаевые. Номер станет грязным.</li>
          <li><b>Уборка.</b> Нажми на грязный номер — горничная с тележкой поедет убирать.</li>
          <li><b>Звонок</b> (с 3-го дня) — жалоба из номера. Нажми на него, техник пойдёт чинить.</li>
          <li><b>?</b> — вопрос гостя: выбери правильный ответ.</li>
          <li>Нет подходящего номера — выбери гостя и нажми «Извиниться». Звезда не снимается.</li>
          <li>6 гостей подряд без потерь возвращают звезду. Каждая третья смена — ночная.</li>
          <li><b>Камера:</b> разведи два пальца (или колесо мыши), чтобы приблизить; потяни, чтобы сдвинуть; двойное касание — вернуть.</li>
        </ul></details>`,
      ups: `<p class="note left">Кошелёк: <b>${s.wallet}</b> ${ic("coin")}. Улучшения действуют во всех следующих сменах.</p><div class="ups">${ups}</div>`,
      ach: `<div class="achs">${achs}</div>`,
      opts: `<div class="opts">
          ${toggle("sound", "sound", "Звуки", s.settings.sound)}
          ${toggle("music", "music", "Музыка", s.settings.music)}
          ${toggle("vibe", "vibe", "Вибрация", s.settings.vibe)}
          ${toggle("quality", "gfx", s.settings.quality === "high" ? "Графика: высокая" : "Графика: экономная", s.settings.quality === "high")}
        </div>
        <p class="note left">Экономная графика выключает тени — меньше греется телефон и дольше держит батарея.</p>
        <div class="foot"><button class="link" data-a="replayTut">Пройти обучение ещё раз</button><button class="link" data-a="reset">Начать карьеру заново</button></div>
        <p class="note">Модели персонажей и мебели: Kenney.nl (CC0). 3D: three.js.</p>`,
    }[tab];
    this.overlay(`<div class="sheet hub"><div class="brand">Hotel <b>Rush</b></div>${tabs}<div class="tab-body">${body}</div></div>`, "hub-ov");
  }
  // Two guests resting on the sofa while the menu is open
  decorGuests() {
    [[1.32, 0.32], [1.88, 0.32]].forEach(([x, z], i) => {
      const a = this.world.spawn(GUESTS[(this.save.day + i * 5) % GUESTS.length], new THREE.Vector3(x, 0.12, z));
      a.isGuest = true;
      a.root.rotation.y = 0;
      a.play("sit");
    });
  }
  showQuestion() {
    const { x, order } = this.question;
    this.overlay(`<div class="sheet q-card">
      <div class="q-who">${this.g.night ? ic("moon") : ""} Гость спрашивает</div>
      <h2>«${esc(x.q)}»</h2>
      <div class="answers">${order.map(i => `<button class="btn ghost ans" data-answer="${i}">${esc(x.answers[i])}</button>`).join("")}</div>
    </div>`, "center");
  }
  showPause() {
    sfx.music(false);
    this.overlay(`<div class="sheet small-card"><h2>Пауза</h2><p class="note">Время смены остановлено.</p>
      <button class="btn big" data-a="resume">Продолжить</button><button class="btn ghost" data-a="quit">Закончить смену</button></div>`, "center");
  }
  showResult() {
    const g = this.g;
    const head = g.failed ? "Гости разбежались…" : g.passed ? (g.record ? "День пройден! Новый рекорд!" : `День ${g.day} пройден!`) : "Цель не выполнена";
    const sub = g.failed ? `В кошелёк идёт только половина: ${g.earned}. День придётся повторить.` : g.passed ? `В кошелёк: +${g.earned}. Загляни в улучшения!` : `Заработано ${g.money} из ${g.goal}. Деньги в кошельке, день повторится.`;
    this.overlay(`<div class="sheet small-card result ${g.passed ? "win" : "lose"}">
      <div class="res-ic">${g.passed ? ic("trophy") : ic("warn")}</div>
      <h2>${head}</h2>
      <div class="res-money">${ic("coin")} <b id="countUp">0</b></div>
      <div class="res-stars">${[0, 1, 2, 3, 4].map(i => `<span style="animation-delay:${0.5 + i * 0.15}s">${ic("star", i < g.stars ? "on" : "off")}</span>`).join("")}</div>
      <p class="note">${sub}</p>
      <div class="res-grid">
        <div><span>Заселено</span><b>${g.served}${g.vips ? ` <small>(VIP ${g.vips})</small>` : ""}</b></div>
        <div><span>Выездов</span><b>${g.checkouts}</b></div>
        <div><span>Апгрейдов</span><b>${g.upgrades}</b></div>
        <div><span>Ответов / починок</span><b>${g.answers} / ${g.fixes}</b></div>
      </div>
      <button class="btn big" data-a="hub">Дальше</button>
    </div>`, "center");
    // money counts up like a slot machine
    const el = $("#countUp"), t0 = performance.now(), dur = 1100;
    const step = now => { const k = Math.min(1, (now - t0) / dur); if (el.isConnected) { el.textContent = Math.round(g.money * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); } };
    requestAnimationFrame(step);
  }
  buy(k) {
    const u = UPGRADES[k], price = u.prices[this.save.up[k]];
    if (price === undefined || this.save.wallet < price) return;
    this.save.wallet -= price; this.save.up[k]++; this.persist();
    sfx.coin();
    this.checkAchievements();
    this.showHub("ups");
  }
  setting(key) {
    const st = this.save.settings;
    if (key === "quality") { st.quality = st.quality === "high" ? "low" : "high"; this.world.setQuality(st.quality); }
    else st[key] = !st[key];
    if (key === "sound") sfx.setEnabled(st.sound);
    if (key === "music") this.musicNow();
    if (key === "vibe" && st.vibe) this.vibrate(30);
    this.persist();
    this.showHub("opts");
  }

  /* ---------- input ---------- */
  bindInput() {
    // Audio may only start after the first touch
    const unlock = () => { this.audioReady = true; sfx.unlock(); this.musicNow(); document.removeEventListener("pointerdown", unlock); };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("click", e => {
      const q = s => e.target.closest(s);
      let el;
      if ((el = q("[data-guest]"))) { const x = this.g && this.g.desk.find(y => y.id === el.dataset.guest); if (x) this.tapGuest(x); return; }
      if ((el = q("[data-call]"))) { const c = this.calls.find(y => y.id === el.dataset.call); if (c) this.tapCall(c); return; }
      if ((el = q("[data-room]"))) return this.tapRoom(el.dataset.room);
      if ((el = q("[data-answer]"))) return this.answer(Number(el.dataset.answer));
      if ((el = q("[data-buy]"))) return this.buy(el.dataset.buy);
      if ((el = q("[data-tab]"))) { sfx.tap(); return this.showHub(el.dataset.tab); }
      if ((el = q("[data-set]"))) { sfx.tap(); return this.setting(el.dataset.set); }
      if ((el = q("[data-a]"))) {
        const a = el.dataset.a;
        if (a === "start") { sfx.ding(); return this.start(); }
        if (a === "pause" && this.g) { this.g.paused = true; return this.showPause(); }
        if (a === "resume" && this.g) { this.g.paused = false; this.musicNow(); return this.closeOverlay(); }
        if (a === "quit" && this.g) { this.g.paused = false; return this.finish(); }
        if (a === "hub") return this.showHub();
        if (a === "decline") return this.decline();
        if (a === "replayTut") { this.save.tutorialDone = false; this.persist(); return this.showHub("career"); }
        if (a === "reset") {
          if (!confirm("Начать карьеру заново? День, кошелёк и улучшения обнулятся. Рекорд и награды сохранятся.")) return;
          this.save = { ...this.save, day: 1, wallet: 0, guests: 0, passed: 0, imported: false, up: { maid: 0, speed: 0, coffee: 0, floor: 0 } };
          this.persist(); return this.showHub();
        }
      }
    });
    // Tapping a character in the 3D scene works like tapping its bubble
    this.world.onTap = (cx, cy) => {
      if (!this.g || this.g.over) return;
      const a = this.world.pick(cx, cy);
      if (a && a.guest) this.tapGuest(a.guest);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        sfx.music(false);
        if (this.g && !this.g.over && !this.g.paused && !this.question) { this.g.paused = true; this.showPause(); }
      } else if (!this.g || this.g.over) this.musicNow();
    });
  }
}
