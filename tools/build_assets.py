#!/usr/bin/env python3
"""Recorta los sprite sheets de /Descargas/Stranger y genera assets/ + js/atlas.js.
Uso: python3 tools/build_assets.py [carpeta_origen]"""
import sys, os, json
from PIL import Image, ImageFilter, ImageChops

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/santi/Descargas/Stranger'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
JS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'atlas.js')
os.makedirs(OUT, exist_ok=True)

def dist(a, b):
    return ((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2) ** 0.5

# ---------------- extraccion de frames ----------------
def frames_in(img, box, bg, thr=26, gap=7, minw=14, expect=None):
    x0, y0, x1, y1 = box
    crop = img.crop(box).convert('RGB')
    w, h = crop.size
    px = crop.load()
    mask = [[dist(px[x, y], bg) > thr for x in range(w)] for y in range(h)]
    cols = [sum(1 for y in range(h) if mask[y][x]) for x in range(w)]
    runs, start, last = [], None, None
    for x in range(w):
        if cols[x] >= 2:
            if start is None: start = x
            last = x
        elif start is not None and x - last > gap:
            runs.append((start, last)); start = None
    if start is not None: runs.append((start, last))
    runs = [r for r in runs if r[1]-r[0] >= minw]
    if expect and len(runs) != expect:
        # corte por valles de la proyeccion, repartiendo en 'expect' ranuras
        first = next(x for x in range(w) if cols[x] >= 2)
        last = max(x for x in range(w) if cols[x] >= 2)
        slot = (last-first+1)/expect
        cuts = [first]
        for i in range(1, expect):
            t = first + i*slot
            lo, hi = int(t-slot*0.3), int(t+slot*0.3)
            cuts.append(min(range(lo, hi), key=lambda x: (cols[x], abs(x-t))))
        cuts.append(last+1)
        runs = [(cuts[i], cuts[i+1]-1) for i in range(expect)]
    return crop, runs

def cut(crop, run, bg, thr=26):
    """devuelve RGBA recortado, quitando fondo por flood fill desde el borde"""
    a, b = run
    f = crop.crop((max(a-2, 0), 0, min(b+3, crop.width), crop.height)).convert('RGB')
    w, h = f.size
    px = f.load()
    seen = [[False]*w for _ in range(h)]
    stack = []
    for x in range(w):
        stack += [(x, 0), (x, h-1)]
    for y in range(h):
        stack += [(0, y), (w-1, y)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]: continue
        if dist(px[x, y], bg) > thr: continue
        seen[y][x] = True
        stack += [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if seen[y][x] or dist(px[x, y], bg) < 12:
                op[x, y] = (0, 0, 0, 0)
            else:
                op[x, y] = px[x, y] + (255,)
    # quita lineas finas del panel y motas sueltas
    seen2 = [[False]*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if seen2[y][x] or op[x, y][3] == 0: continue
            comp, st = [], [(x, y)]
            seen2[y][x] = True
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1), (cx+1, cy+1), (cx-1, cy-1), (cx+1, cy-1), (cx-1, cy+1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen2[ny][nx] and op[nx, ny][3]:
                        seen2[ny][nx] = True; st.append((nx, ny))
            xs = [c[0] for c in comp]; ys = [c[1] for c in comp]
            cw_, ch_ = max(xs)-min(xs)+1, max(ys)-min(ys)+1
            if len(comp) < 30 or (min(cw_, ch_) <= 4 and max(cw_, ch_) >= 14):
                for cx, cy in comp: op[cx, cy] = (0, 0, 0, 0)
    bb = out.getbbox()
    return out.crop(bb) if bb else None

def build_char(name, sheet, bg, rows, thr=26, blank=()):
    """rows: {anim: (box, expected_count, anchor)}  anchor: 'c' centro | ('l', offset)"""
    img = Image.open(os.path.join(SRC, sheet)).convert('RGB')
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for b in blank: d.rectangle(b, fill=bg)
    items = []  # (anim, idx, frame, ax)
    for anim, (box, n, anchor) in rows.items():
        crop, runs = frames_in(img, box, bg, thr, expect=n)
        if n and len(runs) != n:
            print(f'  !! {name}.{anim}: esperaba {n} frames, detecte {len(runs)} {runs}')
        for i, r in enumerate(runs):
            fr = cut(crop, r, bg, thr)
            if fr is None: continue
            ax = fr.width/2 if anchor == 'c' else anchor[1]
            items.append((anim, i, fr, ax))
    half = max(max(ax, fr.width-ax) for _, _, fr, ax in items)
    cw = int(half*2)+2
    ch = max(fr.height for _, _, fr, _ in items)+2
    anims = {}
    order = list(rows.keys())
    maxn = max(sum(1 for it in items if it[0] == a) for a in order)
    atlas = Image.new('RGBA', (cw*maxn, ch*len(order)), (0, 0, 0, 0))
    for r, a in enumerate(order):
        fs = [it for it in items if it[0] == a]
        anims[a] = {'row': r, 'n': len(fs)}
        for c, (_, _, fr, ax) in enumerate(fs):
            atlas.paste(fr, (int(c*cw + cw/2 - ax), r*ch + ch - fr.height - 1), fr)
    atlas.save(os.path.join(OUT, f'{name}.png'))
    print(f'{name}: cell {cw}x{ch}', {k: v['n'] for k, v in anims.items()})
    return {'img': f'assets/{name}.png', 'cw': cw, 'ch': ch, 'anims': anims}

DARK = (22, 18, 30)
atlas = {}

# --- Will / Demogorgon (WA0024)
atlas['will'] = build_char('will', 'IMG-20261121-WA0024.jpg', DARK, {
    'idle':  ((1025, 30, 1500, 130), 4, 'c'),
    'walk':  ((1025, 132, 1500, 230), 5, 'c'),
    'shoot': ((1025, 232, 1500, 340), 4, ('l', 38)),
    'other': ((1025, 355, 1500, 470), 4, 'c'),
})
atlas['demogorgon'] = build_char('demogorgon', 'IMG-20261121-WA0024.jpg', DARK, {
    'idle':   ((1050, 528, 1500, 630), 4, 'c'),
    'walk':   ((1040, 650, 1500, 735), 4, 'c'),
    'attack': ((1045, 738, 1510, 835), 4, ('l', 45)),
    'roar':   ((1050, 840, 1500, 960), 4, 'c'),
})
# --- Eleven (WA0025)
E = 'IMG-20261121-WA0025.jpg'
atlas['eleven'] = build_char('eleven', E, DARK, {
    'idle':  ((1040, 160, 1510, 285), 4, 'c'),
    'walk':  ((1040, 305, 1510, 430), 4, 'c'),
    'power': ((1040, 460, 1510, 590), 4, 'c'),
    'other': ((1040, 640, 1510, 760), 4, 'c'),
})
# --- Mike (WA0027)
atlas['mike'] = build_char('mike', 'IMG-20261121-WA0027.jpg', DARK, {
    'idle':  ((1045, 160, 1510, 285), 4, 'c'),
    'walk':  ((1045, 305, 1510, 430), 4, 'c'),
    'talk':  ((1045, 460, 1510, 590), 4, 'c'),
    'other': ((1045, 640, 1510, 760), 4, 'c'),
})
# --- Dustin (WA0028)
atlas['dustin'] = build_char('dustin', 'IMG-20261121-WA0028.jpg', DARK, {
    'idle':  ((1045, 160, 1510, 285), 4, 'c'),
    'walk':  ((1045, 305, 1510, 430), 4, 'c'),
    'talk':  ((1045, 460, 1510, 590), 4, 'c'),
    'other': ((1045, 640, 1510, 760), 4, 'c'),
})
# --- Steve (WA0029)
S = 'IMG-20261121-WA0029.jpg'
atlas['steve'] = build_char('steve', S, DARK, {
    'idle':   ((50, 590, 440, 725), 4, 'c'),
    'walk':   ((490, 590, 990, 725), 5, 'c'),
    'run':    ((1030, 590, 1510, 725), 4, 'c'),
    'attack': ((40, 810, 560, 955), 5, ('l', 40)),
    'hurt':   ((595, 825, 985, 955), 4, 'c'),
    'other':  ((1020, 815, 1440, 955), 4, 'c'),
})
# --- Mind Master / Vecna (Sin titulo.png)
M = 'Sin título.png'
atlas['vecna'] = build_char('vecna', M, (20, 18, 24), {
    'idle':   ((30, 330, 360, 445), 4, 'c'),
    'walk':   ((385, 330, 790, 445), 5, 'c'),
    'cast':   ((805, 330, 1195, 445), 4, ('l', 45)),
    'tend':   ((800, 470, 1265, 585), 4, ('l', 45)),
    'hurt':   ((15, 615, 375, 750), 4, 'c'),
    'phase':  ((380, 625, 800, 750), 4, 'c'),
    'die':    ((815, 615, 1265, 750), 5, 'c'),
}, thr=22, blank=[(30,306,142,338),(392,306,488,338),(812,306,975,338),
                      (800,458,965,490),(28,600,102,632),(388,600,598,632),(828,600,940,632)])

with open(JS, 'w') as f:
    f.write('window.ATLAS = ' + json.dumps(atlas, indent=1) + ';\n')

# ---------------- fondo ----------------
bg = Image.open(os.path.join(SRC, 'IMG-20261121-WA0022.jpg')).convert('RGB')
# tapar a Will: copiar una franja limpia de la propia imagen, con bordes suavizados
def feather_patch(bg, dst, dx, fe=34, bottom_soft=False):
    src = bg.crop((dst[0]+dx, dst[1], dst[2]+dx, dst[3]))
    mask = Image.new('L', src.size, 255)
    mp = mask.load()
    for y in range(src.height):
        for x in range(src.width):
            d = min(x, src.width-1-x, y)
            if bottom_soft: d = min(d, src.height-1-y)
            mp[x, y] = int(255*min(1, d/fe))
    bg.paste(src, (dst[0], dst[1]), mask)
# fusil: franja limpia de la izquierda
feather_patch(bg, (700, 520, 975, 680), -480, fe=30, bottom_soft=True)
# cuerpo de Will: franja (ya limpia) de la derecha
feather_patch(bg, (515, 355, 775, 772), 270)
bg.save(os.path.join(OUT, 'bg_full.png'))
GROUND = 750
bg.crop((0, 0, 1536, GROUND)).save(os.path.join(OUT, 'bg_far.png'))
bg.crop((0, GROUND, 1536, 1024)).save(os.path.join(OUT, 'bg_floor.png'))
print('fondo ok')
