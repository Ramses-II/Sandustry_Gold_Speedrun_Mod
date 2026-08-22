// DE: Gold Speedrun Challenge - Simulations-Thread-Einstieg.
//
// DE: Schreibt nur den absoluten Stand von store.meta.tick in einen gemeinsamen
// DE: Speicher, den main.js (Hauptthread) mitliest - veraendert dort nichts. Das
// DE: ist der exakte, ausgefuehrte Schrittzaehler U: der Simulations-Manager
// DE: zaehlt store.meta.tick ohnehin bei jedem Rechenschritt hoch, hier wird
// DE: dieser Wert lediglich sichtbar gemacht.
//
// DE: Kein eigener Zaehler, keine Schaetzung: faellt ein Aufruf aus oder kommt
// DE: er doppelt, steht trotzdem die richtige Zahl im Puffer, weil immer der
// DE: absolute Wert geschrieben wird, nie ein Delta.
//
// EN: Gold Speedrun Challenge - simulation thread entry point.
//
// EN: Only writes the absolute value of store.meta.tick into a shared buffer
// EN: that main.js (the main thread) reads - it changes nothing there. This
// EN: is the exact, executed step counter U: the simulation manager already
// EN: increments store.meta.tick on every computation step anyway, this file
// EN: just makes that value visible.
//
// EN: No counter of its own, no estimate: if a call gets skipped or comes
// EN: twice, the buffer still holds the correct number, because it's always
// EN: the absolute value that's written, never a delta.

const { api } = sandkit;

const BUF_KEY = 'goldSpeedrunTicks';
const BUF_SPEC = { type: 'int32', length: 1 };

let buf = null;
try {
  buf = api.shared.buffers.require(BUF_KEY, BUF_SPEC);
} catch (e) {
  try { buf = api.shared.buffers.get(BUF_KEY); } catch (e2) { buf = null; }
}

function currentTick() {
  try {
    const n = sandkit.state.store.meta.tick;
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function publish() {
  if (!buf) return;
  Atomics.store(buf, 0, currentTick());
}

publish();

try {
  api.events.on('update:post', publish);
} catch (e) {
  try { api.events.on('frame:update', publish); } catch (e2) { /* DE: Simulations-Ereignis nicht verfuegbar / EN: simulation event not available */ }
}
