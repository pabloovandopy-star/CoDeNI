'use strict';
/* =====================================================================
   CODE//MISSION — script.js
   Orden del archivo:
   1) DATOS de niveles   2) ESTADO y guardado   3) SONIDO (Web Audio)
   4) DIBUJO en canvas   5) INTÉRPRETE del código   6) LÓGICA del juego
   7) INTERFAZ (pantallas, botones, editor)
   ===================================================================== */

/* ============================ 1. DATOS ============================
   Mapa: '#' obstáculo · '.' libre · 'S' inicio · 'G' meta · 'T' tronco
         '~' río · 'F' fruta · 'f' fogata · 'C' cristal (decoración)
   direccion: 0 arriba, 1 derecha, 2 abajo, 3 izquierda
   ayuda.grado: 1 completa · 2 corta · 3 pista · 4 solo objetivo · 5 nada
   par: nº de instrucciones de una solución eficiente (para el bono) */
const T = 48, COLS = 8, ROWS = 6;
const TODOS = ['avanzar', 'izquierda', 'derecha', 'recoger', 'construirPuente', 'repetir', 'si'];
const SNIPPETS = {
  avanzar: 'avanzar();', izquierda: 'izquierda();', derecha: 'derecha();',
  recoger: 'recoger();', construirPuente: 'construirPuente();',
  repetir: 'repetir(3) {\n  avanzar();\n}',
  si: 'si(camino_libre) {\n  avanzar();\n} sino {\n  derecha();\n}'
};
const NIVELES = [
  { id: 1, nombre: 'El campamento', escenario: 'campamento', zona: '🏕️',
    descripcion: 'Nilo despierta junto a la fogata. Lleva a Nilo hasta el sendero.',
    objetivo: 'Llega a la bandera 🚩 con una secuencia de órdenes.',
    mapa: ['#.#..#..', '...G....', '.#...##.', 'S.......', '.f#..#..', '........'],
    direccion: 1, comandos: ['avanzar', 'izquierda', 'derecha'], par: 6,
    ayuda: { grado: 1, texto: 'COMANDOS\navanzar();   mueve a Nilo una casilla.\nizquierda();  gira a Nilo a su izquierda.\nderecha();    gira a Nilo a su derecha.\n\nSe ejecutan en orden (una secuencia). Ejemplo:\navanzar();\navanzar();\nderecha();\navanzar();' } },
  { id: 2, nombre: 'El río', escenario: 'rio', zona: '🌊',
    descripcion: 'Un río corta el sendero. Hay troncos alrededor.',
    objetivo: 'Recoge 3 troncos, construye un puente y llega a la bandera.',
    mapa: ['.#...~#.', '...#.~..', '.#.T.~.G', 'ST.T.~..', '..#..~#.', '.....~..'],
    direccion: 1, comandos: ['avanzar', 'izquierda', 'derecha', 'recoger', 'construirPuente', 'repetir'], par: 12,
    ayuda: { grado: 2, texto: 'recoger(); guarda en la mochila lo que hay bajo Nilo (aumenta la variable troncos).\nconstruirPuente(); necesita troncos = 3 y que Nilo mire al río.' } },
  { id: 3, nombre: 'El bosque', escenario: 'bosque', zona: '🌲',
    descripcion: 'Un bosque profundo con caminos bloqueados. El sendero gira una y otra vez.',
    objetivo: 'Encuentra la bandera. Usa una decisión: si el camino está libre, avanza; si no, gira.',
    mapa: ['S.....##', '#####.##', '#G###.##', '#.###.##', '#.....##', '########'],
    direccion: 1, comandos: ['avanzar', 'izquierda', 'derecha', 'repetir', 'si'], par: 5,
    ayuda: { grado: 3, texto: 'Pista: un bucle repite; una condición decide. Si combinas las dos, Nilo puede recorrer el sendero solo.' } },
  { id: 4, nombre: 'La noche', escenario: 'noche', zona: '🌙',
    descripcion: 'Nilo se perdió y oscurece. Su linterna tiene batería limitada.',
    objetivo: 'Llega a la bandera antes de que se acabe la batería.',
    mapa: ['#####..G', '###.#.#.', '##....##', '##F#.###', '##.#####', 'S..#####'],
    direccion: 1, bateria: 8, comandos: ['avanzar', 'izquierda', 'derecha', 'recoger', 'repetir', 'si'], par: 9,
    ayuda: { grado: 4, texto: 'Solo el objetivo: llega a la meta antes de quedarte sin batería.' } },
  { id: 5, nombre: 'La cueva', escenario: 'cueva', zona: '🪨',
    descripcion: 'Nilo entra en una cueva de cristales. El pasillo es largo.',
    objetivo: 'Sal por la bandera con el programa más corto que puedas.',
    mapa: ['.##.###G', '#C.#.##.', '..#..#..', '#.##.##.', 'C.#.#.#.', 'S.......'],
    direccion: 1, comandos: ['avanzar', 'izquierda', 'derecha', 'recoger', 'repetir', 'si'], par: 5,
    ayuda: { grado: 5, texto: 'Aquí debes recordar lo aprendido. Si lo necesitas, abre la GUÍA DE CÓDIGO.' } },
  { id: 6, nombre: 'La montaña', escenario: 'cueva', zona: '⛰️', disponible: false,
    descripcion: 'Próximamente: secuencias, variables, condiciones y bucles combinados.' },
  { id: 7, nombre: 'El mirador', escenario: 'cueva', zona: '🌅', disponible: false,
    descripcion: 'Próximamente: funciones, por ejemplo subirMontaña();' },
  { id: 8, nombre: 'La guarida del oso', escenario: 'cueva', zona: '🐻', disponible: false,
    descripcion: 'Próximamente: el jefe final.',
    // ARQUITECTURA DEL JEFE (pendiente de implementar en la lógica):
    // cada ronda muestra un "aviso" y el jugador programa la respuesta.
    jefe: { energia: 5, patrones: [
      { aviso: 'izquierda', respuesta: 'derecha' }, { aviso: 'derecha', respuesta: 'izquierda' },
      { aviso: 'doble' }, { aviso: 'rapido' }, { aviso: 'repetir' } ] } }
];

/* ======================= 2. ESTADO Y GUARDADO ======================= */
const KEY = 'codemission_v1';
let P = { hechos: [], puntos: 0, xp: 0, intentos: 0, errores: 0, pistas: 0, tiempo: 0, objetos: [], snd: true, mus: true, red: false };
try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sin guardado */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { } };
const $ = id => document.getElementById(id);
let lv, S, nilo, busy = false, won = false, errNivel = 0, pista = false, parts = [];

/* ========================= 3. SONIDO (Web Audio) ========================= */
let AC, mi = 0, mt;
function snd(f, d = .1, tipo = 'square', v = .05, s = 0, f2) {
  if (!P.snd || !AC) return;
  const o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime + s;
  o.type = tipo; o.frequency.setValueAtTime(f, n);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + d);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.0001, n + d);
  o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + d);
}
// Para añadir un sonido nuevo: agrega una línea aquí (o carga un archivo con new Audio('assets/audio/x.mp3').play())
const sfx = {
  walk: () => snd(150 + Math.random() * 40, .06, 'square', .04),
  pick: () => { snd(700, .1); snd(950, .12, 'square', .05, .08); },
  run: () => snd(440, .12, 'triangle', .05, 0, 700),
  err: () => snd(300, .35, 'sawtooth', .06, 0, 80),
  win: () => [523, 659, 784, 1046].forEach((f, k) => snd(f, .2, 'square', .06, k * .13)),
  unlock: () => [392, 523, 659].forEach((f, k) => snd(f, .15, 'triangle', .07, k * .1)),
  door: () => snd(120, .3, 'square', .05, 0, 260),
  bear: () => snd(90, .5, 'sawtooth', .1, 0, 40),
  dodge: () => snd(800, .1, 'triangle', .05, 0, 1200),
  victory: () => [523, 659, 784, 1046, 1318].forEach((f, k) => snd(f, .25, 'square', .06, k * .15))
};
const NOTAS = [262, 330, 392, 330, 294, 349, 440, 349, 262, 392, 523, 392, 294, 392, 349, 294];
function musica() {
  clearInterval(mt);
  if (!P.mus || !AC) return;
  mt = setInterval(() => {
    const n = NOTAS[mi % 16];
    if (P.mus) { snd(n, .3, 'triangle', .03); if (mi % 4 === 0) snd(n / 4, .55, 'sine', .05); }
    mi++;
  }, 330);
}
function audioOn() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); } if (AC.state === 'suspended') AC.resume(); musica(); }

/* ========================= 4. DIBUJO (canvas) ========================= */
const TEMA = {
  campamento: { g: '#6aa84f', h: '#5a9440', o: 'tent' }, rio: { g: '#7ab35a', h: '#69a04b', o: 'tree' },
  bosque: { g: '#4e8b3e', h: '#417a33', o: 'pine' }, noche: { g: '#24402f', h: '#1d3526', o: 'pine' },
  cueva: { g: '#4b4650', h: '#3d3942', o: 'rock' }
};
let g; // contexto activo
const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function tri(cx, y, h, s, c) { for (let i = 0; i < h; i++) R(cx - (i + 1) * s, y + i * 4, (i + 1) * s * 2, 4, c); }
function obstaculo(o, X, Y) {
  if (o === 'pine') { R(X + 21, Y + 32, 6, 12, '#5a3b1c'); tri(X + 24, Y + 4, 7, 3, '#2f6b2f'); tri(X + 24, Y + 8, 6, 3, '#3b8a3b'); }
  else if (o === 'tree') { R(X + 21, Y + 28, 6, 16, '#5a3b1c'); R(X + 8, Y + 8, 32, 22, '#3f8a3a'); R(X + 14, Y + 3, 20, 8, '#4c9a45'); R(X + 12, Y + 12, 6, 6, '#63b45a'); }
  else if (o === 'tent') { tri(X + 24, Y + 6, 8, 3, '#e6d3a3'); R(X + 20, Y + 30, 8, 14, '#3b2a18'); R(X + 22, Y + 6, 4, 4, '#c0392b'); }
  else { R(X + 4, Y + 14, 40, 30, '#8b8b94'); R(X + 8, Y + 8, 28, 10, '#a1a1aa'); R(X + 4, Y + 38, 40, 6, '#6d6d75'); }
}
function nino(X, Y, d, bob, linterna) { // Nilo: sombrero, mochila, bufanda, brújula, botas
  Y += bob; R(X + 12, Y + 42, 24, 4, '#0005');
  R(d === 3 ? X + 31 : X + 10, Y + 22, 7, 14, '#a0522d');           // mochila
  R(X + 17, Y + 34, 6, 6, '#4a3520'); R(X + 25, Y + 34, 6, 6, '#4a3520');
  R(X + 16, Y + 40, 8, 4, '#2b1c0e'); R(X + 24, Y + 40, 8, 4, '#2b1c0e'); // botas
  R(X + 15, Y + 22, 18, 13, '#c9b26a'); R(X + 15, Y + 22, 18, 3, '#c0392b');
  R(X + 28, Y + 27, 4, 4, '#e8c547');                               // brújula
  R(X + 16, Y + 10, 16, 13, '#f1c99b');
  if (d === 1) R(X + 27, Y + 15, 3, 3, '#222'); if (d === 3) R(X + 19, Y + 15, 3, 3, '#222');
  if (d === 2) { R(X + 20, Y + 15, 3, 3, '#222'); R(X + 27, Y + 15, 3, 3, '#222'); }
  R(X + 11, Y + 7, 26, 5, '#b98a4a'); R(X + 17, Y + 1, 14, 7, '#c99b52'); R(X + 17, Y + 6, 14, 2, '#7a4a1c');
  if (linterna) R(X + (d === 3 ? 8 : 34), Y + 28, 5, 6, '#ffe27a');
}
function escena(t) {
  const th = TEMA[lv.escenario], seg = t / 1000;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const X = x * T, Y = y * T, c = S.map[y][x];
    R(X, Y, T, T, th.g); R(X + 8 + (x * 7) % 20, Y + 10 + (y * 13) % 20, 4, 4, th.h); R(X + 30 - (y * 5) % 12, Y + 32, 4, 4, th.h);
    if (c === '#') obstaculo(th.o, X, Y);
    else if (c === '~') { R(X, Y, T, T, '#3b7fb8'); for (let k = 0; k < 3; k++) R(X + 6 + Math.floor(seg * 20 + k * 9) % 30, Y + 8 + k * 14, 12, 3, '#8fc1e8'); }
    else if (c === '=') { R(X, Y, T, T, '#3b7fb8'); R(X, Y + 6, T, 36, '#8a5a2b'); R(X, Y + 22, T, 3, '#5a3b1c'); }
    else if (c === 'T') { R(X + 8, Y + 18, 32, 12, '#8a5a2b'); R(X + 8, Y + 18, 5, 12, '#d9b06a'); R(X + 35, Y + 18, 5, 12, '#d9b06a'); }
    else if (c === 'F') { R(X + 16, Y + 16, 16, 16, '#d33'); R(X + 22, Y + 10, 3, 7, '#5a3b1c'); R(X + 25, Y + 10, 7, 4, '#3b8a3b'); }
    else if (c === 'G') { R(X + 14, Y + 6, 4, 36, '#5a3b1c'); R(X + 18, Y + 8, 14, 12, '#e8893a'); }
    else if (c === 'f') { R(X + 10, Y + 34, 28, 6, '#5a3b1c'); const h = 10 + Math.sin(seg * 12 + x) * 3; R(X + 16, Y + 30 - h, 16, h, '#e8893a'); R(X + 20, Y + 30 - h / 2, 8, h / 2, '#ffe27a'); }
    else if (c === 'C') { const b = 150 + Math.sin(seg * 3 + x) * 60 | 0; R(X + 14, Y + 14, 8, 26, `rgb(80,${b},230)`); R(X + 26, Y + 22, 8, 18, `rgb(120,${b},240)`); }
  }
  nino(nilo.x, nilo.y, S.d, busy && !P.red ? Math.sin(t / 60) * 2 : 0, lv.escenario === 'noche' || lv.escenario === 'cueva');
  parts.forEach(p => R(p.x, p.y, 4, 4, p.c));
  const cx = nilo.x + 24, cy = nilo.y + 24;
  if (lv.escenario === 'noche') {
    R(330, 14, 22, 22, '#f4f1d0'); R(340, 14, 12, 22, '#24402f'); // luna creciente (recortada)
    const gr = g.createRadialGradient(cx, cy, 18, cx, cy, S.bat > 0 ? 55 + S.bat * 7 : 26);
    gr.addColorStop(0, 'rgba(5,8,20,0)'); gr.addColorStop(1, 'rgba(5,8,20,.93)'); g.fillStyle = gr; g.fillRect(0, 0, 384, 288);
    for (let k = 0; k < 8; k++) R(30 + k * 45 + Math.sin(seg + k) * 15, 40 + (k * 37) % 220 + Math.cos(seg * 1.3 + k) * 10, 3, 3, Math.sin(seg * 3 + k) > 0 ? '#ffe27a' : '#a89a4a'); // luciérnagas
  } else if (lv.escenario === 'cueva') {
    const gr = g.createRadialGradient(cx, cy, 30, cx, cy, 130);
    gr.addColorStop(0, 'rgba(10,8,20,0)'); gr.addColorStop(1, 'rgba(10,8,20,.72)'); g.fillStyle = gr; g.fillRect(0, 0, 384, 288);
  }
}
function introScene() { // dibujo estático de la portada
  const c = $('ci'); g = c.getContext('2d');
  R(0, 0, 384, 160, '#e8893a'); R(0, 0, 384, 70, '#f0b060'); R(0, 40, 384, 40, '#f7c97a'); R(300, 30, 34, 34, '#ffe9a8');
  R(0, 120, 384, 40, '#3f6e2e');
  for (let i = 0; i < 10; i++) { obstaculo('pine', i * 42 - 6, 84); obstaculo('pine', i * 42 + 14, 94); }
  R(0, 138, 384, 22, '#5a3b1c'); nino(60, 104, 1, 0, false);
}

/* ======================= 5. INTÉRPRETE DEL CÓDIGO =======================
   texto → parse() → árbol → recorrer() genera acciones una a una.
   Los errores se lanzan como texto amigable (no técnico). */
function parse(src, nivel) {
  const toks = [...src.replace(/\/\/.*$/gm, '').matchAll(/[A-Za-zñÑ_]\w*|\d+|\S/g)].map(m => m[0]);
  let i = 0; const peek = () => toks[i], next = () => toks[i++];
  const esperar = (t, msg) => { if (next() !== t) throw msg || `Falta "${t}".`; };
  function bloque() {
    esperar('{', 'Falta "{" para abrir el bloque.'); const b = [];
    while (peek() !== '}') { if (peek() === undefined) throw 'Falta "}" para cerrar el bloque.'; b.push(instr()); }
    next(); return b;
  }
  function instr() {
    const w = next();
    if (w === 'sino') throw '"sino" solo puede ir justo después de un si(...) { ... }.';
    if (!/^[A-Za-zñÑ_]/.test(w)) throw `Símbolo inesperado: ${w}`;
    if (!nivel.comandos.includes(w)) throw TODOS.includes(w) ? 'Nilo no puede realizar esa acción aquí.' : `Comando desconocido: ${w}()`;
    esperar('(', `Después de ${w} van paréntesis: ${w}();`);
    if (w === 'repetir') {
      const n = +next(); if (!(n > 0)) throw 'repetir necesita un número, por ejemplo repetir(3) { ... }';
      esperar(')', 'Falta ")" en repetir.'); return { t: 'rep', n, b: bloque() };
    }
    if (w === 'si') {
      if (next() !== 'camino_libre') throw 'La condición disponible es camino_libre, por ejemplo si(camino_libre) { ... }';
      esperar(')', 'Falta ")" en si.'); const b = bloque(); let e = [];
      if (peek() === 'sino') { next(); e = bloque(); } return { t: 'si', b, e };
    }
    esperar(')', `Falta ")" en ${w}();`); esperar(';', `Falta ";" al final de ${w}();`); return { t: 'cmd', w };
  }
  const ast = []; while (i < toks.length) ast.push(instr()); return ast;
}
const costo = a => a.reduce((s, n) => s + 1 + (n.b ? costo(n.b) : 0) + (n.e ? costo(n.e) : 0), 0); // nº de instrucciones
function* recorrer(a) {
  for (const n of a) {
    if (n.t === 'cmd') yield n.w;
    else if (n.t === 'rep') for (let k = 0; k < n.n; k++) yield* recorrer(n.b);
    else yield* recorrer(caminoLibre() ? n.b : n.e); // la condición se evalúa en el momento
  }
}

/* ========================= 6. LÓGICA DEL JUEGO ========================= */
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const celda = (x, y) => (S.map[y] && S.map[y][x]) || null;
const frente = () => [S.x + DIR[S.d][0], S.y + DIR[S.d][1]];
const libre = c => c && !'#~fC'.includes(c);
const caminoLibre = () => libre(celda(...frente()));
const esperar = ms => new Promise(r => setTimeout(r, P.red ? 0 : ms));

function iniciarNivel() { // vuelve a poner mapa, Nilo y mochila como al principio
  const m = lv.mapa.map(f => f.split('')); let x = 0, y = 0;
  m.forEach((f, j) => f.forEach((c, i) => { if (c === 'S') { x = i; y = j; m[j][i] = '.'; } }));
  S = { map: m, x, y, d: lv.direccion, troncos: 0, bat: lv.bateria || 0 };
  nilo = { x: x * T, y: y * T, tx: x * T, ty: y * T, res: null }; won = false; hud();
}
function hud() {
  const h = [];
  if (lv.id === 2) h.push(`🎒 troncos = ${S.troncos}`);
  if (lv.escenario === 'noche') h.push(`🔦 bateria = ${Math.max(S.bat, 0)}`);
  h.push('🧭 ' + ['norte', 'este', 'sur', 'oeste'][S.d]);
  $('hud').textContent = h.join('   ');
}
function mover(nx, ny) { return new Promise(res => { nilo.tx = nx * T; nilo.ty = ny * T; nilo.res = res; }); }
function chispas(c) { for (let k = 0; k < 10; k++) parts.push({ x: nilo.x + 24, y: nilo.y + 20, vx: (Math.random() - .5) * 120, vy: -Math.random() * 100, life: .6, c }); }
function ok(m) { const o = $('out'); o.className = 'ok'; o.textContent = m; }
function mensaje(m) { const o = $('out'); o.className = ''; o.textContent = m; }
function fallo(m) {
  busy = false; P.errores++; errNivel++; save(); sfx.err();
  const o = $('out'); o.className = 'err'; o.textContent = m; setTimeout(() => { if (!busy && !won) iniciarNivel(); }, 1400);
}

async function ejecutar() {
  if (busy) return; audioOn(); iniciarNivel(); P.intentos++; save(); parts = [];
  let ast; try { ast = parse($('code').value, lv); } catch (e) { return fallo(String(e)); }
  busy = true; sfx.run(); mensaje('Ejecutando…');
  let pasos = 0;
  try {
    for (const a of recorrer(ast)) {
      if (++pasos > 400) throw 'Tu programa se repite demasiado. Revisa tus bucles.';
      await accion(a); if (won) return;
    }
  } catch (e) { return fallo(String(e)); }
  fallo('Nilo tomó un camino incorrecto. Revisa tu código.');
}

async function accion(w) {
  if (w === 'izquierda' || w === 'derecha') { S.d = (S.d + (w === 'izquierda' ? 3 : 1)) % 4; hud(); sfx.walk(); return esperar(160); }
  if (w === 'avanzar') {
    const [nx, ny] = frente(), c = celda(nx, ny);
    if (!c || c === '#' || c === 'C' || c === 'f') throw 'Nilo tomó un camino incorrecto. Revisa tu código.';
    if (c === '~') throw 'Nilo no puede cruzar el río sin un puente.';
    if (lv.escenario === 'noche') { if (S.bat <= 0) throw '¡Sin batería! La linterna se apagó.'; S.bat--; }
    sfx.walk(); await mover(nx, ny); S.x = nx; S.y = ny; hud();
    if (lv.escenario === 'noche' && S.bat <= 0 && c !== 'G') throw '¡Sin batería! La linterna se apagó.';
    if (c === 'G') victoria();
    return;
  }
  if (w === 'recoger') {
    const c = celda(S.x, S.y);
    if (c === 'T') { S.troncos++; S.map[S.y][S.x] = '.'; objeto('🪵 Tronco'); }
    else if (c === 'F') { S.bat += 5; S.map[S.y][S.x] = '.'; objeto('🍎 Fruta'); }
    else throw 'No hay nada que recoger aquí.';
    hud(); chispas('#ffe27a'); sfx.pick(); return esperar(200);
  }
  if (w === 'construirPuente') {
    const [nx, ny] = frente();
    if (celda(nx, ny) !== '~') throw 'No hay río delante de Nilo.';
    if (S.troncos < 3) throw `Necesitas 3 troncos para construir el puente. Tienes ${S.troncos}.`;
    S.troncos -= 3; S.map[ny][nx] = '='; hud(); sfx.door(); chispas('#8a5a2b'); return esperar(300);
  }
}
function objeto(n) { if (!P.objetos.includes(n)) { P.objetos.push(n); save(); } }

function victoria() {
  won = true; busy = false; sfx.win(); chispas('#e8c547');
  const costoTotal = costo(parse($('code').value, lv)), primera = !P.hechos.includes(lv.id);
  const det = [['Misión completada', 100]];
  if (errNivel === 0) det.push(['Sin errores', 50]);
  if (costoTotal <= lv.par) det.push(['Solución eficiente', 50]);
  if (!pista) det.push(['Sin usar ayuda', 25]);
  const total = det.reduce((s, d) => s + d[1], 0);
  let txt = 'MISIÓN COMPLETADA\n' + det.map(d => `+${d[1]}  ${d[0]}`).join('\n') + `\nInstrucciones usadas: ${costoTotal} (eficiente: ${lv.par} o menos)`;
  if (primera) { P.hechos.push(lv.id); P.puntos += total; P.xp += total; } else txt += '\n(Ya habías completado esta misión: no suma puntos otra vez.)';
  save(); barra(); ok(txt);
  const sig = NIVELES.find(n => n.id === lv.id + 1);
  if (sig && sig.disponible !== false && primera) setTimeout(sfx.unlock, 700);
  const b = document.createElement('button'); b.className = 'primary'; b.textContent = sig && sig.disponible !== false ? 'Siguiente misión ▶' : 'Volver al mapa';
  b.onclick = () => sig && sig.disponible !== false ? abrir(sig.id) : pantalla('map');
  $('out').append('\n', b);
}

/* ============================= 7. INTERFAZ ============================= */
function pantalla(id) {
  ['intro', 'map', 'game'].forEach(s => $(s).hidden = s !== id);
  $('bar').hidden = id === 'intro';
  if (id === 'map') zonas();
  window.scrollTo(0, 0);
}
function barra() { $('xp').textContent = P.xp; $('pts').textContent = P.puntos; }
function desbloqueado(n) { return n.disponible !== false && (n.id === 1 || P.hechos.includes(n.id - 1)); }
function zonas() {
  $('zones').innerHTML = '';
  NIVELES.forEach(n => {
    const li = document.createElement('li'), b = document.createElement('button'), abierto = desbloqueado(n);
    b.className = 'zone' + (abierto ? '' : ' locked') + (P.hechos.includes(n.id) ? ' done' : '');
    b.innerHTML = `<span class="em">${abierto ? n.zona : '🔒'}</span><span><b>${n.nombre}</b><small>${P.hechos.includes(n.id) ? 'Completada ✔' : abierto ? 'Disponible' : n.disponible === false ? 'Próximamente' : 'Bloqueada'}</small></span>`;
    b.disabled = !abierto; b.onclick = () => abrir(n.id); li.append(b); $('zones').append(li);
  });
}
function abrir(id) {
  lv = NIVELES.find(n => n.id === id); errNivel = 0; pista = false; parts = [];
  $('lname').textContent = `${lv.zona} Misión ${lv.id}: ${lv.nombre}`; $('ldesc').textContent = lv.descripcion; $('lobj').textContent = lv.objetivo;
  $('code').value = '// Escribe el código de Nilo aquí\n'; codigo(); iniciarNivel(); mensaje('Escribe tu programa y pulsa EJECUTAR.');
  $('chips').innerHTML = '';
  if (lv.ayuda.grado <= 3) lv.comandos.forEach(c => { // niveles 1-3 muestran los comandos disponibles
    const b = document.createElement('button'); b.textContent = c + (c === 'repetir' || c === 'si' ? '(…)' : '()');
    b.onclick = () => { const t = $('code'); t.value += (t.value.endsWith('\n') ? '' : '\n') + SNIPPETS[c] + '\n'; codigo(); t.focus(); }; $('chips').append(b);
  });
  pantalla('game'); audioOn();
}
/* Editor: resaltado con capa <pre> detrás del textarea + números de línea */
function codigo() {
  const t = $('code'), esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('hl').innerHTML = esc(t.value).replace(/(\/\/.*)|\b(repetir|si|sino)\b|\b(avanzar|izquierda|derecha|recoger|construirPuente)\b|\b(camino_libre)\b|\b(\d+)\b/g,
    (m, c, k, f, p, n) => c ? `<span class="cm">${m}</span>` : k ? `<span class="kw">${m}</span>` : f ? `<span class="fn">${m}</span>` : p ? `<span class="pr">${m}</span>` : `<span class="nu">${m}</span>`) + '\n';
  $('gut').textContent = t.value.split('\n').map((_, i) => i + 1).join('\n'); sync();
}
function sync() { const t = $('code'); $('hl').scrollTop = t.scrollTop; $('hl').scrollLeft = t.scrollLeft; $('gut').scrollTop = t.scrollTop; }
function estadisticas() {
  const m = Math.round(P.tiempo / 60), fila = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  $('stTable').innerHTML = fila('Niveles completados', `${P.hechos.length} / ${NIVELES.length}`) + fila('Puntuación', P.puntos) + fila('XP', P.xp) +
    fila('Intentos', P.intentos) + fila('Errores', P.errores) + fila('Pistas utilizadas', P.pistas) + fila('Tiempo aproximado', m + ' min') +
    fila('Progreso', Math.round(P.hechos.length / NIVELES.length * 100) + '%') + fila('Objetos encontrados', P.objetos.length ? P.objetos.join(', ') : 'ninguno aún');
}
function abrirDialogo(id) { if (id === 'stats') estadisticas(); if (id === 'opts') { $('oSnd').checked = P.snd; $('oMus').checked = P.mus; $('oRed').checked = P.red; } $(id).showModal(); }
function ajustes() {
  document.body.classList.toggle('reducir', P.red);
  $('bSnd').setAttribute('aria-pressed', P.snd); $('bMus').setAttribute('aria-pressed', P.mus); save(); musica();
}

/* ---- eventos ---- */
$('bStart').onclick = () => { audioOn(); pantalla('map'); };
document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => abrirDialogo(b.dataset.open));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => pantalla(b.dataset.go));
$('bRun').onclick = ejecutar;
$('bReset').onclick = () => { if (!busy) { iniciarNivel(); mensaje('Nilo volvió al inicio.'); } };
$('bHelp').onclick = () => { pista = true; P.pistas++; save(); $('helpTxt').textContent = lv.ayuda.texto; $('help').showModal(); };
$('bSnd').onclick = () => { P.snd = !P.snd; ajustes(); };
$('bMus').onclick = () => { P.mus = !P.mus; ajustes(); };
$('oSnd').onchange = e => { P.snd = e.target.checked; ajustes(); };
$('oMus').onchange = e => { P.mus = e.target.checked; ajustes(); };
$('oRed').onchange = e => { P.red = e.target.checked; ajustes(); };
$('oClear').onclick = () => { if (confirm('¿Borrar todo tu progreso?')) { try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); } };
$('code').addEventListener('input', codigo); $('code').addEventListener('scroll', sync);
$('code').addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); codigo(); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ejecutar(); }
});
setInterval(() => { if (!$('game').hidden && !document.hidden) { P.tiempo++; if (P.tiempo % 10 === 0) save(); } }, 1000);

/* ---- bucle de dibujo: mueve a Nilo suavemente hacia su destino ---- */
let previo = 0;
function bucle(t) {
  const dt = Math.min(.05, (t - previo) / 1000); previo = t;
  if (!$('game').hidden && nilo) {
    const v = P.red ? 9999 : 260, dx = nilo.tx - nilo.x, dy = nilo.ty - nilo.y, d = Math.hypot(dx, dy);
    if (d <= v * dt) { nilo.x = nilo.tx; nilo.y = nilo.ty; if (nilo.res) { const r = nilo.res; nilo.res = null; r(); } }
    else { nilo.x += dx / d * v * dt; nilo.y += dy / d * v * dt; }
    parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
    g = $('cv').getContext('2d'); g.clearRect(0, 0, 384, 288); escena(t);
  }
  requestAnimationFrame(bucle);
}
lv = NIVELES[0]; introScene(); barra(); ajustes(); requestAnimationFrame(bucle);
