import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, SphereGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry,
  Shape, MeshPhysicalMaterial, MeshBasicMaterial, ShadowMaterial, PlaneGeometry, HemisphereLight, DirectionalLight,
  CanvasTexture, SRGBColorSpace, Raycaster, Vector2, Color, Object3D, BufferGeometry, BufferAttribute, LineBasicMaterial,
  Line, Vector3, RepeatWrapping, Material, Texture, CatmullRomCurve3, PMREMGenerator, ACESFilmicToneMapping,
  PCFSoftShadowMap, Sprite, SpriteMaterial, AdditiveBlending, TorusGeometry, type MeshPhysicalMaterialParameters,
  Points, PointsMaterial, Float32BufferAttribute, DoubleSide,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Pip in 3D. The body is a sculpted model (public/models/pip.glb, made by scripts/sculpt_pip.py from
 * smooth-blended shapes) lit like a soft vinyl toy: glossy skull, plush fabric onesie and nightcap,
 * soft shadows and room reflections. Outfits swap live; this module loads only when Fit Check opens.
 */

export const HATS = ['Starry nightcap', 'Lavender nightcap', 'Party hat', 'Little crown', 'Just a bow'] as const;
export const SUITS = ['Cream hearts', 'Lavender stars', 'Mint stripes', 'Strawberry dots', 'Midnight sky'] as const;
export const EXTRAS = ['Nothing', 'Star wand', 'Teddy', 'Balloon', 'Dream orb'] as const;
export interface Fit { hat: number; suit: number; extra: number }

const PLUM = '#3b2a5c', PINK = '#f6b5c8', GOLD = '#f3d27a', CREAM = '#fff5e8';
const HEAD_C = new Vector3(0, 1.9, 0);

/** Little repeating pattern textures for the onesies and caps, drawn on a canvas. */
function pattern(bg: string, fg: string, kind: 'hearts' | 'stars' | 'stripes' | 'dots', rx = 4, ry = 3): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
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
  if (kind === 'stripes') for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 26);
  else for (const [x, y] of [[64, 64], [192, 192], [192, 64], [64, 192]]) {
    if (kind === 'hearts') heart(x, y, 26);
    if (kind === 'stars') star(x, y, 22);
    if (kind === 'dots') { g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill(); }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}

/** Wrap a pattern round a mesh: spherical UVs about a centre (good enough for round, plush shapes). */
function sphereUV(geo: BufferGeometry, c: Vector3): void {
  const p = geo.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - c.x, y = p.getY(i) - c.y, z = p.getZ(i) - c.z;
    uv[i * 2] = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = Math.atan2(y, Math.hypot(x, z)) / Math.PI + 0.5;
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
}

function starShape(r: number): Shape {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,241,196,1)'); gr.addColorStop(0.35, 'rgba(255,225,160,0.45)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
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

export async function createPipScene(canvas: HTMLCanvasElement, opts: { still: boolean; modelUrl: string }): Promise<PipScene> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const disposables: (Material | Texture | BufferGeometry | { dispose(): void })[] = [];
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  disposables.push(env, pmrem);
  room.traverse((o) => { const m = o as Mesh; if (m.geometry) m.geometry.dispose(); });

  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.7, 8.8);
  camera.lookAt(0, 1.38, 0);

  scene.add(new HemisphereLight('#e6d8ff', PLUM, 0.35));
  const key = new DirectionalLight('#fff0dc', 2.1);
  key.position.set(2.6, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.2;
  key.shadow.camera.right = key.shadow.camera.top = 2.2;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new DirectionalLight('#ffb8d2', 1.4); rim.position.set(-3.5, 2.5, -3); scene.add(rim);
  const fill = new DirectionalLight('#b9a6ff', 0.45); fill.position.set(-3, 1, 3); scene.add(fill);

  // physically based materials: glossy vinyl skull, plush fabric, satin bow
  const vinyl = (color: string, extra: MeshPhysicalMaterialParameters = {}) => {
    const m = new MeshPhysicalMaterial({ color: new Color(color), roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.35, ...extra });
    disposables.push(m); return m;
  };
  const plush = (color: string, extra: MeshPhysicalMaterialParameters = {}) => {
    const m = new MeshPhysicalMaterial({ color: new Color(color), roughness: 0.85, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new Color('#fff4f8'), ...extra });
    disposables.push(m); return m;
  };
  const geo = <G extends BufferGeometry>(g: G) => { disposables.push(g); return g; };
  const prim = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => {
    const o = new Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o;
  };

  // ---- load the sculpted model ----
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(opts.modelUrl);
  const parts = new Map<string, Mesh>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    // the compressed file stores packed integer positions with the scale/offset on the node: unpack to plain
    // world-space floats so every part below can be placed, re-parented and UV-wrapped in one coordinate system
    const g = m.geometry;
    for (const n of ['position', 'normal']) {
      const a = g.getAttribute(n);
      if (!a) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(n, new BufferAttribute(f, 3));
    }
    g.applyMatrix4(m.matrixWorld);
    g.computeBoundingSphere();
    m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
    parts.set(m.name, m); m.castShadow = true; m.receiveShadow = true; disposables.push(g);
  });
  const part = (n: string) => { const m = parts.get(n); if (!m) throw new Error(`pip.glb is missing ${n}`); return m; };

  const root = new Group(); scene.add(root);   // turntable
  const pip = new Group(); root.add(pip);      // hops and bobs

  const headSkin = vinyl('#ffffff', { vertexColors: true });
  // the dark painted areas (eye sockets, nose, mouth) are matte: no gloss coat, no reflections, no highlights
  headSkin.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float socketDark = 1.0 - smoothstep(0.02, 0.2, vColor.r);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, socketDark);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.clearcoat *= 1.0 - socketDark;\n  material.specularColor *= 1.0 - socketDark;\n  material.specularF90 *= 1.0 - socketDark;');
  };
  const handSkin = vinyl('#faf0e4');
  const suitMat = plush('#ffffff');
  const capMat = plush('#ffffff');
  const cloud = part('cloud'); cloud.material = plush(CREAM, { sheenColor: new Color('#e9ddff'), roughness: 0.95 }); root.add(cloud);
  const body = part('body'); body.material = suitMat; sphereUV(body.geometry, new Vector3(0, 0.9, 0)); pip.add(body);
  for (const n of ['foot_l', 'foot_r']) { const f = part(n); f.material = plush(PINK, { roughness: 0.7 }); pip.add(f); }

  // head group pivots about the skull centre so it can tilt towards you
  const head = new Group(); head.position.copy(HEAD_C); pip.add(head);
  const skull = part('head'); skull.material = headSkin; skull.position.sub(HEAD_C); head.add(skull);
  const cap = part('cap'); cap.material = capMat; sphereUV(cap.geometry, HEAD_C.clone().add(new Vector3(0.2, 0.6, 0))); cap.position.sub(HEAD_C); head.add(cap);
  const pompom = part('pompom'); pompom.material = plush('#fde7c8', { roughness: 1 }); pompom.position.sub(HEAD_C); head.add(pompom);
  const bow = part('bow'); bow.material = plush(PINK, { roughness: 0.38, sheenRoughness: 0.3 }); bow.position.sub(HEAD_C); head.add(bow);
  const bowHome = bow.position.clone();

  // glowing eye-lights inside the sockets (they follow the pointer)
  const lightMat = new MeshBasicMaterial({ color: '#fff4cf' }); disposables.push(lightMat);
  const glowTex = glowTexture(); disposables.push(glowTex);
  const lights: Group[] = [];
  for (const s of [-1, 1]) {
    const g = new Group(); g.position.set(s * 0.32, -0.08, 0.64);
    g.add(new Mesh(geo(new SphereGeometry(0.072, 24, 16)), lightMat));
    const sparkle = new Mesh(geo(new SphereGeometry(0.026, 12, 10)), lightMat); // second tiny highlight = extra cute
    sparkle.position.set(-0.05, 0.06, 0.03); g.add(sparkle);
    const halo = new Sprite(new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    disposables.push(halo.material); halo.scale.setScalar(0.17); g.add(halo);
    head.add(g); lights.push(g);
  }

  // little hearts that float up when you poke Pip
  const heartTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
    g.fillStyle = '#ff9ec4'; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(-4, 30, 14, 2, 32, 20); g.bezierCurveTo(50, 2, 68, 30, 32, 54); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(22, 22, 6, 4, -0.6, 0, Math.PI * 2); g.fill();
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  })();
  disposables.push(heartTex);
  const hearts: Sprite[] = Array.from({ length: 6 }, () => {
    const h = new Sprite(new SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
    disposables.push(h.material); h.scale.setScalar(0.26); h.visible = false; h.userData = { age: 9, x0: 0, y0: 0, ph: 0 };
    root.add(h); return h;
  });

  // arms: shoulder-local meshes on pivots so they can pose and wave
  const arms: Group[] = [];
  for (const s of [-1, 1]) {
    const shoulder = new Group(); shoulder.position.set(s * 0.47, 1.06, 0.05);
    const sleeve = new Mesh(part('arm').geometry, suitMat); sleeve.castShadow = true;
    const hand = new Mesh(part('hand').geometry, handSkin); hand.castShadow = true;
    if (s < 0) { sleeve.scale.x = -1; hand.scale.x = -1; }
    shoulder.add(sleeve, hand);
    pip.add(shoulder); arms.push(shoulder);
  }
  sphereUV(part('arm').geometry, new Vector3(0, -0.2, 0));
  const [armL, armR] = arms;

  // soft contact shadow under the cloud
  const ground = new Mesh(geo(new PlaneGeometry(8, 8)), new ShadowMaterial({ opacity: 0.32, color: new Color('#120c24') }));
  disposables.push(ground.material as Material);
  ground.visible = false; // the pedestal now catches Pip's shadow

  // ---------- the photo studio set (stays still while Pip spins) ----------
  const set = new Group(); scene.add(set);
  // plush round pedestal the cloud sits on
  const pedestal = prim(geo(new CylinderGeometry(1.5, 1.58, 0.28, 72)), plush('#c9b6e4', { sheenColor: new Color('#fff0fb') }), 0, -0.34, 0);
  pedestal.receiveShadow = true; set.add(pedestal);
  const rimTop = prim(geo(new TorusGeometry(1.5, 0.075, 14, 96)), plush(CREAM, { roughness: 1 }), 0, -0.2, 0); rimTop.rotation.x = Math.PI / 2; set.add(rimTop);
  const rimBot = prim(geo(new TorusGeometry(1.58, 0.06, 12, 96)), vinyl(GOLD, { metalness: 0.9, roughness: 0.3, clearcoat: 0 }), 0, -0.47, 0); rimBot.rotation.x = Math.PI / 2; set.add(rimBot);
  // soft spotlight beam from above
  const beamTex = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,241,214,0.0)'); gr.addColorStop(0.15, 'rgba(255,241,214,0.9)'); gr.addColorStop(1, 'rgba(255,241,214,0.0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new CanvasTexture(c);
  })();
  disposables.push(beamTex);
  const beam = new Mesh(geo(new CylinderGeometry(0.25, 1.75, 4.6, 48, 1, true)), new MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  disposables.push(beam.material as Material);
  beam.position.y = 2.0; set.add(beam);
  // fairy-light garland across the top
  const bulbMats = ['#ffb3cf', '#ffe29a', '#bff0dc', '#d6c4ff'].map((c) => { const m = new MeshBasicMaterial({ color: c }); disposables.push(m); return m; });
  const bulbGeo = geo(new SphereGeometry(0.065, 14, 10));
  const bulbs: { m: Mesh; halo: Sprite; ph: number }[] = [];
  for (const [x0, x1, y0, sag, z] of [[-4.2, 0.2, 3.9, 0.55, -1.6], [-0.2, 4.2, 3.9, 0.55, -1.6]] as const) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new Vector3(x0 + (x1 - x0) * t, y0 - Math.sin(t * Math.PI) * sag, z)); }
    const wire = new Line(geo(new BufferGeometry().setFromPoints(pts)), new LineBasicMaterial({ color: '#6b5a8e' }));
    disposables.push(wire.material as Material); set.add(wire);
    for (let i = 1; i < 8; i++) {
      const t = i / 8, k = bulbs.length;
      const m = new Mesh(bulbGeo, bulbMats[k % 4]);
      m.position.set(x0 + (x1 - x0) * t, y0 - Math.sin(t * Math.PI) * sag - 0.07, z);
      const halo = new Sprite(new SpriteMaterial({ map: glowTex, color: (bulbMats[k % 4].color as Color).getHex(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      disposables.push(halo.material); halo.scale.setScalar(0.42); halo.position.copy(m.position);
      set.add(m, halo); bulbs.push({ m, halo, ph: k * 1.7 });
    }
  }
  // floating gold stars
  const starGeo = geo(new ExtrudeGeometry(starShape(1), { depth: 0.3, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 3 }));
  const starMat = vinyl(GOLD, { metalness: 0.6, roughness: 0.3, emissive: new Color('#6b5214'), emissiveIntensity: 0.6 });
  const stars = ([[-2.4, 2.5, -1.0, 0.16], [2.5, 2.2, -0.9, 0.14], [-2.1, 0.8, -0.5, 0.11], [2.2, 0.55, -0.4, 0.12], [-3.2, 1.6, -1.8, 0.13], [3.3, 3.0, -2.0, 0.15], [0.9, 3.4, -2.4, 0.1]] as const).map(([x, y, z, r], i) => {
    const m = prim(starGeo, starMat, x, y, z, r); m.castShadow = false; m.userData = { y0: y, ph: i * 1.3 }; set.add(m); return m;
  });
  // little clouds drifting at the back
  const puffMat = plush('#fff8f0', { roughness: 1, sheenColor: new Color('#e9ddff') });
  const puffBall = geo(new SphereGeometry(1, 24, 18));
  const clouds = ([[-3.2, 1.0, -2.8], [3.4, 1.7, -3.0], [0.6, 0.0, -3.4]] as const).map(([x, y, z], i) => {
    const g = new Group(); g.position.set(x, y, z);
    for (const [px, py, pr] of [[0, 0, 0.32], [-0.32, -0.06, 0.24], [0.33, -0.05, 0.26], [0.1, 0.16, 0.22]]) g.add(prim(puffBall, puffMat, px, py, 0, pr, pr * 0.85, pr));
    g.userData = { x0: x, ph: i * 2 }; set.add(g); return g;
  });
  // crescent moon hanging on a string
  const moonShape = new Shape();
  moonShape.absarc(0, 0, 0.32, Math.PI / 2, Math.PI * 1.5, false);
  moonShape.absarc(0.14, 0, Math.hypot(0.14, 0.32), Math.atan2(-0.32, -0.14), Math.atan2(0.32, -0.14), true);
  const moon = new Group(); moon.position.set(-2.7, 3.9, -1.3); set.add(moon);
  const moonMesh = prim(geo(new ExtrudeGeometry(moonShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 4 })), vinyl('#fff1c4', { roughness: 0.35, emissive: new Color('#8a7340'), emissiveIntensity: 0.5 }), 0, -1.25, 0);
  moonMesh.castShadow = false; moon.add(moonMesh);
  const moonString = new Line(geo(new BufferGeometry().setFromPoints([new Vector3(0, 0.5, 0), new Vector3(0, -0.93, 0.05)])), new LineBasicMaterial({ color: '#d9c8f0' }));
  disposables.push(moonString.material as Material); moon.add(moonString);
  // slow sparkle dust
  const DUST = 70;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 7; dustPos[i * 3 + 1] = Math.random() * 4.4 - 0.4; dustPos[i * 3 + 2] = -Math.random() * 3 + 0.5; }
  const dustGeo = geo(new BufferGeometry()); dustGeo.setAttribute('position', new Float32BufferAttribute(dustPos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({ map: glowTex, size: 0.11, color: '#fff1d6', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }));
  disposables.push(dust.material as Material); set.add(dust);
  const animateSet = (t: number, dt: number) => {
    bulbs.forEach((b) => { const k = 0.55 + 0.45 * Math.sin(t * 2.2 + b.ph); (b.halo.material as SpriteMaterial).opacity = 0.35 + 0.55 * k; b.m.scale.setScalar(0.85 + 0.25 * k); });
    if (opts.still) return;
    stars.forEach((m) => { m.position.y = m.userData.y0 + Math.sin(t * 1.1 + m.userData.ph) * 0.08; m.rotation.y = Math.sin(t * 0.7 + m.userData.ph) * 0.6; m.rotation.z = Math.sin(t * 0.5 + m.userData.ph) * 0.15; });
    clouds.forEach((g) => { g.position.x = g.userData.x0 + Math.sin(t * 0.15 + g.userData.ph) * 0.35; });
    moon.rotation.z = Math.sin(t * 0.8) * 0.06;
    const a = dustGeo.getAttribute('position') as Float32BufferAttribute;
    for (let i = 0; i < DUST; i++) { let y = a.getY(i) + dt * 0.12; if (y > 4.1) y = -0.4; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t + i) * dt * 0.02); }
    a.needsUpdate = true;
  };

  // ---- other hats (simple shapes, same materials) ----
  const partyHat = new Group();
  {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d')!;
    x.fillStyle = '#bfe8d6'; x.fillRect(0, 0, 64, 64); x.fillStyle = PINK; for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 8, 64);
    const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; tex.wrapS = RepeatWrapping; tex.repeat.set(3, 1); disposables.push(tex);
    partyHat.add(prim(geo(new ConeGeometry(0.34, 0.9, 40, 1, true)), vinyl('#ffffff', { map: tex, roughness: 0.5 }), 0, 0.5, 0));
    partyHat.add(prim(geo(new SphereGeometry(0.11, 20, 14)), plush(GOLD, { roughness: 1 }), 0, 0.98, 0));
    partyHat.position.set(0.2, 0.6, 0); partyHat.rotation.z = -0.25; partyHat.scale.setScalar(1.1);
  }
  const crown = new Group();
  {
    const gold = vinyl(GOLD, { metalness: 1, roughness: 0.25, clearcoat: 0 });
    crown.add(prim(geo(new CylinderGeometry(0.36, 0.38, 0.2, 40, 1, true)), gold));
    const spike = geo(new ConeGeometry(0.07, 0.2, 12)), gemG = geo(new SphereGeometry(0.04, 16, 12));
    const gem = vinyl(PINK, { roughness: 0.1, clearcoat: 1, transmission: 0.3 });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; crown.add(prim(spike, gold, Math.sin(a) * 0.36, 0.18, Math.cos(a) * 0.36)); crown.add(prim(gemG, gem, Math.sin(a) * 0.375, 0, Math.cos(a) * 0.375)); }
    crown.position.set(0, 0.72, 0); crown.rotation.z = -0.12; crown.scale.setScalar(1.12);
  }
  head.add(partyHat, crown);

  // ---- extras ----
  const ball = geo(new SphereGeometry(1, 32, 24));
  const extras: Group[] = [new Group()];
  { // wand, in the right hand
    const g = new Group();
    g.add(prim(geo(new CylinderGeometry(0.025, 0.025, 0.75, 12)), vinyl(CREAM), 0, 0.28, 0));
    const st = prim(geo(new ExtrudeGeometry(starShape(0.22), { depth: 0.05, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3 })), vinyl(GOLD, { metalness: 0.8, roughness: 0.3, emissive: new Color('#6b5214'), emissiveIntensity: 0.5 }), 0, 0.72, -0.025);
    g.add(st); g.userData.spin = st;
    g.position.set(0, -0.4, 0.12); g.rotation.set(0.25, 0, -1.35);
    armR.add(g); extras.push(g);
  }
  { // teddy, hugged in the left arm
    const g = new Group(); const fur = plush('#c79a6b', { sheenColor: new Color('#f3dcc0') }), snout = plush('#ead1b0'), eye = vinyl('#2a1b22', { roughness: 0.15 });
    g.add(prim(ball, fur, 0, 0, 0, 0.17, 0.19, 0.15)); g.add(prim(ball, fur, 0, 0.24, 0, 0.13));
    for (const s of [-1, 1]) g.add(prim(ball, fur, s * 0.1, 0.34, 0, 0.05));
    g.add(prim(ball, snout, 0, 0.21, 0.11, 0.05, 0.04, 0.04));
    for (const s of [-1, 1]) g.add(prim(ball, eye, s * 0.045, 0.27, 0.11, 0.018));
    g.position.set(-0.28, 0.92, 0.5); g.rotation.y = 0.3;
    pip.add(g); extras.push(g);
  }
  { // balloon above the raised left hand
    const g = new Group(); const bm = vinyl(PINK, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
    const b = prim(ball, bm, -0.45, 1.2, 0, 0.3, 0.36, 0.3); g.add(b);
    const knot = prim(geo(new ConeGeometry(0.04, 0.06, 10)), bm, -0.45, 0.83, 0); knot.rotation.x = Math.PI; g.add(knot);
    const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(-0.08, 0.3, 0.02), new Vector3(-0.3, 0.55, -0.02), new Vector3(-0.45, 0.83, 0)]);
    const str = new Line(geo(new BufferGeometry().setFromPoints(curve.getPoints(24))), new LineBasicMaterial({ color: CREAM }));
    disposables.push(str.material as Material);
    g.add(str); g.userData.float = b;
    g.position.set(-0.84, 0.92, 0.18); pip.add(g); extras.push(g);
  }
  { // dream orb floating beside Pip
    const g = new Group();
    const orb = prim(ball, vinyl('#c9b6e4', { roughness: 0.05, transmission: 0.6, thickness: 0.4, emissive: new Color('#7a5fb0'), emissiveIntensity: 0.6 }), 0, 0, 0, 0.17);
    const halo = new Sprite(new SpriteMaterial({ map: glowTex, color: '#c9b6e4', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    disposables.push(halo.material); halo.scale.setScalar(0.8);
    const ring = prim(geo(new TorusGeometry(0.3, 0.012, 8, 64)), vinyl(GOLD, { metalness: 1, roughness: 0.3 }));
    ring.rotation.x = 1.2;
    g.add(orb, halo, ring); g.position.set(0.95, 1.7, 0.2); g.userData.orbit = true;
    pip.add(g); extras.push(g);
  }

  // ---- outfit textures ----
  const SUIT_TEX = [pattern('#fff5e8', PINK, 'hearts'), pattern('#c9b6e4', '#fff5e8', 'stars'), pattern('#bfe8d6', '#fff5e8', 'stripes'), pattern(PINK, '#fff5e8', 'dots'), pattern('#2b2350', GOLD, 'stars')];
  const CAP_TEX = [pattern('#fdf3e1', '#e8b84a', 'stars', 5, 3), pattern('#c9b6e4', '#fff5e8', 'stars', 5, 3)];
  disposables.push(...SUIT_TEX, ...CAP_TEX);

  let fit: Fit = { hat: 0, suit: 0, extra: 0 };
  const setFit = (f: Fit) => {
    fit = f;
    const nightcap = f.hat <= 1;
    cap.visible = pompom.visible = nightcap;
    if (nightcap) { capMat.map = CAP_TEX[f.hat]; capMat.needsUpdate = true; }
    partyHat.visible = f.hat === 2;
    crown.visible = f.hat === 3;
    bow.visible = f.hat !== 2 && f.hat !== 3;
    bow.position.copy(bowHome);
    if (f.hat === 4) bow.position.add(new Vector3(0.02, 0.12, -0.06)); // sits on the bare head
    suitMat.map = SUIT_TEX[f.suit]; suitMat.needsUpdate = true;
    extras.forEach((e, i) => { e.visible = i === f.extra; });
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
    camera.position.z = camera.aspect < 0.8 ? 11 : 8.8;
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
    const bob = opts.still ? 0 : Math.sin(t * 2) * 0.03;
    hop = Math.max(0, hop - dt * 2.4);
    const jump = Math.sin(hop * Math.PI);
    pip.position.y = bob + jump * 0.35;
    // squash before the hop, stretch in the air, and soft breathing the rest of the time
    const breathe = opts.still ? 0 : Math.sin(t * 2) * 0.012;
    pip.scale.set(1 - jump * 0.06 - breathe, 1 + jump * 0.1 + breathe, 1 - jump * 0.06 - breathe);
    head.rotation.y += ((lookX * 0.35) - head.rotation.y) * 0.08;
    head.rotation.x += ((-lookY * 0.2) - head.rotation.x) * 0.08;
    head.rotation.z = 0.1 + (opts.still ? 0 : Math.sin(t * 1.3) * 0.05);   // a little curious head tilt
    hearts.forEach((h) => {
      h.userData.age += dt;
      const a = h.userData.age;
      h.position.y = h.userData.y0 + a * 0.7; h.position.x = h.userData.x0 + Math.sin(a * 5 + h.userData.ph) * 0.08;
      (h.material as SpriteMaterial).opacity = Math.max(0, 1 - a / 1.6);
      h.visible = a >= 0 && a < 1.6;
    });
    eyeX += (lookX - eyeX) * 0.15; eyeY += (lookY - eyeY) * 0.15;
    lights.forEach((l, i) => { l.position.x = (i ? 0.32 : -0.32) + eyeX * 0.06; l.position.y = -0.08 + eyeY * 0.06; });
    blinkAt -= dt;
    const blink = blinkAt < 0 && blinkAt > -0.14 ? 0.12 : 1;
    if (blinkAt < -0.14) blinkAt = 2 + Math.random() * 3;
    lights.forEach((l) => { l.scale.y = blink; });
    if (wave > 0) { wave = Math.max(0, wave - dt); armR.rotation.z = 2.4 + Math.sin(t * 14) * 0.35; armR.rotation.x = -0.2; if (wave === 0) setFit(fit); }
    const ex = extras[fit.extra];
    if (ex.userData.spin) (ex.userData.spin as Object3D).rotation.y = t * 2;
    if (ex.userData.float) (ex.userData.float as Object3D).position.x = -0.45 + Math.sin(t * 1.4) * 0.05;
    if (ex.userData.orbit && !opts.still) { ex.position.set(Math.cos(t * 0.9) * 0.95, 1.7 + Math.sin(t * 1.8) * 0.12, Math.sin(t * 0.9) * 0.6); ex.rotation.y = t; }
    animateSet(t, dt);
    renderer.render(scene, camera);
  };

  return {
    setFit,
    look(x, y) { lookX = Math.max(-1, Math.min(1, x)); lookY = Math.max(-1, Math.min(1, y)); },
    spinBy(dx, dy = 0) { vel = dx; pitch = Math.max(-0.35, Math.min(0.25, pitch + dy)); auto = false; },
    poke() {
      hop = 1; wave = 1.2;
      hearts.forEach((h, i) => { h.userData.age = -i * 0.12; h.userData.x0 = (Math.random() - 0.5) * 1.2; h.userData.y0 = 2.5 + Math.random() * 0.2; h.userData.ph = Math.random() * 6; h.position.set(h.userData.x0, h.userData.y0, 0.6); h.visible = false; });
    },
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
