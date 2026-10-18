import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, SphereGeometry, CapsuleGeometry, ConeGeometry, TorusGeometry,
  CylinderGeometry, ExtrudeGeometry, Shape, MeshToonMaterial, MeshBasicMaterial, HemisphereLight, DirectionalLight,
  DataTexture, RedFormat, NearestFilter, CanvasTexture, SRGBColorSpace, Raycaster, Vector2, Color, Object3D,
  BufferGeometry, LineBasicMaterial, Line, Vector3, RepeatWrapping, Material, Texture, CatmullRomCurve3, TubeGeometry,
} from 'three';

/**
 * Pip in 3D, built from simple shapes (no model files): skull head with eye sockets and glowing eye-lights,
 * onesie, nightcap, sitting on a cloud. Outfits swap live. Everything here is loaded only when Fit Check opens.
 */

export const HATS = ['Starry nightcap', 'Lavender nightcap', 'Party hat', 'Little crown', 'Just a bow'] as const;
export const SUITS = ['Cream hearts', 'Lavender stars', 'Mint stripes', 'Strawberry dots', 'Midnight sky'] as const;
export const EXTRAS = ['Nothing', 'Star wand', 'Teddy', 'Balloon', 'Dream orb'] as const;
export interface Fit { hat: number; suit: number; extra: number }

const BONE = '#f6ecdc', PLUM = '#3b2a5c', SOCKET = '#4a2f3a', PINK = '#f6b5c8', GOLD = '#f3d27a', CREAM = '#fff5e8';

function toonRamp(): DataTexture {
  const t = new DataTexture(new Uint8Array([110, 175, 225, 255]), 4, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Little repeating pattern textures for the onesies, drawn on a canvas. */
function pattern(bg: string, fg: string, kind: 'hearts' | 'stars' | 'stripes' | 'dots'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = fg;
  const star = (x: number, y: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  const heart = (x: number, y: number, s: number) => {
    g.beginPath(); g.moveTo(x, y + s * 0.35);
    g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.35, y - s, x, y - s * 0.4);
    g.bezierCurveTo(x + s * 0.35, y - s, x + s, y - s * 0.4, x, y + s * 0.35); g.fill();
  };
  if (kind === 'stripes') for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 14);
  else for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) {
    if (kind === 'hearts') heart(x + ((y / 32) % 2) * 10, y, 14);
    if (kind === 'stars') star(x, y, 11);
    if (kind === 'dots') { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

function starShape(r: number): Shape {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

export interface PipScene {
  setFit(f: Fit): void;
  /** -1..1 pointer position over the canvas, for the eye-lights */
  look(x: number, y: number): void;
  spinBy(dx: number, dy?: number): void;
  poke(): void;
  hit(x: number, y: number): boolean;
  setAuto(on: boolean): void;
  resize(w: number, h: number): void;
  snapshot(): string;
  start(): void;
  stop(): void;
  dispose(): void;
}

export function createPipScene(canvas: HTMLCanvasElement, opts: { still: boolean }): PipScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 1.7, 7.8);
  camera.lookAt(0, 1.42, 0);

  scene.add(new HemisphereLight('#d9c8f0', PLUM, 1.5));
  const key = new DirectionalLight('#fff1d6', 2.2); key.position.set(2.5, 4, 4); scene.add(key);
  const rim = new DirectionalLight(PINK, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);

  const ramp = toonRamp();
  const disposables: (Material | Texture | BufferGeometry)[] = [ramp];
  const mat = (color: string, extra: Partial<{ map: Texture; emissive: string; transparent: boolean; opacity: number }> = {}) => {
    const m = new MeshToonMaterial({ color: new Color(color), gradientMap: ramp, map: extra.map ?? null, transparent: extra.transparent ?? false, opacity: extra.opacity ?? 1 });
    if (extra.emissive) { m.emissive = new Color(extra.emissive); m.emissiveIntensity = 0.9; }
    disposables.push(m);
    return m;
  };
  const geo = <G extends BufferGeometry>(g: G) => { disposables.push(g); return g; };
  const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => {
    const o = new Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o;
  };

  const root = new Group(); scene.add(root);   // turntable
  const pip = new Group(); root.add(pip);      // hops and bobs

  // cloud
  const cloudMat = mat(CREAM);
  const ball = geo(new SphereGeometry(1, 28, 20));
  [[0, 0.18, 0, 0.62], [-0.68, 0.12, 0.08, 0.46], [0.7, 0.14, 0.05, 0.5], [-0.3, 0.1, 0.42, 0.42], [0.36, 0.1, 0.4, 0.44], [-1.1, 0.04, 0, 0.32], [1.12, 0.05, 0.02, 0.34], [0.1, 0.12, -0.42, 0.45]]
    .forEach(([x, y, z, r]) => root.add(mesh(ball, cloudMat, x, y, z, r, r * 0.82, r)));

  // onesie (body, legs, arms share one material so the pattern swaps everywhere)
  const suitMat = mat('#ffffff');
  const body = mesh(ball, suitMat, 0, 0.92, 0, 0.6, 0.62, 0.52); pip.add(body);
  const limb = geo(new CapsuleGeometry(0.15, 0.32, 8, 16));
  const footMat = mat(PINK);
  for (const s of [-1, 1]) {
    const leg = mesh(limb, suitMat, s * 0.26, 0.58, 0.32); leg.rotation.x = Math.PI / 2.2; pip.add(leg);
    pip.add(mesh(ball, footMat, s * 0.27, 0.56, 0.62, 0.17, 0.15, 0.19));
  }
  const skinMat = mat(BONE);
  const arms: Group[] = [];
  for (const s of [-1, 1]) {
    const shoulder = new Group(); shoulder.position.set(s * 0.5, 1.12, 0.05);
    const arm = mesh(limb, suitMat, 0, -0.24, 0.06, 0.85); shoulder.add(arm);
    shoulder.add(mesh(ball, skinMat, 0, -0.46, 0.1, 0.15));
    shoulder.rotation.z = s * 0.5; shoulder.rotation.x = -0.35;
    pip.add(shoulder); arms.push(shoulder);
  }
  const [armL, armR] = arms;

  // head
  const head = new Group(); head.position.set(0, 1.86, 0); pip.add(head);
  head.add(mesh(ball, skinMat, 0, 0, 0, 0.76, 0.7, 0.72));
  const socketMat = mat(SOCKET);
  const lightMat = new MeshBasicMaterial({ color: '#fff1c4' }); disposables.push(lightMat);
  const lights: Mesh[] = [];
  for (const s of [-1, 1]) {
    const sock = mesh(ball, socketMat, s * 0.28, -0.02, 0.6, 0.2, 0.23, 0.08);
    sock.lookAt(new Vector3(s * 0.28 * 3, -0.06, 3)); head.add(sock);
    const l = mesh(ball, lightMat, s * 0.28, 0.0, 0.71, 0.055); head.add(l); lights.push(l);
  }
  const nose = mesh(geo(new ConeGeometry(0.05, 0.07, 3)), socketMat, 0, -0.18, 0.7); nose.rotation.x = Math.PI; head.add(nose);
  const smile = mesh(geo(new TorusGeometry(0.09, 0.018, 8, 20, Math.PI)), socketMat, 0, -0.27, 0.66); smile.rotation.z = Math.PI; head.add(smile);
  const cheekMat = mat(PINK, { transparent: true, opacity: 0.85 });
  for (const s of [-1, 1]) { const c = mesh(ball, cheekMat, s * 0.47, -0.2, 0.5, 0.11, 0.07, 0.05); c.lookAt(new Vector3(s * 2, -0.4, 2)); head.add(c); }

  // ---- hats ----
  const hats: Group[] = [];
  const nightcap = (color: string, dots: string) => {
    const g = new Group();
    const tex = pattern(color, dots, 'stars'); tex.repeat.set(3, 1.2); disposables.push(tex);
    const capMat = mat('#ffffff', { map: tex });
    const brim = mesh(geo(new TorusGeometry(0.66, 0.11, 14, 48)), mat(CREAM), 0, 0.3, 0); brim.rotation.x = Math.PI / 2; g.add(brim);
    g.add(mesh(geo(new CylinderGeometry(0.34, 0.64, 0.55, 32, 1, true)), capMat, 0, 0.575, 0));
    g.add(mesh(ball, capMat, 0, 0.85, 0, 0.34, 0.2, 0.34));
    const tip = new Group(); tip.position.set(0, 0.86, 0); tip.rotation.z = -1.05; g.add(tip); // droops over to one side
    tip.add(mesh(geo(new ConeGeometry(0.34, 0.8, 32, 1, true)), capMat, 0, 0.4, 0));
    tip.add(mesh(ball, mat('#fde7c8'), 0, 0.82, 0, 0.15));
    g.rotation.x = -0.08;
    return g;
  };
  hats.push(nightcap('#fdf3e1', GOLD), nightcap('#c9b6e4', '#fff5e8'));
  { // party hat
    const g = new Group();
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d')!;
    x.fillStyle = '#bfe8d6'; x.fillRect(0, 0, 64, 64); x.fillStyle = PINK; for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64);
    const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; tex.wrapS = RepeatWrapping; tex.repeat.set(3, 1); disposables.push(tex);
    g.add(mesh(geo(new ConeGeometry(0.34, 0.9, 32, 1, true)), mat('#ffffff', { map: tex }), 0, 0.5, 0));
    g.add(mesh(ball, mat(GOLD, { emissive: '#8a6a20' }), 0, 0.98, 0, 0.1));
    g.position.set(0.18, 0.5, 0); g.rotation.z = -0.25;
    hats.push(g);
  }
  { // crown
    const g = new Group();
    const goldMat = mat(GOLD, { emissive: '#6b5214' });
    g.add(mesh(geo(new CylinderGeometry(0.36, 0.38, 0.2, 32, 1, true)), goldMat, 0, 0, 0));
    const spike = geo(new ConeGeometry(0.07, 0.2, 8));
    const gem = mat(PINK, { emissive: '#a04a6a' });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(spike, goldMat, Math.sin(a) * 0.36, 0.18, Math.cos(a) * 0.36)); g.add(mesh(ball, gem, Math.sin(a) * 0.37, 0, Math.cos(a) * 0.37, 0.035)); }
    g.position.set(0, 0.62, 0); g.rotation.z = -0.12;
    hats.push(g);
  }
  hats.push(new Group()); // just a bow (the bow below is always on unless a nightcap/hat covers it)
  const bow = new Group();
  { const bm = mat(PINK); const lobe = geo(new ConeGeometry(0.1, 0.18, 16)); for (const s of [-1, 1]) { const l = mesh(lobe, bm, s * 0.1, 0, 0); l.rotation.z = (s * Math.PI) / 2; bow.add(l); } bow.add(mesh(ball, bm, 0, 0, 0, 0.05)); }
  hats.forEach((h) => head.add(h));
  head.add(bow);

  // ---- extras ----
  const extras: Group[] = [new Group()];
  { // wand, in the right hand
    const g = new Group();
    g.add(mesh(geo(new CylinderGeometry(0.025, 0.025, 0.75, 8)), mat(CREAM), 0, 0.28, 0));
    const st = mesh(geo(new ExtrudeGeometry(starShape(0.22), { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 })), mat(GOLD, { emissive: '#8a6a20' }), 0, 0.72, -0.025);
    g.add(st); g.userData.spin = st;
    g.position.set(0, -0.48, 0.12); g.rotation.set(0.25, 0, -1.35); // points straight up out of the raised hand
    armR.add(g); extras.push(g);
  }
  { // teddy, hugged in the left arm
    const g = new Group(); const fur = mat('#c79a6b'), snout = mat('#ead1b0');
    g.add(mesh(ball, fur, 0, 0, 0, 0.17, 0.19, 0.15)); g.add(mesh(ball, fur, 0, 0.24, 0, 0.13));
    for (const s of [-1, 1]) g.add(mesh(ball, fur, s * 0.1, 0.34, 0, 0.05));
    g.add(mesh(ball, snout, 0, 0.21, 0.11, 0.05, 0.04, 0.04));
    for (const s of [-1, 1]) g.add(mesh(ball, socketMat, s * 0.045, 0.27, 0.11, 0.018));
    g.position.set(-0.28, 0.92, 0.5); g.rotation.y = 0.3;
    pip.add(g); extras.push(g);
  }
  { // balloon, string tied to the left hand
    const g = new Group(); const bm = mat(PINK, { emissive: '#7a3048' });
    const b = mesh(ball, bm, 0.15, 1.15, 0, 0.3, 0.36, 0.3); g.add(b);
    g.add(mesh(geo(new ConeGeometry(0.04, 0.06, 8)), bm, 0.15, 0.82, 0)).children.at(-1)!.rotation.x = Math.PI;
    const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0.08, 0.3, 0.02), new Vector3(0.02, 0.55, -0.02), new Vector3(0.15, 0.8, 0)]);
    const str = new Line(geo(new BufferGeometry().setFromPoints(curve.getPoints(20))), new LineBasicMaterial({ color: CREAM }));
    disposables.push(str.material as Material);
    g.add(str); g.userData.float = b;
    g.position.set(-0.95, 0.95, 0.18); pip.add(g); extras.push(g);
  }
  { // dream orb floating beside Pip
    const g = new Group();
    const orb = mesh(ball, new MeshBasicMaterial({ color: '#c9b6e4', transparent: true, opacity: 0.85 }), 0, 0, 0, 0.17);
    disposables.push(orb.material as Material);
    const glow = mesh(ball, new MeshBasicMaterial({ color: '#c9b6e4', transparent: true, opacity: 0.22 }), 0, 0, 0, 0.27);
    disposables.push(glow.material as Material);
    const ring = mesh(geo(new TubeGeometry(new CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => new Vector3(Math.cos((i / 24) * Math.PI * 2) * 0.3, 0, Math.sin((i / 24) * Math.PI * 2) * 0.3)), true), 48, 0.012, 6, true)), mat(GOLD, { emissive: GOLD }));
    ring.rotation.x = 0.4;
    g.add(orb, glow, ring); g.position.set(0.95, 1.7, 0.2); g.userData.orbit = true;
    pip.add(g); extras.push(g);
  }

  // ---- onesie patterns ----
  const SUIT_TEX = [pattern(CREAM, PINK, 'hearts'), pattern('#c9b6e4', '#fff5e8', 'stars'), pattern('#bfe8d6', '#fff5e8', 'stripes'), pattern(PINK, '#fff5e8', 'dots'), pattern('#2b2350', GOLD, 'stars')];
  disposables.push(...SUIT_TEX);

  let fit: Fit = { hat: 0, suit: 0, extra: 0 };
  const setFit = (f: Fit) => {
    fit = f;
    hats.forEach((h, i) => { h.visible = i === f.hat; });
    bow.visible = f.hat !== 2 && f.hat !== 3; // nightcaps keep the bow on the brim, the bow-only look puts it on the head
    if (f.hat <= 1) { bow.position.set(-0.36, 0.52, 0.5); bow.rotation.set(0, -0.4, 0.3); }
    else { bow.position.set(-0.36, 0.5, 0.38); bow.rotation.set(0, -0.4, 0.4); }
    suitMat.map = SUIT_TEX[f.suit]; suitMat.needsUpdate = true;
    extras.forEach((e, i) => { e.visible = i === f.extra; });
    // arms pose: hugging the teddy, holding the balloon up, waving the wand
    armL.rotation.set(f.extra === 2 ? -1.0 : f.extra === 3 ? -0.2 : -0.35, f.extra === 2 ? 0.6 : 0, f.extra === 3 ? -1.2 : -0.5);
    armR.rotation.set(f.extra === 1 ? -0.3 : -0.35, 0, f.extra === 1 ? 1.35 : 0.5);
  };

  // ---- interaction state ----
  let yaw = -0.35, pitch = 0, vel = 0, auto = !opts.still;
  let lookX = 0, lookY = 0, eyeX = 0, eyeY = 0;
  let hop = 0, wave = 0, blinkAt = 2;
  const ray = new Raycaster();

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.position.z = camera.aspect < 0.8 ? 9.2 : 7.2;
    camera.updateProjectionMatrix();
  };

  let raf = 0, last = 0, t = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; t += dt;
    if (auto && Math.abs(vel) < 0.002) yaw += dt * 0.35;
    yaw += vel; vel *= 0.92;
    root.rotation.y = yaw;
    root.rotation.x = pitch;
    // idle: breathing bob, head tilt towards the pointer, eye-lights follow, blink
    const bob = opts.still ? 0 : Math.sin(t * 2) * 0.03;
    hop = Math.max(0, hop - dt * 2.4);
    pip.position.y = bob + Math.sin(hop * Math.PI) * 0.35;
    head.rotation.y += ((lookX * 0.35) - head.rotation.y) * 0.08;
    head.rotation.x += ((-lookY * 0.2) - head.rotation.x) * 0.08;
    eyeX += (lookX - eyeX) * 0.15; eyeY += (lookY - eyeY) * 0.15;
    lights.forEach((l, i) => { l.position.x = (i ? 0.28 : -0.28) + eyeX * 0.07; l.position.y = eyeY * 0.07; });
    blinkAt -= dt;
    const blink = blinkAt < 0 && blinkAt > -0.14 ? 0.15 : 1;
    if (blinkAt < -0.14) blinkAt = 2 + Math.random() * 3;
    lights.forEach((l) => { l.scale.y = 0.055 * blink; });
    if (wave > 0) { wave = Math.max(0, wave - dt); armR.rotation.z = 2.4 + Math.sin(t * 14) * 0.35; armR.rotation.x = -0.2; if (wave === 0) setFit(fit); }
    const ex = extras[fit.extra];
    if (ex.userData.spin) (ex.userData.spin as Object3D).rotation.y = t * 2;
    if (ex.userData.float) (ex.userData.float as Object3D).position.x = 0.15 + Math.sin(t * 1.4) * 0.05;
    if (ex.userData.orbit && !opts.still) { ex.position.set(Math.cos(t * 0.9) * 0.95, 1.7 + Math.sin(t * 1.8) * 0.12, Math.sin(t * 0.9) * 0.6); ex.rotation.y = t; }
    renderer.render(scene, camera);
  };

  return {
    setFit,
    look(x, y) { lookX = Math.max(-1, Math.min(1, x)); lookY = Math.max(-1, Math.min(1, y)); },
    spinBy(dx, dy = 0) { vel = dx; pitch = Math.max(-0.35, Math.min(0.25, pitch + dy)); auto = false; },
    poke() { hop = 1; wave = 1.2; },
    hit(x, y) { ray.setFromCamera(new Vector2(x, y), camera); return ray.intersectObject(pip, true).length > 0; },
    setAuto(on) { auto = on; },
    resize,
    snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    dispose() {
      cancelAnimationFrame(raf); raf = 0;
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
