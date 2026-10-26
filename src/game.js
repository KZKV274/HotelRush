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
const MAID_HOME = [[-3.35, -2.05], [-3.0, -2.4], [-3.45, -1.55], [-2.95, -1.75]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const TECH_HOME = new THREE.Vector3(-3.4, 0, -0.95);
const BACK_LANE = z => [new THREE.Vector3(-2.9, 0, -2.3), new THREE.Vector3(2.1, 0, -2.3)];
const FRONT_TURN = new THREE.Vector3(0.3, 0, 2.3);
const MID = new THREE.Vector3(1.0, 0, -0.35); // between the lift and the queue, clear of the counter

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
  mute: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6"/>',
  warn: '<path d="M12 3 2 20h20zM12 10v4M12 17v.01"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
};
export const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;

/* ---------- save ---------- */
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch {}
  // First launch: continue the career from the FrontDesk mini game (same site, same storage)
  if (!s) { try { const fd = JSON.parse(localStorage.getItem("frontdesk_game_v2") || "null"); if (fd && fd.day > 1) s = { ...fd, imported: true }; } catch {} }
  s = { day: 1, wallet: 0, best: 0, guests: 0, passed: 0, sound: true, seenHelp: false, ...(s || {}) };
  s.up = { maid: 0, speed: 0, coffee: 0, floor: 0, ...(s.up || {}) };
  return s;
}

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pick = xs => xs[Math.floor(Math.random() * xs.length)];
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

export class Game {
  constructor(world) {
    this.world = world;
    this.save = loadSave();
    sfx.setEnabled(this.save.sound);
    this.g = null;
    this.sel = null;
    this.staff = { maids: [], tech: null, receptionist: null };
    this.calls = [];
    this.bindInput();
    this.setupLobby();
    this.showHub();
  }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch {} }

  /* ---------- lobby & staff ---------- */
  setupLobby() {
    const w = this.world, night = isNight(this.save.day);
    w.setNight(night);
    w.setCoffee(this.save.up.coffee > 0);
    if (!this.staff.receptionist) {
      this.staff.receptionist = w.spawn(RECEPTIONIST, SPOT.receptionist);
      this.staff.receptionist.face(SLOTS[0].clone().add(new THREE.Vector3(0.5, 0, 0)));
    }
    const want = 2 + this.save.up.maid;
    while (this.staff.maids.length < want) {
      const i = this.staff.maids.length, a = w.spawn(MAIDS[i], MAID_HOME[i], { hat: "maid" });
      a.face(new THREE.Vector3(0, 0, 0));
      this.staff.maids.push({ actor: a, home: MAID_HOME[i], busy: false });
    }
    this.staff.maids.forEach((m, i) => { m.actor.root.visible = i < want; });
    if (!this.staff.tech) {
      const a = w.spawn(TECH, TECH_HOME, { hat: "tech" });
      a.face(new THREE.Vector3(0, 0, 1));
      this.staff.tech = { actor: a, home: TECH_HOME, busy: false };
    }
    this.staff.tech.actor.root.visible = this.save.day >= 3;
  }
  resetStaff() {
    const want = 2 + this.save.up.maid;
    for (const m of [...this.staff.maids, this.staff.tech]) {
      m.busy = false; m.actor.root.visible = m === this.staff.tech || this.staff.maids.indexOf(m) < want; m.actor.path = []; m.actor.root.position.copy(m.home); m.actor.play("idle"); m.actor.face(new THREE.Vector3(0, 0, 0));
    }
    this.staff.tech.actor.root.visible = this.save.day >= 3;
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
    rooms.forEach(r => { if (Math.random() < (night ? 0.45 : 0.4)) Object.assign(r, { state: "occupied", from: -30, until: night ? 999 : 4 + Math.random() * 40 }); });
    this.g = {
      day, night, goal: goalFor(day), t: 0, money: 0, stars: 5, served: 0, checkouts: 0, answers: 0, upgrades: 0, vips: 0, fixes: 0, lost: 0, streak: 0,
      nextSpawn: 1.2, nextIssue: 20, asked: new Set(), paused: false, over: false,
      rooms, desk: [], pendingOut: [], maxMaids: 2 + this.save.up.maid, clean: cleanTime(this.save.up.speed), coffee: coffeeMul(this.save.up.coffee),
      msg: night ? "Ночь: почти все спят, заездов мало, зато вопросы странные" : "Нажми на гостя, потом на подходящий номер",
    };
    this.calls = [];
    this.sel = null;
    this.world.setMenuView(false);
    this.closeOverlay();
    this.renderHud(); this.renderPanel();
  }
  clearGuests() {
    if (this.g) this.g.desk.forEach(x => x.actor.remove());
    for (const a of [...this.world.actors]) if (a.isGuest) a.remove();
    this.calls.forEach(c => c.label && c.label.remove());
    this.calls = [];
  }
  get active() { return this.g && !this.g.over && !this.g.paused && !this.question; }

  patience() {
    const g = this.g, p = Math.min(1, g.t / SHIFT);
    return (24 - 9 * p) * Math.max(0.8, 1 - 0.02 * (g.day - 1)) * g.coffee * (g.night ? 1.3 : 1);
  }

  tick(dt) {
    const g = this.g;
    if (!this.active) return;
    g.t += dt;
    let panel = false;
    for (const r of g.rooms) {
      if (r.state === "occupied" && !r.due && g.t >= r.until) { r.due = true; g.pendingOut.push(r.num); panel = true; }
      if (r.state === "cleaning" && g.t >= r.until) { r.state = "free"; panel = true; }
      if (r.fixUntil && g.t >= r.fixUntil) { r.fixUntil = 0; r.issue = ""; g.fixes++; g.money += 10; this.flash(`В ${r.num} всё починили, гость благодарит (+10)`); panel = true; }
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
      g.nextSpawn = g.t + ((6 - 3.5 * p) * diff + Math.random() * 1.5) * (g.night ? 1.7 : 1);
    }
    if (g.day >= 3 && g.t >= g.nextIssue) {
      const cand = g.rooms.filter(r => r.state === "occupied" && !r.due && !r.issue);
      if (cand.length && this.calls.length < MAX_CALLS) { this.addCall(pick(cand)); panel = true; }
      g.nextIssue = g.t + (14 + Math.random() * 14) * (g.night ? 1.5 : 1);
    }
    if (g.stars <= 0 || g.t >= SHIFT) return this.finish();
    if (panel) this.renderPanel();
    this.updateLive();
  }

  /* ---------- guests ---------- */
  spawnNew() {
    const g = this.g;
    if (Math.random() < (g.night ? 0.4 : 0.18)) {
      const pool = g.night ? NIGHT_QUESTIONS : QUESTIONS;
      let i = Math.floor(Math.random() * pool.length);
      for (let k = 0; k < pool.length && g.asked.has(i); k++) i = (i + 1) % pool.length;
      g.asked.add(i);
      return this.spawnGuest({ kind: "ask", q: pool[i][0], answers: pool[i][1] });
    }
    let r = Math.random() * Object.values(WEIGHT).reduce((a, b) => a + b, 0), type = "twin";
    for (const [k, w] of Object.entries(WEIGHT)) { if ((r -= w) <= 0) { type = k; break; } }
    this.spawnGuest({ kind: "in", type, vip: g.day >= 2 && Math.random() < 0.12 });
  }
  spawnGuest(spec) {
    const g = this.g, slot = g.desk.length;
    const fromLift = spec.kind !== "in";
    const start = fromLift ? SPOT.elevator : SPOT.entrance;
    const actor = this.world.spawn(pick(GUESTS), start, { luggage: spec.kind === "ask" ? null : pick(BAG_COLORS) });
    actor.isGuest = true; actor.pickable = true;
    actor.labelLift = slot % 2 ? 34 : 0;
    const max = this.patience() * (spec.vip ? 0.55 : 1) + (spec.kind === "out" ? 4 : 0);
    const x = { id: uid(), ...spec, actor, patience: max, max, state: "arriving" };
    actor.guest = x;
    g.desk.push(x);
    if (fromLift) this.liftBlink();
    actor.walkTo(fromLift ? [SPOT.elevatorFront, MID, SLOTS[slot]] : [SPOT.door, FRONT_TURN, SLOTS[slot]], () => this.arrived(x));
    this.labelGuest(x);
  }
  arrived(x) {
    if (x.state !== "arriving") return;
    x.state = "waiting";
    x.actor.face(SPOT.receptionist);
  }
  labelGuest(x) {
    const tag = x.kind === "in" ? `${x.vip ? ic("crown", "gold") : ""}<b>${TYPE_SHORT[x.type]}</b>` : x.kind === "out" ? `${ic("bag")}<b>${x.room}</b>` : `<b class="q">?</b>`;
    const el = x.actor.setLabel(`<span class="tag">${tag}</span><i class="pat"><i></i></i>`, `k-${x.kind} ${x.vip ? "vip" : ""} ${this.sel === x.id ? "sel" : ""}`);
    el.dataset.guest = x.id;
    x.patEl = el.querySelector(".pat i");
  }
  // Move everybody to their place in the queue after someone leaves
  reflow() {
    this.g.desk.forEach((x, i) => {
      const target = SLOTS[i], a = x.actor;
      a.labelLift = i % 2 ? 34 : 0;
      if (x.state === "arriving" && a.path.length) a.path[a.path.length - 1] = target.clone();
      else if (a.root.position.distanceTo(target) > 0.05) { x.state = x.state === "waiting" ? "waiting" : x.state; a.walkTo(target, () => a.face(SPOT.receptionist)); }
    });
  }
  removeFromDesk(x) {
    this.g.desk = this.g.desk.filter(y => y !== x);
    if (this.sel === x.id) this.select(null);
    x.state = "leaving";
    x.actor.pickable = false;
    x.actor.clearLabel();
    this.reflow();
  }
  exitTo(x, where, run = false) {
    const a = x.actor;
    const path = where === "lift" ? [MID, SPOT.elevatorFront, SPOT.elevator] : [FRONT_TURN, SPOT.door, SPOT.entrance];
    a.walkTo(path, () => { if (where === "lift") this.liftBlink(); a.remove(); }, run ? 3 : undefined);
  }
  leaveAngry(x) {
    const g = this.g, pos = x.actor.screenPos(0.9);
    this.removeFromDesk(x);
    if (x.kind === "out") Object.assign(g.rooms.find(r => r.num === x.room), { state: "dirty", due: false, issue: "", fixUntil: 0 });
    this.lose(x.vip ? 2 : 1, x.kind === "out" ? `Гость из ${x.room} ушёл, не дождавшись выезда` : x.vip ? "VIP-гость ушёл — минус две звезды!" : "Гость ушёл недовольным — минус звезда", pos);
    x.actor.play("emote-no", { once: true, then: () => this.exitTo(x, x.kind === "ask" ? "lift" : "out", true) });
  }
  lose(stars, msg, pos) {
    const g = this.g;
    g.stars -= stars; g.lost++; g.streak = 0;
    this.flash(msg, "bad");
    if (pos) this.fx(pos, `−${stars}★`, "bad");
    sfx.angry(); vibrate(120);
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
  }
  select(id) {
    this.sel = id;
    const x = this.g && this.g.desk.find(y => y.id === id);
    this.world.selected = x ? x.actor : null;
    if (this.g) this.g.desk.forEach(y => this.labelGuest(y));
    this.renderPanel();
  }
  canFit(x) { return this.g.rooms.some(r => r.state === "free" && (r.type === x.type || r.type === "suite")); }
  tapRoom(num) {
    const g = this.g;
    if (!g || g.over) return;
    const room = g.rooms.find(r => r.num === num), x = g.desk.find(y => y.id === this.sel);
    if (room.state === "dirty") return this.sendMaid(room);
    if (!x) { sfx.error(); return this.flash(room.state === "free" ? "Сначала выбери гостя в холле" : room.state === "cleaning" ? "Номер убирают" : room.issue ? `В ${num}: ${room.issue}` : "Номер занят"); }
    if (room.state !== "free") { sfx.error(); return this.flash(room.state === "cleaning" ? "Номер ещё убирают" : "Этот номер занят"); }
    if (room.type !== x.type && room.type !== "suite") { sfx.error(); return this.flash(`Гость хочет ${TYPE_SHORT[x.type]}, а это ${TYPE_SHORT[room.type]}`); }
    this.checkin(x, room);
  }
  checkin(x, room) {
    const g = this.g, upgrade = room.type === "suite" && x.type !== "suite", pay = PRICE[x.type] * (x.vip ? 3 : 1);
    const stay = g.night ? 60 + Math.random() * 60 : 22 + Math.random() * 20;
    Object.assign(room, { state: "occupied", due: false, from: g.t, until: g.t + stay, issue: "", fixUntil: 0 });
    g.money += pay; g.served++;
    if (x.vip) g.vips++;
    const pos = x.actor.screenPos(0.9);
    this.removeFromDesk(x);
    this.bossNod();
    sfx.ding(); sfx.coin(); vibrate(15);
    this.fx(pos, `+${pay}`, "coin");
    if (upgrade) { g.upgrades++; if (g.stars < 5) { g.stars++; this.fx({ x: pos.x, y: pos.y - 26 }, "+1★", "star"); } this.flash(`Апгрейд в люкс ${room.num}! Гость в восторге`, "good"); }
    else this.flash(`${x.vip ? "VIP заселён" : "Заселён"} в ${room.num}, +${pay}`, "good");
    this.served(pos);
    x.actor.play("emote-yes", { once: true, then: () => this.exitTo(x, "lift") });
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
      g.money += 15; g.answers++; sfx.coin(); this.fx(pos, "+15", "coin");
      this.flash("Отличный ответ! +15", "good"); this.served(pos);
      x.actor.play("emote-yes", { once: true, then: () => this.exitTo(x, "lift") });
    } else {
      this.lose(1, `Лучше было: «${x.answers[0]}»`, pos);
      x.actor.play("emote-no", { once: true, then: () => this.exitTo(x, "lift") });
    }
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
    const path = [...BACK_LANE(), SPOT.elevator];
    const walk = this.pathTime(maid.actor, path);
    Object.assign(room, { state: "cleaning", from: g.t, until: g.t + walk + g.clean });
    sfx.tap();
    this.flash(`Горничная пошла в ${room.num}`);
    maid.actor.walkTo(path, () => {
      this.liftBlink(); maid.actor.root.visible = false;
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
    this.liftBlink();
    member.actor.root.position.copy(SPOT.elevator);
    member.actor.walkTo([new THREE.Vector3(2.1, 0, -2.3), new THREE.Vector3(-2.9, 0, -2.3), member.home], () => { member.busy = false; member.actor.face(new THREE.Vector3(0, 0, 0)); });
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
    const path = [new THREE.Vector3(-2.9, 0, -2.3), new THREE.Vector3(2.1, 0, -2.3), SPOT.elevator];
    room.fixUntil = g.t + this.pathTime(tech.actor, path) + FIX;
    this.bossNod(); sfx.tap();
    this.flash(`Техник пошёл в ${c.room}: ${c.text}`);
    tech.actor.walkTo(path, () => { this.liftBlink(); tech.actor.root.visible = false; this.after(FIX, () => this.comeBack(tech)); });
    this.renderPanel();
  }
  liftBlink() {
    const l = this.world.elevatorLight;
    l.material.color.set(0x5ee0a8);
    clearTimeout(this.liftT); this.liftT = setTimeout(() => l.material.color.set(0xffb547), 700);
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
    if (g.passed) { this.save.day++; this.save.passed++; }
    this.persist();
    this.select(null);
    g.passed ? sfx.fanfare() : sfx.fail();
    this.renderHud(); this.renderPanel();
    this.showResult();
  }

  /* ---------- interface ---------- */
  flash(msg, tone = "") { if (this.g) { this.g.msg = msg; this.g.msgTone = tone; } const el = $("#msg"); if (el) { el.textContent = msg; el.className = "msg " + tone; } }
  fx(pos, text, cls) {
    const el = document.createElement("div");
    el.className = "fx " + cls; el.textContent = text;
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
  }
  roomTile(r, sel) {
    const g = this.g;
    const fits = sel && r.state === "free" && (r.type === sel.type || r.type === "suite");
    const label = { free: "Свободен", occupied: r.due ? "Выезжает" : r.until > 900 ? "Спят" : "Занят", dirty: "Грязный", cleaning: "Уборка" }[r.state];
    const icon = { free: ic("check"), occupied: r.due ? ic("bag") : ic("bed"), dirty: ic("broom"), cleaning: ic("broom") }[r.state];
    let bar = "";
    if (r.state === "occupied" && r.until < 900 && !r.due) bar = `<i class="bar"><i id="rb-${r.num}" style="width:${Math.max(0, (r.until - g.t) / (r.until - r.from) * 100)}%"></i></i>`;
    if (r.state === "cleaning") bar = `<i class="bar clean"><i id="rb-${r.num}" style="width:${Math.min(100, (g.t - r.from) / (r.until - r.from) * 100)}%"></i></i>`;
    const badge = r.fixUntil ? `<span class="badge">${ic("wrench")}</span>` : r.issue ? `<span class="badge warn">${ic("warn")}</span>` : "";
    return `<button class="room st-${r.state} ${r.due ? "due" : ""} ${fits ? "fits" : ""}" data-room="${r.num}">
      <span class="rn">${r.num}</span><span class="rt">${TYPE_SHORT[r.type]}</span><span class="rs">${icon}${label}</span>${badge}${bar}</button>`;
  }
  // Every frame: timers, patience bars, labels for phone calls
  updateLive() {
    const g = this.g;
    const t = $("#hudTime"); if (t) t.innerHTML = `${ic("clock")} ${mmss(SHIFT - g.t)}`;
    for (const x of g.desk) if (x.patEl) { const p = Math.max(0, x.patience / x.max * 100); x.patEl.style.width = p + "%"; x.patEl.className = p < 30 ? "low" : ""; }
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
  showHub() {
    const s = this.save, night = isNight(s.day);
    this.g = null; this.clearGuests(); this.setupLobby(); this.resetStaff();
    this.world.setMenuView(true);
    this.decorGuests();
    this.renderHud(); this.renderPanel();
    const ups = Object.entries(UPGRADES).map(([k, u]) => {
      const l = s.up[k], price = u.prices[l], max = price === undefined;
      return `<div class="up"><span class="up-ic">${ic(u.icon)}</span><div class="up-body"><b>${u.name}</b><small>${u.now(l)}${max ? " · максимум" : ` → ${u.next(l)}`}</small><span class="lvl">${u.prices.map((_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</span></div>
        ${max ? `<span class="up-max">${ic("check")}</span>` : `<button class="btn small ${s.wallet < price ? "ghost" : ""}" data-buy="${k}" ${s.wallet < price ? "disabled" : ""}>${ic("coin")} ${price}</button>`}</div>`;
    }).join("");
    this.overlay(`<div class="sheet hub">
      <div class="brand">Hotel <b>Rush</b></div>
      <div class="day-card ${night ? "night" : ""}">
        <div class="day-kind">${night ? ic("moon") + " Ночная смена" : ic("sun") + " Дневная смена"}</div>
        <div class="day-num">День ${s.day}</div>
        <p>${night ? "Почти все гости спят, заездов мало, зато вопросы странные." : "Утром выезды, днём заезды."}${s.day === 2 ? " Сегодня впервые приедут VIP-гости." : s.day === 3 ? " С сегодняшнего дня гости звонят с жалобами." : ""}</p>
        <div class="goal-line">${ic("trophy")} Цель смены: <b>${goalFor(s.day)}</b> ${ic("coin")}</div>
        <button class="btn big" data-a="start">Начать смену</button>
      </div>
      <div class="wallet"><span>${ic("coin")} Кошелёк: <b>${s.wallet}</b></span><span>Рекорд смены: <b>${s.best}</b></span></div>
      ${s.imported ? `<p class="note">Карьера продолжена из мини-игры FrontDesk.</p>` : ""}
      <h3>Улучшения отеля</h3>
      <div class="ups">${ups}</div>
      <details class="help" ${s.seenHelp ? "" : "open"}><summary>Как играть</summary><ul>
        <li><b>Заселение.</b> Нажми на гостя в холле (или на облачко над ним), потом на подсвеченный номер его типа: TWN, DBL, FAM или LUX. Люкс подходит всем — это апгрейд и +звезда.</li>
        <li><b>VIP</b> с короной (со 2-го дня) платит втрое, но ждёт недолго. Ушёл — минус две звезды.</li>
        <li><b>Выезд.</b> Гость с чемоданом спускается на лифте — нажми на него, получишь чаевые. Номер станет грязным.</li>
        <li><b>Уборка.</b> Нажми на грязный номер — горничная (в белой шапочке) поедет убирать.</li>
        <li><b>Звонок</b> (с 3-го дня) — жалоба из номера. Нажми на него, техник (в каске) пойдёт чинить.</li>
        <li><b>?</b> — вопрос гостя: выбери правильный ответ.</li>
        <li>Нет подходящего номера — выбери гостя и нажми «Извиниться». Звезда не снимается.</li>
        <li>6 гостей подряд без потерь возвращают звезду. 0 звёзд — смена провалена.</li>
        <li>Каждая третья смена — ночная.</li>
      </ul></details>
      <div class="foot"><button class="link" data-a="sound">${s.sound ? ic("sound") + " Звук включён" : ic("mute") + " Звук выключен"}</button><button class="link" data-a="reset">Начать карьеру заново</button></div>
      <p class="note">Модели персонажей и мебели: Kenney.nl (CC0).</p>
    </div>`, "hub-ov");
    if (!s.seenHelp) { s.seenHelp = true; this.persist(); }
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
    this.overlay(`<div class="sheet small-card"><h2>Пауза</h2><p class="note">Время смены остановлено.</p>
      <button class="btn big" data-a="resume">Продолжить</button><button class="btn ghost" data-a="quit">Закончить смену</button></div>`, "center");
  }
  showResult() {
    const g = this.g;
    const head = g.failed ? "Гости разбежались…" : g.passed ? (g.record ? "День пройден! Новый рекорд!" : `День ${g.day} пройден!`) : "Цель не выполнена";
    const sub = g.failed ? `В кошелёк идёт только половина: ${g.earned}. День придётся повторить.` : g.passed ? `В кошелёк: +${g.earned}. Загляни в улучшения!` : `Заработано ${g.money} из ${g.goal}. Деньги в кошельке, день повторится.`;
    this.overlay(`<div class="sheet small-card result ${g.passed ? "win" : "lose"}">
      <div class="res-ic">${g.passed ? ic("trophy") : ic("warn")}</div>
      <h2>${head}</h2><p class="note">${sub}</p>
      <div class="res-grid">
        <div><span>Заработано</span><b>${g.money}</b></div>
        <div><span>Рейтинг</span><b class="stars">${[0, 1, 2, 3, 4].map(i => ic("star", i < g.stars ? "on" : "off")).join("")}</b></div>
        <div><span>Заселено</span><b>${g.served}${g.vips ? ` <small>(VIP ${g.vips})</small>` : ""}</b></div>
        <div><span>Выездов</span><b>${g.checkouts}</b></div>
        <div><span>Апгрейдов</span><b>${g.upgrades}</b></div>
        <div><span>Ответов / починок</span><b>${g.answers} / ${g.fixes}</b></div>
      </div>
      <button class="btn big" data-a="hub">Дальше</button>
    </div>`, "center");
  }
  buy(k) {
    const u = UPGRADES[k], price = u.prices[this.save.up[k]];
    if (price === undefined || this.save.wallet < price) return;
    this.save.wallet -= price; this.save.up[k]++; this.persist();
    sfx.coin();
    this.showHub();
  }

  /* ---------- input ---------- */
  bindInput() {
    document.addEventListener("click", e => {
      const q = s => e.target.closest(s);
      let el;
      if ((el = q("[data-guest]"))) { const x = this.g && this.g.desk.find(y => y.id === el.dataset.guest); if (x) this.tapGuest(x); return; }
      if ((el = q("[data-call]"))) { const c = this.calls.find(y => y.id === el.dataset.call); if (c) this.tapCall(c); return; }
      if ((el = q("[data-room]"))) return this.tapRoom(el.dataset.room);
      if ((el = q("[data-answer]"))) return this.answer(Number(el.dataset.answer));
      if ((el = q("[data-buy]"))) return this.buy(el.dataset.buy);
      if ((el = q("[data-a]"))) {
        const a = el.dataset.a;
        if (a === "start") { sfx.ding(); return this.start(); }
        if (a === "pause" && this.g) { this.g.paused = true; return this.showPause(); }
        if (a === "resume" && this.g) { this.g.paused = false; return this.closeOverlay(); }
        if (a === "quit" && this.g) { this.g.paused = false; return this.finish(); }
        if (a === "hub") return this.showHub();
        if (a === "decline") return this.decline();
        if (a === "sound") { this.save.sound = !this.save.sound; sfx.setEnabled(this.save.sound); this.persist(); return this.showHub(); }
        if (a === "reset") {
          if (!confirm("Начать карьеру заново? День, кошелёк и улучшения обнулятся. Рекорд сохранится.")) return;
          this.save = { ...loadSave(), day: 1, wallet: 0, guests: 0, passed: 0, imported: false, up: { maid: 0, speed: 0, coffee: 0, floor: 0 } };
          this.persist(); return this.showHub();
        }
      }
    });
    // Tapping a character in the 3D scene works like tapping its bubble
    $("#scene").addEventListener("click", e => {
      if (!this.g || this.g.over) return;
      const a = this.world.pick(e.clientX, e.clientY);
      if (a && a.guest) this.tapGuest(a.guest);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" && this.g && !this.g.over && !this.g.paused && !this.question) { this.g.paused = true; this.showPause(); }
    });
  }
}
