/* STRANGER SLUG – shoot & run en el Mundo del Revés
 * Canvas 2D puro, sin dependencias. Sprites en assets/ (generados por tools/build_assets.py). */
(() => {
'use strict';

const W = 960, H = 540, GROUND = 404, GRAV = 1700, JUMP = 600;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // pixel art nítido (sin suavizado al escalar sprites)
const FONT = '"Press Start 2P", "Courier New", monospace';

/* ------------------------------------------------------------------ input */
const keys = {}, pressed = {};
addEventListener('keydown', e => {
  if (M.capture) { // reasignando una tecla desde AJUSTES
    e.preventDefault();
    if (e.code === 'Escape') M.capture = null;
    else if (!RESERVED.includes(e.code)) { assignKey(M.capture, e.code); M.capture = null; Snd.ok(); }
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  Snd.unlock();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G.state === 'play') { G.state = 'pause'; openMenu('pause'); } });
const down = (...c) => c.some(k => keys[k]);
const tap = (...c) => c.some(k => pressed[k]);
const K = {}; // acciones -> [código de tecla]; se rellena desde los ajustes

/* --------------------------------------------------------------- ajustes */
const SET = { music: 7, sfx: 8, shake: true, keys: {} };
try { Object.assign(SET, JSON.parse(localStorage.getItem('strangerslug.settings') || '{}')); } catch (e) { /* sin almacenamiento */ }
const DEFAULT_KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'KeyX', fire: 'KeyZ', gren: 'KeyC' };
const NAV = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] };
const ACTIONS = [['left', 'IZQUIERDA'], ['right', 'DERECHA'], ['up', 'ARRIBA / APUNTAR'], ['down', 'ABAJO / AGACHARSE'], ['jump', 'SALTAR'], ['fire', 'DISPARAR'], ['gren', 'BOMBA']];
const RESERVED = ['Escape', 'Enter', 'KeyP', 'KeyM', 'KeyF'];
function applyKeys() { for (const a in DEFAULT_KEYS) K[a] = [(SET.keys && typeof SET.keys[a] === 'string' && SET.keys[a]) || DEFAULT_KEYS[a]]; }
applyKeys();
const keyName = c => ({ ArrowLeft: 'FLECHA IZQ', ArrowRight: 'FLECHA DER', ArrowUp: 'FLECHA ARRIBA', ArrowDown: 'FLECHA ABAJO', Space: 'ESPACIO',
  ControlLeft: 'CTRL IZQ', ControlRight: 'CTRL DER', ShiftLeft: 'SHIFT IZQ', ShiftRight: 'SHIFT DER', AltLeft: 'ALT', Tab: 'TAB', Backspace: 'RETROCESO' }[c]
  || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase());
const saveSet = () => { try { localStorage.setItem('strangerslug.settings', JSON.stringify(SET)); } catch (e) { /* ignorar */ } };

/* ------------------------------------------------------------------ audio */
const Snd = (() => {
  let ac, master, musicBus, sfxBus, muted = false, musicTimer = null, step = 0, fast = false;
  const applyVol = () => { if (musicBus) { musicBus.gain.value = SET.music / 10; sfxBus.gain.value = SET.sfx / 10; } };
  const unlock = () => {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.3; master.connect(ac.destination);
        musicBus = ac.createGain(); sfxBus = ac.createGain(); musicBus.connect(master); sfxBus.connect(master); applyVol(); }
      catch (e) { return; }
      startMusic();
    }
    if (ac.state === 'suspended') ac.resume();
  };
  const tone = (f, d, type = 'square', v = 0.15, slide = 0, delay = 0, bus = 'sfx') => {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(bus === 'music' ? musicBus : sfxBus); o.start(t); o.stop(t + d + 0.03);
  };
  const noise = (d, v = 0.25, lp = 1500) => {
    if (!ac || muted) return;
    const n = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, n, ac.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
  };
  // arpegio sintetizado en Do menor (original, ambiente retro)
  const ROOT = [130.81, 103.83, 116.54, 98.0];
  const ARP = [1, 1.2, 1.5, 2, 1.5, 1.2, 1.5, 1.8];
  const tick = () => {
    if (ac && !muted && ac.state === 'running') {
      const bar = Math.floor(step / 16) % 4, root = ROOT[bar];
      if (step % 16 === 0) tone(root / 2, 1.1, 'sawtooth', 0.09, 0, 0, 'music');
      tone(root * 2 * ARP[step % 8], 0.18, 'triangle', 0.07, 0, 0, 'music');
      if (fast && step % 4 === 2) tone(root, 0.08, 'square', 0.04, 0, 0, 'music');
    }
    step++;
    musicTimer = setTimeout(tick, fast ? 120 : 170);
  };
  const startMusic = () => { if (!musicTimer) tick(); };
  // Los navegadores bloquean el audio hasta que hay un gesto: se intenta al cargar y se reintenta
  // con cualquier toque, clic o tecla hasta que el audio esté en marcha.
  const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchstart', 'touchend', 'keydown'];
  const autoUnlock = () => {
    unlock();
    if (ac && ac.state === 'running') GESTURES.forEach(g => removeEventListener(g, autoUnlock, true));
  };
  GESTURES.forEach(g => addEventListener(g, autoUnlock, true));
  unlock(); // intento inicial: suena ya si el navegador lo permite
  return {
    unlock, applyVol, setFast: v => { fast = v; },
    toggleMute: () => { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot: () => tone(900, 0.07, 'square', 0.1, -600),
    psy: () => { tone(300, 0.2, 'sine', 0.15, 500); tone(500, 0.15, 'triangle', 0.08, 300); },
    swing: () => { noise(0.15, 0.2, 2500); tone(200, 0.12, 'sawtooth', 0.08, -100); },
    hit: () => tone(200, 0.06, 'square', 0.1, -120),
    kill: () => { noise(0.3, 0.25, 900); tone(160, 0.3, 'sawtooth', 0.12, -110); },
    hurt: () => { tone(300, 0.3, 'sawtooth', 0.18, -220); },
    jump: () => tone(300, 0.12, 'square', 0.06, 280),
    boom: () => { noise(0.7, 0.5, 700); tone(90, 0.5, 'sawtooth', 0.2, -60); },
    pick: () => { tone(660, 0.08, 'square', 0.1); tone(990, 0.12, 'square', 0.1, 0, 0.07); },
    roar: () => { tone(110, 0.7, 'sawtooth', 0.18, -60); noise(0.6, 0.2, 500); },
    rock: () => tone(140, 0.25, 'sawtooth', 0.1, 60),
    spike: () => { noise(0.25, 0.3, 3000); tone(120, 0.2, 'square', 0.1); },
    ok: () => tone(700, 0.06, 'square', 0.08),
  };
})();

/* ----------------------------------------------------------------- assets */
const IMG = {};
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });
async function loadAll() {
  const jobs = Object.keys(ATLAS).map(async k => { IMG[k] = await loadImg(ATLAS[k].img); });
  jobs.push(loadImg('assets/bg_far.png').then(i => IMG.far = i));
  jobs.push(loadImg('assets/bg_floor.png').then(i => IMG.floor = i));
  for (const k of Object.keys(SCENES)) jobs.push(loadImg(`assets/scene_${k}.png`).then(i => IMG['scene_' + k] = i));
  await Promise.all(jobs);
}

function sprite(name, anim, frame, x, y, scale = 1, flip = false, alpha = 1) {
  const a = ATLAS[name], an = a.anims[anim];
  const f = Math.max(0, Math.min(an.n - 1, frame | 0));
  const w = a.cw * scale, h = a.ch * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(IMG[name], f * a.cw, an.row * a.ch, a.cw, a.ch, -w / 2, -h, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------- game data */
const CHARS = {
  will:   { name: 'WILL',   hp: 6, speed: 190, rate: 0.22, dmg: 1.2, bspeed: 720, kind: 'bullet', heat: 0.115, sc: 1.0,  tag: 'RIFLE CAZA',   stats: [3, 3, 4] },
  eleven: { name: 'ELEVEN', hp: 5, speed: 185, rate: 0.34, dmg: 1.7, bspeed: 520, kind: 'psy',    heat: 0.20, sc: 1.0,  tag: 'TELEQUINESIS', pierce: 2, stats: [2, 3, 5] },
  lucas:  { name: 'LUCAS',  hp: 5, speed: 205, rate: 0.30, dmg: 1.5, bspeed: 780, kind: 'pellet', heat: 0.13, sc: 1.0, tag: 'WRIST ROCKET', stats: [2, 4, 4] },
  mike:   { name: 'MIKE',   hp: 5, speed: 220, rate: 0.13, dmg: 0.7, bspeed: 660, kind: 'pellet', heat: 0.07, sc: 1.0,  tag: 'TIRACHINAS',  stats: [2, 5, 3] },
  dustin: { name: 'DUSTIN', hp: 6, speed: 195, rate: 0.38, dmg: 0.8, bspeed: 570, kind: 'flare',  heat: 0.20, sc: 1.0,  tag: 'BENGALAS x3', stats: [3, 3, 3] },
  steve:  { name: 'STEVE',  hp: 8, speed: 225, rate: 0.45, dmg: 3.0, melee: true,   sc: 0.95, tag: 'BATE CLAVOS', stats: [5, 4, 4] },
};
const ORDER = ['will', 'eleven', 'mike', 'lucas', 'dustin', 'steve'];

const ETYPES = {
  demo:   { hp: 3,  sp: 62,  w: 46, h: 100, sc: 1.1, score: 100,  reach: 64,  dmg: 1, wind: 0.4 },
  runner: { hp: 2,  sp: 150, w: 42, h: 92,  sc: 1.0, score: 150,  reach: 58,  dmg: 1, wind: 0.22 },
  brute:  { hp: 34, sp: 50,  w: 84, h: 160, sc: 1.7, score: 2000, reach: 112, dmg: 2, wind: 0.55 },
  vecna:  { hp: 150, sp: 70, w: 64, h: 160, sc: 1.0, score: 15000, reach: 0, dmg: 2, wind: 0 },
};

// Escenarios: 'up' Mundo del Revés (actos 1-3, dos capas); el resto son panorámicas que se repiten (actos 4-20).
// y = desplazamiento vertical para que el suelo del dibujo quede a la altura donde andan los personajes.
const SCENES = {
  lab:     { y: -20, spore: '#d8ecff', name: 'LABORATORIO' },
  forest:  { y: -20, spore: '#ff9a8a', name: 'BOSQUE' },
  house:   { y: -30, spore: '#ffd9a0', name: 'CASA' },
  street:  { y: -35, spore: '#ffb08a', name: 'CALLE' },
  mansion: { y: -25, spore: '#ff9a9a', name: 'MANSION' },
};
const mixFor = n => { // más corredores y brutos conforme avanza la partida
  const b = Math.min(0.2, Math.max(0, (n - 2) * 0.012)), r = Math.min(0.55, 0.2 + n * 0.03);
  return [['demo', Math.max(0.25, 1 - r - b)], ['runner', r], ['brute', b]].filter(m => m[1] > 0);
};
const ACTS = [ // [mundo, subtítulo, tinte, jefes]
  ['up', 'LAS RAICES DEL REVES', 'rgba(0,0,0,0)', ['brute']],
  ['up', 'EL BOSQUE DE LIANAS', 'rgba(60,0,80,.2)', ['brute']],
  ['up', 'LA PUERTA DE VECNA', 'rgba(8,0,24,.34)', ['brute', 'brute']],
  ['lab', 'LABORATORIO HAWKINS', 'rgba(0,10,30,.10)', ['brute']],
  ['lab', 'PASILLOS ROTOS', 'rgba(0,20,40,.16)', ['brute']],
  ['lab', 'EL NUCLEO DEL LAB', 'rgba(60,0,0,.2)', ['brute', 'brute']],
  ['forest', 'EL BOSQUE MALDITO', 'rgba(0,0,0,0)', ['brute']],
  ['forest', 'NIEBLA ROJA', 'rgba(40,0,30,.16)', ['brute']],
  ['forest', 'EL CLARO DE LAS ESPORAS', 'rgba(20,40,0,.18)', ['brute', 'brute']],
  ['forest', 'EL ARBOL DE VECNA', 'rgba(20,0,30,.3)', ['vecna']],
  ['house', 'LA CASA BYERS', 'rgba(60,20,0,.08)', ['brute']],
  ['house', 'LAS LUCES DE JOYCE', 'rgba(60,0,40,.14)', ['brute']],
  ['house', 'EL SOTANO DE LA CASA', 'rgba(0,0,20,.34)', ['brute', 'brute']],
  ['street', 'BIENVENIDOS A HAWKINS', 'rgba(20,0,40,.1)', ['brute']],
  ['street', 'LA CALLE PRINCIPAL', 'rgba(40,0,30,.18)', ['brute']],
  ['street', 'LA TORRE DE AGUA', 'rgba(60,0,0,.24)', ['brute', 'brute']],
  ['mansion', 'LA MANSION', 'rgba(20,0,30,.16)', ['brute']],
  ['mansion', 'EL JARDIN MUERTO', 'rgba(40,0,20,.24)', ['brute', 'brute']],
  ['mansion', 'EL SALON DEL TERROR', 'rgba(10,0,20,.34)', ['brute', 'brute', 'brute']],
  ['mansion', 'EL ULTIMO PORTAL', 'rgba(60,0,40,.40)', ['brute', 'vecna']],
];
const STAGES = ACTS.map(([world, sub, tint, boss], i) => ({ world, name: `ACTO ${i + 1}`, sub, tint, boss, len: Math.min(6200, 4600 + i * 110), mix: mixFor(i) }));

// objetos lanzables: dmg directo, aoe = radio de explosión, cd = retraso que provoca a los enemigos afectados
const PROPS = {
  chair:        { name: 'SILLA',   dmg: 7, aoe: 0,   cd: 0 },
  extinguisher: { name: 'EXTINTOR', dmg: 3, aoe: 105, cd: 1.6 },
  rock:         { name: 'ROCA',    dmg: 6, aoe: 0,   cd: 0 },
  barrel:       { name: 'BIDON',   dmg: 6, aoe: 125, cd: 0.8 },
  lamp:         { name: 'LAMPARA', dmg: 5, aoe: 0,   cd: 0 },
};
const PROP_WORLD = { up: ['rock', 'barrel'], lab: ['chair', 'extinguisher'], forest: ['rock', 'barrel'], house: ['chair', 'lamp'], street: ['barrel', 'rock'], mansion: ['chair', 'lamp'] };

const rngMaker = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

function buildLevel(n) {
  const st = STAGES[n], rng = rngMaker(1234 + n * 977);
  const plats = [], spawns = [], items = [];
  let first = true;
  for (let x = 800; x < st.len - 1100; x += 750 + rng() * 450) {
    const w = 130 + rng() * 60;
    plats.push({ x, y: GROUND - 92, w });
    items.push({ x: x + w / 2, y: GROUND - 118, type: first ? 'wpn' : (rng() < 0.5 ? 'hp' : 'gren') });
    first = false;
    if (rng() < 0.65) {
      plats.push({ x: x + w + 50, y: GROUND - 175, w: 120 });
      if (rng() < 0.5) items.push({ x: x + w + 110, y: GROUND - 200, type: 'gren' });
    }
  }
  items.push({ x: st.len - W + 180, y: GROUND - 20, type: 'hp' });
  const kinds = PROP_WORLD[st.world];
  for (let x = 650; x < st.len - 900; x += (230 + rng() * 180) * (1 - Math.min(n, 9) * 0.02)) {
    let r = rng(), type = st.mix[0][0], acc = 0;
    for (const [t, p] of st.mix) { acc += p; if (r < acc) { type = t; break; } }
    spawns.push({ x, type, side: rng() < 0.18 ? 'L' : 'R' });
    if (n > 0 && rng() < 0.3) spawns.push({ x: x + 40, type: 'demo', side: 'R' });
  }
  spawns.sort((a, b) => a.x - b.x);
  // objetos del escenario que se pueden coger y lanzar a los enemigos
  for (let x = 560 + rng() * 200; x < st.len - 1000; x += 520 + rng() * 420) items.push({ x, y: GROUND - 18, type: 'prop', prop: kinds[Math.floor(rng() * kinds.length)] });
  return { len: st.len, plats, spawns, items };
}

/* ------------------------------------------------------------------ state */
const G = {
  state: 'loading', t: 0, sel: 0, charId: 'will', stage: 0, score: 0, lives: 3,
  p: null, cam: { x: 0, max: 0 }, plats: [], enemies: [], bullets: [], eproj: [], haz: [], gren: [],
  items: [], parts: [], rings: [], spawns: [], si: 0, bossSpawned: false, shake: 0, banner: 0,
  clearT: 0, flash: 0, noEnemyT: 0, bossDelay: 0, bossQueue: [], bossBanner: 0, props: [],
};
const spores = Array.from({ length: 46 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * GROUND, s: 1 + Math.random() * 2, v: 8 + Math.random() * 18, par: 0.3 + Math.random() * 0.5, ph: Math.random() * 6 }));

function newPlayer(id, x) {
  const c = CHARS[id];
  return { id, c, x, y: GROUND, vx: 0, vy: 0, face: 1, hp: c.hp, maxHp: c.hp, onGround: true, crouch: false,
    shootCd: 0, shootT: 0, hurtT: 0, inv: 0, dead: false, deadT: 0, animT: 0, wpn: 1, gren: 3, gCd: 0,
    bindT: 0, aimT: 0, heat: 0, coolT: 0, jam: 0, holdT: 0, held: null, melee: 0, meleeHit: new Set(), drop: 0, w: 34, h: 84, kx: 0 };
}

function startStage(n) {
  const lv = buildLevel(n);
  G.stage = n; G.plats = lv.plats; G.spawns = lv.spawns; G.items = lv.items.map(i => ({ ...i, t: Math.random() * 6 }));
  G.enemies = []; G.bullets = []; G.eproj = []; G.haz = []; G.gren = []; G.props = []; G.parts = []; G.rings = [];
  G.si = 0; G.bossSpawned = false; G.bossQueue = []; G.cam = { x: 0, max: lv.len - W }; G.shake = 0;
  G.banner = 3.2; G.noEnemyT = 0;
  const keep = G.p;
  G.p = newPlayer(G.charId, 80);
  if (keep && n > 0) { G.p.wpn = keep.wpn; G.p.gren = Math.max(3, keep.gren); G.p.held = keep.held; }
  Snd.setFast(false);
  G.state = 'play';
}

function newGame() {
  G.score = 0; G.lives = 3; G.p = null;
  startStage(0);
}

/* ---------------------------------------------------------------- helpers */
const ovl = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pbox = p => ({ x: p.x - p.w / 2, y: p.y - (p.crouch ? 54 : p.h), w: p.w, h: p.crouch ? 54 : p.h });
const ebox = e => ({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h });
const rnd = (a, b) => a + Math.random() * (b - a);

function burst(x, y, n, color, spd = 160, life = 0.5, g = 400, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = rnd(0.3, 1) * spd;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rnd(0.5, 1) * life, max: life, color, g, size: rnd(size * 0.6, size * 1.4) });
  }
}

/* ----------------------------------------------------------------- player */
function aimDir(p) {
  const up = down(...K.up), dn = down(...K.down), mv = down(...K.left) || down(...K.right);
  if (up && mv) return { x: p.face * 0.7071, y: -0.7071 };
  if (up) return { x: 0, y: -1 };
  if (dn && !p.onGround) return { x: 0, y: 1 };
  return { x: p.face, y: 0 };
}

function fire(p) {
  const c = p.c, lv = p.wpn;
  p.shootCd = c.rate * (lv >= 2 ? 0.8 : 1) * (c.melee ? 1 : 1 + Math.min(0.6, p.holdT * 0.35)); // mantener pulsado = más lento
  p.shootT = 0.24; p.aimT = 0.55;
  if (c.melee) {
    p.melee = 0.36; p.meleeHit = new Set(); Snd.swing(); p.shootCd = 0.4; return;
  }
  const d = aimDir(p);
  const vert = d.x === 0;
  const mx = p.x + (vert ? p.face * 8 : d.x * 40) , my = p.y - (p.crouch ? 34 : 58) + (d.y < 0 ? -26 : d.y > 0 ? 40 : 0);
  const dmg = c.dmg * (1 + 0.3 * (lv - 1));
  let offs;
  if (p.id === 'dustin') offs = lv >= 3 ? [-0.3, -0.15, 0, 0.15, 0.3] : [-0.16, 0, 0.16];
  else if (lv >= 3) offs = [-0.05, 0.05];
  else offs = [0];
  if (p.id === 'eleven' && lv >= 3) offs = [-0.12, 0, 0.12];
  const base = Math.atan2(d.y, d.x) + (Math.random() - 0.5) * 2 * Math.min(0.17, p.holdT * 0.085); // y menos preciso
  for (const o of offs) {
    const a = base + o;
    G.bullets.push({ x: mx, y: my, vx: Math.cos(a) * c.bspeed, vy: Math.sin(a) * c.bspeed, dmg, kind: c.kind,
      pierce: c.pierce || 0, life: 1.0, hit: new Set(), r: c.kind === 'psy' ? 10 : 5, a });
  }
  if (c.kind === 'psy') Snd.psy(); else Snd.shoot();
  burst(mx, my, 3, '#ffd34d', 80, 0.15, 0, 2);
  // calor: el arma se sobrecalienta si no dejas de disparar
  p.heat += c.heat * (1 - 0.12 * (lv - 1)); p.coolT = 0.3;
  if (p.heat >= 1) { p.heat = 1; p.jam = 1.4; p.holdT = 0; Snd.rock(); burst(mx, my, 10, '#999', 70, 0.6, -20, 3); }
}

function throwProp(p) {
  const up = down(...K.up);
  G.props.push({ kind: p.held, x: p.x + p.face * 18, y: p.y - 76, vx: p.face * (up ? 170 : 420) + p.vx * 0.3, vy: up ? -640 : -240, rot: 0, t: 0 });
  p.held = null; Snd.swing();
}

function throwGrenade(p) {
  if (p.gren <= 0 || p.gCd > 0) return;
  p.gren--; p.gCd = 0.5;
  G.gren.push({ x: p.x + p.face * 20, y: p.y - 60, vx: p.face * 300 + p.vx * 0.3, vy: -360, t: 0, spin: 0 });
  Snd.swing();
}

function hurtPlayer(dmg, fromX) {
  const p = G.p;
  if (p.inv > 0 || p.dead) return;
  p.hp -= dmg; p.inv = 1.6; p.hurtT = 0.4; p.vy = -260; p.onGround = false; p.melee = 0;
  p.kx = (p.x < fromX ? -1 : 1) * 220;
  G.shake = Math.max(G.shake, 8); G.flash = 0.18;
  Snd.hurt(); burst(p.x, p.y - 50, 10, '#c01010', 200, 0.5);
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = 0; p.vy = -300; p.wpn = 1; G.lives--; }
}

function updatePlayer(dt) {
  const p = G.p;
  p.animT += dt;
  if (p.inv > 0) p.inv -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.gCd > 0) p.gCd -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.shootT > 0) p.shootT -= dt;
  if (p.aimT > 0) p.aimT -= dt;
  if (p.drop > 0) p.drop -= dt;
  if (p.bindT > 0) p.bindT -= dt;

  if (p.dead) {
    p.deadT += dt; p.vy += GRAV * dt; p.y = Math.min(GROUND, p.y + p.vy * dt); if (p.y >= GROUND) p.vy = 0;
    if (p.deadT > 1.8) {
      if (G.lives < 0) { G.state = 'over'; return; }
      Object.assign(p, { dead: false, hp: p.maxHp, x: G.cam.x + 100, y: -40, vy: 0, vx: 0, inv: 2.6, hurtT: 0, gren: Math.max(p.gren, 3) });
    }
    return;
  }

  let L = down(...K.left), R = down(...K.right);
  if (p.bindT > 0) [L, R] = [R, L];
  const dn = down(...K.down);
  p.crouch = dn && p.onGround && p.melee <= 0;
  let mv = 0;
  if (!p.crouch) { if (L) mv--; if (R) mv++; }
  if (mv && p.melee <= 0) p.face = mv;
  p.vx = (p.hurtT > 0.15 ? p.kx : mv * p.c.speed);
  if (p.melee > 0) p.vx *= 0.45;

  if (tap(...K.jump) && p.onGround && p.bindT <= 0.0001 || (tap(...K.jump) && p.onGround)) {
    if (dn && p.y < GROUND) { p.drop = 0.3; p.onGround = false; }
    else { p.vy = -JUMP; p.onGround = false; Snd.jump(); }
  }
  if (!down(...K.jump) && p.vy < -220) p.vy += GRAV * 1.6 * dt; // salto variable

  const prevY = p.y;
  p.vy += GRAV * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.onGround = false;
  if (p.vy >= 0 && p.drop <= 0) {
    for (const pl of G.plats) {
      if (p.x + 12 > pl.x && p.x - 12 < pl.x + pl.w && prevY <= pl.y + 2 && p.y >= pl.y) { p.y = pl.y; p.vy = 0; p.onGround = true; break; }
    }
  }
  if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; }
  // los enemigos son sólidos: bloquean el paso (se pueden saltar por encima)
  for (const e of G.enemies) {
    if (e.dead || e.dying) continue;
    const top = p.y - (p.crouch ? 54 : p.h), overlapY = Math.min(p.y, e.y) - Math.max(top, e.y - e.h);
    if (overlapY < 14) continue;
    const dxp = p.x - e.x, minD = 15 + e.w * 0.36;
    if (Math.abs(dxp) < minD) p.x = e.x + (dxp >= 0 ? minD : -minD);
  }
  p.x = Math.max(G.cam.x + 26, Math.min(G.cam.x + W - 26, p.x));

  // objetos: DISPARO encima de uno lo coge; DISPARO otra vez lo suelta (lanzado hacia delante; con ABAJO se deja a los pies)
  let used = false;
  if (tap(...K.fire) && !p.dead) {
    if (p.held) {
      if (down(...K.down)) { G.items.push({ x: p.x + p.face * 26, y: GROUND - 18, type: 'prop', prop: p.held, t: 0 }); p.held = null; Snd.pick(); }
      else throwProp(p);
      used = true;
    } else {
      const near = G.items.find(it => it.type === 'prop' && Math.abs(it.x - p.x) < 46 && Math.abs(it.y - (p.y - 20)) < 70);
      if (near) { p.held = near.prop; near.got = true; Snd.pick(); burst(near.x, near.y, 8, '#fff', 120, 0.3); used = true; }
    }
    if (used) p.shootCd = Math.max(p.shootCd, 0.3);
  }
  const firing = down(...K.fire) && !p.held;
  if (p.jam > 0) { p.jam -= dt; if (p.jam <= 0) { p.heat = 0.3; Snd.ok(); } }
  else if (firing && !p.c.melee) p.holdT = Math.min(2, p.holdT + dt);
  if (!firing || p.jam > 0) p.holdT = Math.max(0, p.holdT - dt * 3);
  if (p.jam <= 0) { if (p.coolT > 0) p.coolT -= dt; else p.heat = Math.max(0, p.heat - 0.45 * dt); }
  if (firing && p.shootCd <= 0 && p.melee <= 0 && p.jam <= 0) fire(p);
  if (tap(...K.gren) && !used) { if (p.held) throwProp(p); else throwGrenade(p); }

  if (p.melee > 0) {
    p.melee -= dt;
    const prog = 1 - p.melee / 0.36;
    if (prog > 0.25 && prog < 0.8) {
      const reach = 90 + 8 * (p.wpn - 1);
      const hb = { x: p.face > 0 ? p.x : p.x - reach, y: p.y - 100, w: reach, h: 100 };
      for (const e of G.enemies) if (!e.dead && !p.meleeHit.has(e) && ovl(hb, ebox(e))) {
        p.meleeHit.add(e);
        damageEnemy(e, p.c.dmg * (1 + 0.3 * (p.wpn - 1)), p.face);
      }
      for (const q of G.eproj) if (!q.dead && ovl(hb, { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 })) { q.dead = true; burst(q.x, q.y, 8, '#bbb', 150, 0.4); }
    }
  }
}

function playerPose(p) {
  const id = p.id, mv = Math.abs(p.vx) > 5;
  if (p.dead) return id === 'steve' ? ['hurt', 3] : ['other', id === 'will' || id === 'lucas' ? 6 : 3];
  if (p.hurtT > 0) return id === 'steve' ? ['hurt', 0] : id === 'will' || id === 'lucas' ? ['other', 4] : ['other', 1];
  if (p.melee > 0) return ['attack', Math.min(4, Math.floor((1 - p.melee / 0.36) * 5))];
  if (p.crouch) return ['other', id === 'will' || id === 'lucas' ? 1 : 0];
  if (p.shootT > 0) {
    const hot = p.shootT > 0.12;
    if (id === 'will' || id === 'lucas') return ['shoot', hot ? 2 : 1];
    if (id === 'eleven') return ['power', hot ? 3 : 2];
    return ['talk', hot ? 2 : 1];
  }
  if (!p.onGround) return [id === 'steve' ? 'run' : 'walk', 2];
  if (mv) { // el ritmo sigue a la velocidad: los pies no patinan
    const an = id === 'steve' ? 'run' : 'walk', n = ATLAS[id].anims[an].n;
    return [an, Math.floor(p.animT * Math.max(10, n * p.c.speed / 90)) % n];
  }
  return ['idle', Math.floor(p.animT * 4) % 4];
}

/* ---------------------------------------------------------------- enemies */
function mkEnemy(type, x, face = -1, hpOverride) {
  const T = ETYPES[type];
  const e = { type, x, y: GROUND, vx: 0, vy: 0, hp: hpOverride || T.hp, maxHp: hpOverride || T.hp, w: T.w, h: T.h, sc: T.sc, face,
    state: type === 'vecna' ? 'enter' : 'roar', t: 0, animT: Math.random(), cd: rnd(0.6, 1.6), flash: 0, dead: false, dying: 0,
    hit: false, inv: false, boss: type === 'brute' && G.bossSpawned, roarT: rnd(4, 7), phase2: false, fired: false,
    grounded: true, pounced: false, jumpCd: rnd(0.3, 1) };
  if (type === 'vecna') { e.boss = true; e.cd = 1.2; }
  return e;
}

function spawnEnemy(type, x, face, hp) { const e = mkEnemy(type, x, face, hp); G.enemies.push(e); return e; }

function dropFrom(e) {
  const r = Math.random();
  const type = r < 0.06 ? 'hp' : r < 0.12 ? 'gren' : r < 0.16 ? 'wpn' : null;
  if (type && e.type !== 'vecna') G.items.push({ x: e.x, y: GROUND - 20, type, t: 0 });
}

function damageEnemy(e, d, dir = 1) {
  if (e.dead || e.dying || e.inv) return;
  e.hp -= d; e.flash = 0.1;
  if (e.type !== 'brute' && e.type !== 'vecna') e.hurtT = 0.2;
  burst(e.x, e.y - e.h * 0.6, 4, '#c8c', 140, 0.3);
  Snd.hit();
  if (e.hp <= 0) {
    e.hp = 0; e.dying = 0.0001; Snd.kill();
    G.score += ETYPES[e.type].score;
    burst(e.x, e.y - e.h / 2, e.type === 'brute' ? 40 : 18, '#b01020', 260, 0.8);
    if (e.type === 'vecna') { e.state = 'die'; e.t = 0; Snd.boom(); }
    else dropFrom(e);
  } else if (e.type !== 'brute' && e.type !== 'vecna' && e.state !== 'swipe') {
    e.x += dir * 6;
  }
}

function landEnemy(e) {
  e.vy = 0; e.vx = 0; e.grounded = true; e.pounced = false;
  if (e.type === 'brute') G.shake = Math.max(G.shake, 6);
}
function enemyPhysics(e, dt) {
  const prevY = e.y;
  if (e.grounded && e.y < GROUND - 0.5 && !G.plats.some(q => e.x > q.x && e.x < q.x + q.w && Math.abs(q.y - e.y) < 3)) e.grounded = false;
  if (e.grounded) return;
  e.vy += GRAV * dt; e.y += e.vy * dt; e.x += e.vx * dt;
  if (e.vy >= 0) {
    for (const q of G.plats) if (e.x > q.x && e.x < q.x + q.w && prevY <= q.y + 2 && e.y >= q.y) { e.y = q.y; landEnemy(e); return; }
  }
  if (e.y >= GROUND) { e.y = GROUND; landEnemy(e); }
}

function updateEnemy(e, dt) {
  const p = G.p, T = ETYPES[e.type];
  e.animT += dt; e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.jumpCd > 0) e.jumpCd -= dt; if (e.hurtT > 0) e.hurtT -= dt;
  if (e.dying) {
    if (e.type === 'vecna') { updateVecna(e, dt); return; }
    e.dying += dt; if (e.dying > 1.25) e.dead = true; return;
  }
  if (e.type === 'vecna') { updateVecna(e, dt); return; }

  const dx = p.x - e.x, dist = Math.abs(dx);
  // en el aire: salto para alcanzar al jugador en una plataforma (y golpea al caer sobre él)
  if (!e.grounded) {
    if (!e.pounced && !p.dead && ovl({ x: e.x - e.w * 0.4, y: e.y - e.h, w: e.w * 0.8, h: e.h }, pbox(p))) { e.pounced = true; hurtPlayer(T.dmg, e.x); }
    enemyPhysics(e, dt);
    return;
  }
  switch (e.state) {
    case 'roar':
      if (e.t > (e.type === 'brute' ? 0.9 : 0.45)) { e.state = 'walk'; e.t = 0; }
      if (e.t < 0.05 && e.type === 'brute') Snd.roar();
      break;
    case 'walk': {
      if (!p.dead) e.face = dx >= 0 ? 1 : -1;
      const stop = T.reach * 0.75;
      if (dist > stop) e.x += e.face * T.sp * dt;
      e.cd -= dt;
      // jugador subido en una plataforma: saltar hacia él
      if (!p.dead && e.jumpCd <= 0 && e.y - p.y > 45 && dist < 240) {
        const v = Math.min(900, Math.sqrt(2 * GRAV * (e.y - p.y + 32)));
        e.vy = -v; e.vx = Math.max(-340, Math.min(340, dx / (v / GRAV + 0.15)));
        e.grounded = false; e.pounced = false; e.jumpCd = e.type === 'brute' ? 2.6 : rnd(1.2, 2);
        break;
      }
      if (e.type === 'brute') { e.roarT -= dt; if (e.roarT <= 0 && G.enemies.length < 8) { e.roarT = rnd(5, 8); e.state = 'roar'; e.t = 0; spawnEnemy('runner', Math.min(G.cam.x + W + 40, e.x + 300), -1); } }
      if (dist <= T.reach && e.cd <= 0 && !p.dead && Math.abs(p.y - e.y) < 60) { e.state = 'wind'; e.t = 0; e.hit = false; }
      break; }
    case 'wind':
      if (e.t >= T.wind) { e.state = 'swipe'; e.t = 0; Snd.swing(); }
      break;
    case 'swipe': {
      if (!e.hit) {
        const reach = T.reach + 18;
        const hb = { x: e.face > 0 ? e.x - 10 : e.x - reach, y: e.y - e.h, w: reach + 10, h: e.h };
        if (ovl(hb, pbox(p))) { e.hit = true; hurtPlayer(T.dmg, e.x); }
      }
      if (e.t > 0.2) { e.state = 'recover'; e.t = 0; }
      break; }
    case 'recover':
      if (e.t > 0.4) { e.state = 'walk'; e.t = 0; e.cd = rnd(0.5, 1.1); }
      break;
  }
  enemyPhysics(e, dt); // caerse de las plataformas
  if (e.x < G.cam.x - 200) e.dead = true; // se quedó atrás
}

/* -------------------------------------------------------------- Vecna AI */
function vecnaHit(e) { return e; }

function updateVecna(e, dt) {
  const p = G.p, dx = p.x - e.x, dist = Math.abs(dx);
  const minX = G.cam.x + W * 0.4, maxX = G.cam.x + W - 90;
  if (!p.dead && e.state !== 'phase' && e.state !== 'die') e.face = dx >= 0 ? 1 : -1;
  if (e.state !== 'die' && e.state !== 'phase' && !e.phase2 && e.hp <= e.maxHp * 0.5 && e.hp > 0) {
    e.state = 'phase'; e.t = 0; e.inv = true; e.fired = false; G.shake = 14; Snd.roar();
  }
  switch (e.state) {
    case 'enter': {
      e.inv = true;
      const target = G.cam.x + W - 190;
      e.face = -1;
      if (e.x > target) e.x -= 80 * dt; else { e.state = 'idle'; e.inv = false; e.t = 0; }
      break; }
    case 'idle': {
      let sp = e.phase2 ? 95 : 70;
      if (dist < 250) e.x -= Math.sign(dx || 1) * sp * dt;
      else if (dist > 430) e.x += Math.sign(dx) * sp * dt;
      e.x = Math.max(minX, Math.min(maxX, e.x));
      e.cd -= dt;
      if (e.cd <= 0) {
        const opts = [['cast', 0.32], ['spike', 0.28]];
        if (dist < 330) opts.push(['tend', 0.3]);
        if (e.hp < e.maxHp * 0.8) opts.push(['bind', e.phase2 ? 0.25 : 0.14]);
        let tot = opts.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, pick = opts[0][0];
        for (const o of opts) { if ((r -= o[1]) <= 0) { pick = o[0]; break; } }
        e.state = pick; e.t = 0; e.fired = false;
        if (pick === 'spike') {
          const xs = e.phase2 ? [p.x - 130, p.x, p.x + 130, p.x + 260 * p.face] : [p.x - 60, p.x + 70];
          for (const sx of xs) G.haz.push({ kind: 'spike', x: Math.max(G.cam.x + 20, Math.min(G.cam.x + W - 20, sx)), w: 46, t: 0, delay: 0.8, dur: 0.55, dmg: 2, hit: false });
        }
      }
      break; }
    case 'cast':
      if (!e.fired && e.t > 0.45) {
        e.fired = true; Snd.rock();
        const n = e.phase2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const ang = Math.atan2((p.y - 55) - (e.y - 110), p.x - e.x) + (i - (n - 1) / 2) * 0.17;
          G.eproj.push({ type: 'rock', x: e.x + e.face * 50, y: e.y - 110, vx: Math.cos(ang) * 270, vy: Math.sin(ang) * 270, r: 15, hp: 2, dmg: 1, life: 4, rot: 0 });
        }
      }
      if (e.t > 0.95) endAttack(e);
      break;
    case 'bind':
      if (!e.fired && e.t > 0.45) {
        e.fired = true; Snd.rock();
        G.eproj.push({ type: 'orb', x: e.x + e.face * 50, y: e.y - 110, vx: e.face * 150, vy: 0, r: 17, hp: 3, dmg: 1, life: 6, homing: true });
      }
      if (e.t > 0.95) endAttack(e);
      break;
    case 'tend':
      if (!e.fired && e.t > 0.5) {
        e.fired = true; Snd.spike();
        G.haz.push({ kind: 'tend', x: e.x + e.face * 20, face: e.face, w: 270, t: 0, delay: 0, dur: 0.4, dmg: 2, hit: false });
      }
      if (e.t > 1.15) endAttack(e);
      break;
    case 'spike':
      if (e.t > 1.0) endAttack(e);
      break;
    case 'phase':
      if (e.t > 1.9) {
        e.state = 'idle'; e.inv = false; e.phase2 = true; e.cd = 0.8; Snd.setFast(true);
        spawnEnemy('runner', G.cam.x + 30, 1); spawnEnemy('runner', G.cam.x + W - 30, -1);
      }
      break;
    case 'die':
      e.dying += dt;
      if (Math.random() < 0.3) burst(e.x + rnd(-40, 40), e.y - rnd(20, 150), 6, '#d02030', 220, 0.6);
      if (e.dying > 3.0 && !e.dead) { e.dead = true; G.shake = 18; G.flash = 0.6; Snd.boom(); }
      break;
  }
}
function endAttack(e) { e.state = 'idle'; e.t = 0; e.cd = e.phase2 ? rnd(0.7, 1.2) : rnd(1.3, 2.1); }

function vecnaPose(e) {
  const t = e.t, A = ATLAS.vecna.anims;
  const walk = ['walk', Math.floor(e.animT * 8) % A.walk.n];
  switch (e.state) {
    case 'enter': return walk;
    case 'idle': return Math.abs(G.p.x - e.x) < 250 || Math.abs(G.p.x - e.x) > 430 ? walk : ['idle', Math.floor(e.animT * 4) % A.idle.n];
    case 'cast': return ['cast', Math.min(A.cast.n - 1, Math.floor(t / 0.16))];
    case 'bind': return ['bind', Math.min(A.bind.n - 1, Math.floor(t / 0.3))];
    case 'spike': return ['spike', Math.min(A.spike.n - 1, Math.floor(t / 0.3))];
    case 'tend': return ['tend', Math.min(A.tend.n - 1, Math.floor(t / 0.19))];
    case 'phase': return ['phase', Math.min(A.phase.n - 1, Math.floor(t / 0.24))];
    case 'die': return ['die', Math.min(A.die.n - 1, Math.floor(e.dying / 0.6))];
  }
  return ['idle', 0];
}

/* ----------------------------------------------------------------- update */
function updatePlay(dt) {
  const p = G.p;
  G.t += dt;
  if (G.banner > 0) G.banner -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - 30 * dt);
  if (G.flash > 0) G.flash -= dt;

  updatePlayer(dt);

  // camara: solo avanza (estilo Metal Slug)
  const target = Math.min(G.cam.max, p.x - W * 0.4);
  if (target > G.cam.x) G.cam.x = Math.min(G.cam.max, G.cam.x + Math.max(0, (target - G.cam.x)) * Math.min(1, dt * 8) + 0.01);

  // spawns
  while (G.si < G.spawns.length && G.spawns[G.si].x <= G.cam.x + W + 40) {
    const s = G.spawns[G.si++];
    if (G.enemies.filter(e => !e.dead).length >= 9) continue;
    if (s.side === 'L') spawnEnemy(s.type, G.cam.x - 50, 1);
    else spawnEnemy(s.type, Math.max(s.x, G.cam.x + W + 50), -1);
  }
  // jefes
  if (!G.bossSpawned && G.cam.x >= G.cam.max - 3) {
    G.bossSpawned = true; Snd.setFast(true);
    G.bossQueue = [...STAGES[G.stage].boss]; G.bossDelay = 0.5; G.banner = 0; G.bossBanner = 2.5;
  }
  if (G.bossQueue.length) {
    G.bossDelay -= dt;
    if (G.bossDelay <= 0) {
      const t = G.bossQueue.shift();
      const e = spawnEnemy(t, G.cam.x + W + 80, -1, t === 'brute' ? 34 + G.stage * 4 : (t === 'vecna' ? (G.stage >= 19 ? 260 : 175) : undefined));
      e.boss = true; if (t === 'brute') { e.state = 'roar'; Snd.roar(); }
      G.bossDelay = 1.6;
    }
  }
  if (G.bossBanner > 0) G.bossBanner -= dt;

  // enemigos
  for (const e of G.enemies) updateEnemy(e, dt);
  // los enemigos no se apilan: se separan entre sí
  for (let i = 0; i < G.enemies.length; i++) for (let j = i + 1; j < G.enemies.length; j++) {
    const a = G.enemies[i], b = G.enemies[j];
    if (!a.grounded || !b.grounded || a.dying || b.dying || a.type === 'vecna' || b.type === 'vecna' || Math.abs(a.y - b.y) > 20) continue;
    const min = (a.w + b.w) * 0.36, d = b.x - a.x;
    if (Math.abs(d) < min) { const push = (min - Math.abs(d)) * 0.5 * Math.min(1, dt * 10) * (d >= 0 ? 1 : -1); a.x -= push; b.x += push; }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  if (G.bossSpawned && !G.bossQueue.length && !G.enemies.some(e => e.boss) && G.state === 'play') {
    G.state = 'clear'; G.clearT = 0; Snd.pick();
    G.score += 3000;
  }

  // balas
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < G.cam.x - 30 || b.x > G.cam.x + W + 30 || b.y < -30 || b.y > GROUND + 20) { b.dead = true; continue; }
    const bb = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
    for (const e of G.enemies) {
      if (e.dead || e.dying || b.hit.has(e)) continue;
      if (ovl(bb, ebox(e))) {
        b.hit.add(e); damageEnemy(e, b.dmg, Math.sign(b.vx) || 1);
        if (e.inv) burst(b.x, b.y, 3, '#fff', 80, 0.2);
        if (--b.pierce < 0) { b.dead = true; break; }
      }
    }
    if (b.dead) continue;
    for (const q of G.eproj) if (!q.dead && Math.hypot(q.x - b.x, q.y - b.y) < q.r + b.r) {
      q.hp -= b.dmg; burst(q.x, q.y, 3, '#caa', 100, 0.25);
      if (q.hp <= 0) { q.dead = true; burst(q.x, q.y, 10, q.type === 'orb' ? '#b02070' : '#888', 160, 0.4); G.score += 50; }
      if (--b.pierce < 0) { b.dead = true; break; }
    }
  }
  G.bullets = G.bullets.filter(b => !b.dead);

  // proyectiles enemigos
  for (const q of G.eproj) {
    q.life -= dt; q.rot = (q.rot || 0) + dt * 6;
    if (q.homing && !p.dead) {
      const a = Math.atan2((p.y - 50) - q.y, p.x - q.x), s = Math.hypot(q.vx, q.vy);
      q.vx += Math.cos(a) * 160 * dt; q.vy += Math.sin(a) * 160 * dt;
      const ns = Math.hypot(q.vx, q.vy); if (ns > 190) { q.vx *= 190 / ns; q.vy *= 190 / ns; }
    }
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.life <= 0 || q.y > GROUND + 10 || q.x < G.cam.x - 60 || q.x > G.cam.x + W + 60) { q.dead = true; if (q.y > GROUND) burst(q.x, GROUND, 8, '#777', 140, 0.4); continue; }
    if (!p.dead && ovl({ x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 }, pbox(p))) {
      q.dead = true; hurtPlayer(q.dmg, q.x);
      if (q.type === 'orb' && p.hp > 0) { p.bindT = 3.2; }
    }
  }
  G.eproj = G.eproj.filter(q => !q.dead);

  // peligros (espinas / tentaculos)
  for (const h of G.haz) {
    h.t += dt;
    if (h.t >= h.delay && h.t < h.delay + h.dur) {
      if (!h.sfx) { h.sfx = true; if (h.kind === 'spike') Snd.spike(); G.shake = Math.max(G.shake, 5); }
      const hb = h.kind === 'spike' ? { x: h.x - h.w / 2, y: GROUND - 130, w: h.w, h: 130 }
        : { x: h.face > 0 ? h.x : h.x - h.w, y: GROUND - 150, w: h.w, h: 150 };
      if (!h.hit && !p.dead && ovl(hb, pbox(p))) { h.hit = true; hurtPlayer(h.dmg, h.x); }
    }
  }
  G.haz = G.haz.filter(h => h.t < h.delay + h.dur + 0.25);

  // granadas
  for (const g of G.gren) {
    g.t += dt; g.vy += 1100 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.spin += dt * 12;
    if (Math.random() < 0.75) G.parts.push({ x: g.x, y: g.y, vx: rnd(-15, 15), vy: rnd(-25, -5), life: 0.45, max: 0.45, color: '#9a9a9a', g: 0, size: 0, smoke: true, r: 2.5, gr: 8 });
    if (Math.random() < 0.6) G.parts.push({ x: g.x + rnd(-4, 4), y: g.y - 12, vx: rnd(-50, 50), vy: rnd(-110, -30), life: 0.28, max: 0.28, color: '#ffb23a', g: 300, size: 2.4 });
    let boom = g.y >= GROUND || g.t > 1.6;
    for (const e of G.enemies) if (!e.dead && !e.dying && ovl({ x: g.x - 8, y: g.y - 8, w: 16, h: 16 }, ebox(e))) boom = true;
    if (boom) {
      g.dead = true; G.rings.push({ x: g.x, y: Math.min(g.y, GROUND), t: 0 });
      burst(g.x, Math.min(g.y, GROUND) - 10, 30, '#ff9a2a', 300, 0.7); burst(g.x, Math.min(g.y, GROUND) - 10, 14, '#fff3a0', 200, 0.4);
      Snd.boom(); G.shake = Math.max(G.shake, 10); G.flash = Math.max(G.flash, 0.06);
      for (let i = 0; i < 16; i++) { const l = rnd(0.7, 1.4); G.parts.push({ x: g.x + rnd(-28, 28), y: Math.min(g.y, GROUND) - rnd(0, 30), vx: rnd(-45, 45), vy: rnd(-120, -30), life: l, max: l, color: i % 3 ? '#4d3f3f' : '#8d7d72', g: -25, size: 0, smoke: true, r: 10, gr: 32 }); }
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - g.x, (e.y - e.h / 2) - g.y) < 110 + e.w / 2) damageEnemy(e, 6, Math.sign(e.x - g.x) || 1);
      for (const q of G.eproj) if (Math.hypot(q.x - g.x, q.y - g.y) < 120) q.dead = true;
    }
  }
  G.gren = G.gren.filter(g => !g.dead);
  // objetos lanzados
  for (const o of G.props) {
    const D = PROPS[o.kind];
    o.t += dt; o.vy += 1500 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += dt * (o.vx >= 0 ? 11 : -11);
    let hit = null;
    for (const e of G.enemies) if (!e.dead && !e.dying && ovl({ x: o.x - 15, y: o.y - 15, w: 30, h: 30 }, ebox(e))) { hit = e; break; }
    if (!hit && o.y < GROUND - 4 && o.t < 2.2) continue;
    o.dead = true;
    const gy = Math.min(o.y, GROUND - 6);
    if (D.aoe) {
      const boom = o.kind === 'barrel';
      burst(o.x, gy, boom ? 34 : 22, boom ? '#ff9a2a' : '#ffffff', 280, 0.7);
      for (let i = 0; i < 14; i++) { const l = rnd(0.8, 1.5); G.parts.push({ x: o.x + rnd(-24, 24), y: gy - rnd(0, 30), vx: rnd(-40, 40), vy: rnd(-70, -15), life: l, max: l, color: boom ? '#4d3f3f' : '#e8f0f4', g: -10, size: 0, smoke: true, r: 12, gr: 34 }); }
      if (boom) { G.rings.push({ x: o.x, y: gy, t: 0 }); Snd.boom(); G.shake = Math.max(G.shake, 9); } else { Snd.spike(); G.shake = Math.max(G.shake, 4); }
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - o.x, (e.y - e.h / 2) - gy) < D.aoe + e.w / 2) {
        damageEnemy(e, D.dmg, Math.sign(e.x - o.x) || 1);
        if (!e.boss) e.cd = Math.max(e.cd || 0, D.cd); // aturdidos: tardan en volver a atacar
      }
      for (const q of G.eproj) if (Math.hypot(q.x - o.x, q.y - o.y) < D.aoe) q.dead = true;
    } else {
      burst(o.x, gy, 14, o.kind === 'rock' ? '#8a8078' : '#8d949c', 230, 0.5);
      Snd.rock();
      if (hit) damageEnemy(hit, D.dmg, Math.sign(hit.x - o.x) || 1);
    }
  }
  G.props = G.props.filter(o => !o.dead);
  for (const r of G.rings) r.t += dt;
  G.rings = G.rings.filter(r => r.t < 0.6);

  // items
  for (const it of G.items) {
    it.t += dt;
    if (it.type === 'prop') continue; // los objetos se cogen disparando encima de ellos
    if (!p.dead && Math.abs(it.x - p.x) < 28 && Math.abs((it.y) - (p.y - 40)) < 60) {
      it.got = true; Snd.pick();
      if (it.type === 'hp') p.hp = Math.min(p.maxHp, p.hp + 2);
      if (it.type === 'gren') p.gren += 3;
      if (it.type === 'wpn') p.wpn = Math.min(3, p.wpn + 1);
      if (it.type === 'prop') { p.held = it.prop; burst(it.x, it.y, 6, '#fff', 120, 0.3); it.got = true; continue; }
      G.score += 50; burst(it.x, it.y, 10, '#ffe27a', 160, 0.5);
    }
  }
  G.items = G.items.filter(i => !i.got);

  // particulas
  for (const q of G.parts) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  G.parts = G.parts.filter(q => q.life > 0);

  // flecha GO
  const alive = G.enemies.some(e => !e.dying);
  G.noEnemyT = !alive && !G.bossSpawned && G.cam.x < G.cam.max ? G.noEnemyT + dt : 0;
}

/* ------------------------------------------------------------------ render */
const vign = document.createElement('canvas'); vign.width = W; vign.height = H;
(() => {
  const v = vign.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,0,10,.65)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
})();

function tiled(img, y, h, par, camX, noMirror = false) {
  const tw = Math.round(h * img.width / img.height * 1); // mantiene proporción
  const off = camX * par, first = Math.floor(off / tw);
  for (let i = first; i <= first + Math.ceil(W / tw) + 1; i++) {
    const x = Math.floor(i * tw - off);
    if ((i & 1) && !noMirror) { ctx.save(); ctx.translate(x + tw, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, tw + 1, h); ctx.restore(); }
    else ctx.drawImage(img, x, y, tw + 1, h);
  }
}

function drawBackground(camX, t) {
  const S = H / 1024, world = STAGES[G.stage || 0].world, sc = SCENES[world];
  if (!sc) tiled(IMG.far, 0, 750 * S, 0.35, camX);
  else { // panorámica a ancho completo, a la misma velocidad que el suelo
    ctx.fillStyle = '#0a0306'; ctx.fillRect(0, 0, W, H);
    tiled(IMG['scene_' + world], sc.y, H, 1, camX, true);
  }
  ctx.fillStyle = STAGES[G.stage || 0].tint; ctx.fillRect(0, 0, W, sc ? H : 750 * S);
  for (const s of spores) {
    const x = ((s.x - camX * s.par * 0.6 - t * 6) % W + W) % W, y = (s.y - t * s.v) % GROUND;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s.ph);
    ctx.fillStyle = sc ? sc.spore : '#ffb0b0'; ctx.fillRect(x, y < 0 ? y + GROUND : y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  if (!sc) tiled(IMG.floor, 750 * S - 1, H - 750 * S + 1, 1, camX);
}

function drawPlatform(pl, camX) {
  const x = Math.round(pl.x - camX), y = pl.y;
  const world = STAGES[G.stage || 0].world;
  if (world !== 'up' && world !== 'lab') { // tablones / hormigón según el escenario
    const P = { forest: ['#5a2a22', '#24100e', '#e0563a'], house: ['#7a5230', '#33200f', '#d9a35c'], street: ['#6f6a75', '#2c2a33', '#b9b4c4'], mansion: ['#4a3a42', '#1a1216', '#c04a5a'] }[world];
    const g = ctx.createLinearGradient(0, y, 0, y + 22); g.addColorStop(0, P[0]); g.addColorStop(1, P[1]);
    ctx.fillStyle = g; ctx.fillRect(x, y, pl.w, 22);
    ctx.fillStyle = P[2]; ctx.fillRect(x, y, pl.w, 3);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 28; i < pl.w; i += 28) ctx.fillRect(x + i, y + 3, 2, 19);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y + 19, pl.w, 3);
    return;
  }
  if (world === 'lab') { // pasarela metálica del laboratorio
    const g = ctx.createLinearGradient(0, y, 0, y + 22);
    g.addColorStop(0, '#6b727c'); g.addColorStop(1, '#2a2e35');
    ctx.fillStyle = g; ctx.fillRect(x, y, pl.w, 22);
    ctx.fillStyle = '#aeb6c1'; ctx.fillRect(x, y, pl.w, 3);
    ctx.fillStyle = '#e8b520'; // franjas de peligro
    for (let i = 0; i < pl.w; i += 24) { ctx.beginPath(); ctx.moveTo(x + i, y + 8); ctx.lineTo(x + i + 8, y + 8); ctx.lineTo(x + i + 2, y + 16); ctx.lineTo(x + i - 6, y + 16); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#14161a'; ctx.fillRect(x, y + 19, pl.w, 3);
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(x + 8, y + 22, 6, 10); ctx.fillRect(x + pl.w - 14, y + 22, 6, 10);
    return;
  }
  const g = ctx.createLinearGradient(0, y, 0, y + 22);
  g.addColorStop(0, '#5a1420'); g.addColorStop(1, '#1a0508');
  ctx.fillStyle = g; ctx.fillRect(x, y, pl.w, 22);
  ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x, y, pl.w, 3);
  ctx.fillStyle = 'rgba(255,60,60,.25)'; ctx.fillRect(x, y + 3, pl.w, 3);
  ctx.strokeStyle = '#2a0a10'; ctx.lineWidth = 3;
  let s = pl.x * 7;
  for (let i = 0; i < 6; i++) {
    s = (s * 16807) % 2147483647;
    const vx = x + 8 + (s % (pl.w - 16)), len = 14 + (s % 30);
    ctx.beginPath(); ctx.moveTo(vx, y + 20); ctx.quadraticCurveTo(vx + 8, y + 20 + len / 2, vx - 3, y + 20 + len); ctx.stroke();
  }
}

function drawGrenade(c, sc = 1) {
  c.save(); c.scale(sc, sc);
  const g = c.createRadialGradient(-3.5, -3, 1, 0, 1, 13);
  g.addColorStop(0, '#9dbd62'); g.addColorStop(0.55, '#526f2e'); g.addColorStop(1, '#1d2e11');
  c.fillStyle = g; c.strokeStyle = '#0b1406'; c.lineWidth = 1.7;
  c.beginPath(); c.ellipse(0, 2, 9.5, 11.5, 0, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(8,18,4,.7)'; c.lineWidth = 1.2; c.beginPath();
  c.moveTo(-9, 2); c.lineTo(9, 2); c.moveTo(0, -9); c.lineTo(0, 13);
  c.moveTo(-6.5, -4.5); c.quadraticCurveTo(0, -1, 6.5, -4.5);
  c.moveTo(-6.5, 8.5); c.quadraticCurveTo(0, 5, 6.5, 8.5);
  c.moveTo(-5, -7); c.lineTo(-5, 11); c.moveTo(5, -7); c.lineTo(5, 11); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-4.5, -2.5, 2, 3.8, -0.4, 0, 7); c.fill();
  c.fillStyle = '#8c929a'; c.strokeStyle = '#2a2d31'; c.lineWidth = 1.4; c.fillRect(-4.5, -14, 9, 5.5); c.strokeRect(-4.5, -14, 9, 5.5);
  c.strokeStyle = '#c3c9d1'; c.lineWidth = 2.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(4, -13); c.quadraticCurveTo(14, -11, 11.5, 3); c.stroke();
  c.strokeStyle = '#e6b53a'; c.lineWidth = 1.9; c.beginPath(); c.arc(-8.5, -12.5, 4, 0, 7); c.stroke();
  c.restore();
}

// Objetos lanzables: sprites de pixel art de 16 px dibujados a x2 (cada letra es un color de la paleta)
const PROP_ART = {
  chair: { pal: { K: '#140c10', b: '#26324f', B: '#3c5282', h: '#7894d0', g: '#596069', G: '#aab2bd', w: '#0d0d10', s: '#c8d0da' }, rows: [
    '................',
    '...KKKKKKKKKK...',
    '..KbBBBBBBBBhK..',
    '..KbBBBBBBBhhK..',
    '..KbBBBBBBBBhK..',
    '..KbBBBBBBBhhK..',
    '..KbbBBBBBBBBK..',
    '...KKKKKKKKKK...',
    '......KgGK......',
    '.KKKKKKKKKKKKKK.',
    'KbBBBBBBBBBBBhhK',
    'KbbBBBBBBBBBBbbK',
    '.KKKKKKKKKKKKKK.',
    '......KgGK......',
    '......KgsK......',
    '..KK..KgGK..KK..',
    '.KgGKKKgGKKKGgK.',
    '.KwwK.KKKK.KwwK.'] },
  extinguisher: { pal: { K: '#140c10', R: '#cc2230', r: '#8a1220', h: '#ff7a7a', S: '#b9c0c9', D: '#2a2d33', W: '#efefef', Y: '#f2c230', d: '#555b63' }, rows: [
    '......KKKK......',
    '....KKDDDDKKK...',
    '...KDDDDDDDDDK..',
    '....KKKSSKKKDK..',
    '......KSSK..DK..',
    '....KKKKKKKKDK..',
    '...KRhRRRRrRKDK.',
    '...KRhRRRRrRKDK.',
    '...KRhRRRRrRKDK.',
    '...KRhWWWWrRKKK.',
    '...KRhWYYWrRK...',
    '...KRhWDDWrRK...',
    '...KRhWWWWrRK...',
    '...KRhRRRRrRK...',
    '...KRhRRRRrRK...',
    '...KRhRRRRrRK...',
    '....KrRRRRrRK...',
    '....KddddddK....',
    '.....KKKKKK.....'] },
  rock: { pal: { K: '#14100e', s: '#6f6860', S: '#8e867c', H: '#bdb4a6', d: '#4a453f', m: '#41602c', M: '#5f8a3e' }, rows: [
    '................',
    '......KKKK......',
    '....KKSSHHKK....',
    '...KSSSHHSSsK...',
    '..KSSHHSSSSssK..',
    '..KSHSSSSssssK..',
    '.KSSSSSsssssddK.',
    '.KSSSSssmMsdddK.',
    '.KSSssssmMddddK.',
    '.KssssssddddddK.',
    '.KsssssdddddddK.',
    '..KKssddddddKK..',
    '....KKKKKKKK....'] },
  barrel: { pal: { K: '#140c10', O: '#cf6f2a', o: '#a8541c', r: '#6b3112', h: '#ee9d58', S: '#7b828c', s: '#a5acb6', Y: '#f2b320' }, rows: [
    '...KKKKKKKKKK...',
    '..KSsSSSSSSSSK..',
    '..KOhOOOOOOorK..',
    '..KOhOOOOOOorK..',
    '.KSsSSSSSSSSSSK.',
    '.KOhOOOKYKOOorK.',
    '.KOhOOKYYYKOorK.',
    '.KOhOKYKKYYKorK.',
    '.KOhOKYYKYYKorK.',
    '.KOhOOKYYYKOorK.',
    '.KSsSSSSSSSSSSK.',
    '.KOhOOOOOOOOorK.',
    '.KOhOOOOOOOOorK.',
    '.KOOOOOOOOOoorK.',
    '..KSsSSSSSSSSK..',
    '...KKKKKKKKKK...'] },
  lamp: { pal: { K: '#140c10', y: '#c8902a', Y: '#f8dd78', Z: '#fff4b8', d: '#6a4a1a', D: '#a67a2e' }, rows: [
    '......KKKK......',
    '....KKyyyyKK....',
    '...KyyYYYYyyK...',
    '..KyYYZZZZYYyK..',
    '..KyYZZZZZZYyK..',
    '.KKKKKKKKKKKKKK.',
    '......KddK......',
    '......KdDK......',
    '......KdDK......',
    '......KdDK......',
    '......KdDK......',
    '....KKKddKKK....',
    '...KdDDDDDDdK...',
    '...KKKKKKKKKK...'] },
};
const PROP_CACHE = {};
function propSprite(kind) {
  if (PROP_CACHE[kind]) return PROP_CACHE[kind];
  const art = PROP_ART[kind], w = 16, h = art.rows.length, c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  art.rows.forEach((row, y) => { for (let x = 0; x < w; x++) { const ch = row[x]; if (ch && ch !== '.' && art.pal[ch]) { g.fillStyle = art.pal[ch]; g.fillRect(x * 2, y * 2, 2, 2); } } });
  return (PROP_CACHE[kind] = c);
}
function drawProp(kind, sc = 1) {
  const c = propSprite(kind);
  ctx.drawImage(c, -c.width * sc / 2, -c.height * sc / 2, c.width * sc, c.height * sc);
}

function drawItem(it, camX) {
  const x = Math.round(it.x - camX), y = Math.round(it.y + Math.sin(it.t * 3) * 4);
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = '#ffcc55'; ctx.shadowBlur = 12;
  if (it.type === 'hp') { // gofre
    ctx.fillStyle = '#e8a93c'; ctx.fillRect(-12, -12, 24, 24);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#a8671a'; ctx.lineWidth = 2;
    for (let i = -4; i <= 4; i += 8) { ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i, 12); ctx.moveTo(-12, i); ctx.lineTo(12, i); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6);
  } else if (it.type === 'prop') {
    ctx.shadowColor = '#9fe0ff'; ctx.shadowBlur = 10; drawProp(it.prop, 1.25);
    ctx.shadowBlur = 0; ctx.fillStyle = '#9fe0ff'; ctx.font = `7px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(PROPS[it.prop].name, 0, 28);
  } else if (it.type === 'gren') {
    drawGrenade(ctx, 1.3);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffd34d'; ctx.font = `8px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('+3', 0, 26);
  } else {
    ctx.fillStyle = '#1b2a6b'; ctx.fillRect(-13, -13, 26, 26);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.strokeRect(-13, -13, 26, 26);
    ctx.fillStyle = '#ffd34d'; ctx.font = `12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('P', 0, 5);
  }
  ctx.restore();
}

function drawHaz(h, camX) {
  const x = h.x - camX;
  if (h.kind === 'spike') {
    if (h.t < h.delay) { // grietas de aviso
      const k = h.t / h.delay;
      ctx.fillStyle = `rgba(255,40,40,${0.25 + 0.5 * k})`;
      ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 10 + 26 * k, 4 + 3 * k, 0, 0, 7); ctx.fill();
    } else {
      const k = Math.min(1, (h.t - h.delay) / 0.12), fade = h.t > h.delay + h.dur ? 1 - (h.t - h.delay - h.dur) / 0.25 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      for (let i = -1; i <= 1; i++) {
        const hh = (i === 0 ? 130 : 85) * k, bx = x + i * 15;
        ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.moveTo(bx - 9, GROUND + 4); ctx.lineTo(bx, GROUND + 4 - hh); ctx.lineTo(bx + 9, GROUND + 4); ctx.fill();
        ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.moveTo(bx + 1, GROUND + 4); ctx.lineTo(bx, GROUND + 4 - hh); ctx.lineTo(bx + 9, GROUND + 4); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (h.t >= h.delay) { // tentaculos
    const k = Math.min(1, (h.t - h.delay) / 0.1), fade = Math.max(0, 1 - Math.max(0, h.t - h.delay - h.dur) / 0.25);
    ctx.globalAlpha = fade; ctx.strokeStyle = '#a01428'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y0 = GROUND - 110 + i * 22, len = h.w * k * (0.7 + 0.06 * i);
      ctx.beginPath(); ctx.moveTo(x, y0);
      ctx.bezierCurveTo(x + h.face * len * 0.3, y0 - 30 + Math.sin(G.t * 20 + i) * 14, x + h.face * len * 0.6, y0 + 30, x + h.face * len, y0 + Math.sin(G.t * 15 + i) * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawEProj(q, camX) {
  const x = q.x - camX;
  ctx.save(); ctx.translate(x, q.y);
  if (q.type === 'rock') {
    ctx.rotate(q.rot); ctx.fillStyle = '#6a5a5a'; ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-q.r, -4); ctx.lineTo(-4, -q.r); ctx.lineTo(q.r, -6); ctx.lineTo(q.r - 2, q.r - 4); ctx.lineTo(-6, q.r); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowColor = '#f33'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,60,60,.6)'; ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, q.r + 8);
    g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#ff3070'); g.addColorStop(1, 'rgba(120,0,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, q.r + 8, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawBullet(b, camX) {
  const x = b.x - camX;
  ctx.save(); ctx.translate(x, b.y);
  if (b.kind === 'bullet') {
    ctx.rotate(b.a); ctx.fillStyle = '#ffe9a0'; ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 8; ctx.fillRect(-12, -2, 20, 4);
  } else if (b.kind === 'psy') {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff8fd0'); g.addColorStop(1, 'rgba(255,80,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,220,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11 + Math.sin(G.t * 30) * 2, 0, 7); ctx.stroke();
  } else if (b.kind === 'pellet') {
    ctx.fillStyle = '#9fe0ff'; ctx.shadowColor = '#5cf'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#b6ff6a'; ctx.shadowColor = '#7f3'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(e, camX) {
  const x = e.x - camX;
  const flip = e.face < 0, blink = e.flash > 0 ? 0.55 : 1;
  if (e.type === 'vecna') {
    const [a, f] = vecnaPose(e);
    ctx.save(); ctx.shadowColor = e.state === 'phase' || e.phase2 ? 'rgba(255,40,60,.95)' : 'rgba(255,90,90,.75)'; ctx.shadowBlur = e.phase2 ? 22 : 14;
    const fade = e.state === 'die' ? Math.max(0, 1 - Math.max(0, e.dying - 2.2) / 0.8) : 1;
    if (e.state === 'phase') { // aura y tentáculos de la transformación
      const k = Math.min(1, e.t / 1.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, e.y - 85);
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 40 + 120 * k);
      g.addColorStop(0, `rgba(255,70,70,${0.6 * k})`); g.addColorStop(1, 'rgba(120,0,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40 + 120 * k, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,60,80,${0.8 * k})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + e.t * 1.5, r = 30 + 90 * k;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 40);
        ctx.quadraticCurveTo(Math.cos(a + 0.5) * r * 0.7, Math.sin(a + 0.5) * r, Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.2); ctx.stroke();
      }
      ctx.restore();
    }
    sprite('vecna', a, f, x, e.y, e.sc, flip, blink * fade);
    ctx.restore();
    return;
  }
  const T = ETYPES[e.type];
  let anim = 'idle', f = Math.floor(e.animT * 4) % 4;
  if (e.state === 'roar') { anim = 'roar'; f = Math.floor(e.t * 8) % 4; }
  else if (e.state === 'walk') { anim = 'walk'; f = Math.floor(e.animT * (e.type === 'runner' ? 14 : 8)) % ATLAS.demogorgon.anims.walk.n; }
  else if (e.state === 'wind') { anim = 'attack'; f = e.t < T.wind * 0.5 ? 0 : 1; }
  else if (e.state === 'swipe') { anim = 'attack'; f = e.t < 0.1 ? 2 : 3; }
  else if (e.state === 'recover') { anim = 'attack'; f = 4; }
  if (e.hurtT > 0 && (e.state === 'walk' || e.state === 'roar')) { anim = 'hurt'; f = 1; }
  if (e.dying) { // animación de muerte (5 frames) y desvanecido final
    const fr = Math.min(4, Math.floor(e.dying / 0.16)), fade = e.dying > 0.95 ? Math.max(0, 1 - (e.dying - 0.95) / 0.3) : 1;
    sprite('demogorgon', 'die', fr, x, e.y, e.sc, flip, fade);
    return;
  }
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, (e.grounded ? e.y : GROUND) + 2, 30 * e.sc / 1.1, 6, 0, 0, 7); ctx.fill();
  if (!e.grounded) { anim = 'attack'; f = e.vy < 0 ? 1 : 2; }
  // al ir a la izquierda se usa la fila "Walk ←" de la hoja
  if (flip && ATLAS.demogorgon.anims[anim + 'L']) sprite('demogorgon', anim + 'L', f, x, e.y, e.sc, false, blink);
  else sprite('demogorgon', anim, f, x, e.y, e.sc, flip, blink);
}

// Armas de la serie. En reposo van colgadas del cuerpo (se dibujan detrás o encima del sprite, en el punto de cada personaje);
// al disparar, Mike y Dustin levantan un brazo (manga + mano) hasta el arma, que apunta hacia donde miras.
// Will y Lucas ya traen el arma en sus poses de disparo del sprite.
const ARM = { mike: ['#b9a37a', '#f0b890'], dustin: ['#2c4a8c', '#f2b88e'] };
const hasAimPose = id => id === 'will' || id === 'lucas';
function drawCarryBack(p, x) { // rifle de Will en bandolera: asoma por encima del hombro y por debajo de la cadera
  if (p.id !== 'will' || p.dead || (p.shootT > 0)) return;
  const f = p.face, c = ctx, y = p.y;
  c.save(); c.lineCap = 'round';
  c.strokeStyle = '#120a0c'; c.lineWidth = 6.5; c.beginPath(); c.moveTo(x - f * 16, y - 110); c.lineTo(x + f * 3, y - 30); c.stroke();
  c.strokeStyle = '#3b4048'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - f * 16, y - 110); c.lineTo(x - f * 9, y - 80); c.stroke();     // cañón
  c.strokeStyle = '#8a5a2b'; c.lineWidth = 4.4; c.beginPath(); c.moveTo(x - f * 3, y - 54); c.lineTo(x + f * 3, y - 30); c.stroke();     // culata
  c.restore();
}
function drawCarryFront(p, x) { // tirachinas en el bolsillo de atrás y pistola de bengalas en la cartuchera
  if (p.dead || p.shootT > 0 || p.aimT > 0) return;
  const f = p.face, c = ctx, hy = p.y - (p.crouch ? 28 : 42);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (p.id === 'mike' || p.id === 'lucas') {
    c.translate(x - f * 11, hy); c.rotate(-f * 0.5);
    c.strokeStyle = '#120a0c'; c.lineWidth = 5.4; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -2); c.moveTo(0, -2); c.lineTo(-4.5, -9); c.moveTo(0, -2); c.lineTo(4.5, -9); c.stroke();
    c.strokeStyle = p.id === 'lucas' ? '#8a5a2b' : '#2f6fb0'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -2); c.moveTo(0, -2); c.lineTo(-4.5, -9); c.moveTo(0, -2); c.lineTo(4.5, -9); c.stroke();
  } else if (p.id === 'dustin') {
    c.translate(x + f * 9, hy); c.rotate(f * 0.15);
    c.fillStyle = '#120a0c'; c.fillRect(-4, -3, 9, 14);
    c.fillStyle = '#d4551c'; c.fillRect(-3, -2, 7, 5); c.fillStyle = '#4a2a14'; c.fillRect(-2, 3, 5, 7);  // cartuchera con la culata asomando
  }
  c.restore();
}
function drawWeapon(p, x) {
  const id = p.id, c = ctx;
  if (p.dead || p.hurtT > 0.2) return;
  const kick = Math.max(0, (p.shootT - 0.16) / 0.08) * 3;           // retroceso al disparar
  if (id === 'steve') { // bate con clavos: solo se ve al golpear (en reposo va a la espalda, ya dibujado)
    if (p.melee <= 0) return;
    const prog = 1 - p.melee / 0.36, ang = -1.5 + 2.7 * Math.min(1, prog * 1.5), hy = p.y - 66;
    c.save(); c.translate(x + p.face * 12, hy); c.scale(p.face, 1); c.rotate(ang);
    c.fillStyle = '#8a5a2b'; c.strokeStyle = '#2a170a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -3); c.lineTo(34, -5.5); c.lineTo(46, -6.5); c.lineTo(46, 6.5); c.lineTo(34, 5.5); c.lineTo(0, 3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#d6dbe0'; for (const nx of [30, 36, 42]) { c.fillRect(nx, -9, 2, 4); c.fillRect(nx, 5, 2, 4); }
    c.restore(); return;
  }
  if (id === 'eleven') { // sin arma: solo el brillo de su poder
    if (p.shootT <= 0) return;
    const hx = x + p.face * 24, hy = p.y - 70;
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(hx, hy, 2, hx, hy, 26);
    g.addColorStop(0, 'rgba(255,170,255,.9)'); g.addColorStop(1, 'rgba(120,60,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(hx, hy, 26, 0, 7); c.fill(); c.restore(); return;
  }
  if (hasAimPose(id) || p.aimT <= 0) return;
  const d = aimDir(p), ang = Math.atan2(d.y, d.x), f = p.face;
  const sx = x + f * (3 - kick * 0.4), sy = p.y - (p.crouch ? 46 : 71);          // hombro
  const hx = sx + Math.cos(ang) * (15 - kick), hy = sy + Math.sin(ang) * (15 - kick);   // mano
  const [sleeve, skin] = ARM[id];
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#120a0c'; c.lineWidth = 8.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();   // brazo extendido
  c.strokeStyle = sleeve; c.lineWidth = 5.6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
  c.save(); c.translate(hx, hy); c.rotate(ang); if (f < 0) c.scale(1, -1);
  c.lineWidth = 1.6; c.strokeStyle = '#120a0c';
  if (id === 'mike') { // tirachinas Wrist Rocket
    c.fillStyle = '#2f6fb0'; c.fillRect(-3, -2.5, 11, 5); c.strokeRect(-3, -2.5, 11, 5);
    c.strokeStyle = '#120a0c'; c.lineWidth = 5.4; c.beginPath(); c.moveTo(8, 0); c.lineTo(14, -9); c.moveTo(8, 0); c.lineTo(14, 9); c.stroke();
    c.strokeStyle = '#3f86cf'; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 0); c.lineTo(14, -9); c.moveTo(8, 0); c.lineTo(14, 9); c.stroke();
    c.strokeStyle = '#e04a30'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(14, -9); c.lineTo(p.shootT > 0.1 ? 16 : 4, 0); c.lineTo(14, 9); c.stroke();
    if (p.shootT <= 0.1) { c.fillStyle = '#c8ccd2'; c.fillRect(2, -2, 4, 4); }
  } else { // pistola de bengalas
    c.fillStyle = '#d4551c'; c.fillRect(-3, -4, 22, 8); c.strokeRect(-3, -4, 22, 8);
    c.fillStyle = '#f0884a'; c.fillRect(-2, -3, 20, 2);
    c.fillStyle = '#2a2a2e'; c.fillRect(-2, 4, 6, 9); c.strokeRect(-2, 4, 6, 9); c.fillRect(19, -2.5, 4, 5);
    if (p.shootCd <= 0.05) { c.fillStyle = '#ff3a2a'; c.fillRect(22, -3, 5, 6); c.fillStyle = '#ffd34d'; c.fillRect(26, -2, 3, 4); }
    if (p.shootT > 0.16) { c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(25, 0, 5, 0, 7); c.fill(); }
  }
  c.restore();
  c.fillStyle = skin; c.strokeStyle = '#120a0c'; c.lineWidth = 1.5; c.beginPath(); c.arc(hx, hy, 3.6, 0, 7); c.fill(); c.stroke();   // mano
  c.restore();
}

function drawPlayer(p, camX) {
  const x = p.x - camX;
  if (p.inv > 0 && !p.dead && Math.floor(p.inv * 14) % 2 === 0) return;
  const [a, f] = playerPose(p);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, GROUND + 2, 20, 5, 0, 0, 7); ctx.fill();
  // al mirar a la izquierda se usa la fila "Walk ←" de la hoja (anim + 'L'); si no existe, se voltea la de la derecha
  let an = a, flipP = p.face < 0;
  if (flipP && ATLAS[p.id].anims[a + 'L']) { an = a + 'L'; flipP = false; }
  drawCarryBack(p, x);
  if (p.bindT > 0) { ctx.save(); ctx.shadowColor = '#ff2060'; ctx.shadowBlur = 18; sprite(p.id, an, f, x, p.y, p.c.sc, flipP); ctx.restore(); }
  else sprite(p.id, an, f, x, p.y, p.c.sc, flipP);
  drawCarryFront(p, x);
  drawWeapon(p, x);
  if (!p.held && !p.dead && G.items.some(it => it.type === 'prop' && Math.abs(it.x - p.x) < 46 && Math.abs(it.y - (p.y - 20)) < 70)) text('DISPARA: COGER', x, p.y - 128, 8, '#9fe0ff', 'center');
  if (p.held && !p.dead) { ctx.save(); ctx.translate(x, p.y - 112 + Math.sin(G.t * 5) * 2); drawProp(p.held, 0.7); ctx.restore(); }
  if (p.jam > 0) text('¡SOBRECALENTADO!', x, p.y - 128, 8, Math.floor(G.t * 8) % 2 ? '#ff4040' : '#ffd34d', 'center');
  if (p.melee > 0 && p.melee < 0.28) { // estela del bate
    const prog = 1 - p.melee / 0.36;
    ctx.save(); ctx.translate(x + p.face * 38, p.y - 56); ctx.scale(p.face, 1);
    ctx.strokeStyle = `rgba(255,240,220,${0.85 - prog * 0.6})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-6, 8, 50, -1.2, 0.9 * Math.min(1, prog * 1.6)); ctx.stroke(); ctx.restore();
  }
}

function text(s, x, y, size = 12, color = '#fff', align = 'left', stroke = '#000') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 3); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

function drawHUD() {
  const p = G.p, c = p.c;
  ctx.fillStyle = 'rgba(8,0,12,.65)'; ctx.fillRect(10, 10, 300, 78);
  ctx.strokeStyle = '#a01428'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 300, 78);
  ctx.save(); ctx.beginPath(); ctx.rect(14, 14, 62, 70); ctx.clip();
  sprite(p.id, 'idle', 0, 45, 82, 0.7); ctx.restore();
  text(c.name, 84, 34, 12, '#ffd34d');
  for (let i = 0; i < p.maxHp; i++) {
    ctx.fillStyle = i < p.hp ? '#e01830' : '#3a1018'; ctx.fillRect(84 + i * 16, 42, 13, 10);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(84 + i * 16, 42, 13, 10);
  }
  text(`VIDAS x${Math.max(0, G.lives)}`, 84, 70, 9, '#fff');
  ctx.save(); ctx.translate(200, 62); drawGrenade(ctx, 0.62); ctx.restore(); text(`x${p.gren}`, 214, 70, 10, '#ffb060');
  text(`ARMA ${'*'.repeat(p.wpn)}`, 190, 34, 9, '#9fe0ff');
  if (!c.melee) { // barra de calor del arma
    ctx.fillStyle = '#2a0a10'; ctx.fillRect(190, 40, 108, 8);
    ctx.fillStyle = p.jam > 0 ? (Math.floor(G.t * 8) % 2 ? '#ff2a2a' : '#7a1010') : p.heat < 0.6 ? '#ffd34d' : p.heat < 0.85 ? '#ff8a30' : '#ff3030';
    ctx.fillRect(190, 40, 108 * (p.jam > 0 ? 1 : p.heat), 8);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(190, 40, 108, 8);
  }
  if (p.held) text(PROPS[p.held].name + ': DISPARA=LANZAR', 238, 70, 7, '#9fe0ff');
  text('SCORE', W - 20, 28, 10, '#ff8080', 'right');
  text(String(G.score).padStart(7, '0'), W - 20, 52, 18, '#fff', 'right');
  text(`${STAGES[G.stage].name}`, W - 20, 74, 9, '#ccc', 'right');
  if (down(...K.up) === false && p.bindT > 0) { /* noop */ }
  if (p.bindT > 0) text('¡CONTROL MENTAL! (INVERTIDO)', W / 2, 120, 12, '#ff4080', 'center');
  // barra de jefe
  const bosses = G.enemies.filter(e => e.boss && !e.dead);
  if (bosses.length) {
    const hp = bosses.reduce((s, e) => s + e.hp, 0), mx = bosses.reduce((s, e) => s + e.maxHp, 0);
    const bw = 360, bx = W / 2 - bw / 2;
    text(bosses[0].type === 'vecna' ? 'VECNA' : 'DEMOGORGON', W / 2, 30, 11, '#ff6060', 'center');
    ctx.fillStyle = '#200'; ctx.fillRect(bx, 38, bw, 12);
    ctx.fillStyle = bosses[0].phase2 ? '#ff2a4a' : '#c01830'; ctx.fillRect(bx, 38, bw * Math.max(0, hp / mx), 12);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx, 38, bw, 12);
  }
}

function drawGame() {
  const camX = G.cam.x, p = G.p;
  ctx.save();
  if (G.shake > 0 && SET.shake) ctx.translate(rnd(-G.shake, G.shake) * 0.5, rnd(-G.shake, G.shake) * 0.5);
  drawBackground(camX, G.t);
  for (const pl of G.plats) drawPlatform(pl, camX);
  for (const it of G.items) drawItem(it, camX);
  for (const h of G.haz) drawHaz(h, camX);
  for (const e of G.enemies) drawEnemy(e, camX);
  drawPlayer(p, camX);
  for (const g of G.gren) {
    ctx.save(); ctx.translate(g.x - camX, g.y); ctx.rotate(g.spin);
    ctx.shadowColor = 'rgba(255,150,40,.7)'; ctx.shadowBlur = 8; drawGrenade(ctx, 0.95); ctx.restore();
  }
  for (const o of G.props) { ctx.save(); ctx.translate(o.x - camX, o.y); ctx.rotate(o.rot); drawProp(o.kind, 1.1); ctx.restore(); }
  for (const b of G.bullets) drawBullet(b, camX);
  for (const q of G.eproj) drawEProj(q, camX);
  for (const q of G.parts) {
    const a = Math.max(0, q.life / q.max);
    if (q.smoke) { ctx.globalAlpha = a * 0.5; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x - camX, q.y, q.r + (1 - a) * q.gr, 0, 7); ctx.fill(); }
    else { ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.fillRect(q.x - camX - q.size / 2, q.y - q.size / 2, q.size, q.size); }
  }
  ctx.globalAlpha = 1;
  for (const r of G.rings) { // explosión: destello + bola de fuego + onda expansiva
    const k = r.t / 0.6, x = r.x - camX, y = r.y - 12, e = 1 - (1 - k) * (1 - k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = 40 + 130 * e, fg = ctx.createRadialGradient(x, y, 4, x, y, R);
    fg.addColorStop(0, `rgba(255,250,200,${1 - k})`); fg.addColorStop(0.35, `rgba(255,170,40,${0.9 * (1 - k)})`);
    fg.addColorStop(0.75, `rgba(210,50,10,${0.5 * (1 - k)})`); fg.addColorStop(1, 'rgba(120,10,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    if (k < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - k * 4)})`; ctx.beginPath(); ctx.arc(x, y, 38 * (1 - k * 2), 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = `rgba(255,235,200,${0.8 * (1 - k)})`; ctx.lineWidth = 5 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 20 + 150 * e, 6 + 22 * e, 0, 0, 7); ctx.stroke();
  }
  ctx.restore();
  ctx.drawImage(vign, 0, 0);
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,40,40,${Math.min(0.4, G.flash)})`; ctx.fillRect(0, 0, W, H); }
  drawHUD();

  if (G.banner > 0) {
    const a = Math.min(1, G.banner, (3.2 - G.banner) * 3);
    ctx.globalAlpha = a;
    text(STAGES[G.stage].name, W / 2, 200, 34, '#ff3b3b', 'center');
    text(STAGES[G.stage].sub, W / 2, 240, 14, '#fff', 'center');
    text('MISION START', W / 2, 290, 18, '#ffd34d', 'center');
    ctx.globalAlpha = 1;
  }
  if (G.bossBanner > 0) {
    ctx.globalAlpha = Math.min(1, G.bossBanner);
    text('¡¡ PELIGRO !!', W / 2, 200, 28, '#ff2a2a', 'center');
    ctx.globalAlpha = 1;
  }
  if (G.noEnemyT > 1.2 && Math.floor(G.t * 3) % 2 === 0) text('GO  >>>', W - 40, 150, 22, '#ffd34d', 'right');
  }

/* ----------------------------------------------------------------- screens */
function drawTitle(t) {
  drawBackground(t * 40, t);
  ctx.drawImage(vign, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
  const bob = Math.sin(t * 2) * 3;
  text('STRANGER', W / 2, 150 + bob, 52, '#ff2a3a', 'center', '#2a0008');
  text('SLUG', W / 2, 215 + bob, 52, '#ff2a3a', 'center', '#2a0008');
  text('SHOOT & RUN EN EL MUNDO DEL REVES', W / 2, 252, 12, '#fff', 'center');
  // desfile de personajes
  const cs = ['will', 'eleven', 'mike', 'lucas', 'dustin', 'steve'];
  cs.forEach((id, i) => {
    sprite(id, 'walk', Math.floor(t * 8 + i) % ATLAS[id].anims.walk.n, 36 + i * 46, 450, 0.8); // a la izquierda, sin tapar el menú
  });
  sprite('demogorgon', 'walk', Math.floor(t * 7) % ATLAS.demogorgon.anims.walk.n, 760, 450, 1.2, true);
  sprite('vecna', 'idle', 0, 865, 450 + Math.sin(t * 2) * 1.5, 1.0, true); // en la portada espera quieto; solo camina en el juego
  if (document.body.classList.contains('touch')) {
    text('CRUCETA: MOVER Y APUNTAR   SALTO / FUEGO / BOMBA   II: PAUSA', W / 2, 492, 9, '#ddd', 'center');
    text('GIRA EL MOVIL EN HORIZONTAL', W / 2, 512, 8, '#aaa', 'center');
  } else { const kn = a => keyName(K[a][0]); text(`MOVER ${kn('left')} / ${kn('right')}   SALTAR ${kn('jump')}   DISPARAR ${kn('fire')}   BOMBA ${kn('gren')}`, W / 2, 492, 9, '#ddd', 'center'); }
  if (!document.body.classList.contains('touch')) text('P / ESC pausa y ajustes   M sonido   F pantalla completa   (las teclas se cambian en AJUSTES)', W / 2, 512, 8, '#aaa', 'center');
}

function drawSelect(t) {
  drawBackground(t * 20, t);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  text('ELIGE PERSONAJE', W / 2, 60, 24, '#ff3b3b', 'center');
  const cw = 146, gap = 10, x0 = (W - (cw * ORDER.length + gap * (ORDER.length - 1))) / 2;
  ORDER.forEach((id, i) => {
    const c = CHARS[id], x = x0 + i * (cw + gap), y = 90, sel = i === G.sel;
    ctx.fillStyle = sel ? 'rgba(120,10,30,.8)' : 'rgba(20,5,15,.75)'; ctx.fillRect(x, y, cw, 360);
    ctx.strokeStyle = sel ? '#ffd34d' : '#6a2030'; ctx.lineWidth = sel ? 4 : 2; ctx.strokeRect(x, y, cw, 360);
    const sc = 1.3 * (sel ? 1.08 : 1);
    sprite(id, sel ? 'idle' : 'idle', sel ? Math.floor(t * 5) % 4 : 0, x + cw / 2, y + 190, sc);
    text(c.name, x + cw / 2, y + 225, 13, sel ? '#ffd34d' : '#fff', 'center');
    text(c.tag, x + cw / 2, y + 245, 7, '#9fe0ff', 'center');
    ['VIDA', 'VELOC', 'PODER'].forEach((lab, j) => {
      const yy = y + 268 + j * 26;
      text(lab, x + 8, yy, 7, '#ccc');
      for (let k = 0; k < 5; k++) { ctx.fillStyle = k < c.stats[j] ? '#e01830' : '#3a1018'; ctx.fillRect(x + 52 + k * 18, yy - 9, 14, 10); }
    });
  });
  text('< >  elegir      ENTER  jugar', W / 2, 500, 11, '#ffd34d', 'center');
}

function drawEnd(title, color, sub) {
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
  text(title, W / 2, 230, 34, color, 'center');
  if (sub) text(sub, W / 2, 275, 12, '#fff', 'center');
  text(`SCORE ${String(G.score).padStart(7, '0')}`, W / 2, 330, 16, '#ffd34d', 'center');
  if (Math.floor(G.t * 2) % 2 === 0) text('PULSA ENTER', W / 2, 400, 14, '#fff', 'center');
}

/* -------------------------------------------------------------------- menús */
const M = { screen: 'title', idx: 0, backS: 'title', backC: 'title', capture: null };
function assignKey(action, code) {
  const old = K[action][0];
  for (const a in DEFAULT_KEYS) if (a !== action && K[a][0] === code) K[a] = [old]; // intercambia si estaba en uso
  K[action] = [code];
  SET.keys = {}; for (const a in DEFAULT_KEYS) SET.keys[a] = K[a][0];
  saveSet();
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function openMenu(screen) { M.screen = screen; M.idx = 0; }
function toggleFS() { try { if (document.fullscreenElement) document.exitFullscreen(); else canvas.requestFullscreen(); } catch (e) { /* ignorar */ } }
function resumeGame() { G.state = 'play'; }
function goSettings(from) { M.backS = from; openMenu('settings'); }
function goControls(from) { M.backC = from; openMenu('controls'); }

function menuItems() {
  switch (M.screen) {
    case 'title': return [
      { label: 'JUGAR', act: () => { G.state = 'select'; } },
      { label: 'AJUSTES', act: () => goSettings('title') },
      { label: 'CONTROLES', act: () => goControls('title') }];
    case 'pause': return [
      { label: 'REANUDAR', act: resumeGame },
      { label: 'AJUSTES', act: () => goSettings('pause') },
      { label: 'CONTROLES', act: () => goControls('pause') },
      { label: 'REINICIAR ACTO', act: () => startStage(G.stage) },
      { label: 'SALIR AL TITULO', act: () => { G.state = 'title'; Snd.setFast(false); openMenu('title'); } }];
    case 'settings': return [
      { label: 'MUSICA', value: () => SET.music, adj: d => { SET.music = clamp(SET.music + d, 0, 10); Snd.applyVol(); saveSet(); } },
      { label: 'EFECTOS', value: () => SET.sfx, adj: d => { SET.sfx = clamp(SET.sfx + d, 0, 10); Snd.applyVol(); saveSet(); Snd.shoot(); } },
      { label: 'SONIDO', value: () => (Snd.muted ? 'NO' : 'SI'), act: () => Snd.toggleMute(), adj: () => Snd.toggleMute() },
      { label: 'TEMBLOR DE PANTALLA', value: () => (SET.shake ? 'SI' : 'NO'), act: () => { SET.shake = !SET.shake; saveSet(); }, adj: () => { SET.shake = !SET.shake; saveSet(); } },
      { label: 'PANTALLA COMPLETA', value: () => (document.fullscreenElement ? 'SI' : 'NO'), act: toggleFS, adj: toggleFS },
      { label: 'CONTROLES', act: () => goControls('settings') },
      { label: 'VOLVER', act: () => openMenu(M.backS) }];
    case 'controls': return [
      ...ACTIONS.map(([a, name]) => ({ label: name, value: () => (M.capture === a ? 'PULSA UNA TECLA...' : keyName(K[a][0])), act: () => { M.capture = a; } })),
      { label: 'RESTABLECER', act: () => { SET.keys = {}; applyKeys(); saveSet(); } },
      { label: 'VOLVER', act: () => openMenu(M.backC) }];
  }
  return [];
}

function menuInput() {
  const items = menuItems();
  if (!items.length) return;
  if (M.capture) return;
  if (tap(...NAV.up)) { M.idx = (M.idx + items.length - 1) % items.length; Snd.ok(); }
  if (tap(...NAV.down)) { M.idx = (M.idx + 1) % items.length; Snd.ok(); }
  const it = items[M.idx];
  if (tap(...NAV.left) && it.adj) { it.adj(-1); Snd.ok(); }
  if (tap(...NAV.right) && it.adj) { it.adj(1); Snd.ok(); }
  if (tap('Enter', 'Space', 'KeyZ') && it.act) { Snd.ok(); it.act(); return; }
  if (tap('Escape', 'KeyP')) {
    if (M.screen === 'settings') openMenu(M.backS);
    else if (M.screen === 'controls') openMenu(M.backC);
    else if (M.screen === 'pause') resumeGame();
  }
}

function drawPanel(title, items, rowH = 38) {
  const pw = 640, ph = 100 + items.length * rowH, px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.fillStyle = 'rgba(8,0,12,.9)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#a01428'; ctx.lineWidth = 3; ctx.strokeRect(px, py, pw, ph);
  text(title, W / 2, py + 46, 20, '#ff3b3b', 'center');
  items.forEach((it, i) => {
    const y = py + 96 + i * rowH, sel = i === M.idx;
    if (sel) { ctx.fillStyle = 'rgba(170,25,45,.5)'; ctx.fillRect(px + 14, y - 22, pw - 28, 31); }
    text((sel ? '> ' : '  ') + it.label, px + 32, y, 12, sel ? '#ffd34d' : '#fff', 'left', null);
    if (it.value) {
      const v = it.value();
      if (typeof v === 'number') {
        for (let k = 0; k < 10; k++) { ctx.fillStyle = k < v ? (sel ? '#ffd34d' : '#e01830') : '#3a1018'; ctx.fillRect(px + pw - 32 - 10 * 18 + k * 18, y - 14, 14, 16); }
      } else text(v, px + pw - 32, y, 12, sel ? '#ffd34d' : '#9fe0ff', 'right', null);
    }
  });
  text(M.capture ? 'PULSA LA NUEVA TECLA   (ESC cancela)' : 'ARRIBA/ABAJO elegir   IZQ/DER ajustar   ENTER aceptar   ESC volver', W / 2, py + ph - 14, 8, '#aaa', 'center', null);
}

function drawMenuScreen() {
  if (G.state === 'pause') { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); }
  if (M.screen === 'settings') drawPanel('AJUSTES', menuItems(), 40);
  else if (M.screen === 'controls') drawPanel('CONTROLES', menuItems(), 34);
  else if (M.screen === 'pause') drawPanel('PAUSA', menuItems(), 42);
}

function drawTitleMenu() {
  menuItems().forEach((it, i) => {
    const y = 305 + i * 36, sel = i === M.idx;
    text((sel ? '> ' : '') + it.label + (sel ? ' <' : ''), W / 2, y, 18, sel ? '#ffd34d' : '#fff', 'center');
  });
}

/* -------------------------------------------------------------------- loop */
let last = performance.now(), tAcc = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now; tAcc += dt;
  ctx.clearRect(0, 0, W, H);
  if (tap('KeyM')) Snd.toggleMute();
  if (tap('KeyF')) toggleFS();
  switch (G.state) {
    case 'loading': text('CARGANDO...', W / 2, H / 2, 16, '#fff', 'center'); break;
    case 'title':
      drawTitle(tAcc);
      if (M.screen === 'title') drawTitleMenu(); else drawMenuScreen();
      menuInput();
      break;
    case 'select':
      drawSelect(tAcc);
      if (tap(...NAV.left)) { G.sel = (G.sel + ORDER.length - 1) % ORDER.length; Snd.ok(); }
      if (tap(...NAV.right)) { G.sel = (G.sel + 1) % ORDER.length; Snd.ok(); }
      if (tap('Enter', 'Space', 'KeyZ')) { G.charId = ORDER[G.sel]; Snd.pick(); newGame(); }
      if (tap('Escape')) { G.state = 'title'; openMenu('title'); }
      break;
    case 'play':
      if (tap('KeyP', 'Escape')) { G.state = 'pause'; openMenu('pause'); drawGame(); drawMenuScreen(); break; }
      updatePlay(dt); drawGame(); break;
    case 'pause':
      drawGame(); drawMenuScreen(); menuInput();
      break;
    case 'clear': {
      G.clearT += dt; G.t += dt;
      for (const q of G.parts) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
      updatePlayer(dt);
      drawGame();
      const last = G.stage === STAGES.length - 1;
      if (G.clearT > 1.2) {
        drawEnd(last ? '¡VECNA HA CAIDO!' : 'STAGE CLEAR', '#7dff7d', last ? 'HAWKINS Y EL MUNDO DEL REVES ESTAN A SALVO... POR AHORA' : STAGES[G.stage].name + ' COMPLETADO');
        if (tap('Enter', 'Space')) {
          if (last) { G.state = 'title'; openMenu('title'); Snd.setFast(false); }
          else { const hp = G.p; startStage(G.stage + 1); G.p.hp = G.p.maxHp; }
        }
      }
      break; }
    case 'over':
      G.t += dt; drawGame(); drawEnd('GAME OVER', '#ff3b3b', 'EL REVES TE HA ATRAPADO');
      if (tap('Enter', 'Space')) { G.state = 'select'; Snd.setFast(false); }
      break;
  }
  for (const k in pressed) delete pressed[k];
  requestAnimationFrame(frame);
}

loadAll().then(() => {
  G.state = 'title';
  // atajos de depuración: ?char=will&stage=3&boss=1&ff=5
  const q = new URLSearchParams(location.search);
  if (q.has('char')) {
    G.charId = q.get('char'); newGame(); startStage(+(q.get('stage') || 1) - 1);
    if (q.get('boss')) { G.cam.x = G.cam.max; G.p.x = G.cam.x + 200; }
    else if (q.get('at')) { G.cam.x = +q.get('at'); G.p.x = G.cam.x + 300; }
    G.banner = q.get('boss') || q.get('at') ? 0 : G.banner;
    if (q.get('bomb')) { G.p.gren = 5; throwGrenade(G.p); }
    for (let i = 0; i < (+q.get('ff') || 0) * 60; i++) updatePlay(1 / 60);
    if (q.get('kill')) { G.enemies.forEach(e => damageEnemy(e, 99)); for (let i = 0; i < (+q.get('kill')) * 60; i++) updatePlay(1 / 60); }
    if (q.get('menu')) { G.state = 'pause'; openMenu(q.get('menu')); }
  }
});
requestAnimationFrame(frame);
canvas.focus();
window.__G = G; window.__M = M; window.__K = K; window.__SET = SET; // depuración
// puente para los controles táctiles (js/touch.js)
window.SSInput = {
  press(code) { if (!keys[code]) pressed[code] = true; keys[code] = true; Snd.unlock(); },
  release(code) { keys[code] = false; },
  unlock: () => Snd.unlock(),
  state: () => G.state,
  K,
};
})();
