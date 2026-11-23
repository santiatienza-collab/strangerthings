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

def cut(crop, run, bg, thr=26, solid=False, boost=1.0):
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
    if solid:
        # silueta cerrada: el cuerpo oscuro no se confunde con el fondo del sheet
        fg = Image.new('L', (w, h))
        fp = fg.load()
        for y in range(h):
            for x in range(w):
                fp[x, y] = 255 if dist(px[x, y], bg) > 14 else 0
        cp = fg.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).load()
        seen = [[False]*w for _ in range(h)]
        stack = [(x, 0) for x in range(w)] + [(x, h-1) for x in range(w)] + [(0, y) for y in range(h)] + [(w-1, y) for y in range(h)]
        while stack:
            x, y = stack.pop()
            if x < 0 or y < 0 or x >= w or y >= h or seen[y][x] or cp[x, y]: continue
            seen[y][x] = True
            stack += [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if seen[y][x] or (not solid and dist(px[x, y], bg) < 12):
                op[x, y] = (0, 0, 0, 0)
            else:
                r, g, b = px[x, y]
                if boost != 1.0:
                    r, g, b = min(255, int(r*boost)+6), min(255, int(g*boost)+3), min(255, int(b*boost)+3)
                op[x, y] = (r, g, b, 255)
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
    if not bb: return None
    if bb[1] <= 0 or bb[3] >= h:
        print('   (aviso) frame toca el borde vertical del recorte', 'arriba' if bb[1] <= 0 else 'abajo')
    return out.crop(bb)

def sheet_frames(sheet, bg, box, n, thr=26):
    img = Image.open(os.path.join(SRC, sheet)).convert('RGB')
    # borra la rejilla del panel: sus píxeles son grises apagados (el personaje no usa grises medios)
    x0, y0, x1, y1 = box
    px = img.load()
    for y in range(max(0, y0 - 16), min(img.height, y1 + 16)):
        for x in range(max(0, x0 - 16), min(img.width, x1 + 16)):
            c = px[x, y]
            if 66 <= min(c) and max(c) <= 112 and max(c) - min(c) <= 20 and c[0] >= c[1] - 2: px[x, y] = bg
    crop, runs = frames_in(img, box, bg, thr, expect=n)
    return [thin_clean(fr) for fr in (cut(crop, r, bg, thr) for r in runs) if fr is not None]

def head_x(fr):
    """ancla de los frames de andar: centro de la cabeza (parte alta), que apenas se mueve en el ciclo;
    así el cuerpo no tiembla al cambiar de frame como con el centro del recuadro"""
    a = fr.getchannel('A').load(); w, h = fr.size
    xs = [x for y in range(int(h * 0.30)) for x in range(w) if a[x, y]]
    return sum(xs) / len(xs) if xs else w / 2

def thin_clean(fr, passes=2, opening=True):
    """quita rebabas de 1-2 px (restos de la rejilla pegados al contorno)"""
    fr = fr.copy()
    # apertura morfológica: lo que es más fino que 3 px (líneas de rejilla) desaparece; se conserva 1 px de margen al cuerpo
    a = fr.getchannel('A').point(lambda v: 255 if v > 0 else 0)
    body = a.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MaxFilter(3))
    ap, bp, fp = a.load(), body.load(), fr.load()
    for y in range(fr.height if opening else 0):
        for x in range(fr.width):
            if ap[x, y] and not bp[x, y]: fp[x, y] = (0, 0, 0, 0)
    # motas sueltas que han quedado separadas del personaje
    w, h = fr.size; fp = fr.load(); seen = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not fp[x, y][3]: continue
            comp, st = [], [(x, y)]; seen.add((x, y))
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for nx in (cx-1, cx, cx+1):
                    for ny in (cy-1, cy, cy+1):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and fp[nx, ny][3]:
                            seen.add((nx, ny)); st.append((nx, ny))
            if len(comp) < 40:
                for cx, cy in comp: fp[cx, cy] = (0, 0, 0, 0)
    bb = fr.getbbox()
    return fr.crop(bb) if bb else fr

def build_char(name, sheet, bg, rows, thr=26, blank=(), solid=False, boost=1.0, idle_h=None, override=None):
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
            if i == 0: print(f'  [{name}.{anim}]')
            fr = cut(crop, r, bg, thr, solid, boost)
            if fr is None: continue
            ax = fr.width/2 if anchor == 'c' else anchor[1]
            items.append((anim, i, fr, ax))
    if idle_h:  # normaliza la escala para que el idle mida idle_h px (mismo tamaño que en el juego)
        h0 = next(fr.height for a, i, fr, _ in items if a == 'idle' and i == 0)
        k = idle_h / h0
        items = [(a, i, fr.resize((max(1, round(fr.width*k)), max(1, round(fr.height*k))), Image.LANCZOS), ax*k) for a, i, fr, ax in items]
        print(f'  escala {name}: x{k:.3f}')
    if override:  # animaciones reemplazadas por frames de otra hoja, escalados a la altura del idle
        h_idle = next(fr.height for a, i, fr, _ in items if a == 'idle' and i == 0)
        for anim, (osheet, obg, obox, on) in override.items():
            frs = sheet_frames(osheet, obg, obox, on)
            k = h_idle / sorted(f.height for f in frs)[len(frs)//2]
            items = [it for it in items if it[0] != anim]
            for i, fr in enumerate(frs):
                fr = fr.resize((max(1, round(fr.width*k)), max(1, round(fr.height*k))), Image.NEAREST if k >= 1 else Image.BOX)
                items.append((anim, i, fr, head_x(fr)))
            print(f'  {name}.{anim}: {len(frs)} frames nuevos de {osheet}, escala x{k:.3f}')
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

# --- Will y Demogorgon: hojas nuevas (will.png / demogorgon.png)
atlas['will'] = build_char('will', 'will.png', (21, 16, 24), {
    'idle':  ((55, 538, 575, 690), 4, 'c'),
    'walk':  ((635, 538, 1450, 690), 6, 'c'),
    'shoot': ((40, 768, 712, 925), 5, ('l', 52)),
    'other': ((735, 764, 1520, 925), 7, 'c'),
}, idle_h=80, override={'walk': ('Gemini_Generated_Image_5lqkgz5lqkgz5lqk.jpeg', (26, 25, 31), (60, 88, 1230, 335), 6)}, blank=[(40, 490, 215, 540), (625, 490, 790, 540), (40, 712, 250, 764), (745, 712, 975, 764)])
atlas['demogorgon'] = build_char('demogorgon', 'demogorgon.png', (19, 18, 25), {
    'idle':   ((45, 452, 595, 595), 4, 'c'),
    'walk':   ((622, 452, 1490, 595), 6, 'c'),
    'attack': ((38, 648, 795, 778), 5, ('l', 62)),
    'roar':   ((828, 606, 1505, 778), 4, 'c'),
    'hurt':   ((38, 828, 708, 978), 5, 'c'),
    'die':    ((738, 834, 1515, 978), 5, 'c'),
}, idle_h=92, blank=[(30, 405, 200, 463), (630, 405, 782, 463), (30, 598, 242, 647), (826, 598, 1006, 647), (28, 783, 216, 833), (740, 783, 845, 833)])
# --- Eleven (WA0025)
E = 'IMG-20261121-WA0025.jpg'
atlas['eleven'] = build_char('eleven', E, DARK, {
    'idle':  ((1040, 160, 1510, 285), 4, 'c'),
    'walk':  ((1040, 305, 1510, 430), 4, 'c'),
    'power': ((1040, 460, 1510, 590), 4, 'c'),
    'other': ((1040, 640, 1510, 760), 4, 'c'),
}, override={'walk': ('Gemini_Generated_Image_ohbt8iohbt8iohbt.jpeg', (26, 24, 27), (234, 128, 1326, 356), 8)})
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
# --- Vecna (vicna.png): hoja nueva de 8 frames por animación, sin reescalado suave (nítido)
def build_vecna(sheet='vicna.png', bg=(11, 8, 11), target_h=176):
    img = Image.open(os.path.join(SRC, sheet)).convert('RGB')
    # fila -> (caja, nº de frames de la hoja, qué frames se usan)
    ROWS = {
        'walk':  ((25, 408, 725, 556), 8, range(8)),
        'cast':  ((975, 83, 1765, 204), 8, range(6)),    # telekinesis (sin las rocas: las dibuja el juego)
        'bind':  ((975, 234, 1765, 344), 8, range(3)),   # control mental (sin la silueta de la víctima)
        'spike': ((975, 375, 1765, 486), 8, range(3)),   # agacharse; los pinchos los dibuja el juego
        'tend':  ((975, 518, 1765, 632), 8, range(6)),   # zarcillos
        'phase': ((975, 662, 1765, 798), 8, range(8)),   # cambio de fase
    }
    frames = {}
    for anim, (box, n, use) in ROWS.items():
        crop, runs = frames_in(img, box, bg, 22, expect=n)
        if len(runs) != n: print(f'  !! vecna.{anim}: esperaba {n}, detecte {len(runs)}')
        got = []
        for i in use:
            fr = cut(crop, runs[i], bg, 22, solid=True)
            if fr is not None: got.append(fr)
        # mismo tamaño de cuerpo en todas las filas: el primer frame (de pie) mide target_h
        k = target_h / got[0].height
        scaled = []
        for fr in got:
            fr = thin_clean(fr, 0, opening=False)
            scaled.append(fr.resize((max(1, round(fr.width*k)), max(1, round(fr.height*k))), Image.NEAREST))
        frames[anim] = scaled
        print(f'  vecna.{anim}: {len(scaled)} frames, escala x{k:.2f}')
    frames['idle'] = [frames['cast'][0]] * 4
    frames['die'] = [frames['spike'][0], frames['spike'][1], frames['spike'][2], frames['spike'][2], frames['spike'][2]]
    # ancla = centro de los pies (último 22% del frame), para que no "baile" al cambiar de frame
    def feet_x(fr):
        a = fr.getchannel('A'); w, h = fr.size; ap = a.load()
        xs = [x for y in range(int(h*0.78), h) for x in range(w) if ap[x, y]]
        return sum(xs)/len(xs) if xs else w/2
    order = ['idle', 'walk', 'cast', 'bind', 'spike', 'tend', 'phase', 'die']
    items = [(an, i, fr, feet_x(fr)) for an in order for i, fr in enumerate(frames[an])]
    half = max(max(ax, fr.width-ax) for _, _, fr, ax in items)
    cw = int(half*2)+2
    ch = max(fr.height for _, _, fr, _ in items)+2
    maxn = max(len(frames[a]) for a in order)
    atlas_img = Image.new('RGBA', (cw*maxn, ch*len(order)), (0, 0, 0, 0))
    anims = {}
    for r, an in enumerate(order):
        anims[an] = {'row': r, 'n': len(frames[an])}
        for c, fr in enumerate(frames[an]):
            atlas_img.paste(fr, (int(c*cw + cw/2 - feet_x(fr)), r*ch + ch - fr.height - 1), fr)
    atlas_img.save(os.path.join(OUT, 'vecna.png'))
    print(f'vecna: cell {cw}x{ch}', {k: v['n'] for k, v in anims.items()})
    return {'img': 'assets/vecna.png', 'cw': cw, 'ch': ch, 'anims': anims}
atlas['vecna'] = build_vecna()

with open(JS, 'w') as f:
    f.write('window.ATLAS = ' + json.dumps(atlas, indent=1) + ';\n')

# El fondo ahora lo genera tools/build_bg.py
