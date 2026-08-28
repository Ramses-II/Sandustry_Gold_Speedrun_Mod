// Prueft den Uhrenblock aus main.js gegen ein nachgebautes Spiel.
// Drei Uhren: R (Echtzeit, performance.now()), W (Spielzeit, api.time.getTimeMs()
// mit 50-ms-Deckel) und U (ausgefuehrte Weltschritte aus dem geteilten Puffer);
// T = U * (1000/60).
const fs = require('fs');
const path = require('path');

// Der Uhrenblock wird direkt aus main.js geschnitten, damit der Test nicht
// gegen eine veraltete Kopie laeuft. Anker: von den Uhren-Konstanten bis zur
// ersten Funktion dahinter, die keine Uhr mehr ist.
const MAIN = path.join(__dirname, '..', 'main.js');
const mainSrc = fs.readFileSync(MAIN, 'utf8');
const from = mainSrc.indexOf('const TICK_HZ = 60;');
const to = mainSrc.indexOf('const cheatsUsed');
if (from < 0 || to < 0 || to <= from) {
  console.error('Uhrenblock in main.js nicht gefunden - wurde er umbenannt?');
  process.exit(2);
}
const BLOCK = mainSrc.slice(from, to);

const TICK_MS = 1000 / 60;

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
    perf: 0,          // performance.now()
    metaTime: 0,      // W-Quelle: api.time.getTimeMs() (store.meta.time)
    tickAccum: 1,     // absoluter Schrittzaehler (U-Quelle); neue Welt startet bei 1
    paused: false,
    postUpdate: false,
    store,
  };

  w.NS = 'goldSpeedrun';
  w.log = () => {};
  w.now = () => w.metaTime;
  // Der geteilte 32-Bit-Puffer, in den worker.js store.meta.tick schreibt.
  w.tickArr = new Int32Array(1);
  w.tickArr[0] = 1;
  w.performance = { now: () => w.perf };

  const ensure = () => (store.mods[w.NS] = store.mods[w.NS] || {});
  w.readRun = () => ({
    startedAt: store.mods[w.NS] ? store.mods[w.NS].startedAt : undefined,
    finishedAt: store.mods[w.NS] ? store.mods[w.NS].finishedAt : undefined,
  });
  w.isRunning = () => {
    const r = w.readRun();
    return typeof r.startedAt === 'number' && typeof r.finishedAt !== 'number';
  };

  w.sandkit = {
    get state() {
      return { session: { paused: w.paused }, store };
    },
  };
  w.api = {
    storage: {
      get: (ns, k) => ensure()[k],
      set: (ns, k, v) => { ensure()[k] = v; },
    },
    shared: {
      buffers: {
        // Der Block ruft api.shared.buffers.create() - wir liefern genau den
        // Puffer, den der Test steuert.
        create: () => w.tickArr,
      },
    },
    workers: { setPostUpdateEnabled: v => { w.postUpdate = v; } },
    time: { getTimeMs: () => w.metaTime },
  };

  // Der Block wird mit denselben Namen ausgefuehrt, die er in main.js sieht.
  const args = ['NS', 'log', 'now', 'readRun', 'isRunning', 'api', 'sandkit', 'performance'];
  const factory = new Function(...args, BLOCK + `
    return { startClocks, advanceClocks, resumeClocks,
             elapsed, elapsedSim, elapsedPlay, scoredTime,
             slowdownPercent, tickDeficit, tickDeficitMs, wMinusR };`);
  w.clock = factory(...args.map(k => w[k]));
  return w;
}

// Echtzeit vorruecken. upsFactor 1 = 60 UPS, 1/3 = 20 UPS. stepMs = ms je Frame.
function advance(w, ms, upsFactor, stepMs) {
  const step = stepMs || 1000 / 60;
  const upf = upsFactor === undefined ? 1 : upsFactor;
  let left = ms;
  while (left > 1e-9) {
    const d = Math.min(step, left);
    left -= d;
    w.perf += d;
    if (!w.paused) {
      // W des Spiels: summiert Frame-Abstaende, deckelt aber jeden auf 50 ms.
      w.metaTime += Math.min(d, 50);
      // Schritte, die in dieser Zeit tatsaechlich liefen.
      w.tickAccum += (d / TICK_MS) * upf;
      w.tickArr[0] = Math.floor(w.tickAccum);
    }
    w.clock.advanceClocks();
  }
}

function startRun(w) {
  w.clock.startClocks();
  w.api.storage.set(w.NS, 'startedAt', w.now());
  w.api.storage.set(w.NS, 'finishedAt', null);
}

// === 1. Durchgehend 60 UPS ================================================
{
  const w = makeWorld();
  startRun(w);
  advance(w, 60000, 1);

  check('60 UPS: R = 60 s', near(w.clock.elapsed(), 60000, 40), w.clock.elapsed());
  check('60 UPS: T = R', near(w.clock.elapsedSim(), 60000, 120), w.clock.elapsedSim());
  check('60 UPS: W = 60 s', near(w.clock.elapsedPlay(), 60000, 120), w.clock.elapsedPlay());
  check('60 UPS: kaum Verzoegerung', Math.abs(w.clock.slowdownPercent()) < 1, w.clock.slowdownPercent());
  check('60 UPS: kaum Defizit', Math.abs(w.clock.tickDeficit()) < 5, w.clock.tickDeficit());
}

// === 2. 20 UPS bei 60 FPS - der Fall des Melders ==========================
{
  const w = makeWorld();
  startRun(w);
  advance(w, 60000, 1 / 3);

  check('20 UPS: R bleibt 60 s', near(w.clock.elapsed(), 60000, 40), w.clock.elapsed());
  check('20 UPS: T = ein Drittel', near(w.clock.elapsedSim(), 20000, 250), w.clock.elapsedSim());
  check('20 UPS: W bleibt 60 s', near(w.clock.elapsedPlay(), 60000, 120), w.clock.elapsedPlay());
  check('20 UPS: Verzoegerung ~ -66.7 %', near(w.clock.slowdownPercent(), -66.7, 2), w.clock.slowdownPercent());
  check('20 UPS: Defizit ~ 2400 Schritte', near(w.clock.tickDeficit(), 2400, 80), w.clock.tickDeficit());
}

// === 3. 12 FPS - hier verliert W durch den 50-ms-Deckel Zeit ==============
{
  const w = makeWorld();
  startRun(w);
  advance(w, 60000, 1, 1000 / 12);   // 83,3 ms pro Frame = 12 FPS

  check('12 FPS: R = 60 s', near(w.clock.elapsed(), 60000, 60), w.clock.elapsed());
  check('12 FPS: W verliert Zeit', w.clock.elapsedPlay() < 40000, w.clock.elapsedPlay());
  check('12 FPS: W-Verlust ~ 24 s', near(w.clock.wMinusR(), -24000, 2000), w.clock.wMinusR());
  check('12 FPS: T bleibt 60 s (Sim ungedrosselt)', near(w.clock.elapsedSim(), 60000, 150), w.clock.elapsedSim());
}

// === 4. Pause haelt alle Uhren an =========================================
{
  const w = makeWorld();
  startRun(w);
  advance(w, 10000, 1);
  w.paused = true;
  advance(w, 30000, 1);
  w.paused = false;
  advance(w, 10000, 1);

  check('Pause: R 20 s statt 50 s', near(w.clock.elapsed(), 20000, 80), w.clock.elapsed());
  check('Pause: W 20 s', near(w.clock.elapsedPlay(), 20000, 120), w.clock.elapsedPlay());
  check('Pause: T 20 s', near(w.clock.elapsedSim(), 20000, 200), w.clock.elapsedSim());
  check('Pause: einmal gezaehlt', w.api.storage.get(w.NS, 'pauseCount') === 1, w.api.storage.get(w.NS, 'pauseCount'));
}

// === 5. Nach dem Ziel laufen die Uhren nicht weiter =======================
{
  const w = makeWorld();
  startRun(w);
  advance(w, 5000, 1);
  const r = w.clock.elapsed();
  w.api.storage.set(w.NS, 'finishedAt', w.now());
  advance(w, 10000, 1);
  check('Ziel erreicht: R steht', w.clock.elapsed() === r, w.clock.elapsed() + ' statt ' + r);
}

// === 6. Speichern und Laden mitten im Lauf ================================
{
  const a = makeWorld();
  startRun(a);
  advance(a, 30000, 1);
  const snapshot = JSON.parse(JSON.stringify(a.store.mods));

  // Neue Sitzung: neuer Prozess, geladener Spielstand.
  const b = makeWorld();
  b.store.mods = JSON.parse(JSON.stringify(snapshot));
  b.perf = 12345;                    // andere Zeitbasis
  b.metaTime = 30000;                // Spielzeit wandert mit
  b.tickAccum = a.tickArr[0];        // absoluter Schritt wandert mit
  b.tickArr[0] = Math.floor(b.tickAccum);
  b.clock.resumeClocks();
  advance(b, 30000, 1);

  check('Laden: R summiert weiter', near(b.clock.elapsed(), 60000, 80), b.clock.elapsed());
  check('Laden: W summiert weiter', near(b.clock.elapsedPlay(), 60000, 120), b.clock.elapsedPlay());
  check('Laden: T summiert weiter', near(b.clock.elapsedSim(), 60000, 200), b.clock.elapsedSim());
}

// === 7. Zerrissener Lesevorgang wird gedeckelt ============================
{
  const w = makeWorld();
  startRun(w);
  advance(w, 2000, 1);
  const before = w.clock.elapsedSim();

  // Der Puffer liefert ploetzlich Unsinn (zerrissener 64->32-Bit-Lesevorgang).
  // Direkt einen Frame ausloesen, damit advance() den Wert nicht ueberschreibt.
  w.tickArr[0] = 2000000000;
  w.perf += TICK_MS;
  w.clock.advanceClocks();
  const jump = w.clock.elapsedSim() - before;
  check('Muellwert springt nicht durch', jump < 500, jump);

  // Und ein Ruecksprung zaehlt nicht rueckwaerts.
  w.tickArr[0] = 5;
  const b2 = w.clock.elapsedSim();
  w.perf += TICK_MS;
  w.clock.advanceClocks();
  check('Ruecksprung zaehlt nicht rueckwaerts', w.clock.elapsedSim() >= b2 - 1, w.clock.elapsedSim());
}

// === 8. Simzeit ueberholt nie die Echtzeit ================================
{
  const w = makeWorld();
  startRun(w);
  for (let i = 0; i < 40; i++) advance(w, 500, i % 3 === 0 ? 0.2 : 1);
  check('T <= R', w.clock.elapsedSim() <= w.clock.elapsed() + 20,
        w.clock.elapsedSim() + ' > ' + w.clock.elapsed());
}

console.log(fails === 0 ? '\nalle Pruefungen bestanden' : `\n${fails} Pruefung(en) fehlgeschlagen`);
process.exit(fails === 0 ? 0 : 1);
