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

def cut(crop, run, bg, thr=26, solid=False, boost=1.0, inner=12, local_bg=False, solid_top=0.0, fg_thr=14):
    """devuelve RGBA recortado, quitando fondo por flood fill desde el borde"""
    a, b = run
    f = crop.crop((max(a-2, 0), 0, min(b+3, crop.width), crop.height)).convert('RGB')
    w, h = f.size
    px = f.load()
    if local_bg:  # fondo = mediana del borde del propio frame (pelo casi negro sobre fondo oscuro)
        edge = sorted([px[x, y] for x in range(w) for y in (0, h-1)] + [px[x, y] for y in range(h) for x in (0, w-1)])
        bg = edge[len(edge)//2]
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
    seen_n = seen
    if solid or solid_top:
        # silueta cerrada: el cuerpo oscuro no se confunde con el fondo del sheet
        fg = Image.new('L', (w, h))
        fp = fg.load()
        for y in range(h):
            for x in range(w):
                fp[x, y] = 255 if dist(px[x, y], bg) > fg_thr else 0
        cp = fg.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).load()
        seen = [[False]*w for _ in range(h)]
        stack = [(x, 0) for x in range(w)] + [(x, h-1) for x in range(w)] + [(0, y) for y in range(h)] + [(w-1, y) for y in range(h)]
        while stack:
            x, y = stack.pop()
            if x < 0 or y < 0 or x >= w or y >= h or seen[y][x] or cp[x, y]: continue
            seen[y][x] = True
            stack += [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
    if solid_top:  # silueta cerrada solo arriba (cabeza y pelo); abajo, el recorte normal
        seen_c, seen = seen, seen_n
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            top = solid_top and y < solid_top * h
            if (seen_c[y][x] if top else (seen[y][x] or (not solid and dist(px[x, y], bg) < inner))):
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

def sheet_frames(sheet, bg, box, n, thr=26, scrub=True, cut_thr=None, local_bg=False, solid_top=0.0, fg_thr=14, edit=None):
    img = Image.open(os.path.join(SRC, sheet)).convert('RGB')
    if edit: edit(img)
    # borra la rejilla del panel: sus píxeles son grises apagados (el personaje no usa grises medios)
    x0, y0, x1, y1 = box
    px = img.load()
    for y in range(max(0, y0 - 16), min(img.height, y1 + 16) if scrub else 0):
        for x in range(max(0, x0 - 16), min(img.width, x1 + 16)):
            c = px[x, y]
            if 66 <= min(c) and max(c) <= 112 and max(c) - min(c) <= 20 and c[0] >= c[1] - 2: px[x, y] = bg
    crop, runs = frames_in(img, box, bg, thr, expect=n)
    ct = cut_thr or thr
    return [thin_clean(fr) for fr in (cut(crop, r, bg, ct, inner=min(12, ct), local_bg=local_bg, solid_top=solid_top, fg_thr=fg_thr) for r in runs) if fr is not None]

def swap_heads(frames, cut=0.43):
    """misma cabeza en todos los frames: la del primero sustituye a las demás, alineada por el centro de la cabeza.
    Evita que la cara 'gire' de un frame a otro cuando el dibujo original no es consistente."""
    def head_box(fr):
        a = fr.getchannel('A').load(); H = int(fr.height * cut)
        xs = [x for y in range(H) for x in range(fr.width) if a[x, y]]
        return min(xs), max(xs), H
    ref = frames[0]; rx0, rx1, H = head_box(ref)
    head = ref.crop((rx0, 0, rx1 + 1, H)); hw = rx1 - rx0 + 1
    out = [ref]
    for f in frames[1:]:
        x0, x1, _ = head_box(f)
        cx = (x0 + x1) // 2; left = cx - hw // 2
        g = f.copy(); gp = g.load()
        for y in range(H):
            for x in range(max(0, left - 1), min(g.width, left + hw + 1)): gp[x, y] = (0, 0, 0, 0)
        g.alpha_composite(head, (left, 0)) if left >= 0 and left + hw <= g.width else g.paste(head, (max(0, left), 0), head)
        out.append(g)
    return out

def keep_main(fr, gap=7):
    """se queda solo con el personaje: quita piedras volando, estelas y marcas sueltas que no tocan el cuerpo (a menos de 'gap' px)"""
    a = fr.getchannel('A').point(lambda v: 255 if v > 0 else 0)
    d = a.filter(ImageFilter.MaxFilter(gap * 2 + 1)).load(); ap = a.load(); w, h = fr.size
    seen = {}; comps = []
    for y in range(h):
        for x in range(w):
            if d[x, y] and (x, y) not in seen:
                comp, st = [], [(x, y)]; seen[(x, y)] = len(comps)
                while st:
                    cx, cy = st.pop(); comp.append((cx, cy))
                    for nx in (cx-1, cx, cx+1):
                        for ny in (cy-1, cy, cy+1):
                            if 0 <= nx < w and 0 <= ny < h and d[nx, ny] and (nx, ny) not in seen:
                                seen[(nx, ny)] = len(comps); st.append((nx, ny))
                comps.append(comp)
    if len(comps) < 2: return fr
    best = max(range(len(comps)), key=lambda i: sum(1 for (x, y) in comps[i] if ap[x, y]))
    out = fr.copy(); op = out.load()
    for y in range(h):
        for x in range(w):
            if ap[x, y] and seen.get((x, y)) != best: op[x, y] = (0, 0, 0, 0)
    bb = out.getbbox()
    return out.crop(bb) if bb else out

def feet_x(fr):
    a = fr.getchannel('A').load(); w, h = fr.size
    xs = [x for y in range(int(h * 0.82), h) for x in range(w) if a[x, y]]
    return sum(xs) / len(xs) if xs else w / 2

def head_x(fr):
    """ancla de los frames de andar: centro de cabeza y tronco (8%-45% de la altura), que apenas se mueven en el ciclo;
    así el cuerpo no tiembla al cambiar de frame como con el centro del recuadro"""
    a = fr.getchannel('A').load(); w, h = fr.size
    xs = [x for y in range(int(h * 0.08), int(h * 0.45)) for x in range(w) if a[x, y]]
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

def erase_rects(*rects, bg=(19, 12, 19)):
    """quita objetos pintados en la hoja (piedra de Mike) tapándolos con el color de fondo"""
    def f(img):
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        for r in rects: d.rectangle(r, fill=bg)
    return f

def _is_skin(c): return c[0] > 200 and c[1] > 140 and c[2] > 100 and c[2] < 200 and c[0] - c[2] > 35 and c[1] < 235
def _is_blue(c): return c[2] > c[0] + 25 and c[2] > c[1] + 5

def _face_bbox(fr):
    """caja de la cara = mayor mancha de piel en la parte alta del frame"""
    a = fr.load(); w, h = fr.size
    seen = set(); best = None
    for y in range(int(h * 0.7)):
        for x in range(w):
            if (x, y) in seen or a[x, y][3] == 0 or not _is_skin(a[x, y][:3]): continue
            st = [(x, y)]; seen.add((x, y)); xs = []; ys = []
            while st:
                cx, cy = st.pop(); xs.append(cx); ys.append(cy)
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                    if 0 <= nx < w and 0 <= ny < int(h * 0.7) and (nx, ny) not in seen and a[nx, ny][3] and _is_skin(a[nx, ny][:3]):
                        seen.add((nx, ny)); st.append((nx, ny))
            if best is None or len(xs) > best[0]: best = (len(xs), min(xs), min(ys), max(xs), max(ys))
    return best[1:] if best else None

def dustin_lift_post(frames):
    """Dustin con los brazos en alto SIN el extintor: se borra el objeto (todo lo que no sea piel o manga azul por encima de la cara)
    y se pinta, detrás, la gorra del frame de pie, que el extintor tapaba."""
    stand = frames[0]; sb = _face_bbox(stand)
    dome = stand.crop((0, 0, stand.width, sb[1] + 5))
    out = [stand]
    for i in (5, 6, 7, 8, 9):
        fr = frames[i].copy(); p = fr.load(); fb = _face_bbox(fr)
        for y in range(max(0, fb[1] - 2)):
            for x in range(fr.width):
                c = p[x, y]
                if c[3] and not (_is_skin(c[:3]) or _is_blue(c[:3])): p[x, y] = (0, 0, 0, 0)
        # lienzo con sitio para la gorra, que queda detrás de lo que ya había
        dx, dy = fb[0] - sb[0], fb[1] - sb[1]
        W, H = max(fr.width, dome.width + max(dx, 0)), fr.height + max(-dy, 0)
        base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        base.alpha_composite(dome, (max(dx, 0), max(dy, 0)))
        base.alpha_composite(fr, (0, max(-dy, 0)))
        bb = base.getbbox(); out.append(base.crop(bb) if bb else base)
    return out

def build_char(name, sheet, bg, rows, thr=26, blank=(), solid=False, boost=1.0, idle_h=None, override=None, solid_top=0.0, fg_thr=14, liftwalk=None, hip=0.40):
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
            fr = cut(crop, r, bg, thr, solid, boost, solid_top=solid_top, fg_thr=fg_thr)
            if fr is None: continue
            ax = fr.width/2 if anchor == 'c' else head_x(fr) if anchor == 'torso' else anchor[1]
            items.append((anim, i, fr, ax))
    if idle_h:  # normaliza la escala para que el idle mida idle_h px (mismo tamaño que en el juego)
        h0 = next(fr.height for a, i, fr, _ in items if a == 'idle' and i == 0)
        k = idle_h / h0
        items = [(a, i, fr.resize((max(1, round(fr.width*k)), max(1, round(fr.height*k))), Image.LANCZOS), ax*k) for a, i, fr, ax in items]
        print(f'  escala {name}: x{k:.3f}')
    extra = []
    if override:  # animaciones reemplazadas por frames de otra hoja, escalados a la altura del idle
        h_idle = next(fr.height for a, i, fr, _ in items if a == 'idle' and i == 0)
        for anim, ov in override.items():
            osheet, obg = ov['sheet'], ov['bg']
            obox, on = (ov['boxes'][0] if 'boxes' in ov else (ov['box'], ov['n']))
            kw = dict(thr=ov.get('thr', 26), scrub=ov.get('scrub', True), cut_thr=ov.get('cut_thr'), local_bg=ov.get('local_bg', False), solid_top=ov.get('solid_top', 0.0), fg_thr=ov.get('fg_thr', 14), edit=ov.get('edit'))
            drop = set(ov.get('drop', ()))   # frames "de pie" (pies juntos) que harían parar el ciclo
            pick = ov.get('pick')            # ciclo simétrico: solo estos frames, en este orden
            sel = (lambda frs: [frs[i] for i in pick if i < len(frs)]) if pick else (lambda frs: [f for i, f in enumerate(frs) if i not in drop])
            allf = sheet_frames(osheet, obg, obox, on, **kw)
            for bx, bn in ov.get('boxes', [])[1:]: allf += sheet_frames(osheet, obg, bx, bn, **kw)
            if ov.get('keep_main'): allf = [keep_main(f) for f in allf]
            if ov.get('post'): allf = ov['post'](allf)
            right = sel(allf)
            if ov.get('same_head'): right = swap_heads(right)
            k = h_idle / (allf[ov['ref_idx']].height if 'ref_idx' in ov else sorted(f.height for f in right)[len(right)//2])
            sets = {anim: right}
            if ov.get('left'):  # fila "Walk ←" de la hoja: se usa tal cual (sin voltear) al mirar a la izquierda
                left = sel(sheet_frames(osheet, obg, ov['left'], on, **kw))
                if ov.get('mirror_left'): left = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in right]  # fila izquierda irregular: se usa el espejo
                # si faltan fotogramas a la izquierda, se rellenan con el espejo de los de la derecha (y al revés)
                while len(left) < len(right): left.append(right[len(left)].transpose(Image.FLIP_LEFT_RIGHT))
                while len(right) < len(left): right.append(left[len(right)].transpose(Image.FLIP_LEFT_RIGHT))
                sets = {anim: right, anim + 'L': left[:len(right)]}
            for an, frs in sets.items():
                items = [it for it in items if it[0] != an]
                if an not in rows and an not in extra: extra.append(an)
                for i, fr in enumerate(frs):
                    fr = fr.resize((max(1, round(fr.width*k)), max(1, round(fr.height*k))), Image.NEAREST if k >= 1 else Image.BOX)
                    items.append((an, i, fr, feet_x(fr) if ov.get('anchor') == 'feet' else head_x(fr)))
                print(f'  {name}.{an}: {len(frs)} frames nuevos de {osheet}, escala x{k:.3f}')
    if liftwalk is not None:  # andar con los brazos en alto: torso con brazos de la pose 'lift' + piernas de cada frame de 'walk'
        lifts = [it for it in items if it[0] == 'lift']
        stand, up = lifts[0][2], lifts[liftwalk][2]
        legH = int(stand.height * hip)
        upc = up.crop((0, 0, up.width, up.height - legH))
        def cx(img, rows):
            a = img.getchannel('A').load(); xs = [x for y in rows for x in range(img.width) if a[x, y]]
            return sum(xs) / len(xs) if xs else img.width / 2
        cu = cx(upc, range(max(0, upc.height - 4), upc.height))
        for an, i, fr, ax in [it for it in items if it[0] == 'walk']:
            low = fr.crop((0, fr.height - legH, fr.width, fr.height))
            lp = low.load()   # quita la línea oscura del borde superior del corte (si no, se ve una raya en la cintura)
            for yy in range(0, 2):
                for xx in range(low.width):
                    c = lp[xx, yy]
                    if c[3] and 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] < 70: lp[xx, yy] = (0, 0, 0, 0)
            cl = cx(low, range(0, 4))
            c = max(cu, cl) + 2
            ou, ol = int(round(c - cu)), int(round(c - cl))
            W = max(ou + upc.width, ol + low.width)
            img = Image.new('RGBA', (W, upc.height + low.height), (0, 0, 0, 0))
            ov = 4  # las piernas suben 4 px por debajo del torso: sin hueco en la cintura
            img = Image.new('RGBA', (W, upc.height + low.height - ov), (0, 0, 0, 0))
            img.alpha_composite(low, (ol, upc.height - ov)); img.alpha_composite(upc, (ou, 0))
            items.append(('liftwalk', i, img, c))
        extra_names = ['liftwalk']
        for nme in extra_names:
            if nme not in rows and nme not in extra: extra.append(nme)
    half = max(max(ax, fr.width-ax) for _, _, fr, ax in items)
    cw = int(half*2)+2
    ch = max(fr.height for _, _, fr, _ in items)+2
    anims = {}
    order = list(rows.keys()) + extra
    maxn = max(sum(1 for it in items if it[0] == a) for a in order)
    atlas = Image.new('RGBA', (cw*maxn, ch*len(order)), (0, 0, 0, 0))
    for r, a in enumerate(order):
        fs = [it for it in items if it[0] == a]
        anims[a] = {'row': r, 'n': len(fs), 'h': [it[2].height for it in fs]}   # 'h' = altura de cada frame (para colocar objetos sobre las manos)
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
}, idle_h=111, override={'walk': dict(sheet='will1.png', bg=(21, 16, 23), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6], solid_top=1.0, fg_thr=8, mirror_left=True, same_head=True),
    'shoot': dict(sheet='tirachinas.jpg', bg=(17, 14, 21), box=(30, 482, 1250, 760), n=5, scrub=False, solid_top=0.45, fg_thr=8, pick=list(range(5)), ref_idx=0, anchor='feet')}, blank=[(40, 490, 215, 540), (625, 490, 790, 540), (40, 712, 250, 764), (745, 712, 975, 764)])
atlas['demogorgon'] = build_char('demogorgon', 'demogorgon.png', (19, 18, 25), {
    'idle':   ((45, 452, 595, 595), 4, 'c'),
    'walk':   ((622, 452, 1490, 595), 6, 'c'),
    'attack': ((38, 648, 795, 778), 5, ('l', 62)),
    'roar':   ((828, 606, 1505, 778), 4, 'c'),
    'hurt':   ((38, 828, 708, 978), 5, 'c'),
    'die':    ((738, 834, 1515, 978), 5, 'c'),
}, idle_h=92, override={'walk': dict(sheet='demo1.png', bg=(19, 13, 16), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6])}, blank=[(30, 405, 200, 463), (630, 405, 782, 463), (30, 598, 242, 647), (826, 598, 1006, 647), (28, 783, 216, 833), (740, 783, 845, 833)])
# --- Eleven (WA0025)
E = 'IMG-20261121-WA0025.jpg'
atlas['eleven'] = build_char('eleven', E, DARK, {
    'idle':  ((1040, 160, 1510, 285), 4, 'c'),
    'walk':  ((1040, 305, 1510, 430), 4, 'c'),
    'power': ((1040, 460, 1510, 590), 4, 'c'),
    'other': ((1040, 640, 1510, 760), 4, 'c'),
}, override={'walk': dict(sheet='eleven1.png', bg=(22, 15, 21), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6], solid_top=1.0, fg_thr=8, mirror_left=True)})
# --- Mike (WA0027)
atlas['mike'] = build_char('mike', 'IMG-20261121-WA0027.jpg', DARK, {
    'idle':  ((1045, 160, 1510, 285), 4, 'c'),
    'walk':  ((1045, 305, 1510, 430), 4, 'c'),
    'talk':  ((1045, 460, 1510, 590), 4, 'c'),
    'other': ((1045, 640, 1510, 760), 4, 'c'),
}, solid_top=0.45, fg_thr=7, liftwalk=2, hip=0.27, override={'walk': dict(sheet='mike1.png', bg=(22, 15, 21), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, thr=9, cut_thr=4, local_bg=True, solid_top=1.0, pick=[0, 1, 2, 4, 5, 6]),
    'lift': dict(sheet='objeto2.png', bg=(19, 12, 19), box=(40, 55, 1900, 262), n=12, scrub=False, thr=9, cut_thr=5, local_bg=True, solid_top=0.45, fg_thr=7, pick=[0, 4, 5, 6, 8, 9], ref_idx=0, keep_main=True, anchor='feet',
                 edit=erase_rects((700, 55, 760, 91), (850, 50, 915, 89), (1000, 35, 1075, 90), (1512, 85, 1680, 130))),
    'shoot': dict(sheet='objeto2.png', bg=(19, 12, 19), box=(40, 375, 1900, 558), n=12, scrub=False, thr=9, cut_thr=5, local_bg=True, solid_top=0.45, fg_thr=7, pick=[3, 5, 6, 7, 4], ref_idx=0, keep_main=True, anchor='feet')})
# --- Dustin (WA0028)
atlas['dustin'] = build_char('dustin', 'IMG-20261121-WA0028.jpg', DARK, {
    'idle':  ((1045, 160, 1510, 285), 4, 'c'),
    'walk':  ((1045, 305, 1510, 430), 4, 'c'),
    'talk':  ((1045, 460, 1510, 590), 4, 'c'),
    'other': ((1045, 640, 1510, 760), 4, 'c'),
}, liftwalk=2, hip=0.27, override={'walk': dict(sheet='dustin1.png', bg=(17, 13, 16), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6], solid_top=1.0, fg_thr=8),
    'shoot': dict(sheet='tirachinas.jpg', bg=(17, 14, 21), box=(30, 85, 1250, 335), n=5, scrub=False, solid_top=0.45, fg_thr=8, pick=list(range(5)), ref_idx=0, anchor='feet'),
    'lift': dict(sheet='objeto.png', bg=(25, 17, 29), boxes=[((60, 180, 1500, 492), 8), ((60, 565, 1500, 858), 8)], scrub=False, solid_top=0.45, fg_thr=8, post=dustin_lift_post, pick=list(range(6)), ref_idx=0, anchor='feet')})
# --- Steve (WA0029)
S = 'IMG-20261121-WA0029.jpg'
atlas['steve'] = build_char('steve', S, DARK, {
    'idle':   ((50, 590, 440, 725), 4, 'c'),
    'walk':   ((490, 590, 990, 725), 5, 'c'),
    'run':    ((1030, 590, 1510, 725), 4, 'c'),
    'attack': ((40, 810, 560, 955), 5, ('l', 40)),
    'hurt':   ((595, 825, 985, 955), 4, 'c'),
    'other':  ((1020, 815, 1440, 955), 4, 'c'),
}, override={'walk': dict(sheet='steve1.png', bg=(17, 13, 18), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6], solid_top=1.0, fg_thr=8),
              'run': dict(sheet='steve1.png', bg=(17, 13, 18), box=(300, 75, 1900, 277), left=(300, 340, 1900, 551), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6], solid_top=1.0, fg_thr=8)})
# --- Lucas (lucas1.png: andar; lucas2.png: reposo, tirachinas y otras acciones)
atlas['lucas'] = build_char('lucas', 'lucas2.png', (22, 16, 24), {
    'idle':  ((60, 541, 530, 685), 4, 'torso'),
    'shoot': ((40, 770, 715, 920), 5, 'torso'),
    'other': ((755, 775, 1515, 920), 7, 'torso'),
}, idle_h=111, solid_top=0.62, fg_thr=7, override={'walk': dict(sheet='lucas1.png', bg=(26, 22, 30), box=(320, 78, 1875, 292), left=(320, 345, 1875, 560), n=8, scrub=False, pick=[0, 1, 2, 4, 5, 6], solid_top=1.0, fg_thr=8)})
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
