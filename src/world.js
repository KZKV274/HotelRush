/* Hotel Rush 3D world: the lobby scene, animated characters walking around, and labels that follow them */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export const CHARS = ["male-a", "male-b", "male-c", "male-d", "male-e", "male-f", "female-a", "female-b", "female-c", "female-d", "female-e", "female-f"];
const CHAR_SCALE = 1.25;
const FURN = ["kitchenBar", "kitchenBarEnd", "computerScreen", "chairDesk", "loungeSofa", "loungeChair", "tableCoffee", "pottedPlant", "plantSmall1", "plantSmall2",
  "lampRoundFloor", "rugRectangle", "rugDoormat", "kitchenCoffeeMachine", "sideTable", "wall", "wallWindow", "wallDoorway", "wallDoorwayWide", "floorFull",
  "coatRack", "trashcan", "bookcaseOpenLow", "speakerSmall", "bench", "radio"];

// Key spots of the lobby (x to the right, z towards the camera)
export const SPOT = {
  entrance: new THREE.Vector3(4.6, 0, 2.4),
  door: new THREE.Vector3(3.6, 0, 2.4),
  elevator: new THREE.Vector3(2.6, 0, -2.55),
  elevatorFront: new THREE.Vector3(2.6, 0, -1.8),
  staff: new THREE.Vector3(-3.3, 0, -2.0),
  staffDoor: new THREE.Vector3(-3.3, 0, -2.75),
  receptionist: new THREE.Vector3(-1.4, 0, -1.75),
  phone: new THREE.Vector3(-0.55, 0.62, -1.25),
  coffee: new THREE.Vector3(0.6, 0, -2.6),
};
// Queue in front of the desk: slot 0 is at the counter
// Queue along the counter; odd slots get their bubble a bit higher so bubbles never overlap
export const SLOTS = [[-2.35, -0.62], [-1.45, -0.62], [-0.55, -0.62], [0.35, -0.62]].map(([x, z]) => new THREE.Vector3(x, 0, z));
export const WAIT_SPOTS = [[1.9, -1.6], [1.5, -0.9], [2.2, -0.6], [1.1, -1.7]].map(([x, z]) => new THREE.Vector3(x, 0, z));

export class World {
  constructor(canvas, labels) {
    this.canvas = canvas;
    this.labels = labels;
    this.actors = new Set();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    this.zoom = 1.6;
    this.focus(new THREE.Vector3(0.65, 0, -0.85));
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.lights();
    window.addEventListener("resize", () => this.resize());
  }

  lights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9aa3b5, 1.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 1.8);
    this.sun.position.set(5, 10, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun);
    this.lamps = [];
    for (const [x, z] of [[-1.4, -1.2], [1.6, 0.6], [2.6, -2.2]]) {
      const l = new THREE.PointLight(0xffc27a, 0, 4, 1.6);
      l.position.set(x, 1.2, z);
      this.scene.add(l); this.lamps.push(l);
    }
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
    this.buildLobby();
  }

  // Furniture is re-centered so every model is placed by its bottom center
  piece(name, x, z, rotY = 0, y = 0) {
    const src = this.assets["furn:" + name].scene;
    const inner = src.clone(true);
    const box = new THREE.Box3().setFromObject(inner), c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -box.min.y, -c.z);
    const g = new THREE.Group();
    g.add(inner);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    return g;
  }

  buildLobby() {
    const W = 4, D = 3;
    // floor: wooden tiles plus a darker outside area so the lobby reads as a room
    const tileA = new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.55 }), tileB = new THREE.MeshStandardMaterial({ color: 0xd8c6a8, roughness: 0.55 });
    for (let x = -W; x < W; x++) for (let z = -D; z < D; z++) {
      this.piece("floorFull", x + 0.5, z + 0.5, 0, -0.05).traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = (x + z) % 2 ? tileA : tileB; } });
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x3a4152 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true;
    this.scene.add(ground); this.ground = ground;
    // back wall (z = -3) with the elevator and windows, left wall (x = -4) with the staff door
    for (let x = -W; x < W; x++) {
      const name = x === 2 ? "wallDoorwayWide" : x === -1 || x === 0 ? "wallWindow" : "wall";
      this.piece(name, x + 0.5, -D, 0);
    }
    for (let z = -D; z < D; z++) {
      const name = z === -3 ? "wallDoorway" : z === 0 || z === 1 ? "wallWindow" : "wall";
      this.piece(name, -W, z + 0.5, Math.PI / 2);
    }
    // elevator doors: a metal panel behind the wide doorway with a floor indicator
    const elev = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.98, 0.04), new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.6, roughness: 0.35 }));
    elev.position.set(2.5, 0.49, -3.06); this.scene.add(elev); this.elevatorDoor = elev;
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0xffb547 }));
    ind.position.set(2.5, 1.08, -3.0); this.scene.add(ind); this.elevatorLight = ind;
    // hotel sign on the back wall
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
    const c2 = cv.getContext("2d");
    c2.fillStyle = "#1d2433"; c2.fillRect(0, 0, 512, 128);
    c2.strokeStyle = "#ffc94d"; c2.lineWidth = 6; c2.strokeRect(8, 8, 496, 112);
    c2.fillStyle = "#ffc94d"; c2.font = "900 64px Nunito, Arial, sans-serif"; c2.textAlign = "center"; c2.textBaseline = "middle";
    c2.fillText("HOTEL RUSH", 256, 68);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(-1.5, 1.0, -2.94); this.scene.add(sign);
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 40), new THREE.MeshBasicMaterial({ color: 0x5ee0a8, transparent: true, opacity: 0.9, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.position.y = 0.01; this.selRing.visible = false;
    this.scene.add(this.selRing);
    // reception counter facing the lobby
    const bar = [];
    for (let i = 0; i < 5; i++) bar.push(this.piece("kitchenBar", -2.45 + i * 0.43, -1.25, Math.PI));
    this.piece("kitchenBarEnd", -2.72, -1.25, Math.PI);
    this.piece("kitchenBarEnd", -0.13, -1.25, Math.PI);
    this.piece("computerScreen", -1.6, -1.32, 0, 0.42);
    this.piece("radio", -0.55, -1.25, 0, 0.42);
    this.piece("chairDesk", -0.8, -1.8, 0);
    this.piece("bookcaseOpenLow", -2.0, -2.82, 0);
    this.piece("speakerSmall", -1.2, -2.85, 0);
    this.piece("pottedPlant", -3.6, -0.6, 0);
    this.piece("coatRack", -3.75, 0.9, Math.PI / 2);
    // lounge
    this.piece("rugRectangle", 1.6, 0.9, 0);
    this.piece("loungeSofa", 1.6, 0.25, 0);
    this.piece("loungeChair", 0.65, 1.1, Math.PI / 2);
    this.piece("loungeChair", 2.55, 1.1, -Math.PI / 2);
    this.piece("tableCoffee", 1.6, 1.1, 0);
    this.piece("lampRoundFloor", 2.6, 0.2, 0);
    this.piece("plantSmall1", 1.6, 1.12, 0, 0.23);
    this.piece("pottedPlant", 3.6, -2.6, 0);
    this.piece("pottedPlant", 1.6, -2.65, 0);
    this.piece("trashcan", 3.7, 1.2, 0);
    this.piece("bench", -3.7, 2.2, Math.PI / 2);
    this.piece("plantSmall2", -3.7, 2.7, 0, 0.47);
    this.piece("rugDoormat", 3.6, 2.4, Math.PI / 2);
    // coffee corner, shown after the upgrade
    this.coffee = new THREE.Group();
    this.coffee.add(this.piece("sideTable", 0.6, -2.75, 0));
    this.coffee.add(this.piece("kitchenCoffeeMachine", 0.6, -2.75, 0, 0.38));
    this.scene.add(this.coffee);
    this.coffee.visible = false;
    this.resize();
  }

  // Camera looks at a point of the lobby from the same isometric angle
  focus(target) {
    this.camera.position.copy(target).add(new THREE.Vector3(9, 9.5, 9));
    this.camera.lookAt(target);
  }

  // Menu view: the lobby moves up and gets smaller so the menu sheet does not cover it
  setMenuView(on) {
    this.shiftY = on ? 0.45 : 0;
    this.zoom = on ? 1.3 : 1.6;
    this.resize();
  }

  setCoffee(on) { if (this.coffee) this.coffee.visible = on; }

  setNight(night) {
    this.night = night;
    this.scene.background = new THREE.Color(night ? 0x070a14 : 0x283041);
    this.ground.material.color.set(night ? 0x141a28 : 0x3a4152);
    this.hemi.intensity = night ? 0.45 : 1.6;
    this.hemi.color.set(night ? 0x8fa8ff : 0xffffff);
    this.sun.intensity = night ? 0.25 : 1.8;
    this.sun.color.set(night ? 0x9db4ff : 0xfff1dc);
    this.lamps.forEach(l => { l.intensity = night ? 3.2 : 0; });
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h, halfW = (aspect < 1 ? 5.3 : 5.3 * Math.min(1.6, aspect)) / this.zoom;
    const halfH = halfW / aspect, d = (this.shiftY || 0) * halfH;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH - d, bottom: -halfH - d });
    this.camera.updateProjectionMatrix();
  }

  spawn(name, pos, opts = {}) {
    const gltf = this.assets["char:" + name];
    const root = SkeletonUtils.clone(gltf.scene);
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
      if (!a.pickable) continue;
      const center = a.root.position.clone().add(new THREE.Vector3(0, 0.35, 0));
      const d = this.raycaster.ray.distanceToPoint(center);
      if (d < 0.45 && d < bestD) { best = a; bestD = d; }
    }
    return best;
  }

  // paused: characters freeze in place but the scene keeps rendering
  frame(paused = false) {
    const real = Math.min(0.05, this.clock.getDelta()), dt = paused ? 0 : real;
    for (const a of this.actors) a.update(dt);
    if (this.selected && this.selected.root.parent) {
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
    this.speed = opts.speed || 1.6;
    this.pickable = false;
    this.path = [];
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const clip of world.clips) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    this.play("idle");
    if (opts.luggage) this.addLuggage(opts.luggage);
    if (opts.hat) this.addHat(opts.hat);
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

  // A small suitcase in the right hand
  addLuggage(color) {
    const arm = this.root.getObjectByName("arm-right");
    if (!arm) return;
    const bag = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    handle.position.y = 0.115;
    bag.add(body, handle);
    bag.traverse(o => { if (o.isMesh) o.castShadow = true; });
    bag.position.set(-0.3, -0.16, 0);
    arm.add(bag);
    this.bag = bag;
  }
  // Staff are told apart from guests by headwear: a white cap for maids, a yellow hard hat for the technician
  addHat(kind) {
    const head = this.root.getObjectByName("head");
    if (!head) return;
    const mat = new THREE.MeshStandardMaterial({ color: kind === "maid" ? 0xffffff : 0xffc21a, roughness: 0.5 });
    const hat = kind === "maid"
      ? new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.36), mat)
      : new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    hat.position.set(0, kind === "maid" ? 0.42 : 0.36, 0);
    hat.castShadow = true;
    head.add(hat);
  }
  dropLuggage() { if (this.bag) { this.bag.removeFromParent(); this.bag = null; } }

  walkTo(points, onArrive, speed) {
    this.path = (Array.isArray(points) ? points : [points]).map(p => p.clone());
    this.onArrive = onArrive || null;
    this.moveSpeed = speed || this.speed;
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
