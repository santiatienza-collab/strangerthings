# STRANGER SLUG

Shoot & run de plataformas al estilo *Metal Slug*, ambientado en el Mundo del Revés.
Hecho con HTML5 Canvas, sin dependencias: abre `index.html` o publícalo en GitHub Pages.

## Actos
10 actos en dos escenarios: **Mundo del Revés** (actos 1-5, acaba con Vecna) y **Laboratorio HNL** (actos 6-10, jefe final doble). Los fondos se regeneran con `python3 tools/build_bg.py`. Depuración: `?char=will&stage=7` salta a un acto.

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

**Armas** (todas salen de la serie; solo Eleven no lleva arma, usa telequinesis): Will, rifle de caza; Mike, tirachinas Wrist Rocket; Dustin, pistola de bengalas; Steve, bate con clavos.
**Calor:** disparar sin parar sobrecalienta el arma (barra bajo ARMA): mantener pulsado dispara más lento y con menos puntería, y al llegar al máximo se bloquea 1,4 s. Disparar en ráfagas cortas lo enfría.
**Objetos:** en cada acto hay objetos por el suelo (silla y extintor en el laboratorio; roca y bidón en el Mundo del Revés). Pasa por encima para cogerlos y lanza con BOMBA (C): la silla y la roca golpean fuerte a un enemigo; el extintor y el bidón explotan en área y aturden.

El menú de pausa incluye ajustes de música, efectos, temblor de pantalla y pantalla completa.

## Móvil y tablet (Android e iPhone/iPad)
- En **Android** aparecen automáticamente una **cruceta** y tres botones (**SALTO, FUEGO, BOMBA**) más un botón de **pausa**, todos transparentes. Admiten multitoque (correr, saltar y disparar a la vez) y la cruceta acepta diagonales y deslizar el dedo. En los menús, la cruceta navega, FUEGO acepta y BOMBA vuelve atrás.
- Hay que jugar en **horizontal**; en vertical se muestra un aviso.
- **Instalar como app:** abre la web en Chrome (Android) → menú ⋮ → *Instalar aplicación* (o el botón *INSTALAR APP* del título). Se abre a pantalla completa y funciona **sin conexión**.
- **iPhone / iPad (Safari):** mismos controles. Para pantalla completa pulsa *Compartir* → *Añadir a pantalla de inicio* (en el título aparece un aviso). Gira el móvil en horizontal.
- **Controles mejorados:** la cruceta es **flotante** (aparece bajo tu pulgar en la mitad izquierda y lo sigue), puedes **deslizar entre SALTO/FUEGO/BOMBA** sin soltar, hay zonas de toque ampliadas, vibración suave (Android y iOS 17.4+), márgenes seguros para el notch y pausa automática al cambiar de app.
- Los controles táctiles solo se activan en Android e iOS. Para probar los controles en otro dispositivo: añade `?touch=1` a la URL.

## Personajes
Will (rifle), Eleven (telequinesis perforante), Mike (tirachinas rápido), Dustin (bengalas x3), Steve (bate con clavos, cuerpo a cuerpo).

## Enemigos
Demogorgon (normal, veloz y jefe) y Vecna (jefe final: rocas telequinéticas, espinas, tentáculos, control mental y 2ª fase).

## Sonido
Todo el audio (efectos y música) se sintetiza en el navegador con Web Audio; no hay archivos de sonido.

## Publicar en GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.

## Archivos de la app instalable
`manifest.webmanifest` (nombre, iconos, pantalla completa), `sw.js` (caché para jugar sin conexión) e `icons/`. Si cambias archivos del juego, sube el número de `CACHE` en `sw.js` para forzar la actualización.

## Regenerar sprites
`python3 tools/build_assets.py <carpeta_con_los_sprite_sheets>` (requiere Pillow).
