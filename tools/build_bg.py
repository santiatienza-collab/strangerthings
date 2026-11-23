#!/usr/bin/env python3
"""Genera los fondos: Mundo del Revés (actos 1-5, pixelado más fino) y Laboratorio HNL (actos 6-10).
Uso: python3 tools/build_bg.py [carpeta_origen]"""
import sys, os
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/santi/Descargas/Stranger'
OUT = os.path.join(HERE, '..', 'assets')

# ---- Mundo del Revés: la fuente tiene bloques grandes; se interpola y se vuelve a pixelar con rejilla más fina
im = Image.open(os.path.join(HERE, 'bg_source_patched.png')).convert('RGB')
fine = im.resize((256, 171), Image.BOX).resize((512, 341), Image.BICUBIC)
fine = fine.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
fine = ImageEnhance.Contrast(fine).enhance(1.08)
fine = fine.quantize(64, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
bg = fine.resize((1536, 1024), Image.NEAREST)
bg.save(os.path.join(OUT, 'bg_full.png'))
bg.crop((0, 0, 1536, 750)).save(os.path.join(OUT, 'bg_far.png'))
bg.crop((0, 750, 1536, 1024)).save(os.path.join(OUT, 'bg_floor.png'))

# ---- Laboratorio HNL
lab = Image.open(os.path.join(SRC, 'laboratorio.png')).convert('RGB')
W, H = lab.size
SPLIT = round(H * 750 / 1024)          # misma proporción pared/suelo que el otro mundo
clean = lab.copy()
px = clean.load()
def erase(box):  # borra un cartel interpolando por filas entre los píxeles de ambos lados
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        l, r = px[x0 - 3, y], px[x1 + 3, y]
        for x in range(x0, x1):
            t = (x - x0) / (x1 - x0)
            px[x, y] = tuple(round(l[i] * (1 - t) + r[i] * t) for i in range(3))
erase((236, 196, 476, 342))      # logo HNL
erase((836, 118, 1056, 228))     # "HNL LAB 11"
far_a = lab.crop((0, 0, W, SPLIT))
far_b = clean.crop((0, 0, W, SPLIT)).transpose(Image.FLIP_LEFT_RIGHT)
far = Image.new('RGB', (W * 2, SPLIT)); far.paste(far_a, (0, 0)); far.paste(far_b, (W, 0))
far.save(os.path.join(OUT, 'lab_far.png'))
lab.crop((480, SPLIT, 1110, H)).save(os.path.join(OUT, 'lab_floor.png'))   # franja de suelo libre de muebles
print('fondos ok', far.size, SPLIT)
