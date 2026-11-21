/* Controles táctiles (cruceta + 3 botones transparentes) e instalación como app.
 * Solo se activan en móviles y tablets Android. Para probar en otro dispositivo: ?touch=1 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  const android = /Android/i.test(navigator.userAgent);
  if (!android && q.get('touch') !== '1') return;

  const body = document.body;
  body.classList.add('touch');

  /* ---------------------------------------------------------------- PWA */
  if (android) {
    const link = document.createElement('link');
    link.rel = 'manifest'; link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW: sigue funcionando online */ }));
    }
  }
  const installBtn = document.getElementById('install');
  let deferred = null;
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => { deferred = null; });
  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* ignorar */ }
    deferred = null;
  });
  setInterval(() => { // el botón solo aparece en el título, si el navegador permite instalar
    const show = deferred && !standalone && window.SSInput && SSInput.state() === 'title';
    installBtn.style.display = show ? 'block' : 'none';
  }, 400);

  /* ------------------------------------------------------------ entrada */
  const NAV = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', fire: 'Enter', jump: 'Space', gren: 'Escape' };
  const held = {}; // nombre -> código de tecla que se pulsó (para soltar exactamente el mismo)

  // en juego usa las teclas configuradas; en menús, las teclas de navegación
  const codeFor = action => (SSInput.state() === 'play' ? SSInput.K[action][0] : NAV[action]);
  function press(name, action) {
    if (held[name]) return;
    held[name] = codeFor(action);
    SSInput.press(held[name]);
  }
  function release(name) {
    if (!held[name]) return;
    SSInput.release(held[name]);
    delete held[name];
  }

  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* sin captura: se sigue con pointerup/cancel */ } };

  // pantalla completa + horizontal al primer toque (si aún no es una app instalada)
  let fsTried = false;
  function goFullscreen() {
    if (fsTried || standalone) return;
    fsTried = true;
    try {
      const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => { /* ignorar */ });
    } catch (e) { /* ignorar */ }
  }
  addEventListener('pointerdown', () => { goFullscreen(); SSInput.unlock(); }, { passive: true });

  /* ------------------------------------------------------ botones de acción */
  document.querySelectorAll('#touch [data-a]').forEach(el => {
    const action = el.dataset.a, name = 'btn-' + action;
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); capture(el, e); el.classList.add('on'); press(name, action);
    });
    const up = e => { el.classList.remove('on'); release(name); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  });

  /* --------------------------------------------------------------- cruceta */
  // direcciones a partir de la posición del dedo respecto al centro (admite diagonales y deslizar)
  function dirsFor(dx, dy) { // dx, dy normalizados a -1..1 desde el centro
    const out = [];
    if (Math.hypot(dx, dy) < 0.16) return out;
    if (dx < -0.32) out.push('left'); else if (dx > 0.32) out.push('right');
    if (dy < -0.32) out.push('up'); else if (dy > 0.32) out.push('down');
    return out;
  }
  const pad = document.getElementById('dpad');
  const arrows = {};
  pad.querySelectorAll('[data-d]').forEach(el => { arrows[el.dataset.d] = el; });
  function setDirs(dirs) {
    for (const d of ['left', 'right', 'up', 'down']) {
      if (dirs.includes(d)) { arrows[d].classList.add('on'); press('dpad-' + d, d); }
      else { arrows[d].classList.remove('on'); release('dpad-' + d); }
    }
  }
  const padMove = e => {
    const r = pad.getBoundingClientRect();
    setDirs(dirsFor(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2));
  };
  let padId = null; // dedo que controla la cruceta
  pad.addEventListener('pointerdown', e => { e.preventDefault(); if (padId !== null) return; padId = e.pointerId; capture(pad, e); padMove(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === padId) padMove(e); });
  const padUp = e => { if (e && e.pointerId !== undefined && e.pointerId !== padId) return; padId = null; setDirs([]); };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('lostpointercapture', padUp);

  /* ----------------------------------------------------------------- pausa */
  const pauseBtn = document.getElementById('tpause');
  pauseBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); pauseBtn.classList.add('on');
    SSInput.press('Escape'); setTimeout(() => SSInput.release('Escape'), 90);
  });
  const pUp = () => pauseBtn.classList.remove('on');
  pauseBtn.addEventListener('pointerup', pUp);
  pauseBtn.addEventListener('pointercancel', pUp);

  /* --------------------------------------------------- evitar gestos del navegador */
  for (const ev of ['contextmenu', 'gesturestart', 'dblclick']) addEventListener(ev, e => e.preventDefault());
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  window.TouchLogic = { dirsFor }; // para pruebas
})();
