/* Controles táctiles (cruceta flotante + 3 botones transparentes) e instalación como app.
 * Se activan en móviles y tablets Android y iOS (iPhone / iPad). Para probar en otro dispositivo: ?touch=1 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  // iPadOS 13+ se identifica como Mac: se distingue por tener pantalla táctil
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!android && !ios && q.get('touch') !== '1') return;

  const body = document.body;
  body.classList.add('touch');

  /* ---------------------------------------------------------------- PWA */
  if (android || ios) {
    const link = document.createElement('link');
    link.rel = 'manifest'; link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW: sigue funcionando online */ }));
    }
  }
  const installBtn = document.getElementById('install');
  let deferred = null;
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => { deferred = null; });
  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* ignorar */ }
    deferred = null;
  });
  // iOS no tiene "instalar": se explica cómo añadirlo a la pantalla de inicio (una vez)
  const hint = document.getElementById('ioshint');
  let hintDone = false;
  try { hintDone = localStorage.getItem('strangerslug.iosHint') === '1'; } catch (e) { /* ignorar */ }
  document.getElementById('ioshintx').addEventListener('click', () => {
    hintDone = true; hint.style.display = 'none';
    try { localStorage.setItem('strangerslug.iosHint', '1'); } catch (e) { /* ignorar */ }
  });
  setInterval(() => { // el botón solo aparece en el título, si el navegador permite instalar
    const show = deferred && !standalone && window.SSInput && SSInput.state() === 'title';
    installBtn.style.display = show ? 'block' : 'none';
    const showHint = ios && !standalone && !hintDone && window.SSInput && SSInput.state() === 'title' && innerWidth > innerHeight;
    hint.style.display = showHint ? 'block' : 'none';
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

  // pantalla completa + horizontal al primer toque (Android, iPad; el iPhone no lo permite: ahí se usa "Añadir a inicio")
  let fsTried = false;
  function goFullscreen() {
    if (fsTried || standalone) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    fsTried = true;
    try {
      const p = req.call(el);
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => { /* ignorar */ });
    } catch (e) { /* ignorar */ }
  }
  // iOS solo activa el audio tras un gesto completo (soltar el dedo), por eso también se escucha pointerup/touchend
  const gesture = () => { goFullscreen(); SSInput.unlock(); };
  addEventListener('pointerdown', gesture, { passive: true });
  addEventListener('pointerup', () => SSInput.unlock(), { passive: true });
  addEventListener('touchend', () => SSInput.unlock(), { passive: true });

  // vibración suave: Android con vibrate(); iOS 17.4+ con el interruptor nativo (switch)
  const hapticLabel = document.getElementById('haptic');
  function buzz() {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
      else if (ios && hapticLabel) hapticLabel.click();
    } catch (e) { /* sin vibración */ }
  }

  /* ------------------------------------------------------ botones de acción */
  // cada dedo controla el botón que tiene debajo; si desliza a otro botón, cambia sin soltar
  const btns = [...document.querySelectorAll('#touch [data-a]')];
  const btnAt = (x, y) => {
    let best = null, bestD = 1e9;
    for (const el of btns) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) / (r.width / 2);
      if (d < 1.2 && d < bestD) { best = el; bestD = d; }
    }
    return best;
  };
  const fingers = new Map(); // pointerId -> botón pulsado
  function setBtn(id, el) {
    const old = fingers.get(id);
    if (old === el) return;
    if (old) { old.classList.remove('on'); release('btn-' + old.dataset.a); }
    if (el) { el.classList.add('on'); press('btn-' + el.dataset.a, el.dataset.a); buzz(); fingers.set(id, el); }
    else fingers.delete(id);
  }
  for (const el of btns) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); capture(el, e); setBtn(e.pointerId, el); });
    el.addEventListener('pointermove', e => { if (fingers.has(e.pointerId)) setBtn(e.pointerId, btnAt(e.clientX, e.clientY)); });
    const up = e => setBtn(e.pointerId, null);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

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
  const zone = document.getElementById('lzone');
  const arrows = {};
  pad.querySelectorAll('[data-d]').forEach(el => { arrows[el.dataset.d] = el; });
  function setDirs(dirs) {
    for (const d of ['left', 'right', 'up', 'down']) {
      if (dirs.includes(d)) { arrows[d].classList.add('on'); press('dpad-' + d, d); }
      else { arrows[d].classList.remove('on'); release('dpad-' + d); }
    }
  }
  // cruceta flotante: aparece centrada bajo el pulgar y lo sigue si se aleja demasiado
  let cx = 0, cy = 0, size = 0;
  const place = () => {
    pad.style.setProperty('--px', (cx - size / 2) + 'px');
    pad.style.setProperty('--py', (cy - size / 2) + 'px');
  };
  const padMove = e => {
    const half = size / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy), max = half * 1.1;
    if (dist > max) { // arrastra el centro para que el pulgar nunca se salga
      cx += dx * (1 - max / dist); cy += dy * (1 - max / dist);
      dx = e.clientX - cx; dy = e.clientY - cy; place();
    }
    setDirs(dirsFor(dx / half, dy / half));
  };
  let padId = null; // dedo que controla la cruceta
  zone.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (padId !== null) return;
    padId = e.pointerId; capture(zone, e);
    size = pad.offsetWidth;
    const half = size / 2;
    cx = Math.min(Math.max(e.clientX, half + 4), innerWidth * 0.5);
    cy = Math.min(Math.max(e.clientY, half + 4), innerHeight - half - 4);
    place(); pad.classList.add('float'); buzz();
    padMove(e);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === padId) padMove(e); });
  const padUp = e => {
    if (e && e.pointerId !== undefined && e.pointerId !== padId) return;
    padId = null; setDirs([]); pad.classList.remove('float');
  };
  zone.addEventListener('pointerup', padUp);
  zone.addEventListener('pointercancel', padUp);
  zone.addEventListener('lostpointercapture', padUp);

  /* ----------------------------------------------------------------- pausa */
  const pauseBtn = document.getElementById('tpause');
  pauseBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); pauseBtn.classList.add('on'); buzz();
    SSInput.press('Escape'); setTimeout(() => SSInput.release('Escape'), 90);
  });
  const pUp = () => pauseBtn.classList.remove('on');
  pauseBtn.addEventListener('pointerup', pUp);
  pauseBtn.addEventListener('pointercancel', pUp);

  /* --------------------------------------------------- evitar gestos del navegador */
  for (const ev of ['contextmenu', 'gesturestart', 'dblclick']) addEventListener(ev, e => e.preventDefault());
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  // iOS no siempre lanza "blur" al cambiar de app: se pausa al ocultarse la página
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && SSInput.state() === 'play') { SSInput.press('Escape'); setTimeout(() => SSInput.release('Escape'), 90); }
  });

  window.TouchLogic = { dirsFor }; // para pruebas
})();
