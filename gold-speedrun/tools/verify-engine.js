// Prueft, ob die Annahmen der Uhr in gold-speedrun im installierten Spiel
// noch gelten. Nach jedem Spiel-Update einmal laufen lassen.
//
//   node verify-engine.js ["Pfad zu app.asar"]
//
// Die Muster sind absichtlich ohne Variablennamen geschrieben - der Minifier
// vergibt bei jedem Build neue, ein Treffer auf "r>50" waere also wertlos.

const fs = require('fs');

const DEFAULT_ASAR =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sandustry\\resources\\app.asar';

const asar = process.argv[2] || DEFAULT_ASAR;
if (!fs.existsSync(asar)) {
  console.error('Nicht gefunden: ' + asar);
  process.exit(2);
}

const src = fs.readFileSync(asar, 'latin1');
const version = (src.match(/"version":\s*"(0\.\d+\.\d+)"/g) || [])
  .map(m => m.match(/(0\.\d+\.\d+)/)[1])
  .sort((a, b) => {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
  })[0] || 'unbekannt';

console.log('Datei   : ' + asar);
console.log('Groesse : ' + fs.statSync(asar).size.toLocaleString('de-DE') + ' Bytes');
console.log('Version : ' + version);
console.log('');

// Vorabpruefung: hat dieser Build ueberhaupt die Laufzeit fuer externe Mods?
// Der oeffentliche Branch von 0.5.5 hat sie nicht - dort wird %APPDATA%\sandustry
// \mods gar nicht erst gelesen, und kein Sandkit-Mod laedt. Alle weiteren
// Pruefungen waeren dann bedeutungslos.
const MODAPI = [
  ['apiVersion im Mod-Objekt', /apiVersion:1/],
  ['Laufzeit-Kennung', /__sandkitExternalRuntimeV1/],
  ['api.time.getTimeMs', /getTimeMs/],
];
const fehlend = MODAPI.filter(([, re]) => !re.test(src)).map(([name]) => name);

if (fehlend.length === MODAPI.length) {
  console.log('KEINE MOD-API IN DIESEM BUILD');
  console.log('');
  console.log('  Weder apiVersion noch die Laufzeit-Kennung noch getTimeMs sind im');
  console.log('  Paket. Dieser Build laedt keine Sandkit-Mods - gold-speedrun startet');
  console.log('  hier gar nicht erst, unabhaengig davon, was in main.js steht.');
  console.log('');
  const flux = /modID\s*===\s*['"]fluxloader['"]/.test(src);
  console.log('  Fluxloader-Haken vorhanden: ' + (flux ? 'ja' : 'nein'));
  console.log('  Branch pruefen: steamapps/appmanifest_2764460.acf -> BetaKey');
  console.log('');
  console.log('  Auf den Branch mit der Mod-API zurueck, dann diesen Test erneut.');
  process.exit(3);
}
if (fehlend.length > 0) {
  console.log('WARNUNG: Mod-API nur teilweise vorhanden - fehlt: ' + fehlend.join(', '));
  console.log('');
}

// Jede Pruefung: was angenommen wird, wonach gesucht wird, und was es fuer den
// Mod bedeutet, wenn sie ausfaellt.
const CHECKS = [
  {
    id: 'deckel',
    was: 'Renderschleife deckelt das Frame-Delta bei 50 ms',
    re: /(\w+)>50&&\(\1=50\)/,
    folge: 'Faellt das weg, misst getTimeMs() wieder echte Zeit - der Text in '
         + 'CHANGELOG und README stimmt dann nicht mehr. Die Uhr des Mods '
         + 'benutzt getTimeMs() ohnehin nicht, sie bleibt richtig.',
  },
  {
    id: 'metatime',
    was: 'store.meta.time wird in der Renderschleife aufsummiert',
    re: /meta\.time\+=/,
    folge: 'Nur noch migrateClocks() haengt daran (Uebernahme eines Laufs aus '
         + '2.6.0). Ohne das ist eine alte laufende Runde nicht uebernehmbar.',
  },
  {
    id: 'gettimems',
    was: 'api.time.getTimeMs() liefert store.meta.time',
    re: /getTimeMs:\(\)=>\w+\.store\.meta\.time/,
    folge: 'now() im Mod liefert etwas anderes. Betrifft startedAt/finishedAt '
         + 'als Laufmarkierung und migrateClocks().',
  },
  {
    id: 'schritt',
    was: 'Simulation laeuft mit festem Zeitschritt 1/60 s',
    re: /=1\/60[,;]/,
    folge: 'KRITISCH: SIM_STEP_MS in main.js muss auf den neuen Schritt. Sonst '
         + 'ist die Simulationszeit um genau diesen Faktor falsch.',
    kritisch: true,
  },
  {
    id: 'managerloop',
    was: 'Manager-Schleife: Akkumulator, Pause-Pruefung, requestAnimationFrame',
    re: /session\.paused\|\|await |\|\|await \w+\(\w+,\w+\)/,
    folge: 'Die Simulation pausiert evtl. anders. Betrifft die Annahme, dass '
         + 'die Simulationsuhr bei Pause von allein stehenbleibt.',
  },
  {
    id: 'metatick',
    was: 'Manager zaehlt store.meta.tick pro Simulationsschritt hoch',
    re: /meta\.tick\+\+/,
    folge: 'KRITISCH: das ist der Wert, den die Simulationsuhr ausliest. Ohne '
         + 'ihn faellt der Mod dauerhaft auf die Schaetzung zurueck.',
    kritisch: true,
  },
  {
    id: 'perf',
    was: 'shared.managerPerformance[1] traegt den Schrittabstand',
    re: /managerPerformance\[1\]=/,
    folge: 'Der Rueckfallweg (Schaetzung) rechnet mit Muell. Faellt gleichzeitig '
         + 'metatick aus, ist die Simulationszeit unbrauchbar.',
  },
  {
    id: 'sharedbuf',
    was: 'RegisterModSharedBuffer legt den Puffer unter shared.mods ab',
    re: /RegisterModSharedBuffer:[\s\S]{0,400}?shared\.mods\[/,
    folge: 'KRITISCH: der gemeinsame Speicher kommt im Simulations-Thread nicht '
         + 'an, der Ausloeser findet nichts. Rueckfall auf die Schaetzung.',
    kritisch: true,
  },
  {
    id: 'bufname',
    was: 'Puffername wird als external:<modId>:<key> gebildet',
    re: /`external:\$\{\w+\}:\$\{\w+\}`/,
    folge: 'KRITISCH: SHARED_NAME in main.js stimmt nicht mehr, der Ausloeser '
         + 'greift ins Leere. Neuen Namen aus dem asar ablesen.',
    kritisch: true,
  },
  {
    id: 'triggerargs',
    was: 'Ausloeser werden mit (state, trigger, dtMs) gerufen',
    re: /await \w+\.callback\(\w+,\w+,\w+\)/,
    folge: 'KRITISCH: der Callback der Simulationsuhr bekommt den State nicht '
         + 'mehr als erstes Argument und findet den Puffer nicht.',
    kritisch: true,
  },
  {
    id: 'apibug',
    was: 'api.triggers.register schleppt weiterhin eine Closure-Variable mit '
       + '(der Grund, warum der Mod ueber engine.api geht)',
    re: /callback:function\(\w+,\w+,\w+\)\{return \w+\.callback\(\w+,\w+\)\}/,
    folge: 'Kein Problem - wenn das repariert wurde, funktioniert der Weg des '
         + 'Mods trotzdem. Nur der Hinweis im CHANGELOG waere veraltet.',
    optional: true,
  },
];

let kritischOffen = 0;
let offen = 0;

for (const c of CHECKS) {
  const hit = c.re.test(src);
  const marke = hit ? 'OK  ' : (c.optional ? 'weg ' : (c.kritisch ? 'FEHLT' : 'weg '));
  console.log(`${marke}  ${c.was}`);
  if (!hit && !c.optional) {
    console.log(`        -> ${c.folge}`);
    if (c.kritisch) kritischOffen++; else offen++;
  }
  if (!hit && c.optional) {
    console.log(`        -> ${c.folge}`);
  }
}

console.log('');
if (kritischOffen === 0 && offen === 0) {
  console.log('Alle Annahmen halten. Die Uhr in gold-speedrun braucht keine Anpassung.');
} else {
  console.log(`${kritischOffen} kritische und ${offen} weitere Annahme(n) gelten nicht mehr.`);
  console.log('main.js pruefen, bevor der Mod mit diesem Build veroeffentlicht wird.');
}
process.exit(kritischOffen > 0 ? 1 : 0);
