// DE: Gold Speedrun Challenge - Simulations-Thread-Einstieg.
//
// DE: Schreibt Simulations-Metriken in einen gemeinsamen Speicher (SharedArrayBuffer):
// DE: Index 0: tick (store.meta.tick - exakter Schrittzaehler der Simulation)
// DE: Index 1: awakeChunks (aktive 40x40-Abschnitte aus chunkShouldUpdate)
// DE: Index 2: ballisticBlocks (Kollisionen geworfener Partikel)
// DE: Index 3: ballisticMoves (Bewegungen geworfener Partikel)
// DE: Index 4: liveElements (Gesamtzahl dynamischer Elemente / sim.liveElementCount)
// DE: Index 5: simTimeMs * 100 (Dauer des Simulationsschritts in ms)
// DE: Index 6: allMatterBlocks (Kollisionen aller Materie - optional fuer Diagnose)
// DE: Index 7: allMatterMoves (Bewegungen aller Materie - optional fuer Diagnose)
// DE: Index 8: allMatterControl (0 = aus, 1 = aktiv - vom Hauptthread gesteuert)
// DE: Index 14: allMatterBlocksSettled (direction=down gegen terrain/element)
// DE: Index 15: allMatterBlocksActive (alle anderen all-matter Bloecke)
// DE: Index 9: allMatterActive (0 = inaktiv, 1 = aktiv - vom Worker bestaetigt)
// DE: Index 10: metricControlMask (einzeln schaltbare Benchmark-Messungen)
// DE: Index 12: metricControlGeneration (Uebergangsnummer vom Hauptthread)
// DE: Index 13: metricAckCount (Worker, die die aktuelle Generation angewendet haben)
//
// DE: goldSpeedrunPhaseV1 (float32, 16): Tick, Rechnen/Warten/Nachlauf, Phasen 1-4,
// DE: langsamster Abschnitt (ms, x, y), verarbeitete Einheiten.
// DE: goldSpeedrunHeatmapV3 (int32): Kopf + 128x128 Live-ms + 128x128 Kumulativ-ms + 128x128 Peak-ms
// DE: (langsamster Abschnitt je Worker und Tick, Summe und Maximum pro Zelle).
// EN: Gold Speedrun Challenge - simulation thread entry point.
//
// EN: Writes simulation metrics into shared memory (SharedArrayBuffer):
// EN: Index 0: tick (store.meta.tick - exact simulation step counter)
// EN: Index 1: awakeChunks (active 40x40 chunks from chunkShouldUpdate)
// EN: Index 2: ballisticBlocks (thrown particle collisions)
// EN: Index 3: ballisticMoves (thrown particle moves)
// EN: Index 4: liveElements (total dynamic element population / sim.liveElementCount)
// EN: Index 5: simTimeMs * 100 (simulation step duration in ms)
// EN: Index 6: allMatterBlocks (all-matter collisions - optional for diagnostics)
// EN: Index 7: allMatterMoves (all-matter moves - optional for diagnostics)
// EN: Index 8: allMatterControl (0 = off, 1 = on - written by main thread)
// EN: Index 9: allMatterActive (0 = inactive, 1 = active - confirmed by worker)
// EN: Index 10: metricControlMask (individually switchable benchmark measurements)
// EN: Index 11: metricActiveMask (confirmed by worker 0)
// EN: Index 12: metricControlGeneration (main-thread transition number)
// EN: Index 13: metricAckCount (workers that applied the current generation)
// EN: Index 14: allMatterBlocksSettled (direction=down against terrain/element)
// EN: Index 15: allMatterBlocksActive (all other all-matter blocks)
//
// EN: goldSpeedrunPhaseV1 (float32, 16):
// EN: 0 tick, 1 computeMs, 2 waitMs, 3 postMs,
// EN: 4-7 phase1-4 work, 8-11 phase1-4 spin,
// EN: 12 slowestUnitMs, 13 slowestChunkX, 14 slowestChunkY, 15 processedUnits
//
// EN: goldSpeedrunHeatmapV3 (int32):
// EN: 0 tick, 1 chunkWidth, 2 chunkHeight, 3 gridW, 4 gridH,
// EN: 5 lastSlowestMs*100, 6 sumMaxMs, 7 peakMs*100, 8 resetControl,
// EN: 9 restoreControl, 10 restoreAck,
// EN: then 128x128 live bottleneck ms*100, then 128x128 sum ms, then 128x128 peak ms*100.

const { api } = sandkit;

const METRICS_BUF_KEY = 'goldSpeedrunMetricsV4';
const METRICS_BUF_SPEC = { type: 'int32', length: 16 };
const PHASE_BUF_KEY = 'goldSpeedrunPhaseV1';
const PHASE_BUF_SPEC = { type: 'float32', length: 16 };
const HEATMAP_MAX = 128;
const HEATMAP_HEADER = 16;
const HEATMAP_CELLS = HEATMAP_MAX * HEATMAP_MAX;
const HEATMAP_BUF_KEY = 'goldSpeedrunHeatmapV3';
const HEATMAP_BUF_SPEC = { type: 'int32', length: HEATMAP_HEADER + 3 * HEATMAP_CELLS };
const CHUNK_SIZE = 40;

const METRIC_BALLISTIC_BLOCKS = 1 << 0;
const METRIC_BALLISTIC_MOVES = 1 << 1;
const METRIC_ALL_BLOCKS = 1 << 2;
const METRIC_ALL_MOVES = 1 << 3;
const METRIC_AWAKE = 1 << 4;
const METRIC_LIVE = 1 << 5;
const METRIC_SIM_TIME = 1 << 6;
const METRIC_NORMAL = METRIC_BALLISTIC_BLOCKS | METRIC_BALLISTIC_MOVES | METRIC_AWAKE | METRIC_LIVE | METRIC_SIM_TIME;

let buf = null;
try {
  buf = api.shared.buffers.require(METRICS_BUF_KEY, METRICS_BUF_SPEC);
} catch (e) {
  try { buf = api.shared.buffers.get(METRICS_BUF_KEY); } catch (e2) { buf = null; }
}

let phaseBuf = null;
try {
  phaseBuf = api.shared.buffers.require(PHASE_BUF_KEY, PHASE_BUF_SPEC);
} catch (e) {
  try { phaseBuf = api.shared.buffers.get(PHASE_BUF_KEY); } catch (e2) { phaseBuf = null; }
}

let heatmapBuf = null;
try {
  heatmapBuf = api.shared.buffers.require(HEATMAP_BUF_KEY, HEATMAP_BUF_SPEC);
} catch (e) {
  try { heatmapBuf = api.shared.buffers.get(HEATMAP_BUF_KEY); } catch (e2) { heatmapBuf = null; }
}

const runSumGrid = new Float64Array(HEATMAP_CELLS);
const sumBufGrid = new Int32Array(HEATMAP_CELLS);
const peakMsGrid = new Uint32Array(HEATMAP_CELLS);
let lastHeatmapReset = 0;
let lastHeatmapRestore = 0;
let heatmapSumMax = 0;
let heatmapPeakMax = 0;
let lastHeatmapDimKey = '';

const isWorkerZero = () => {
  try {
    return sandkit.state.environment.threadMeta.startingIndex === 0;
  } catch (e) {
    return false;
  }
};

function currentTick() {
  try {
    const n = sandkit.state.store.meta.tick;
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function countAwakeChunks() {
  try {
    const sim = sandkit.state.shared && sandkit.state.shared.sim;
    const flags = sim && sim.chunkShouldUpdate;
    if (!flags) return 0;
    let count = 0;
    const len = flags.length;
    for (let i = 0; i < len; i++) {
      if (flags[i] === 1) count++;
    }
    return count;
  } catch (e) {
    return 0;
  }
}

function workerThreadCount() {
  try {
    return (sandkit.state.environment && sandkit.state.environment.threadMeta && sandkit.state.environment.threadMeta.threadCount) || 1;
  } catch (e) {
    return 1;
  }
}

function readSimTimeMs() {
  try {
    const wp = sandkit.state.shared && sandkit.state.shared.workerPerformance;
    if (!wp) return 0;
    const threadCount = workerThreadCount();
    let maxTime = 0;
    for (let i = 0; i < threadCount; i++) {
      const base = 4 * i;
      const t = (wp[base] || 0) + (wp[base + 1] || 0) + (wp[base + 2] || 0);
      if (t > maxTime) maxTime = t;
    }
    return maxTime;
  } catch (e) {
    return 0;
  }
}

function enableWorkerDetailTimers() {
  try {
    const flag = sandkit.state.shared && sandkit.state.shared.workerDetailEnabled;
    if (flag) flag[0] = 1;
  } catch (e) {}
}

function publishPhaseTimers(tick) {
  if (!phaseBuf) return;
  try {
    const shared = sandkit.state.shared;
    const wp = shared && shared.workerPerformance;
    const dp = shared && shared.workerDetailPerformance;
    const n = workerThreadCount();
    let compute = 0;
    let wait = 0;
    let post = 0;
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    let p4 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let slowest = 0;
    let sx = -1;
    let sy = -1;
    let units = 0;
    if (wp) {
      for (let i = 0; i < n; i++) {
        const base = 4 * i;
        compute += wp[base] || 0;
        wait += wp[base + 1] || 0;
        post += wp[base + 2] || 0;
      }
    }
    if (dp) {
      for (let i = 0; i < n; i++) {
        const base = 13 * i;
        p1 += dp[base] || 0;
        s1 += dp[base + 1] || 0;
        p2 += dp[base + 2] || 0;
        s2 += dp[base + 3] || 0;
        p3 += dp[base + 4] || 0;
        s3 += dp[base + 5] || 0;
        p4 += dp[base + 6] || 0;
        s4 += dp[base + 7] || 0;
        const w = dp[base + 8] || 0;
        if (w >= slowest) {
          slowest = w;
          sx = dp[base + 9];
          sy = dp[base + 10];
        }
        units += dp[base + 12] || 0;
      }
    }
    phaseBuf[0] = tick;
    phaseBuf[1] = compute;
    phaseBuf[2] = wait;
    phaseBuf[3] = post;
    phaseBuf[4] = p1;
    phaseBuf[5] = p2;
    phaseBuf[6] = p3;
    phaseBuf[7] = p4;
    phaseBuf[8] = s1;
    phaseBuf[9] = s2;
    phaseBuf[10] = s3;
    phaseBuf[11] = s4;
    phaseBuf[12] = slowest;
    phaseBuf[13] = Number.isFinite(sx) ? sx : -1;
    phaseBuf[14] = Number.isFinite(sy) ? sy : -1;
    phaseBuf[15] = units;
  } catch (e) {}
}

function chunkDims() {
  try {
    const sim = sandkit.state.shared && sandkit.state.shared.sim;
    let w = sim && (sim.chunkWidth | 0);
    let h = sim && (sim.chunkHeight | 0);
    if (w > 0 && h > 0) return { w, h };
  } catch (e) {}
  try {
    const sz = sandkit.state.store.world.size;
    const w = Math.ceil(sz.width / CHUNK_SIZE);
    const h = Math.ceil(sz.height / CHUNK_SIZE);
    if (w > 0 && h > 0) return { w, h };
  } catch (e) {}
  return { w: 0, h: 0 };
}

function toGridCoord(chunk, chunkCount, gridCount) {
  if (chunkCount <= gridCount) return chunk | 0;
  return Math.min(gridCount - 1, Math.floor((chunk * gridCount) / chunkCount));
}

function publishCostHeatmap() {
  if (!heatmapBuf) return;
  try {
    const dims = chunkDims();
    const chunkWidth = dims.w;
    const chunkHeight = dims.h;
    if (chunkWidth <= 0 || chunkHeight <= 0) return;
    const gridW = Math.min(HEATMAP_MAX, chunkWidth);
    const gridH = Math.min(HEATMAP_MAX, chunkHeight);
    const dimKey = chunkWidth + 'x' + chunkHeight;

    const liveOff = HEATMAP_HEADER;
    const sumOff = HEATMAP_HEADER + HEATMAP_CELLS;
    const peakOff = HEATMAP_HEADER + 2 * HEATMAP_CELLS;

    const wipeHeatmapGrids = () => {
      runSumGrid.fill(0);
      sumBufGrid.fill(0);
      peakMsGrid.fill(0);
      heatmapSumMax = 0;
      heatmapPeakMax = 0;
    };

    const applyHeatmapRestore = requestedRestore => {
      lastHeatmapRestore = requestedRestore;
      sumBufGrid.set(heatmapBuf.subarray(sumOff, sumOff + HEATMAP_CELLS));
      peakMsGrid.set(heatmapBuf.subarray(peakOff, peakOff + HEATMAP_CELLS));
      heatmapSumMax = heatmapBuf[6] | 0;
      heatmapPeakMax = heatmapBuf[7] | 0;
      for (let i = 0; i < HEATMAP_CELLS; i++) runSumGrid[i] = sumBufGrid[i] | 0;
      try { Atomics.store(heatmapBuf, 10, requestedRestore); } catch (e) {}
    };

    try {
      const requestedReset = Atomics.load(heatmapBuf, 8);
      const requestedRestore = Atomics.load(heatmapBuf, 9);
      const dimChanged = dimKey !== lastHeatmapDimKey;
      const resetRequested = requestedReset !== lastHeatmapReset;
      if (resetRequested) {
        lastHeatmapReset = requestedReset;
        lastHeatmapDimKey = dimKey;
        wipeHeatmapGrids();
        lastHeatmapRestore = requestedRestore;
        try { Atomics.store(heatmapBuf, 10, requestedRestore); } catch (e) {}
      } else {
        if (dimChanged) lastHeatmapDimKey = dimKey;
        if (requestedRestore !== lastHeatmapRestore) {
          applyHeatmapRestore(requestedRestore);
        } else if (dimChanged) {
          wipeHeatmapGrids();
        }
      }
    } catch (e) {}
    heatmapBuf.fill(0, liveOff, liveOff + HEATMAP_CELLS);

    const dp = sandkit.state.shared && sandkit.state.shared.workerDetailPerformance;
    const n = workerThreadCount();
    let lastMs100 = 0;

    const stamp = (cx, cy, rawMs) => {
      if (!(rawMs > 0) || !Number.isFinite(cx) || cx < 0) return;
      const ms100 = Math.max(1, Math.round(rawMs * 100));
      const gx = toGridCoord(cx, chunkWidth, gridW);
      if (gx < 0 || gx >= gridW) return;
      const writeCell = gy => {
        const gi = gy * HEATMAP_MAX + gx;
        const live = heatmapBuf[liveOff + gi] | 0;
        if (ms100 > live) heatmapBuf[liveOff + gi] = ms100;
        const newSum = runSumGrid[gi] + rawMs;
        runSumGrid[gi] = newSum;
        const totalMs = newSum < 2147483647 ? Math.round(newSum) : 2147483647;
        sumBufGrid[gi] = totalMs;
        if (totalMs > heatmapSumMax) heatmapSumMax = totalMs;
        if (ms100 > (peakMsGrid[gi] || 0)) {
          peakMsGrid[gi] = ms100;
          if (ms100 > heatmapPeakMax) heatmapPeakMax = ms100;
        }
      };
      if (!Number.isFinite(cy) || cy < 0) {
        for (let gy = 0; gy < gridH; gy++) writeCell(gy);
        return;
      }
      const gy = toGridCoord(cy, chunkHeight, gridH);
      if (gy < 0 || gy >= gridH) return;
      writeCell(gy);
    };

    if (dp) {
      for (let i = 0; i < n; i++) {
        const base = 13 * i;
        const ms = dp[base + 8] || 0;
        if (!(ms > 0)) continue;
        const ms100 = Math.max(1, Math.round(ms * 100));
        if (ms100 > lastMs100) lastMs100 = ms100;
        stamp(dp[base + 9], dp[base + 10], ms);
      }
    }

    heatmapBuf.set(sumBufGrid, sumOff);
    heatmapBuf.set(peakMsGrid, peakOff);
    heatmapBuf[0] = currentTick();
    heatmapBuf[1] = chunkWidth;
    heatmapBuf[2] = chunkHeight;
    heatmapBuf[3] = gridW;
    heatmapBuf[4] = gridH;
    heatmapBuf[5] = lastMs100;
    heatmapBuf[6] = heatmapSumMax;
    heatmapBuf[7] = heatmapPeakMax;
  } catch (e) {}
}

// Worker-local accumulators: avoids heavy Atomics.add contention per event
let localBallisticBlocks = 0;
let localBallisticMoves = 0;
let localAllBlocks = 0;
let localAllMoves = 0;
let localAllBlocksSettled = 0;
let localAllBlocksActive = 0;

let activeMetricMask = -1;
let lastControlGeneration = -1;
let particleType = 2;
try {
  particleType = (sandkit.enums && sandkit.enums.ElementType && sandkit.enums.ElementType.Particle) || 2;
} catch (e) {
  particleType = 2;
}

// Ballistic handlers
const ballisticBlockHandler = (state, payload, hookControl) => {
  localBallisticBlocks++;
  return undefined; // Must return undefined so vanilla settlement continues
};
ballisticBlockHandler.fn = ballisticBlockHandler;
const ballisticBlockObj = { fn: ballisticBlockHandler, priority: 0, order: 0 };

const ballisticMoveHandler = (state, payload) => {
  localBallisticMoves++;
  return undefined;
};
ballisticMoveHandler.fn = ballisticMoveHandler;
const ballisticMoveObj = { fn: ballisticMoveHandler, priority: 0, order: 0 };

// All-matter wildcard handlers
const isSettledBlock = payload => {
  const direction = payload && payload.direction;
  const hit = payload && payload.collidedWith;
  return direction === 'down' && (hit === 'terrain' || hit === 'element');
};

const allBlockHandler = (state, payload, hookControl) => {
  localAllBlocks++;
  if (isSettledBlock(payload)) localAllBlocksSettled++;
  else localAllBlocksActive++;
  return undefined;
};
allBlockHandler.fn = allBlockHandler;
const allBlockObj = { fn: allBlockHandler, priority: 0, order: 0 };

const allMoveHandler = (state, payload) => {
  localAllMoves++;
  return undefined;
};
allMoveHandler.fn = allMoveHandler;
const allMoveObj = { fn: allMoveHandler, priority: 0, order: 0 };

function getOrCreateGuard(collectionName, eventName) {
  const st = sandkit.state && sandkit.state.sandkit;
  if (!st) return null;
  if (!st[collectionName]) st[collectionName] = {};
  let guardObj = st[collectionName][eventName];
  if (!guardObj) {
    guardObj = st[collectionName][eventName] = {
      byElementType: new Array(4096).fill(void 0),
      byTerrainType: new Array(4096).fill(void 0),
      wildcardElement: void 0,
      wildcardTerrain: void 0,
      ranKey: eventName + ':ran',
      elementMask: new Uint8Array(4096),
      terrainMask: new Uint8Array(4096),
    };
  }
  return guardObj;
}

function addHandlerObj(arr, obj) {
  if (!arr) return [obj];
  if (arr.includes(obj)) return arr;
  arr.push(obj);
  return arr;
}

function removeHandlerObj(arr, obj) {
  if (!arr) return arr;
  const next = arr.filter(h => h !== obj);
  return next.length ? next : void 0;
}

function refreshElementMask(guard) {
  if (!guard) return;
  if (guard.wildcardElement && guard.wildcardElement.length) {
    guard.elementMask.fill(1);
    return;
  }
  for (let t = 0; t < guard.elementMask.length; t++) {
    const handlers = guard.byElementType[t];
    guard.elementMask[t] = handlers && handlers.length ? 1 : 0;
  }
}

function configureGuard(guard, ballisticObj, allObj, wantBallistic, wantAll) {
  if (!guard) return;

  guard.wildcardElement = removeHandlerObj(guard.wildcardElement, allObj);
  for (let t = 0; t < guard.byElementType.length; t++) {
    let handlers = guard.byElementType[t];
    handlers = removeHandlerObj(handlers, allObj);
    if (t === particleType) handlers = removeHandlerObj(handlers, ballisticObj);
    guard.byElementType[t] = handlers;
  }

  if (wantBallistic) {
    guard.byElementType[particleType] = addHandlerObj(guard.byElementType[particleType], ballisticObj);
  }
  if (wantAll) {
    guard.wildcardElement = addHandlerObj(guard.wildcardElement, allObj);
    for (let t = 0; t < guard.byElementType.length; t++) {
      if (guard.byElementType[t]) {
        guard.byElementType[t] = addHandlerObj(guard.byElementType[t], allObj);
      }
    }
  }
  refreshElementMask(guard);
}

function applyMetricMask(mask) {
  if (mask === activeMetricMask) return;
  try {
    configureGuard(
      getOrCreateGuard('workerInterceptorsByGuard', 'element:blocked'),
      ballisticBlockObj,
      allBlockObj,
      Boolean(mask & METRIC_BALLISTIC_BLOCKS),
      Boolean(mask & METRIC_ALL_BLOCKS)
    );
    configureGuard(
      getOrCreateGuard('workerEventsByGuard', 'element:moved'),
      ballisticMoveObj,
      allMoveObj,
      Boolean(mask & METRIC_BALLISTIC_MOVES),
      Boolean(mask & METRIC_ALL_MOVES)
    );
    activeMetricMask = mask;
  } catch (e) {
    activeMetricMask = 0;
  }

  if (buf && isWorkerZero()) {
    try {
      Atomics.store(buf, 11, activeMetricMask);
      const allActive = Boolean((activeMetricMask & METRIC_ALL_BLOCKS) && (activeMetricMask & METRIC_ALL_MOVES));
      Atomics.store(buf, 9, allActive ? 1 : 0);
    } catch (e) {}
  }
}

function publish() {
  if (!buf) return;

  // Apply individually switchable capture/read controls.
  try {
    const generation = Atomics.load(buf, 12);
    const requested = Atomics.load(buf, 10);
    applyMetricMask(requested);
    if (Atomics.load(buf, 12) === generation && generation !== lastControlGeneration) {
      lastControlGeneration = generation;
      Atomics.add(buf, 13, 1);
    }
  } catch (e) {}

  // Flush local ballistic accumulators to shared buffer
  if (localBallisticBlocks > 0) {
    Atomics.add(buf, 2, localBallisticBlocks);
    localBallisticBlocks = 0;
  }
  if (localBallisticMoves > 0) {
    Atomics.add(buf, 3, localBallisticMoves);
    localBallisticMoves = 0;
  }

  // Flush local all-matter accumulators if active
  if (localAllBlocks > 0) {
    Atomics.add(buf, 6, localAllBlocks);
    localAllBlocks = 0;
  }
  if (localAllMoves > 0) {
    Atomics.add(buf, 7, localAllMoves);
    localAllMoves = 0;
  }
  if (localAllBlocksSettled > 0) {
    Atomics.add(buf, 14, localAllBlocksSettled);
    localAllBlocksSettled = 0;
  }
  if (localAllBlocksActive > 0) {
    Atomics.add(buf, 15, localAllBlocksActive);
    localAllBlocksActive = 0;
  }

  // Always update tick
  Atomics.store(buf, 0, currentTick());

  // Worker 0 performs global passive scans and cause-signal publishes
  if (isWorkerZero()) {
    enableWorkerDetailTimers();
    const tick = currentTick();
    publishPhaseTimers(tick);
    publishCostHeatmap();
    if (activeMetricMask & METRIC_AWAKE) {
      Atomics.store(buf, 1, countAwakeChunks());
    } else {
      Atomics.store(buf, 1, 0);
    }
    if (activeMetricMask & METRIC_LIVE) {
      try {
        const live = sandkit.state.shared && sandkit.state.shared.sim && sandkit.state.shared.sim.liveElementCount;
        if (live) Atomics.store(buf, 4, Atomics.load(live, 0));
      } catch (e) {}
    } else {
      Atomics.store(buf, 4, 0);
    }
    if (activeMetricMask & METRIC_SIM_TIME) {
      try {
        const st = readSimTimeMs();
        if (Number.isFinite(st)) Atomics.store(buf, 5, Math.round(st * 100));
      } catch (e) {}
    } else {
      Atomics.store(buf, 5, 0);
    }
  }
}

publish();

try {
  api.events.on('update:post', publish);
} catch (e) {
  try { api.events.on('frame:update', publish); } catch (e2) { /* DE: Simulations-Ereignis nicht verfuegbar / EN: simulation event not available */ }
}
