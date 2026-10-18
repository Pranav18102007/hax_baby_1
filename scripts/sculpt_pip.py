"""
Sculpts 3D Pip from signed distance fields (smooth-blended shapes, carved eye sockets and smile),
meshes each part with marching cubes, simplifies, and writes public/models/pip.glb (meshopt-compressed).

Parts are separate named meshes so the site can recolour the onesie / nightcap and pose the arms:
  head (vertex-painted: bone, dark sockets/nose/smile, blush), body, foot_l, foot_r,
  arm_l, arm_r, hand_l, hand_r (arms/hands in shoulder-local coords), cap, pompom, bow, cloud.
Run:  python3 scripts/sculpt_pip.py
"""
import numpy as np
import trimesh
import pyfqmr
from skimage.measure import marching_cubes
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'assets-raw' / 'pip-sculpt.glb'          # full-size sculpt (not deployed)
OUT = ROOT / 'public' / 'models' / 'pip.glb'           # meshopt-compressed copy the site loads

# ---------- SDF building blocks (vectorised over (N,3) points) ----------
def length(v): return np.sqrt((v * v).sum(-1))

def sphere(p, c, r): return length(p - np.asarray(c)) - r

def ellipsoid(p, c, r):
    q = (p - np.asarray(c)) / np.asarray(r)
    k0 = length(q); k1 = length(q / np.asarray(r))
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)

def capsule(p, a, b, r):
    a, b = np.asarray(a), np.asarray(b)
    pa, ba = p - a, b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return length(pa - h[:, None] * ba) - r

def round_cone(p, a, b, ra, rb):
    """capsule whose radius goes from ra (at a) to rb (at b), approximated by lerping radius along the segment"""
    a, b = np.asarray(a), np.asarray(b)
    pa, ba = p - a, b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return length(pa - h[:, None] * ba) - (ra + (rb - ra) * h)

def torus_xz(p, c, R, r):
    q = p - np.asarray(c)
    return np.sqrt((np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - R) ** 2 + q[:, 1] ** 2) - r

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)

def ssub(d, cut, k):  # smooth subtraction: d minus cut
    h = np.clip(0.5 - 0.5 * (d + cut) / k, 0, 1)
    return d + (-cut - d) * h + k * h * (1 - h)

def noise3(p, f, a):
    x, y, z = p[:, 0] * f, p[:, 1] * f, p[:, 2] * f
    return a * (np.sin(x * 1.7 + np.sin(y * 2.3)) * np.sin(y * 1.9 + np.sin(z * 2.1)) * np.sin(z * 1.3 + np.sin(x * 2.7)))

def bezier(pts, t):
    pts = np.asarray(pts, float)
    while len(pts) > 1:
        pts = pts[:-1] * (1 - t) + pts[1:] * t
    return pts[0]

# ---------- parts (world coords, y up, +z towards the viewer) ----------
HEAD_C = np.array([0.0, 1.86, 0.0])
SOCKETS = [np.array([s * 0.29, 1.85, 0.6]) for s in (-1, 1)]

def head_sdf(p):
    d = ellipsoid(p, HEAD_C, (0.78, 0.71, 0.74))
    d = smin(d, ellipsoid(p, (0, 1.66, 0.1), (0.64, 0.5, 0.62)), 0.18)   # chubby cheeks / jaw
    for s in (-1, 1):
        d = smin(d, ellipsoid(p, (s * 0.47, 1.62, 0.46), (0.25, 0.22, 0.24)), 0.1)  # round, puffy cheek apples
    for c in SOCKETS:
        d = ssub(d, ellipsoid(p, c + (0, 0, 0.06), (0.205, 0.245, 0.2)), 0.05)  # big hollow eye sockets
    d = ssub(d, ellipsoid(p, (0, 1.665, 0.735), (0.05, 0.035, 0.06)), 0.02)       # little nose
    arc = [(np.sin(a) * 0.1, 1.585 - np.cos(a) * 0.055, 0.74 - abs(np.sin(a)) * 0.03) for a in np.linspace(-1.25, 1.25, 9)]
    smile = np.min([capsule(p, arc[i], arc[i + 1], 0.021) for i in range(len(arc) - 1)], axis=0)
    return ssub(d, smile, 0.015)

def head_colors(v):
    bone = np.array([246, 236, 220]); dark = np.array([52, 30, 42]); blush = np.array([246, 170, 190])
    col = np.tile(bone, (len(v), 1)).astype(float)
    for c in SOCKETS:   # inside the socket bowls goes dark
        q = (v - (c + (0, 0, 0.06))) / np.array([0.23, 0.27, 0.24])
        w = np.clip((1.08 - length(q)) * 5, 0, 1)[:, None]
        col = col * (1 - w) + dark * w
    nose = np.clip((0.07 - length((v - (0, 1.665, 0.72)) / (1, 1.3, 1))) * 40, 0, 1)[:, None]
    col = col * (1 - nose) + dark * nose
    arc = [(np.sin(a) * 0.1, 1.585 - np.cos(a) * 0.055, 0.74 - abs(np.sin(a)) * 0.03) for a in np.linspace(-1.25, 1.25, 9)]
    sm = np.min([capsule(v, arc[i], arc[i + 1], 0.0) for i in range(len(arc) - 1)], axis=0)
    w = np.clip((0.035 - sm) * 45, 0, 1)[:, None]
    col = col * (1 - w) + dark * w
    for s in (-1, 1):   # soft blush
        w = np.clip(1 - length((v - (s * 0.5, 1.6, 0.6)) / (0.19, 0.13, 0.22)), 0, 1)[:, None] ** 1.5 * 0.8
        col = col * (1 - w) + blush * w
    return col

def body_sdf(p):
    d = ellipsoid(p, (0, 0.95, 0), (0.58, 0.62, 0.5))
    d = smin(d, ellipsoid(p, (0, 0.84, 0.12), (0.5, 0.46, 0.44)), 0.15)       # round baby tummy
    d = smin(d, capsule(p, (0, 1.2, 0), (0, 1.36, 0), 0.24), 0.1)              # neck
    d = smin(d, torus_xz(p, (0, 1.3, 0), 0.25, 0.05), 0.04)                   # collar
    for s in (-1, 1):                                                          # sitting legs
        d = smin(d, round_cone(p, (s * 0.24, 0.66, 0.08), (s * 0.28, 0.56, 0.6), 0.2, 0.15), 0.12)
    d = d + noise3(p, 9, 0.004)                                                # soft fabric wobble
    for i, y in enumerate((1.12, 0.98, 0.84)):                                 # little buttons
        d = smin(d, sphere(p, (0, y, 0.5 - i * 0.012), 0.028), 0.02)
    return d

def foot_sdf(s):
    return lambda p: smin(ellipsoid(p, (s * 0.29, 0.55, 0.72), (0.17, 0.15, 0.2)), sphere(p, (s * 0.29, 0.6, 0.64), 0.12), 0.08)

# arms built in shoulder-local coords (shoulder at origin, hanging down)
def arm_sdf(p):
    d = round_cone(p, (0, 0, 0), (0, -0.34, 0.05), 0.16, 0.13)
    return smin(d, torus_xz(p - np.array([0, 0, 0]), (0, -0.36, 0.05), 0.11, 0.04), 0.03)  # cuff

def hand_sdf(p):
    d = ellipsoid(p, (0, -0.5, 0.07), (0.13, 0.14, 0.12))
    return smin(d, ellipsoid(p, (0.08, -0.45, 0.13), (0.05, 0.06, 0.05)), 0.04)          # mitten thumb

# nightcap in head-local coords (origin = head centre)
CAP_PATH = [(0, 0.3, 0), (0.02, 0.95, -0.02), (0.55, 1.15, -0.08), (0.95, 0.62, -0.06)]
def cap_sdf(p):
    ts = np.linspace(0, 1, 28)
    pts = [bezier(CAP_PATH, t) for t in ts]
    rad = 0.64 * (1 - ts) ** 1.15 + 0.1
    d = np.min([round_cone(p, pts[i], pts[i + 1], rad[i], rad[i + 1]) for i in range(len(ts) - 1)], axis=0)
    d = d + 0.012 * np.sin(np.arctan2(p[:, 0], p[:, 2]) * 7 + p[:, 1] * 6)    # soft cloth folds
    d = np.maximum(d, -(p[:, 1] - 0.26))                                        # open at the bottom
    d = smin(d, torus_xz(p, (0, 0.3, 0), 0.66, 0.13), 0.06)                     # rolled brim
    return d

def pompom_sdf(p):
    c = bezier(CAP_PATH, 1.0) + np.array([0.05, -0.1, 0])
    return sphere(p, c, 0.17) + noise3(p, 40, 0.012)

def bow_sdf(p):
    c = np.array([-0.45, 0.44, 0.5])
    d = sphere(p, c, 0.07)
    for s in (-1, 1):
        d = smin(d, ellipsoid(p, c + (s * 0.15, 0.015, -0.01), (0.155, 0.11, 0.06)), 0.04)
        d = smin(d, capsule(p, c, c + (s * 0.09, -0.17, 0), 0.03), 0.02)
    return d

def cloud_sdf(p):
    puffs = [(0, 0.18, 0, 0.62), (-0.68, 0.12, 0.08, 0.46), (0.7, 0.14, 0.05, 0.5), (-0.3, 0.1, 0.42, 0.42), (0.36, 0.1, 0.4, 0.44),
             (-1.1, 0.04, 0, 0.32), (1.12, 0.05, 0.02, 0.34), (0.1, 0.12, -0.42, 0.45), (-0.6, 0.06, -0.3, 0.36), (0.66, 0.06, -0.3, 0.36)]
    d = None
    for x, y, z, r in puffs:
        e = ellipsoid(p, (x, y, z), (r, r * 0.8, r))
        d = e if d is None else smin(d, e, 0.12)
    d = d + noise3(p, 7, 0.015)
    return -smin(-d, (p[:, 1] + 0.12), 0.12)                                    # softly flattened underside

# ---------- meshing ----------
def mesh(sdf, lo, hi, h, target, colors=None):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    axes = [np.linspace(lo[i], lo[i] + (n[i] - 1) * h, n[i]) for i in range(3)]
    X, Y, Z = np.meshgrid(*axes, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], -1).astype(np.float32)
    vol = sdf(P).reshape(n)
    v, f, _, _ = marching_cubes(vol, 0.0, spacing=(h, h, h))
    v = v + lo
    s = pyfqmr.Simplify(); s.setMesh(v, f); s.simplify_mesh(target_count=target, aggressiveness=5, preserve_border=True, verbose=0)
    v, f, _ = s.getMesh()
    m = trimesh.Trimesh(v, f, process=True)
    trimesh.smoothing.filter_taubin(m, iterations=6)
    trimesh.repair.fix_normals(m)
    if m.volume < 0: m.invert()  # faces point outwards
    if colors is not None:
        c = colors(m.vertices)
        c = np.clip(c / 255.0, 0, 1) ** 2.2 * 255  # glTF vertex colours are linear
        m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=np.c_[c, np.full(len(c), 255)].astype(np.uint8))
    print(f'  {len(m.faces):6d} tris')
    return m

def main():
    scene = trimesh.Scene()
    def add(name, m):
        print(name, end='')
        scene.add_geometry(m, node_name=name, geom_name=name)
    hc = HEAD_C
    add('head', mesh(head_sdf, hc - 0.95, hc + 0.95, 0.011, 16000, head_colors))
    add('body', mesh(body_sdf, (-0.75, 0.3, -0.6), (0.75, 1.45, 0.85), 0.012, 9000))
    for s, n in ((-1, 'l'), (1, 'r')):
        print(f'foot_{n}', end=''); scene.add_geometry(mesh(foot_sdf(s), (s * 0.29 - 0.25, 0.3, 0.4), (s * 0.29 + 0.25, 0.85, 1.0), 0.01, 1500), node_name=f'foot_{n}', geom_name=f'foot_{n}')
    add('arm', mesh(arm_sdf, (-0.25, -0.5, -0.25), (0.25, 0.2, 0.3), 0.01, 2500))
    add('hand', mesh(hand_sdf, (-0.2, -0.7, -0.15), (0.2, -0.3, 0.25), 0.008, 1500))
    cap = lambda p: cap_sdf(p - hc)
    add('cap', mesh(cap, hc + (-0.95, 0.1, -0.9), hc + (1.25, 1.4, 0.9), 0.012, 9000))
    add('pompom', mesh(lambda p: pompom_sdf(p - hc), hc + (0.7, 0.2, -0.35), hc + (1.3, 0.85, 0.25), 0.008, 2500))
    add('bow', mesh(lambda p: bow_sdf(p - hc), hc + (-0.8, 0.1, 0.3), hc + (-0.05, 0.7, 0.75), 0.007, 2500))
    add('cloud', mesh(cloud_sdf, (-1.6, -0.6, -1.0), (1.6, 0.85, 1.0), 0.016, 9000))
    RAW.parent.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    scene.export(RAW, include_normals=True)
    print('wrote', RAW, RAW.stat().st_size // 1024, 'KB')
    import subprocess
    subprocess.run(['npx', '-y', '@gltf-transform/cli@4', 'meshopt', str(RAW), str(OUT), '--level', 'medium'], check=True)
    print('wrote', OUT, OUT.stat().st_size // 1024, 'KB')

if __name__ == '__main__':
    main()
