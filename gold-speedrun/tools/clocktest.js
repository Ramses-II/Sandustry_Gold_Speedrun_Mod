// Prueft den Uhrenblock aus main.js gegen ein nachgebautes Spiel.
const fs = require('fs');
const path = require('path');

// Der Uhrenblock wird direkt aus main.js geschnitten, damit der Test nicht
// gegen eine veraltete Kopie laeuft.
const MAIN = path.join(__dirname, '..', 'main.js');
const mainSrc = fs.readFileSync(MAIN, 'utf8');
const from = mainSrc.indexOf('// --- Die beiden Uhren');
const qual = mainSrc.indexOf('const clockQuality');
const to = qual < 0 ? -1 : mainSrc.indexOf('});', qual) + 3;
if (from < 0 || to < 3) {
  console.error('Uhrenblock in main.js nicht gefunden - wurde er umbenannt?');
  process.exit(2);
}
const BLOCK = mainSrc.slice(from, to);

let fails = 0;
const check = (name, ok, got) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${ok ? '' : '   -> ' + got}`);
  if (!ok) fails++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// --- nachgebautes Spiel ---------------------------------------------------
function makeWorld() {
  const store = { mods: {} };
  const w = {
    perf: 0,                       // performance.now()
    paused: false,
    metaTime: 0,                   // store.meta.time, mit dem 50-ms-Deckel
    simTick: 0,                    // Schrittzaehler des Simulations-Threads
    simAccum: 0,
    managerLast: 16.6667,          // managerPerformance[1]
    triggers: [],
    buffers: {},
    store,
  };

  w.MOD_ID = 'gold-speedrun';
  w.NS = 'goldSpeedrun';
  w.log = () => {};
  w.formatTime = ms => String(Math.floor(ms));
  w.now = () => w.metaTime;
  w.readRun = () => ({
    startedAt: store.mods[w.NS] ? store.mods[w.NS].startedAt : undefined,
    finishedAt: store.mods[w.NS] ? store.mods[w.NS].finishedAt : undefined,
  });
  w.isRunning = () => {
    const r = w.readRun();
    return typeof r.startedAt === 'number' && typeof r.finishedAt !== 'number';
  };

  const ensure = () => (store.mods[w.NS] = store.mods[w.NS] || {});
  w.api = {
    storage: {
      get: (ns, k) => ensure()[k],
      set: (ns, k, v) => { ensure()[k] = v; },
    },
    shared: {
      buffers: {
        create: (key, opt) => {
          const name = `external:${w.MOD_ID}:${key}`;
          if (!w.buffers[name]) w.buffers[name] = new Float64Array(opt.length);
          return w.buffers[name];
        },
      },
    },
  };
  w.sandkit = {
    get state() {
      return {
        session: { paused: w.paused },
        shared: { managerPerformance: { 1: w.managerLast } },
        store,
      };
    },
    engine: {
      get state() {
        return { shared: { mods: w.buffers }, store: { meta: { get tick() { return w.simTick; } } } };
      },
      api: {
        triggers: {
          register: (state, id, opt) => {
            // genau wie das Spiel: Quelltext verschicken, drueben neu bauen
            const src = opt.callback.toString();
            const rebuilt = new Function('return ' + src)();
            w.triggers = w.triggers.filter(t => t.id !== id);
            w.triggers.push({ id, interval: opt.interval, accumulator: 0, cb: rebuilt });
          },
        },
      },
    },
  };
  w.performance = { now: () => w.perf };

  // Der Block wird mit denselben Namen ausgefuehrt, die er in main.js sieht.
  const args = ['MOD_ID', 'NS', 'log', 'formatTime', 'now', 'readRun', 'isRunning',
                'api', 'sandkit', 'performance'];
  const factory = new Function(...args, BLOCK + `
    return { setupSimClock, advanceClocks, migrateClocks, startClocks,
             elapsed, elapsedSim, simDeficit, clockQuality,
             reset: () => { simLastTick = null; lastPerf = null; } };`);
  w.clock = factory(...args.map(k => (k === 'sandkit' ? w.sandkit : w[k])));
  return w;
}

// Ein Simulationsschritt des Managers, so wie Le() ihn ausfuehrt.
function simStep(w) {
  const dt = 1000 / 60;
  for (const trg of w.triggers) {
    trg.accumulator += dt;
    let guard = 0;
    while (trg.accumulator >= trg.interval && guard++ < 100) {
      trg.cb(w.sandkit.engine.state, trg, dt);
      trg.accumulator -= trg.interval;
    }
  }
  w.simTick++;
}

// Echtzeit vorruecken. upsFactor 1 = 60 UPS, 0.33 = 20 UPS.
function advance(w, ms, upsFactor, stepMs) {
  const step = stepMs || 16.6667;
  let left = ms;
  while (left > 0) {
    const d = Math.min(step, left);
    left -= d;
    w.perf += d;

    if (!w.paused) {
      // meta.time des Spiels, mit dem 50-ms-Deckel
      w.metaTime += Math.min(d, 50);
      // Simulationsschritte, die in dieser Zeit tatsaechlich liefen
      w.simAccum += d * upsFactor;
      while (w.simAccum >= 1000 / 60) {
        simStep(w);
        w.simAccum -= 1000 / 60;
      }
      w.managerLast = (1000 / 60) / upsFactor;
    }
    w.clock.advanceClocks();
  }
}

function startRun(w) {
  w.clock.startClocks();
  w.api.storage.set(w.NS, 'startedAt', w.now());
  w.api.storage.set(w.NS, 'finishedAt', null);
}

// === 1. Ausloeser kommt an, durchgehend 60 UPS ============================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  check('Ausloeser registriert', w.triggers.length === 1, w.triggers.length);
  advance(w, 200, 1);
  startRun(w);
  advance(w, 60000, 1);

  check('60 UPS: Echtzeit = 60 s', near(w.clock.elapsed(), 60000, 30), w.clock.elapsed());
  check('60 UPS: Simzeit = Echtzeit', near(w.clock.elapsedSim(), 60000, 60), w.clock.elapsedSim());
  check('60 UPS: kein Defizit', w.clock.simDeficit() < 0.5, w.clock.simDeficit());
  check('60 UPS: exakt gemessen', w.clock.clockQuality().exact === true, '');
}

// === 2. 20 UPS bei 60 FPS - der Fall des Melders ==========================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  advance(w, 60000, 1 / 3);

  check('20 UPS: Echtzeit bleibt 60 s', near(w.clock.elapsed(), 60000, 30), w.clock.elapsed());
  check('20 UPS: Simzeit = ein Drittel', near(w.clock.elapsedSim(), 20000, 200), w.clock.elapsedSim());
  check('20 UPS: Defizit ~ 67 %', near(w.clock.simDeficit(), 66.7, 1.5), w.clock.simDeficit());
}

// === 3. 12 FPS - hier verliert die alte Uhr Zeit ==========================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  const t0 = w.metaTime;
  advance(w, 60000, 1, 83.3);   // 83,3 ms pro Frame = 12 FPS

  const alt = w.metaTime - t0;
  check('12 FPS: alte Uhr verliert Zeit', alt < 37000, alt);
  check('12 FPS: neue Echtzeit stimmt', near(w.clock.elapsed(), 60000, 120), w.clock.elapsed());
  check('12 FPS: Vorteil der alten Uhr war ' + Math.round((60000 - alt) / 1000) + ' s',
        near(60000 - alt, 24000, 1500), 60000 - alt);
}

// === 4. Pause haelt beide Uhren an =======================================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  advance(w, 10000, 1);
  w.paused = true;
  advance(w, 30000, 1);
  w.paused = false;
  advance(w, 10000, 1);

  check('Pause: Echtzeit 20 s statt 50 s', near(w.clock.elapsed(), 20000, 60), w.clock.elapsed());
  check('Pause: Simzeit 20 s', near(w.clock.elapsedSim(), 20000, 120), w.clock.elapsedSim());
}

// === 5. Nach dem Ziel laufen die Uhren nicht weiter ======================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  advance(w, 5000, 1);
  const t = w.clock.elapsed();
  w.api.storage.set(w.NS, 'finishedAt', w.now());
  advance(w, 10000, 1);
  check('Ziel erreicht: Uhr steht', w.clock.elapsed() === t, w.clock.elapsed() + ' statt ' + t);
}

// === 6. Ohne Ausloeser: Schaetzung springt ein ===========================
{
  const w = makeWorld();
  // setupSimClock absichtlich nicht gerufen -> kein gemeinsamer Speicher
  advance(w, 200, 1);
  startRun(w);
  advance(w, 60000, 1 / 3);

  check('Rueckfall: Echtzeit stimmt', near(w.clock.elapsed(), 60000, 30), w.clock.elapsed());
  check('Rueckfall: Simzeit ~ ein Drittel', near(w.clock.elapsedSim(), 20000, 1000), w.clock.elapsedSim());
  check('Rueckfall: als geschaetzt markiert', w.clock.clockQuality().exact === false, '');
}

// === 7. Speichern und Laden mitten im Lauf ===============================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  advance(w, 30000, 1);
  const snapshot = JSON.parse(JSON.stringify(w.store.mods));

  // Neue Sitzung: neuer Prozess, neuer Schrittzaehler, Spielstand geladen.
  const w2 = makeWorld();
  w2.store.mods = JSON.parse(JSON.stringify(snapshot));
  w2.clock.setupSimClock();
  w2.simTick = 0;
  w2.perf = 12345;
  w2.clock.reset();
  advance(w2, 30000, 1);

  check('Laden: Echtzeit summiert weiter', near(w2.clock.elapsed(), 60000, 60), w2.clock.elapsed());
  check('Laden: Simzeit summiert weiter', near(w2.clock.elapsedSim(), 60000, 200), w2.clock.elapsedSim());
}

// === 8. Lauf aus 2.6.0 wird uebernommen =================================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  w.metaTime = 100000;
  w.api.storage.set(w.NS, 'startedAt', 40000);
  w.api.storage.set(w.NS, 'finishedAt', null);
  w.clock.migrateClocks();
  check('Migration: 60 s uebernommen', w.clock.elapsed() === 60000, w.clock.elapsed());
  check('Migration: als uebernommen markiert', w.clock.clockQuality().legacy === true, '');

  const before = w.clock.elapsed();
  w.clock.migrateClocks();
  check('Migration laeuft nicht zweimal', w.clock.elapsed() === before, w.clock.elapsed());
}

// === 9. Zerrissener Lesevorgang wird gedeckelt ===========================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  advance(w, 1000, 1);
  const before = w.clock.elapsedSim();

  // Der Puffer liefert plotzlich Unsinn (zerrissener 64-Bit-Lesevorgang).
  w.buffers['external:gold-speedrun:simClock'][0] = 1e12;
  advance(w, 16.6667, 1);
  const jump = w.clock.elapsedSim() - before;
  check('Muellwert springt nicht durch', jump < 300, jump);

  // Und ein Ruecksprung normiert neu, statt negativ zu zaehlen.
  w.buffers['external:gold-speedrun:simClock'][0] = 5;
  const b2 = w.clock.elapsedSim();
  advance(w, 100, 1);
  check('Ruecksprung zaehlt nicht rueckwaerts', w.clock.elapsedSim() >= b2, w.clock.elapsedSim());
}

// === 10. Simzeit ueberholt nie die Echtzeit ==============================
{
  const w = makeWorld();
  w.clock.setupSimClock();
  advance(w, 200, 1);
  startRun(w);
  for (let i = 0; i < 40; i++) advance(w, 500, i % 3 === 0 ? 0.2 : 1);
  check('Simzeit <= Echtzeit', w.clock.elapsedSim() <= w.clock.elapsed() + 20,
        w.clock.elapsedSim() + ' > ' + w.clock.elapsed());
}

console.log(fails === 0 ? '\nalle Pruefungen bestanden' : `\n${fails} Pruefung(en) fehlgeschlagen`);
process.exit(fails === 0 ? 0 : 1);
