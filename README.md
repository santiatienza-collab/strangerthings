# STRANGER SLUG

Shoot & run de plataformas al estilo *Metal Slug*, ambientado en el Mundo del Revés.
Hecho con HTML5 Canvas, sin dependencias: abre `index.html` o publícalo en GitHub Pages.

## Controles
| Acción | Teclas |
|---|---|
| Mover | Flechas / A D |
| Saltar | X / K / Espacio (abajo + salto: bajar de plataforma) |
| Disparar | Z / J / Ctrl |
| Bomba | C / L |
| Apuntar arriba | Flecha arriba / W |
| Agacharse | Flecha abajo / S (en el aire: disparar hacia abajo) |
| Pausa / Sonido | P o Esc / M |

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
