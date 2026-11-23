#!/usr/bin/env python3
"""Genera los fondos del juego.
 - Mundo del Revés (actos 1-3): 2 capas (bg_far / bg_floor), a partir de tools/bg_source_patched.png, con pixelado fino.
 - Escenarios panorámicos (actos 4-20): laboratorio1, bosque1, casa1, calle1, mansion1 -> assets/scene_*.png,
   hechos periódicos (espejo con carteles borrados, o fundido de bordes) para repetirse sin cortes.
Uso: python3 tools/build_bg.py [carpeta_origen]"""
import sys, os
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/santi/Descargas/Stranger'
OUT = os.path.join(HERE, '..', 'assets')

# ---- Mundo del Revés
im = Image.open(os.path.join(HERE, 'bg_source_patched.png')).convert('RGB')
fine = im.resize((256, 171), Image.BOX).resize((512, 341), Image.BICUBIC)
fine = fine.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
fine = ImageEnhance.Contrast(fine).enhance(1.08)
fine = fine.quantize(64, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
bg = fine.resize((1536, 1024), Image.NEAREST)
bg.save(os.path.join(OUT, 'bg_full.png'))
bg.crop((0, 0, 1536, 750)).save(os.path.join(OUT, 'bg_far.png'))
bg.crop((0, 750, 1536, 1024)).save(os.path.join(OUT, 'bg_floor.png'))

# ---- Escenarios panorámicos
def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

def erase_text(img, box, delta, _unused=None):
    """borra las letras de un cartel: todo lo que se aparta del tono mediano de la caja pasa a ese tono"""
    px = img.load(); x0, y0, x1, y1 = box
    pix = sorted((px[x, y] for y in range(y0, y1) for x in range(x0, x1)), key=lum)
    fill = pix[len(pix) // 2]
    for y in range(y0, y1):
        for x in range(x0, x1):
            if abs(lum(px[x, y]) - lum(fill)) > delta: px[x, y] = fill

def mirrored(img):
    out = Image.new('RGB', (img.width * 2, img.height))
    out.paste(img, (0, 0)); out.paste(img.transpose(Image.FLIP_LEFT_RIGHT), (img.width, 0))
    return out

def blended(img, b):
    """periodo = ancho - b: el final se funde con el principio"""
    w, h = img.size
    out = img.crop((0, 0, w - b, h)).copy()
    head, tail = img.crop((0, 0, b, h)), img.crop((w - b, 0, w, h))
    mask = Image.linear_gradient('L').rotate(90).resize((b, h))   # 0 -> 255 de izquierda a derecha
    mask = mask.transpose(Image.FLIP_LEFT_RIGHT)                  # 255 -> 0
    out.paste(Image.composite(tail, head, mask), (0, 0))
    return out

def scene(name, src, mode, erase=(), b=0):
    img = Image.open(os.path.join(SRC, src)).convert('RGB')
    if mode == 'mirror':
        clean = img.copy()
        for box, delta in erase: erase_text(clean, box, delta)
        out = Image.new('RGB', (img.width * 2, img.height))
        out.paste(img, (0, 0)); out.paste(clean.transpose(Image.FLIP_LEFT_RIGHT), (img.width, 0))
    else:
        out = blended(img, b)
    out.save(os.path.join(OUT, f'scene_{name}.png'), optimize=True)
    print('escena', name, out.size)

scene('lab', 'laboratorio1.png', 'mirror', [((450, 134, 565, 187), 14)])
scene('forest', 'bosque1.png', 'mirror')
scene('house', 'casa1.png', 'blend', b=220)
scene('street', 'calle1.png', 'mirror', [((1022, 104, 1092, 128), 14), ((1132, 224, 1236, 281), 12)])
scene('mansion', 'mansion1.png', 'mirror')
