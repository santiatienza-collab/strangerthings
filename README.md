# STRANGER SLUG

Shoot & run de plataformas al estilo *Metal Slug*, ambientado en el Mundo del Revés.
Hecho con HTML5 Canvas, sin dependencias: abre `index.html` o publícalo en GitHub Pages.

## Controles
Por defecto (todas se pueden cambiar en **AJUSTES → CONTROLES**; se guardan en el navegador):

| Acción | Tecla |
|---|---|
| Mover | Flecha izquierda / derecha |
| Apuntar arriba | Flecha arriba |
| Agacharse | Flecha abajo (en el aire: disparar hacia abajo; abajo + salto: bajar de plataforma) |
| Saltar | X |
| Disparar | Z |
| Bomba | C |
| Pausa / menú | P o Esc |
| Sonido / Pantalla completa | M / F |

El menú de pausa incluye ajustes de música, efectos, temblor de pantalla y pantalla completa.

## Personajes
Will (rifle), Eleven (telequinesis perforante), Mike (tirachinas rápido), Dustin (bengalas x3), Steve (bate con clavos, cuerpo a cuerpo).

## Enemigos
Demogorgon (normal, veloz y jefe) y Vecna (jefe final: rocas telequinéticas, espinas, tentáculos, control mental y 2ª fase).

## Sonido
Todo el audio (efectos y música) se sintetiza en el navegador con Web Audio; no hay archivos de sonido.

## Publicar en GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.

## Regenerar sprites
`python3 tools/build_assets.py <carpeta_con_los_sprite_sheets>` (requiere Pillow).
