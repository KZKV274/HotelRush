/* Hotel Rush 3D world: the lobby and the street outside, animated characters, labels that follow them, camera gestures */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export const CHARS = ["male-a", "male-b", "male-c", "male-d", "male-e", "male-f", "female-a", "female-b", "female-c", "female-d", "female-e", "female-f"];
const CHAR_SCALE = 1.25;
const FURN = ["kitchenBar", "kitchenBarEnd", "computerScreen", "chairDesk", "loungeSofa", "loungeChair", "tableCoffee", "pottedPlant", "plantSmall1", "plantSmall2", "plantSmall3",
  "lampRoundFloor", "rugRectangle", "rugRound", "kitchenCoffeeMachine", "sideTable", "wall", "wallWindow", "wallDoorway", "wallDoorwayWide",
  "coatRack", "trashcan", "bookcaseOpenLow", "bookcaseClosedWide", "speakerSmall", "bench", "radio", "lampWall", "lampSquareTable", "televisionModern", "cabinetTelevision"];

// Key spots of the lobby (x to the right, z towards the camera); the street is outside at x > 4
export const SPOT = {
  entrance: new THREE.Vector3(5.3, 0, 2.4),
  door: new THREE.Vector3(3.5, 0, 2.4),
  elevator: new THREE.Vector3(2.5, 0, -2.6),
  elevatorFront: new THREE.Vector3(2.5, 0, -1.8),
  staff: new THREE.Vector3(-3.3, 0, -2.0),
  receptionist: new THREE.Vector3(-1.4, 0, -1.75),
  phone: new THREE.Vector3(-0.55, 0.62, -1.25),
};
// The part of the scene that must always be on screen: staff corner, desk and queue, lift, lounge and the front door
const FIT_POINTS = [[-3.7, 0, -2.9], [-3.7, 1.3, -2.9], [3.2, 1.3, -2.9], [3.6, 0, -2.6], [-3.8, 0, 0.6], [-2.8, 0, 0.4], [4.2, 0, 2.7], [1.6, 0, 1.9]]
  .map(([x, y, z]) => new THREE.Vector3(x, y, z));
// Queue along the counter
export const SLOTS = [[-2.35, -0.62], [-1.45, -0.62], [-0.55, -0.62], [0.35, -0.62]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const TAXI_STOP = 2.4, STREET_X = 6.55;

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// Polished marble floor: alternating cream and beige slabs with soft veins and a dark inlay border
function marbleTex() {
  return canvasTex(1024, 768, (g, w, h) => {
    const s = 128;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 6; y++) {
      const light = (x + y) % 2 === 0;
      const gr = g.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
      gr.addColorStop(0, light ? "#f4ece0" : "#e3d4bd"); gr.addColorStop(1, light ? "#ebe0d0" : "#d6c4a8");
      g.fillStyle = gr; g.fillRect(x * s, y * s, s, s);
      g.strokeStyle = light ? "rgba(150,130,110,.18)" : "rgba(120,95,70,.2)";
      for (let v = 0; v < 3; v++) {
        g.lineWidth = 0.6 + rnd() * 1.2;
        g.beginPath(); let px = x * s + rnd() * s, py = y * s;
        g.moveTo(px, py);
        for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 40; py += s / 6; g.lineTo(px, py); }
        g.stroke();
      }
    }
    g.strokeStyle = "rgba(90,70,50,.35)"; g.lineWidth = 2;
    for (let x = 0; x <= 8; x++) { g.beginPath(); g.moveTo(x * s, 0); g.lineTo(x * s, h); g.stroke(); }
    for (let y = 0; y <= 6; y++) { g.beginPath(); g.moveTo(0, y * s); g.lineTo(w, y * s); g.stroke(); }
    g.strokeStyle = "#5c4330"; g.lineWidth = 10; g.strokeRect(28, 28, w - 56, h - 56);
    g.strokeStyle = "#c9a35c"; g.lineWidth = 3; g.strokeRect(40, 40, w - 80, h - 80);
  });
}
const carpetTex = () => canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = "#8e1f2b"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#d4af63"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  g.strokeStyle = "rgba(212,175,99,.35)"; g.lineWidth = 2; g.strokeRect(20, 20, w - 40, h - 40);
  g.fillStyle = "rgba(255,255,255,.04)";
  for (let x = 30; x < w - 30; x += 24) g.fillRect(x, 26, 10, h - 52);
});
const artTex = (hue) => canvasTex(256, 200, (g, w, h) => {
  g.fillStyle = `hsl(${hue},35%,86%)`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `hsla(${(hue + i * 47) % 360},55%,${45 + i * 7}%,.85)`;
    g.beginPath(); g.arc(40 + i * 45, 70 + (i % 2) * 60, 30 + i * 6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = `hsla(${hue},40%,25%,.6)`; g.fillRect(0, h - 40, w, 40);
});
const signTex = () => canvasTex(512, 128, (g) => {
  g.fillStyle = "#1d2433"; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#ffc94d"; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = "#ffc94d"; g.font = "900 64px Nunito, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("HOTEL RUSH", 256, 68);
});
const roadTex = () => canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = "#3a3f49"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = "#f1f1f1"; for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y, 6, 34);
}, [1, 6]);
const paveTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#b9b2a6"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(80,70,60,.25)"; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
}, [1, 6]);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class World {
  constructor(canvas, labels) {
    this.canvas = canvas;
    this.labels = labels;
    this.actors = new Set();
    this.view = { zoom: 1, x: 0, y: 0 };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    this.camera.position.set(9, 9.5, 9);
    this.camera.lookAt(0, 0, 0);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.anims = [];
    this.setQuality("high");
    this.lights();
    window.addEventListener("resize", () => this.resize());
    this.gestures();
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : 1));
    this.renderer.shadowMap.enabled = q === "high";
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  lights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9aa3b5, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
    this.sun.position.set(6, 11, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    // warm lamps (desk, lounge) and two street lights; they only glow at night
    this.lamps = [[-1.5, 1.1, -1.4], [2.4, 1.0, 0.4], [4.75, 1.5, -0.5], [4.75, 1.5, 4.0]].map(([x, y, z]) => {
      const l = new THREE.PointLight(0xffc27a, 0, 4.5, 1.6);
      l.position.set(x, y, z);
      this.scene.add(l);
      return l;
    });
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    const jobs = [
      ...CHARS.map(n => ["char:" + n, `models/chars/character-${n}.glb`]),
      ...FURN.map(n => ["furn:" + n, `models/furn/${n}.glb`]),
    ];
    let done = 0;
    this.assets = {};
    await Promise.all(jobs.map(([key, url]) => loader.loadAsync(url).then(g => {
      this.assets[key] = g;
      onProgress && onProgress(++done / jobs.length);
    })));
    this.clips = this.assets["char:male-a"].animations;
    this.build();
  }

  // Furniture is re-centered so every model is placed by its bottom center
  piece(name, x, z, rotY = 0, y = 0, parent = this.scene) {
    const inner = this.assets["furn:" + name].scene.clone(true);
    const b = new THREE.Box3().setFromObject(inner), c = b.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -b.min.y, -c.z);
    const g = new THREE.Group();
    g.add(inner);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    parent.add(g);
    return g;
  }

  build() {
    const S = this.scene;
    // outside: plaza, sidewalk and street
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x86b56f }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.03; this.ground.receiveShadow = true; S.add(this.ground);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 40), new THREE.MeshLambertMaterial({ map: paveTex() }));
    walk.material.map.repeat.set(1, 24);
    walk.rotation.x = -Math.PI / 2; walk.position.set(4.95, -0.015, 0); walk.receiveShadow = true; S.add(walk);
    S.add(box(0.12, 0.08, 40, mat(0x9a948a), 5.85, 0.0, 0));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 40), new THREE.MeshLambertMaterial({ map: roadTex() }));
    road.material.map.repeat.set(1, 18);
    road.rotation.x = -Math.PI / 2; road.position.set(6.85, -0.02, 0); road.receiveShadow = true; S.add(road);
    this.trees = [[5.25, -4.6], [5.25, 4.4], [8.6, -1.5], [8.6, 3.0]].map(([x, z]) => this.tree(x, z));
    this.streetLamps = [[5.6, -0.5], [5.6, 4.0]].map(([x, z]) => this.streetLamp(x, z));

    // marble floor with a border inlay, red carpet from the door
    const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 6), [mat(0xcdbfa8), mat(0xcdbfa8), new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.32, metalness: 0.05 }), mat(0xcdbfa8), mat(0xcdbfa8), mat(0xcdbfa8)]);
    floor.position.y = -0.03; floor.receiveShadow = true; S.add(floor);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.85), new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 0.9 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(2.15, 0.006, 2.4); carpet.receiveShadow = true; S.add(carpet);

    // walls: cream plaster with dark wood panelling and a gold rail
    const W = 4, D = 3;
    const tintWall = g => g.traverse(o => { if (o.isMesh && !/glass/i.test(o.material.name)) { o.material = o.material.clone(); if (/wood|default/i.test(o.material.name)) o.material.color.set(0xf1e7d6); } });
    for (let x = -W; x < W; x++) tintWall(this.piece(x === 2 ? "wallDoorwayWide" : x === -1 || x === 0 ? "wallWindow" : "wall", x + 0.5, -D, 0));
    for (let z = -D; z < D; z++) tintWall(this.piece(z === -3 ? "wallDoorway" : z === 0 || z === 1 ? "wallWindow" : "wall", -W, z + 0.5, Math.PI / 2));
    const panel = mat(0x6b4429, { roughness: 0.5 }), rail = mat(0xc9a35c, { metalness: 0.6, roughness: 0.3 });
    for (const [x0, x1] of [[-4, 1.9], [3.1, 4]]) {
      S.add(box(x1 - x0, 0.34, 0.03, panel, (x0 + x1) / 2, 0.17, -2.935));
      S.add(box(x1 - x0, 0.03, 0.04, rail, (x0 + x1) / 2, 0.355, -2.93));
    }
    for (const [z0, z1] of [[-2.05, 3]]) {
      S.add(box(0.03, 0.34, z1 - z0, panel, -3.935, 0.17, (z0 + z1) / 2));
      S.add(box(0.04, 0.03, z1 - z0, rail, -3.93, 0.355, (z0 + z1) / 2));
    }

    // glass front on the street side with the entrance gap
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const frame = mat(0x9aa3b0, { metalness: 0.7, roughness: 0.35 });
    for (const [z0, z1] of [[-3, 1.85]]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, z1 - z0), glass);
      pane.position.set(4, 0.6, (z0 + z1) / 2); S.add(pane);
      S.add(box(0.06, 0.06, z1 - z0, frame, 4, 1.22, (z0 + z1) / 2));
      S.add(box(0.06, 0.06, z1 - z0, frame, 4, 0.03, (z0 + z1) / 2));
      for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 5) S.add(box(0.035, 1.25, 0.035, frame, 4, 0.62, z));
    }
    S.add(box(0.08, 1.4, 0.08, frame, 4, 0.7, 2.95));
    // slim burgundy awning over the door
    S.add(box(0.7, 0.035, 1.05, mat(0x8e1f2b, { roughness: 0.7 }), 4.3, 1.32, 2.4));
    S.add(box(0.04, 0.06, 1.05, mat(0xd4af63, { metalness: 0.7, roughness: 0.3 }), 4.65, 1.31, 2.4));

    // elevator: frame, two sliding doors, floor indicator
    const steel = new THREE.MeshStandardMaterial({ color: 0xc3cad4, metalness: 0.75, roughness: 0.28 });
    this.liftDoors = [-1, 1].map(s => { const d = box(0.3, 0.98, 0.03, steel, 2.5 + s * 0.15, 0.49, -3.07); S.add(d); d.userData.home = d.position.x; d.userData.side = s; return d; });
    this.liftOpen = 0; this.liftTarget = 0;
    S.add(box(0.72, 0.06, 0.06, frame, 2.5, 1.0, -2.98));
    this.liftCanvas = document.createElement("canvas"); this.liftCanvas.width = 128; this.liftCanvas.height = 48;
    this.liftTex = new THREE.CanvasTexture(this.liftCanvas); this.liftTex.colorSpace = THREE.SRGBColorSpace;
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshBasicMaterial({ map: this.liftTex }));
    ind.position.set(2.5, 1.1, -2.94); S.add(ind);
    this.drawLift(1, false);

    // reception: counter, computer, phone, chair, hotel sign, clock, key board
    for (let i = 0; i < 5; i++) this.piece("kitchenBar", -2.45 + i * 0.43, -1.25, Math.PI);
    this.piece("kitchenBarEnd", -2.72, -1.25, Math.PI);
    this.piece("kitchenBarEnd", -0.13, -1.25, Math.PI);
    S.add(box(2.75, 0.03, 0.26, mat(0x2b2f3a, { roughness: 0.25 }), -1.43, 0.435, -1.27));
    this.piece("computerScreen", -1.6, -1.32, 0, 0.45);
    this.piece("radio", -0.55, -1.25, 0, 0.45);
    S.add(box(0.12, 0.12, 0.12, mat(0xffc94d, { metalness: 0.7, roughness: 0.3 }), -2.3, 0.51, -1.22)); // desk bell
    this.piece("chairDesk", -0.8, -1.8, 0);
    this.piece("bookcaseOpenLow", -2.1, -2.82, 0);
    this.piece("speakerSmall", -1.2, -2.85, 0);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex() }));
    sign.position.set(-1.5, 1.05, -2.93); S.add(sign);
    this.clockCanvas = document.createElement("canvas"); this.clockCanvas.width = this.clockCanvas.height = 128;
    this.clockTex = new THREE.CanvasTexture(this.clockCanvas); this.clockTex.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshBasicMaterial({ map: this.clockTex }));
    clock.position.set(-0.35, 1.02, -2.93); S.add(clock);
    this.setClock(8 * 60);
    this.buildKeyBoard();

    // wall decor: paintings and wall lamps
    const painting = (x, y, z, rotY, hue) => {
      const g = new THREE.Group();
      g.add(box(0.56, 0.44, 0.03, mat(0xb08a3e, { metalness: 0.5, roughness: 0.35 }), 0, 0, 0));
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), new THREE.MeshStandardMaterial({ map: artTex(hue), roughness: 0.8 }));
      art.position.z = 0.017; g.add(art);
      g.position.set(x, y, z); g.rotation.y = rotY; S.add(g);
    };
    painting(1.5, 0.82, -2.93, 0, 200);
    painting(-3.93, 0.82, 2.5, Math.PI / 2, 25);
    this.piece("lampWall", -3.3, -2.92, 0, 0.82);
    this.piece("lampWall", 3.6, -2.92, 0, 0.82);

    // staff corner and left side
    this.piece("pottedPlant", -3.6, -0.6, 0);
    this.piece("coatRack", -3.78, 0.9, Math.PI / 2);
    this.piece("bench", -3.72, 2.2, Math.PI / 2);
    this.piece("plantSmall2", -3.72, 2.75, 0, 0.47);

    // lounge
    this.piece("rugRectangle", 1.6, 0.9, 0);
    this.piece("loungeSofa", 1.6, 0.25, 0);
    this.piece("loungeChair", 0.65, 1.1, Math.PI / 2);
    this.piece("loungeChair", 2.55, 1.1, -Math.PI / 2);
    this.piece("tableCoffee", 1.6, 1.1, 0);
    this.piece("plantSmall1", 1.6, 1.12, 0, 0.23);
    this.piece("sideTable", 2.55, 0.2, 0);
    this.piece("lampSquareTable", 2.55, 0.2, 0, 0.38);
    this.piece("lampRoundFloor", 0.6, 0.2, 0);
    this.piece("cabinetTelevision", 1.6, -2.75, 0);
    this.piece("televisionModern", 1.6, -2.78, 0, 0.42);
    this.piece("pottedPlant", 3.6, -2.6, 0);
    this.piece("trashcan", 3.75, 1.3, 0);
    this.piece("rugRound", -1.5, 1.6, 0);
    this.luggageCart(3.2, 1.25);

    // coffee corner, shown after the upgrade
    this.coffee = new THREE.Group();
    this.piece("sideTable", 0.45, -2.75, 0, 0, this.coffee);
    this.piece("kitchenCoffeeMachine", 0.45, -2.75, 0, 0.38, this.coffee);
    S.add(this.coffee); this.coffee.visible = false;

    // selection ring and the taxi
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 40), new THREE.MeshBasicMaterial({ color: 0x5ee0a8, transparent: true, opacity: 0.9, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.position.y = 0.012; this.selRing.visible = false; S.add(this.selRing);
    this.taxi = this.makeTaxi(); this.taxi.visible = false; S.add(this.taxi);
    this.taxiBusy = false;
    this.resize();
  }

  tree(x, z) {
    const g = new THREE.Group();
    g.add(box(0.12, 0.5, 0.12, mat(0x7a5232), 0, 0.25, 0));
    const leaf = mat(0x4f9a52, { roughness: 0.8 });
    [[0, 0.75, 0, 0.42], [0.15, 1.0, 0.05, 0.32], [-0.12, 0.95, -0.08, 0.3]].forEach(([a, b, c, r]) => {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf); s.position.set(a, b, c); s.castShadow = true; g.add(s);
    });
    g.add(box(0.5, 0.05, 0.5, mat(0x6d665c), 0, 0.02, 0));
    g.position.set(x, 0, z); this.scene.add(g);
    return g;
  }
  streetLamp(x, z) {
    const g = new THREE.Group(), dark = mat(0x2b3140, { metalness: 0.6, roughness: 0.4 });
    g.add(box(0.06, 1.6, 0.06, dark, 0, 0.8, 0));
    g.add(box(0.3, 0.05, 0.06, dark, -0.12, 1.6, 0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffc56b, emissiveIntensity: 0 }));
    bulb.position.set(-0.25, 1.53, 0); g.add(bulb); g.userData.bulb = bulb;
    g.position.set(x, 0, z); this.scene.add(g);
    return g;
  }
  luggageCart(x, z) {
    const g = new THREE.Group(), brass = mat(0xd4af63, { metalness: 0.8, roughness: 0.25 });
    g.add(box(0.55, 0.04, 0.32, mat(0x8e1f2b), 0, 0.08, 0));
    for (const sx of [-0.25, 0.25]) g.add(box(0.03, 0.62, 0.03, brass, sx, 0.4, 0));
    g.add(box(0.55, 0.03, 0.03, brass, 0, 0.71, 0));
    g.add(box(0.2, 0.26, 0.14, mat(0x2e86de), -0.12, 0.23, 0.02));
    g.add(box(0.18, 0.2, 0.12, mat(0xc0392b), 0.12, 0.2, -0.03));
    g.position.set(x, 0, z); g.rotation.y = 0.5; this.scene.add(g);
  }
  makeTaxi() {
    const g = new THREE.Group(), yellow = mat(0xffc21a, { roughness: 0.4, metalness: 0.2 }), dark = mat(0x1d2433, { roughness: 0.2, metalness: 0.4 });
    g.add(box(0.55, 0.26, 1.15, yellow, 0, 0.22, 0));
    g.add(box(0.5, 0.22, 0.62, dark, 0, 0.45, -0.05));
    g.add(box(0.52, 0.04, 0.64, yellow, 0, 0.57, -0.05));
    g.add(box(0.2, 0.08, 0.1, mat(0xffffff, { emissive: 0x666666 }), 0, 0.63, -0.05));
    const wheel = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14), tire = mat(0x15171c);
    for (const [wx, wz] of [[-0.28, 0.38], [0.28, 0.38], [-0.28, -0.38], [0.28, -0.38]]) { const w = new THREE.Mesh(wheel, tire); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.11, wz); g.add(w); }
    g.add(box(0.5, 0.06, 0.02, mat(0xfff6d0, { emissive: 0xffe08a }), 0, 0.26, 0.58));
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  // A taxi drives up to the entrance, drops a guest and leaves
  taxiArrive(onStop) {
    if (this.taxiBusy) return false;
    this.taxiBusy = true;
    const t = this.taxi;
    t.visible = true; t.position.set(STREET_X, 0, -14); t.rotation.y = 0;
    this.tween(t.position, "z", TAXI_STOP, 1.6, () => {
      onStop && onStop();
      setTimeout(() => this.tween(t.position, "z", 16, 1.8, () => { t.visible = false; this.taxiBusy = false; }), 900);
    });
    return true;
  }
  tween(obj, key, to, dur, done) { this.anims.push({ obj, key, from: obj[key], to, dur, t: 0, done }); }

  buildKeyBoard() {
    const g = new THREE.Group();
    g.add(box(0.03, 0.46, 0.72, mat(0x5a3a24, { roughness: 0.5 }), 0, 0, 0));
    this.keys = [];
    const brass = mat(0xd4af63, { metalness: 0.8, roughness: 0.3 });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const y = 0.15 - r * 0.1, z = -0.26 + c * 0.17;
      g.add(box(0.03, 0.015, 0.015, brass, 0.02, y + 0.03, z));
      const key = new THREE.Group();
      key.add(box(0.012, 0.06, 0.02, brass, 0.03, y, z));
      key.add(box(0.012, 0.035, 0.045, mat([0xc0392b, 0x2e86de, 0x27ae60, 0x8e44ad][r]), 0.03, y - 0.045, z));
      g.add(key); this.keys.push(key);
    }
    g.position.set(-3.95, 0.82, -1.35); this.scene.add(g);
  }
  // A key hangs on the board while its room is not occupied
  setKeys(states) { this.keys?.forEach((k, i) => { k.visible = i < states.length && states[i]; }); }

  setClock(minutes) {
    const g = this.clockCanvas.getContext("2d"), m = minutes % 720;
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = "#fbf6ec"; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#b08a3e"; g.lineWidth = 8; g.stroke();
    g.fillStyle = "#1d2433";
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(64 + Math.sin(a) * 46 - 2, 64 - Math.cos(a) * 46 - 2, 4, 4); }
    const hand = (a, len, w) => { g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); g.stroke(); };
    g.strokeStyle = "#1d2433"; hand(m / 720 * Math.PI * 2, 30, 6); hand((minutes % 60) / 60 * Math.PI * 2, 44, 4);
    this.clockTex.needsUpdate = true;
  }
  drawLift(floor, moving) {
    const g = this.liftCanvas.getContext("2d");
    g.fillStyle = "#111622"; g.fillRect(0, 0, 128, 48);
    g.fillStyle = moving ? "#5ee0a8" : "#ffb547"; g.font = "bold 34px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText((moving ? "▲ " : "") + floor, 64, 26);
    this.liftTex.needsUpdate = true;
  }
  // Doors slide open, stay a moment and close
  liftCycle() {
    this.liftTarget = 1;
    this.drawLift(1 + Math.floor(Math.random() * 4), true);
    clearTimeout(this.liftT);
    this.liftT = setTimeout(() => { this.liftTarget = 0; this.drawLift(1, false); }, 1400);
  }

  setCoffee(on) { if (this.coffee) this.coffee.visible = on; }

  setNight(night) {
    this.night = night;
    document.getElementById("stage")?.classList.toggle("night", night);
    this.ground.material.color.set(night ? 0x1b2a24 : 0x86b56f);
    this.hemi.intensity = night ? 0.5 : 1.5;
    this.hemi.color.set(night ? 0x8fa8ff : 0xffffff);
    this.sun.intensity = night ? 0.22 : 1.9;
    this.sun.color.set(night ? 0x9db4ff : 0xfff1dc);
    this.lamps.forEach(l => { l.intensity = night ? 3 : 0; });
    this.streetLamps?.forEach(s => { s.userData.bulb.material.emissiveIntensity = night ? 2.5 : 0; });
  }

  /* ---------- camera ---------- */
  setMenuView(on) { this.menu = on; this.view = { zoom: 1, x: 0, y: 0 }; this.resize(); }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    // Fit the important part of the scene into the free area of the screen, whatever its shape:
    // below the top HUD during a shift, into the upper part above the menu sheet otherwise
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse, min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
    for (const p of FIT_POINTS) { const v = p.clone().applyMatrix4(inv); min.min(v); max.max(v); }
    const pad = 0.25, topPx = this.menu ? 8 : 92, areaH = this.menu ? h * 0.4 : h - topPx - 14;
    const sizeX = max.x - min.x + pad * 2, sizeY = max.y - min.y + pad * 2;
    const upp = Math.max(sizeX / w, sizeY / Math.max(60, areaH));
    const cx = (min.x + max.x) / 2, top = max.y + pad + topPx * upp + (areaH * upp - sizeY) / 2;
    this.fit = { cx, cy: top - h * upp / 2, hw: w * upp / 2, hh: h * upp / 2 };
    this.applyView();
  }
  // Player zoom and pan on top of the fitted view
  applyView() {
    if (!this.fit) return;
    const { cx, cy, hw, hh } = this.fit, v = this.view, z = v.zoom;
    const lim = (half) => half * (1 - 1 / z) + 0.4;
    v.x = Math.max(-lim(hw), Math.min(lim(hw), v.x));
    v.y = Math.max(-lim(hh), Math.min(lim(hh), v.y));
    Object.assign(this.camera, { left: cx + v.x - hw / z, right: cx + v.x + hw / z, top: cy + v.y + hh / z, bottom: cy + v.y - hh / z });
    this.camera.updateProjectionMatrix();
  }
  zoomBy(f, sx, sy) {
    const v = this.view, old = v.zoom;
    v.zoom = Math.max(1, Math.min(2.6, old * f));
    if (sx !== undefined && this.fit) {
      // keep the point under the fingers in place
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      const ox = (sx / w - 0.5) * 2 * this.fit.hw, oy = (0.5 - sy / h) * 2 * this.fit.hh;
      v.x += ox / old - ox / v.zoom; v.y += oy / old - oy / v.zoom;
    }
    if (v.zoom === 1) { v.x = 0; v.y = 0; }
    this.applyView();
  }
  // Pinch / wheel to zoom, drag to pan, double tap to reset; single taps go to onTap
  gestures() {
    const c = this.canvas, pts = new Map();
    let start = null, moved = false, lastTap = 0, pinch = null;
    c.addEventListener("pointerdown", e => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y }; moved = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.view.zoom }; moved = true; }
    });
    c.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = c.getBoundingClientRect();
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomBy(pinch.z * d / pinch.d / this.view.zoom, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (pts.size === 1 && start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > 8) moved = true;
        if (moved && this.view.zoom > 1 && this.fit) {
          const upp = this.fit.hw * 2 / r.width / this.view.zoom;
          this.view.x = start.vx - dx * upp; this.view.y = start.vy + dy * upp;
          this.applyView();
        }
      }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && start && !moved && e.type === "pointerup") {
        const now = performance.now();
        if (now - lastTap < 300) { this.view = { zoom: 1, x: 0, y: 0 }; this.applyView(); lastTap = 0; }
        else { lastTap = now; this.onTap && this.onTap(e.clientX, e.clientY); }
      }
      if (pts.size === 0) start = null;
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", e => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }

  spawn(name, pos, opts = {}) {
    const root = SkeletonUtils.clone(this.assets["char:" + name].scene);
    root.scale.setScalar(CHAR_SCALE);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const actor = new Actor(this, root, opts);
    root.position.copy(pos);
    this.scene.add(root);
    this.actors.add(actor);
    return actor;
  }

  // Screen position (CSS px inside the canvas) of a world point
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.canvas.clientWidth, y: (1 - p.y) / 2 * this.canvas.clientHeight };
  }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let best = null, bestD = Infinity;
    for (const a of this.actors) {
      if (!a.pickable || !a.root.visible) continue;
      const d = this.raycaster.ray.distanceToPoint(a.root.position.clone().add(new THREE.Vector3(0, 0.35, 0)));
      if (d < 0.45 && d < bestD) { best = a; bestD = d; }
    }
    return best;
  }

  // paused: characters freeze in place but the scene keeps rendering
  frame(paused = false) {
    const real = Math.min(0.05, this.clock.getDelta()), dt = paused ? 0 : real;
    for (const a of this.actors) a.update(dt);
    for (const an of [...this.anims]) {
      an.t = Math.min(1, an.t + real / an.dur);
      const k = an.t < 0.5 ? 2 * an.t * an.t : 1 - Math.pow(-2 * an.t + 2, 2) / 2;
      an.obj[an.key] = an.from + (an.to - an.from) * k;
      if (an.t >= 1) { this.anims.splice(this.anims.indexOf(an), 1); an.done && an.done(); }
    }
    this.liftOpen += (this.liftTarget - this.liftOpen) * Math.min(1, real * 6);
    this.liftDoors?.forEach(d => { d.position.x = d.userData.home + d.userData.side * 0.3 * this.liftOpen; });
    if (this.selected && this.selected.root.parent && this.selected.root.visible) {
      this.selRing.visible = true;
      this.selRing.position.x = this.selected.root.position.x; this.selRing.position.z = this.selected.root.position.z;
      this.selRing.scale.setScalar(1 + Math.sin(performance.now() / 180) * 0.06);
    } else this.selRing.visible = false;
    this.renderer.render(this.scene, this.camera);
    for (const a of this.actors) a.placeLabel();
    return dt;
  }
}

export class Actor {
  constructor(world, root, opts) {
    this.world = world;
    this.root = root;
    this.speed = (opts.speed || 1.6) * (0.92 + Math.random() * 0.16);
    this.pickable = false;
    this.path = [];
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const clip of world.clips) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    this.play("idle");
    if (opts.luggage) this.addLuggage(opts.luggage);
    if (opts.hat) this.addHat(opts.hat);
    if (opts.crown) this.addCrown();
    if (opts.cart) this.addCart();
    if (opts.toolbox) this.addToolbox();
    this.label = null;
  }

  play(name, { once = false, then = null, fade = 0.2 } = {}) {
    const next = this.actions[name];
    if (!next) return;
    if (this.current === next && !once) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next;
    if (once && then) {
      const onDone = e => { if (e.action === next) { this.mixer.removeEventListener("finished", onDone); then(); } };
      this.mixer.addEventListener("finished", onDone);
    }
  }

  addLuggage(color) {
    const arm = this.root.getObjectByName("arm-right");
    if (!arm) return;
    const bag = new THREE.Group();
    bag.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), mat(color)));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), mat(0x222222)); handle.position.y = 0.115; bag.add(handle);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.025, 0.085), mat(0xf5f0e6)); strap.position.y = 0.02; bag.add(strap);
    bag.traverse(o => { if (o.isMesh) o.castShadow = true; });
    bag.position.set(-0.3, -0.16, 0);
    arm.add(bag);
    this.bag = bag;
  }
  // Staff are told apart from guests by headwear: a white cap for maids, a yellow hard hat for the technician
  addHat(kind) {
    const head = this.root.getObjectByName("head");
    if (!head) return;
    const m = mat(kind === "maid" ? 0xffffff : 0xffc21a, { roughness: 0.5 });
    const hat = kind === "maid" ? new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.26), m) : new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
    hat.position.set(0, kind === "maid" ? 0.41 : 0.35, 0);
    hat.castShadow = true;
    head.add(hat);
  }
  addCrown() {
    const head = this.root.getObjectByName("head");
    if (!head) return;
    const g = new THREE.Group(), gold = mat(0xffc94d, { metalness: 0.85, roughness: 0.25, emissive: 0x4a3200 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 18, 1, true), gold); band.material.side = THREE.DoubleSide; g.add(band);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), gold); const a = i / 6 * Math.PI * 2; s.position.set(Math.sin(a) * 0.18, 0.075, Math.cos(a) * 0.18); g.add(s); }
    g.position.y = 0.42;
    head.add(g);
  }
  // Maids push a small cleaning cart in front of them
  addCart() {
    const g = new THREE.Group();
    g.add(box(0.3, 0.2, 0.22, mat(0x54a0ff), 0, 0.18, 0));
    g.add(box(0.32, 0.03, 0.24, mat(0xffffff), 0, 0.29, 0));
    g.add(box(0.1, 0.12, 0.1, mat(0xffffff), -0.07, 0.36, 0));
    g.add(box(0.1, 0.09, 0.1, mat(0xff9f43), 0.07, 0.34, 0.02));
    g.position.set(0, 0, 0.32);
    g.scale.setScalar(1 / CHAR_SCALE);
    this.root.add(g);
    this.cart = g;
  }
  addToolbox() {
    const arm = this.root.getObjectByName("arm-right");
    if (!arm) return;
    const b = box(0.18, 0.1, 0.09, mat(0xd63031, { roughness: 0.4 }), -0.3, -0.13, 0);
    arm.add(b);
  }
  dropLuggage() { if (this.bag) { this.bag.removeFromParent(); this.bag = null; } }

  walkTo(points, onArrive, speed) {
    this.path = (Array.isArray(points) ? points : [points]).map(p => p.clone());
    this.onArrive = onArrive || null;
    this.moveSpeed = (speed || this.speed);
    this.play(this.moveSpeed > 2.2 ? "sprint" : "walk");
  }
  get moving() { return this.path.length > 0; }

  face(target) {
    const d = target.clone().sub(this.root.position);
    if (d.lengthSq() > 1e-4) this.targetYaw = Math.atan2(d.x, d.z);
  }

  update(dt) {
    this.mixer.update(dt);
    if (this.path.length) {
      const pos = this.root.position, target = this.path[0];
      const d = target.clone().sub(pos); d.y = 0;
      const dist = d.length(), step = this.moveSpeed * dt;
      if (dist > 1e-3) this.targetYaw = Math.atan2(d.x, d.z);
      if (dist <= step) {
        pos.copy(target);
        this.path.shift();
        if (!this.path.length) {
          this.play("idle");
          const cb = this.onArrive; this.onArrive = null;
          cb && cb();
        }
      } else pos.addScaledVector(d.normalize(), step);
    }
    if (this.targetYaw !== undefined) {
      let diff = this.targetYaw - this.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.root.rotation.y += diff * Math.min(1, dt * 10);
    }
  }

  setLabel(html, cls = "") {
    if (!this.label) {
      this.label = document.createElement("button");
      this.label.className = "bubble";
      this.world.labels.appendChild(this.label);
    }
    this.label.className = "bubble " + cls;
    if (this.label.__html !== html) { this.label.innerHTML = html; this.label.__html = html; }
    return this.label;
  }
  clearLabel() { if (this.label) { this.label.remove(); this.label = null; } }
  placeLabel() {
    if (!this.label) return;
    this.label.style.visibility = this.root.visible ? "" : "hidden";
    const p = this.world.toScreen(this.root.position.clone().add(new THREE.Vector3(0, 1.05, 0)));
    this.label.style.transform = `translate(${p.x}px, ${p.y - (this.labelLift || 0)}px) translate(-50%, -100%)`;
  }
  screenPos(h = 0.6) { return this.world.toScreen(this.root.position.clone().add(new THREE.Vector3(0, h, 0))); }

  remove() {
    this.clearLabel();
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    this.world.actors.delete(this);
  }
}
