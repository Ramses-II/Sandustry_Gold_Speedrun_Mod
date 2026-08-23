// DE: Gold Speedrun Challenge
// DE: Die Uhr startet mit der ersten echten Spielhandlung - Bewegung, Graben,
// DE: Bauen, Forschen - und stoppt, sobald das Ziel der Kategorie erreicht ist.
// DE: Vorher steht sie gedimmt auf 00:00:00.
//
// DE: Kategorien: Gold (100k/500k/1M/eigenes), Alle Artefakte, Fabrikrang 6/7.
// DE: Unterwegs setzen frei waehlbare Ausloeser Zwischenzeiten - jede Forschung,
// DE: jeder Fabrikrang, jedes Artefakt, Gold-Marken. Jede Zwischenzeit landet in
// DE: der Split-Tabelle im Spiel und im Ergebnisfenster am Ende.
//
// EN: Gold Speedrun Challenge
// EN: The clock starts on the first real in-game action - movement, digging,
// EN: building, researching - and stops the moment the category goal is
// EN: reached. Before that it sits dimmed at 00:00:00.
//
// EN: Categories: Gold (100k/500k/1M/custom), All Artifacts, Factory rank 6/7.
// EN: Along the way, freely selectable triggers create splits - every research,
// EN: every factory rank, every artifact, gold marks. Every split lands in the
// EN: split table in-game and in the result screen at the end.

const { api, enums, react } = sandkit;
const h = react.createElement;

const MOD_ID = 'gold-speedrun';
const NS = 'goldSpeedrun';          // DE: Namespace im Savegame / EN: namespace inside the save file
const BEST_PREFIX = 'goldSpeedrun.best'; // DE: localStorage, savegame-uebergreifend / EN: localStorage, shared across save files
const LEGACY_BEST_KEY = 'goldSpeedrun.best'; // DE: Bestzeit aus Version <= 1.4 / EN: best time from version <= 1.4

const MOD_VERSION = '2.8.1';
const log = (...a) => console.log(`[${MOD_ID} v${MOD_VERSION}]`, ...a);

// --- DE: Schalter der Mod-Verwaltung / EN: Mod-manager switch ---------------
// DE: Traegt sich bei der Mod-Verwaltung ein und fragt deren Schalter ab.
// DE: Fehlt die Verwaltung, ist der Mod schlicht immer aktiv.
//
// DE: Zusaetzlich gibt es "enabled" als eigene Einstellung direkt im Mod-Menue -
// DE: derselbe Schalter wie der der Mod-Verwaltung, nur ohne dort erst hin
// DE: wechseln zu muessen. Ein laufender Lauf ignoriert beide Schalter bewusst
// DE: weiter (siehe advanceClocks()): Aus- und Wiedereinschalten waehrend eines
// DE: Laufs darf die Echtzeit nicht anhalten, sonst liesse sich damit schummeln.
//
// EN: Registers with the mod manager and reads its switch back. If the
// EN: manager is missing, the mod is simply always active.
//
// EN: There is also "enabled" as its own setting right in the mod's menu -
// EN: the same switch as the mod manager's, just without having to go there
// EN: first. A run in progress deliberately ignores both switches (see
// EN: advanceClocks()): turning the mod off and back on during a run must not
// EN: pause real time, or that could be used to cheat.
const MANAGER_REGISTRY = 'sandkitManager.registry';

const registerWithManager = name => {
  try {
    const v = api.storage.local.get(MANAGER_REGISTRY);
    const reg = Array.isArray(v) ? v : [];
    const i = reg.findIndex(e => e && e.id === MOD_ID);
    if (i >= 0) {
      if (reg[i].name === name) return;
      reg[i] = { id: MOD_ID, name };
    } else {
      reg.push({ id: MOD_ID, name });
    }
    api.storage.local.set(MANAGER_REGISTRY, reg);
  } catch (e) { /* DE: kein localStorage / EN: no localStorage available */ }
};

const modEnabled = () => {
  try {
    if (api.storage.local.get(`sandkitManager.enabled.${MOD_ID}`) === false) return false;
  } catch (e) { /* DE: keine Mod-Verwaltung / EN: no mod manager present */ }
  try {
    return api.settings.get('enabled') !== false;
  } catch (e) {
    return true;
  }
};

registerWithManager('Gold Speedrun');

// --- DE: Uebersetzungen / EN: Translations ----------------------------------
api.i18n.register('en', {
  'mods|goldSpeedrun|name': 'Gold Speedrun',
  'mods|goldSpeedrun|running': 'Category: {category}',
  'mods|goldSpeedrun|done': 'Challenge complete! Time: {time}',
  'mods|goldSpeedrun|newBest': 'New personal best: {time}',
  'mods|goldSpeedrun|waiting': 'Any action starts the run',
  'mods|goldSpeedrun|waitingMove': 'Press W/A/S/D to start',
  'mods|goldSpeedrun|waitingClick': 'Your first action starts the run',
  'mods|goldSpeedrun|waitingMouse': 'Click to start the run',
  'mods|goldSpeedrun|reset': 'Timer reset - next action starts a new run',
  'mods|goldSpeedrun|resetKey': 'Reset speedrun timer',
  'mods|goldSpeedrun|resultKey': 'Show last result',
  'mods|goldSpeedrun|tutorialSkipped': 'Tutorial skipped automatically',
  'mods|goldSpeedrun|artifacts': '{current} / {target} artifacts',
  'mods|goldSpeedrun|factory': 'Rank {current} / {target}',
  'mods|goldSpeedrun|tainted': 'CHEATS USED - run does not count',
  'mods|goldSpeedrun|noTutorial': 'No Tutorial',

  // DE: Ausloeser und Ergebnis / EN: Triggers and result
  'mods|goldSpeedrun|split|rank': 'Factory rank {level}',
  'mods|goldSpeedrun|split|artifact': 'Artifact {index}',
  'mods|goldSpeedrun|split|gold': '{percent}% gold',
  'mods|goldSpeedrun|split|upgrade': 'Upgrade: {name}',
  'mods|goldSpeedrun|split|goal': 'GOAL',
  'mods|goldSpeedrun|result|title': 'Run complete',
  'mods|goldSpeedrun|result|total': 'Final time',
  'mods|goldSpeedrun|result|best': 'Personal best',
  'mods|goldSpeedrun|result|noBest': 'first finish',
  'mods|goldSpeedrun|result|sim': 'Simulation time',
  'mods|goldSpeedrun|result|play': 'Play-clock',
  'mods|goldSpeedrun|result|tickSourceMissing': 'No tick source - the simulation thread did not report step counts this run, so simulation time and the derived metrics are unavailable.',
  'mods|goldSpeedrun|clock|simShort': 'sim',
  'mods|goldSpeedrun|clock|realShort': 'real',
  'mods|goldSpeedrun|clock|playShort': 'play',
  'mods|goldSpeedrun|result|colSplit': 'Trigger',
  'mods|goldSpeedrun|result|colTime': 'Time',
  'mods|goldSpeedrun|result|colSegment': 'Segment',
  'mods|goldSpeedrun|result|colGold': 'Gold',
  'mods|goldSpeedrun|result|noSplits': 'No triggers fired - enable some under Splits.',
  'mods|goldSpeedrun|result|close': 'Close',
  'mods|goldSpeedrun|result|hint': 'F10 shows this again',
  'mods|goldSpeedrun|result|expand': 'Show full statistics',
  'mods|goldSpeedrun|result|collapse': 'Hide full statistics',

  // DE: Metriken (U, R, W und was sich daraus ergibt) / EN: Metrics (U, R, W and what follows from them)
  'mods|goldSpeedrun|metric|slowdown': 'Slowdown',
  'mods|goldSpeedrun|metric|deficit': 'Tick deficit',
  'mods|goldSpeedrun|metric|ticks': 'Executed ticks (U)',
  'mods|goldSpeedrun|metric|avgUps': 'Average UPS',
  'mods|goldSpeedrun|metric|idealTicks': 'Ideal ticks (60×R)',
  'mods|goldSpeedrun|metric|thinkMult': 'Thinking multiplier',
  'mods|goldSpeedrun|metric|wrProbe': 'Play-clock − real time (W−R)',
  'mods|goldSpeedrun|metric|dash': 'waiting for the run to start',

  // DE: Verlaufsgrafik / EN: History graph
  'mods|goldSpeedrun|graph|title': 'UPS over the whole run',
  'mods|goldSpeedrun|graph|live': 'Live UPS (last 60 s)',
  'mods|goldSpeedrun|graph|empty': 'No data yet - turn on "Record UPS history" before starting a run.',

  // DE: Ausloeser-Fenster / EN: Triggers window
  'mods|goldSpeedrun|trg|title': 'Split triggers',
  'mods|goldSpeedrun|trg|key': 'Open split triggers',
  'mods|goldSpeedrun|trg|groups': 'Groups',
  'mods|goldSpeedrun|trg|tech': 'Research',
  'mods|goldSpeedrun|trg|rank': 'Factory ranks',
  'mods|goldSpeedrun|trg|gold': 'Gold marks',
  'mods|goldSpeedrun|trg|other': 'Other',
  'mods|goldSpeedrun|trg|artifactAll': 'Every artifact',
  'mods|goldSpeedrun|trg|upgradeAll': 'Every upgrade',
  'mods|goldSpeedrun|trg|allOn': 'All on',
  'mods|goldSpeedrun|trg|allOff': 'All off',
  'mods|goldSpeedrun|trg|default': 'Default',
  'mods|goldSpeedrun|trg|count': '{on} of {total}',
  'mods|goldSpeedrun|trg|filter': 'Filter',
  'mods|goldSpeedrun|trg|hint': 'Every switch counts on its own. The group settings in the mod options are only the starting point - what you pick here wins.',
  'mods|goldSpeedrun|trg|locked': 'A run is in progress - changes apply to the next run.',
  'mods|goldSpeedrun|trg|noGoldMarks': 'No gold marks - pick an interval under Gold marks in the mod options.',
  'mods|goldSpeedrun|btn|on': 'ON',
  'mods|goldSpeedrun|btn|off': 'OFF',

  // DE: Einstellungen / EN: Settings
  'mods|goldSpeedrun|cfg|goalGold': 'Custom gold target',
  'mods|goldSpeedrun|cfg|goalGold|desc': 'Only used when Category is set to Custom gold. Any whole number from 1 upwards - handy for quick tests.',
  'mods|goldSpeedrun|cfg|artifactTarget': 'Artifact target',
  'mods|goldSpeedrun|cfg|artifactTarget|desc': 'Only used by the Artifacts category. 0 counts every artifact the current map contains.',
  'mods|goldSpeedrun|cfg|mode': 'Gold ruleset',
  'mods|goldSpeedrun|cfg|mode|desc': 'Normal counts every bit of gold you earn, so spending costs no progress. Hard Mode goes by your current balance: researching sets you back. Official ruleset is Hard Mode plus the rest of the official settings - it also starts the timer on any action including movement and keeps the automatic tutorial skip off, whatever those two options are set to.',
  'mods|goldSpeedrun|cfg|mode|earned': 'Normal',
  'mods|goldSpeedrun|cfg|mode|balance': 'Hard Mode',
  'mods|goldSpeedrun|cfg|mode|official': 'Official ruleset (Hard Mode)',
  'mods|goldSpeedrun|modeNormal': 'Normal',
  'mods|goldSpeedrun|modeHard': 'Hard Mode',
  'mods|goldSpeedrun|rules|forced': 'set by the Official ruleset option',
  'mods|goldSpeedrun|cfg|enabled': 'Mod enabled',
  'mods|goldSpeedrun|cfg|enabled|desc': 'Turns the whole mod off without uninstalling it: no timer, no overlay, no splits, no auto-skips. A run already in progress keeps its official real-time clock running in the background while this is off, so toggling it cannot be used to pause a run.',
  'mods|goldSpeedrun|cfg|preset': 'Category',
  'mods|goldSpeedrun|cfg|preset|desc': 'Pick a common target, or Custom gold to set your own below.',
  'mods|goldSpeedrun|cfg|preset|100k': '100k Gold %',
  'mods|goldSpeedrun|cfg|preset|500k': '500k Gold %',
  'mods|goldSpeedrun|cfg|preset|1m': '1M Gold %',
  'mods|goldSpeedrun|cfg|preset|artifacts': 'All Artifacts %',
  'mods|goldSpeedrun|cfg|preset|factory6': 'Factory Rank 6',
  'mods|goldSpeedrun|cfg|preset|factory7': 'Factory Rank 7 (max)',
  'mods|goldSpeedrun|cfg|preset|custom': 'Custom gold',
  'mods|goldSpeedrun|cfg|startMode': 'What starts the timer',
  'mods|goldSpeedrun|cfg|startMode|desc': 'Mouse press is the speedrun setting: the clock starts the moment you dig, grab, build or research. Walking around is free, and anything running without a click of yours - a digger drone, a belt - does not start it either.',
  'mods|goldSpeedrun|cfg|startMode|mouse': 'Mouse press only',
  'mods|goldSpeedrun|cfg|startMode|click': 'Mouse press or any progress',
  'mods|goldSpeedrun|cfg|startMode|any': 'Any action, movement included',
  'mods|goldSpeedrun|cfg|startMode|move': 'Movement only',
  'mods|goldSpeedrun|cfg|clockMode': 'Headline clock',
  'mods|goldSpeedrun|cfg|clockMode|desc': 'All three times are always measured and always shown - this only decides which one stands large on the timer, the other two stay underneath. Real time (R) is the official scoring: the number a stopwatch next to the screen shows, and the only one a verifier can check against a video. Simulation time (T) counts the simulation steps the world actually ran, divided by 60 - a run on a machine that cannot hold 60 UPS stays comparable with one that can, but it also gives more real thinking time per world-tick on slow hardware. Play-clock (W) is the game\'s own save-file clock.',
  'mods|goldSpeedrun|cfg|clockMode|real': 'Real time (R)',
  'mods|goldSpeedrun|cfg|clockMode|sim': 'Simulation time (T)',
  'mods|goldSpeedrun|cfg|clockMode|play': 'Play-clock (W)',
  'mods|goldSpeedrun|cfg|timeFormat': 'Timer precision',
  'mods|goldSpeedrun|cfg|timeFormat|seconds': 'Seconds (00:00:00)',
  'mods|goldSpeedrun|cfg|timeFormat|centis': 'Hundredths (00:00:00.00)',
  'mods|goldSpeedrun|cfg|timeFormat|millis': 'Milliseconds (00:00:00.000)',
  'mods|goldSpeedrun|cfg|skipIntro': 'Skip intro and landing',
  'mods|goldSpeedrun|cfg|skipIntro|desc': 'Jumps straight into the world on a new game, exactly like the in-game Skip Intro button. The clock stays untouched: the skipped landing cannot start it.',
  'mods|goldSpeedrun|cfg|skipStory': 'Dismiss story text boxes',
  'mods|goldSpeedrun|cfg|skipStory|desc': 'Closes the story pop-ups the moment they appear - the same as clicking them away, so the story still counts them as seen. While one is on screen the timer cannot start.',
  'mods|goldSpeedrun|cfg|skipTutorial': 'Skip the tutorial automatically',
  'mods|goldSpeedrun|cfg|skipTutorial|desc': 'Ends the tutorial as soon as a save is loaded, exactly like the in-game skip button. Only happens while the timer is still waiting, never during a run.',
  'mods|goldSpeedrun|cfg|showOverlay': 'Show timer on screen',
  'mods|goldSpeedrun|cfg|showSplits': 'Show split table',
  'mods|goldSpeedrun|cfg|showSplits|desc': 'Lists the last triggers under the timer with time and the LiveSplit-style delta versus the personal best. The full table appears on the result screen when the run ends.',
  'mods|goldSpeedrun|cfg|hudSplitRows': 'Splits visible on the timer',
  'mods|goldSpeedrun|cfg|hudSplitRows|desc': 'How many split rows the timer shows at once. The last completed ones stay visible; the rest look ahead to upcoming marks. 6 is the default.',
  'mods|goldSpeedrun|cfg|hudLayout': 'Timer layout',
  'mods|goldSpeedrun|cfg|hudLayout|desc': 'Horizontal puts splits, clocks and the UPS graph side by side to save height. Vertical is the old single-column stack.',
  'mods|goldSpeedrun|cfg|hudLayout|horizontal': 'Horizontal (compact)',
  'mods|goldSpeedrun|cfg|hudLayout|vertical': 'Vertical',
  'mods|goldSpeedrun|cfg|corner': 'Timer position',
  'mods|goldSpeedrun|cfg|corner|topCenter': 'Top centre',
  'mods|goldSpeedrun|cfg|corner|topLeft': 'Top left',
  'mods|goldSpeedrun|cfg|corner|topRight': 'Top right',
  'mods|goldSpeedrun|cfg|corner|bottomLeft': 'Bottom left',
  'mods|goldSpeedrun|cfg|corner|bottomRight': 'Bottom right',

  // DE: Ausloeser / EN: Triggers
  'mods|goldSpeedrun|cfg|splitTech': 'Split on every research',
  'mods|goldSpeedrun|cfg|splitTech|desc': 'Each unlocked technology becomes a split, named after the research.',
  'mods|goldSpeedrun|cfg|splitRank': 'Split on every factory rank',
  'mods|goldSpeedrun|cfg|splitRank|desc': 'Each factory rank becomes a split - the tier objectives of the base game.',
  'mods|goldSpeedrun|cfg|splitArtifact': 'Split on every artifact',
  'mods|goldSpeedrun|cfg|splitUpgrade': 'Split on every upgrade',
  'mods|goldSpeedrun|cfg|splitGold': 'Gold marks',
  'mods|goldSpeedrun|cfg|splitGold|desc': 'Splits at a share of the category goal, or at a fixed gold interval.',
  'mods|goldSpeedrun|cfg|splitGold|off': 'Off',
  'mods|goldSpeedrun|cfg|splitGold|quarters': '25 / 50 / 75 % of the goal',
  'mods|goldSpeedrun|cfg|splitGold|tenths': 'Every 10 % of the goal',
  'mods|goldSpeedrun|cfg|splitGold|10k': 'Every 10k gold',
  'mods|goldSpeedrun|cfg|splitGold|100k': 'Every 100k gold',

  // DE: Offizielles Regelwerk / EN: Official ruleset
  'mods|goldSpeedrun|rules|badge': 'OFFICIAL RULESET',
  'mods|goldSpeedrun|rules|custom': 'Custom rules',
  'mods|goldSpeedrun|rules|title': 'Official speedrun ruleset',
  'mods|goldSpeedrun|rules|ok': 'Every setting matches the official ruleset.',
  'mods|goldSpeedrun|rules|bad': 'These settings differ from the official ruleset:',
  'mods|goldSpeedrun|rules|need': 'needs: {value}',
  'mods|goldSpeedrun|rules|broken': 'RULESET CHANGED',
  'mods|goldSpeedrun|rules|brokenDesc': 'A setting of the official ruleset was changed while the run was going. The run no longer counts as official and is not stored as a best time.',
  'mods|goldSpeedrun|rules|locked': 'locked in when the run started',
  'mods|goldSpeedrun|rules|mods': 'Other mods enabled',
  'mods|goldSpeedrun|rules|modsNone': 'none',
  'mods|goldSpeedrun|cfg|showRuleset': 'Show ruleset badge',
  'mods|goldSpeedrun|cfg|showRuleset|desc': 'Marks on the timer and on the result screen whether the settings match the official ruleset: timer started by any action including movement, gold ruleset Hard Mode, tutorial skip off, and no other mod enabled.',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics': 'Show advanced metrics',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics|desc': 'Adds the raw tick count, average UPS, the ticks a perfect 60 UPS machine would have run by now, the thinking multiplier (how many real seconds each simulated second cost) and the gap between play-clock and real time.',
  'mods|goldSpeedrun|cfg|trackUpsHistory': 'Record UPS history',
  'mods|goldSpeedrun|cfg|trackUpsHistory|desc': 'Keeps a UPS min/max/average graph of the whole run for the result screen, sampled once per second and stored in the save. Off by default - a very long run adds a modest amount of save data.',
  'mods|goldSpeedrun|cfg|showLiveSparkline': 'Show live UPS graph',
  'mods|goldSpeedrun|cfg|showLiveSparkline|desc': 'Adds a small live graph of the last 60 seconds of UPS under the timer. Sampled on the main thread only - no measurable cost to the simulation.',

});

api.i18n.register('de', {
  'mods|goldSpeedrun|name': 'Gold Speedrun',
  'mods|goldSpeedrun|running': 'Kategorie: {category}',
  'mods|goldSpeedrun|done': 'Challenge geschafft! Zeit: {time}',
  'mods|goldSpeedrun|newBest': 'Neue Bestzeit: {time}',
  'mods|goldSpeedrun|waiting': 'Jede Aktion startet den Lauf',
  'mods|goldSpeedrun|waitingMove': 'W/A/S/D startet den Lauf',
  'mods|goldSpeedrun|waitingClick': 'Die erste Aktion startet den Lauf',
  'mods|goldSpeedrun|waitingMouse': 'Mausklick startet den Lauf',
  'mods|goldSpeedrun|reset': 'Timer zurückgesetzt - die nächste Aktion startet neu',
  'mods|goldSpeedrun|resetKey': 'Speedrun-Timer zurücksetzen',
  'mods|goldSpeedrun|resultKey': 'Letztes Ergebnis zeigen',
  'mods|goldSpeedrun|tutorialSkipped': 'Tutorial automatisch übersprungen',
  'mods|goldSpeedrun|artifacts': '{current} / {target} Artefakte',
  'mods|goldSpeedrun|factory': 'Rang {current} / {target}',
  'mods|goldSpeedrun|tainted': 'CHEATS BENUTZT - Lauf zählt nicht',
  'mods|goldSpeedrun|noTutorial': 'Ohne Tutorial',

  'mods|goldSpeedrun|split|rank': 'Fabrikrang {level}',
  'mods|goldSpeedrun|split|artifact': 'Artefakt {index}',
  'mods|goldSpeedrun|split|gold': '{percent}% Gold',
  'mods|goldSpeedrun|split|upgrade': 'Aufwertung: {name}',
  'mods|goldSpeedrun|split|goal': 'ZIEL',
  'mods|goldSpeedrun|result|title': 'Lauf beendet',
  'mods|goldSpeedrun|result|total': 'Endzeit',
  'mods|goldSpeedrun|result|best': 'Bestzeit',
  'mods|goldSpeedrun|result|noBest': 'erster Durchlauf',
  'mods|goldSpeedrun|result|sim': 'Simulationszeit',
  'mods|goldSpeedrun|result|play': 'Spielzeit-Uhr',
  'mods|goldSpeedrun|result|tickSourceMissing': 'Kein Schrittzähler - die Simulation hat diesen Lauf keine Schritte gemeldet, Simulationszeit und die daraus abgeleiteten Werte fehlen deshalb.',
  'mods|goldSpeedrun|clock|simShort': 'sim',
  'mods|goldSpeedrun|clock|realShort': 'echt',
  'mods|goldSpeedrun|clock|playShort': 'spiel',
  'mods|goldSpeedrun|result|colSplit': 'Auslöser',
  'mods|goldSpeedrun|result|colTime': 'Zeit',
  'mods|goldSpeedrun|result|colSegment': 'Abschnitt',
  'mods|goldSpeedrun|result|colGold': 'Gold',
  'mods|goldSpeedrun|result|noSplits': 'Kein Auslöser gefeuert - unter Splits welche einschalten.',
  'mods|goldSpeedrun|result|close': 'Schließen',
  'mods|goldSpeedrun|result|hint': 'F10 zeigt das nochmal',
  'mods|goldSpeedrun|result|expand': 'Alle Werte zeigen',
  'mods|goldSpeedrun|result|collapse': 'Alle Werte ausblenden',

  // DE: Metriken (U, R, W und Ableitungen) / EN: Metrics (U, R, W and derived values)
  'mods|goldSpeedrun|metric|slowdown': 'Verzögerung',
  'mods|goldSpeedrun|metric|deficit': 'Schritt-Rückstand',
  'mods|goldSpeedrun|metric|ticks': 'Ausgeführte Schritte (U)',
  'mods|goldSpeedrun|metric|avgUps': 'Mittlere UPS',
  'mods|goldSpeedrun|metric|idealTicks': 'Soll-Schritte (60×R)',
  'mods|goldSpeedrun|metric|thinkMult': 'Denk-Faktor',
  'mods|goldSpeedrun|metric|wrProbe': 'Spielzeit-Uhr minus Echtzeit (W−R)',
  'mods|goldSpeedrun|metric|dash': 'wartet auf den Laufstart',

  // DE: Verlaufsgrafik / EN: History graph
  'mods|goldSpeedrun|graph|title': 'UPS über den ganzen Lauf',
  'mods|goldSpeedrun|graph|live': 'UPS live (letzte 60 s)',
  'mods|goldSpeedrun|graph|empty': 'Noch keine Daten - "UPS-Verlauf aufzeichnen" vor Laufstart einschalten.',

  'mods|goldSpeedrun|trg|title': 'Split-Auslöser',
  'mods|goldSpeedrun|trg|key': 'Split-Auslöser öffnen',
  'mods|goldSpeedrun|trg|groups': 'Gruppen',
  'mods|goldSpeedrun|trg|tech': 'Forschungen',
  'mods|goldSpeedrun|trg|rank': 'Fabrikränge',
  'mods|goldSpeedrun|trg|gold': 'Gold-Marken',
  'mods|goldSpeedrun|trg|other': 'Weitere',
  'mods|goldSpeedrun|trg|artifactAll': 'Jedes Artefakt',
  'mods|goldSpeedrun|trg|upgradeAll': 'Jede Aufwertung',
  'mods|goldSpeedrun|trg|allOn': 'Alle an',
  'mods|goldSpeedrun|trg|allOff': 'Alle aus',
  'mods|goldSpeedrun|trg|default': 'Standard',
  'mods|goldSpeedrun|trg|count': '{on} von {total}',
  'mods|goldSpeedrun|trg|filter': 'Filter',
  'mods|goldSpeedrun|trg|hint': 'Jeder Schalter zählt für sich. Die Gruppen in den Mod-Einstellungen sind nur der Ausgangspunkt - was du hier wählst, gilt.',
  'mods|goldSpeedrun|trg|locked': 'Ein Lauf läuft gerade - Änderungen greifen beim nächsten Lauf.',
  'mods|goldSpeedrun|trg|noGoldMarks': 'Keine Gold-Marken - in den Mod-Einstellungen unter Gold-Marken einen Abstand wählen.',
  'mods|goldSpeedrun|btn|on': 'AN',
  'mods|goldSpeedrun|btn|off': 'AUS',

  'mods|goldSpeedrun|cfg|goalGold': 'Eigenes Gold-Ziel',
  'mods|goldSpeedrun|cfg|goalGold|desc': 'Wird nur benutzt, wenn die Kategorie auf Eigenes Gold steht. Jede ganze Zahl ab 1 - praktisch für schnelle Tests.',
  'mods|goldSpeedrun|cfg|artifactTarget': 'Artefakt-Ziel',
  'mods|goldSpeedrun|cfg|artifactTarget|desc': 'Gilt nur für die Artefakt-Kategorie. 0 zählt alle Artefakte, die auf der aktuellen Karte liegen.',
  'mods|goldSpeedrun|cfg|mode': 'Gold-Regelwerk',
  'mods|goldSpeedrun|cfg|mode|desc': 'Normal zählt jedes eingenommene Gold, Ausgeben kostet also keinen Fortschritt. Hard Mode geht nach dem aktuellen Kontostand: Forschen wirft zurück. Offizielles Regelwerk ist Hard Mode samt den übrigen offiziellen Vorgaben - der Timer startet dann bei jeder Aktion inklusive Bewegung, und der automatische Tutorial-Skip bleibt aus, egal was in diesen beiden Optionen steht.',
  'mods|goldSpeedrun|cfg|mode|earned': 'Normal',
  'mods|goldSpeedrun|cfg|mode|balance': 'Hard Mode',
  'mods|goldSpeedrun|cfg|mode|official': 'Offizielles Regelwerk (Hard Mode)',
  'mods|goldSpeedrun|modeNormal': 'Normal',
  'mods|goldSpeedrun|modeHard': 'Hard Mode',
  'mods|goldSpeedrun|rules|forced': 'gesetzt durch "Offizielles Regelwerk"',
  'mods|goldSpeedrun|cfg|enabled': 'Mod aktiviert',
  'mods|goldSpeedrun|cfg|enabled|desc': 'Schaltet den ganzen Mod ab, ohne ihn zu deinstallieren: kein Timer, keine Einblendung, keine Splits, keine automatischen Skips. Ein bereits laufender Lauf zählt seine offizielle Echtzeit im Hintergrund weiter, solange dies aus ist - das Umschalten lässt sich also nicht zum Anhalten eines Laufs missbrauchen.',
  'mods|goldSpeedrun|cfg|preset': 'Kategorie',
  'mods|goldSpeedrun|cfg|preset|desc': 'Ein gängiges Ziel wählen, oder Eigenes Gold und den Wert unten selbst setzen.',
  'mods|goldSpeedrun|cfg|preset|100k': '100k Gold %',
  'mods|goldSpeedrun|cfg|preset|500k': '500k Gold %',
  'mods|goldSpeedrun|cfg|preset|1m': '1M Gold %',
  'mods|goldSpeedrun|cfg|preset|artifacts': 'Alle Artefakte %',
  'mods|goldSpeedrun|cfg|preset|factory6': 'Fabrikrang 6',
  'mods|goldSpeedrun|cfg|preset|factory7': 'Fabrikrang 7 (max)',
  'mods|goldSpeedrun|cfg|preset|custom': 'Eigenes Gold',
  'mods|goldSpeedrun|cfg|startMode': 'Was den Timer startet',
  'mods|goldSpeedrun|cfg|startMode|desc': 'Mausdruck ist die Speedrun-Einstellung: die Uhr startet in dem Moment, in dem du gräbst, greifst, baust oder forschst. Herumlaufen ist frei, und was ohne deinen Klick weiterläuft - eine Grabdrohne, ein Förderband - startet sie ebenfalls nicht.',
  'mods|goldSpeedrun|cfg|startMode|mouse': 'Nur Mausdruck',
  'mods|goldSpeedrun|cfg|startMode|click': 'Mausdruck oder jeder Fortschritt',
  'mods|goldSpeedrun|cfg|startMode|any': 'Jede Aktion, auch Bewegung',
  'mods|goldSpeedrun|cfg|startMode|move': 'Nur Bewegung',
  'mods|goldSpeedrun|cfg|clockMode': 'Große Uhr',
  'mods|goldSpeedrun|cfg|clockMode|desc': 'Alle drei Zeiten werden immer gemessen und immer gezeigt - das hier entscheidet nur, welche groß auf dem Timer steht, die anderen beiden stehen darunter. Die Echtzeit (R) ist die offizielle Wertung: die Zahl, die auch eine Stoppuhr neben dem Bildschirm zeigt, und die einzige, die sich an einem Video nachprüfen lässt. Die Simulationszeit (T) zählt die Schritte, die die Welt tatsächlich gelaufen ist, geteilt durch 60 - damit bleibt ein Lauf auf einem Rechner, der keine 60 UPS hält, mit einem vergleichbar, der sie hält, gibt auf schwacher Hardware aber auch mehr reale Bedenkzeit je Weltschritt. Die Spielzeit-Uhr (W) ist die eigene Uhr des Spielstands.',
  'mods|goldSpeedrun|cfg|clockMode|real': 'Echtzeit (R)',
  'mods|goldSpeedrun|cfg|clockMode|sim': 'Simulationszeit (T)',
  'mods|goldSpeedrun|cfg|clockMode|play': 'Spielzeit-Uhr (W)',
  'mods|goldSpeedrun|cfg|timeFormat': 'Genauigkeit der Uhr',
  'mods|goldSpeedrun|cfg|timeFormat|seconds': 'Sekunden (00:00:00)',
  'mods|goldSpeedrun|cfg|timeFormat|centis': 'Hundertstel (00:00:00.00)',
  'mods|goldSpeedrun|cfg|timeFormat|millis': 'Millisekunden (00:00:00.000)',
  'mods|goldSpeedrun|cfg|skipIntro': 'Intro und Landeanflug überspringen',
  'mods|goldSpeedrun|cfg|skipIntro|desc': 'Springt bei einem neuen Spiel direkt in die Welt, genau wie der Knopf "Skip Intro" im Spiel. Die Uhr bleibt unberührt: der übersprungene Landeanflug kann sie nicht starten.',
  'mods|goldSpeedrun|cfg|skipStory': 'Story-Textboxen wegblenden',
  'mods|goldSpeedrun|cfg|skipStory|desc': 'Schließt die Story-Einblendungen, sobald sie auftauchen - dasselbe wie Wegklicken, die Story zählt sie also weiter als gesehen. Solange eine im Bild ist, kann der Timer nicht starten.',
  'mods|goldSpeedrun|cfg|skipTutorial': 'Tutorial automatisch überspringen',
  'mods|goldSpeedrun|cfg|skipTutorial|desc': 'Beendet das Tutorial beim Laden eines Spielstands, genau wie der Knopf im Spiel. Passiert nur, solange der Timer noch wartet - nie mitten im Lauf.',
  'mods|goldSpeedrun|cfg|showOverlay': 'Timer einblenden',
  'mods|goldSpeedrun|cfg|showSplits': 'Split-Tabelle zeigen',
  'mods|goldSpeedrun|cfg|showSplits|desc': 'Listet die letzten Auslöser unter der Uhr mit Zeit und dem LiveSplit-Delta zur Bestzeit. Die vollständige Tabelle erscheint am Ende im Ergebnisfenster.',
  'mods|goldSpeedrun|cfg|hudSplitRows': 'Splits am Timer',
  'mods|goldSpeedrun|cfg|hudSplitRows|desc': 'Wie viele Split-Zeilen der Timer gleichzeitig zeigt. Die letzten erledigten bleiben stehen, der Rest blickt auf die kommenden Marken. Standard ist 6.',
  'mods|goldSpeedrun|cfg|hudLayout': 'Anordnung des Timers',
  'mods|goldSpeedrun|cfg|hudLayout|desc': 'Waagerecht stellt Splits, Uhren und die UPS-Grafik nebeneinander, damit der Kasten weniger hoch wird. Senkrecht ist der alte Stapel.',
  'mods|goldSpeedrun|cfg|hudLayout|horizontal': 'Waagerecht (kompakt)',
  'mods|goldSpeedrun|cfg|hudLayout|vertical': 'Senkrecht',
  'mods|goldSpeedrun|cfg|corner': 'Position des Timers',
  'mods|goldSpeedrun|cfg|corner|topCenter': 'Oben mittig',
  'mods|goldSpeedrun|cfg|corner|topLeft': 'Oben links',
  'mods|goldSpeedrun|cfg|corner|topRight': 'Oben rechts',
  'mods|goldSpeedrun|cfg|corner|bottomLeft': 'Unten links',
  'mods|goldSpeedrun|cfg|corner|bottomRight': 'Unten rechts',

  'mods|goldSpeedrun|cfg|splitTech': 'Split bei jeder Forschung',
  'mods|goldSpeedrun|cfg|splitTech|desc': 'Jede freigeschaltete Technologie wird zur Zwischenzeit, benannt nach der Forschung.',
  'mods|goldSpeedrun|cfg|splitRank': 'Split bei jedem Fabrikrang',
  'mods|goldSpeedrun|cfg|splitRank|desc': 'Jeder Fabrikrang wird zur Zwischenzeit - das sind die Stufenziele des Grundspiels.',
  'mods|goldSpeedrun|cfg|splitArtifact': 'Split bei jedem Artefakt',
  'mods|goldSpeedrun|cfg|splitUpgrade': 'Split bei jeder Aufwertung',
  'mods|goldSpeedrun|cfg|splitGold': 'Gold-Marken',
  'mods|goldSpeedrun|cfg|splitGold|desc': 'Zwischenzeiten bei einem Anteil des Kategorieziels oder in festen Gold-Schritten.',
  'mods|goldSpeedrun|cfg|splitGold|off': 'Aus',
  'mods|goldSpeedrun|cfg|splitGold|quarters': '25 / 50 / 75 % des Ziels',
  'mods|goldSpeedrun|cfg|splitGold|tenths': 'Alle 10 % des Ziels',
  'mods|goldSpeedrun|cfg|splitGold|10k': 'Alle 10k Gold',
  'mods|goldSpeedrun|cfg|splitGold|100k': 'Alle 100k Gold',

  // DE: Offizielles Regelwerk / EN: Official ruleset
  'mods|goldSpeedrun|rules|badge': 'OFFIZIELLES REGELWERK',
  'mods|goldSpeedrun|rules|custom': 'Eigene Regeln',
  'mods|goldSpeedrun|rules|title': 'Offizielles Speedrun-Regelwerk',
  'mods|goldSpeedrun|rules|ok': 'Alle Einstellungen entsprechen dem offiziellen Regelwerk.',
  'mods|goldSpeedrun|rules|bad': 'Diese Einstellungen weichen vom offiziellen Regelwerk ab:',
  'mods|goldSpeedrun|rules|need': 'nötig: {value}',
  'mods|goldSpeedrun|rules|broken': 'REGELWERK VERSTELLT',
  'mods|goldSpeedrun|rules|brokenDesc': 'Während des laufenden Laufs wurde eine Einstellung des offiziellen Regelwerks geändert. Der Lauf gilt nicht mehr als offiziell und wird nicht als Bestzeit gespeichert.',
  'mods|goldSpeedrun|rules|locked': 'festgehalten beim Start des Laufs',
  'mods|goldSpeedrun|rules|mods': 'Andere Mods aktiv',
  'mods|goldSpeedrun|rules|modsNone': 'keine',
  'mods|goldSpeedrun|cfg|showRuleset': 'Regelwerk-Abzeichen zeigen',
  'mods|goldSpeedrun|cfg|showRuleset|desc': 'Zeigt am Timer und im Ergebnisfenster, ob die Einstellungen dem offiziellen Regelwerk entsprechen: Start durch jede Aktion inklusive Bewegung, Gold-Regelwerk Hard Mode, Tutorial-Skip aus, und kein anderer Mod aktiv.',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics': 'Erweiterte Messwerte zeigen',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics|desc': 'Zeigt zusätzlich die rohe Schrittzahl, die mittleren UPS, die Schritte, die eine perfekte 60-UPS-Maschine inzwischen gelaufen wäre, den Denk-Faktor (wie viele reale Sekunden jede simulierte Sekunde kostete) und den Abstand zwischen Spielzeit-Uhr und Echtzeit.',
  'mods|goldSpeedrun|cfg|trackUpsHistory': 'UPS-Verlauf aufzeichnen',
  'mods|goldSpeedrun|cfg|trackUpsHistory|desc': 'Hält eine Min/Max/Mittel-Grafik der UPS des ganzen Laufs für das Ergebnisfenster fest, einmal pro Sekunde abgetastet und im Spielstand gespeichert. Standardmäßig aus - ein sehr langer Lauf legt dadurch etwas mehr Spielstanddaten an.',
  'mods|goldSpeedrun|cfg|showLiveSparkline': 'Live-UPS-Grafik zeigen',
  'mods|goldSpeedrun|cfg|showLiveSparkline|desc': 'Zeigt eine kleine Live-Grafik der letzten 60 Sekunden UPS unter dem Timer. Wird nur im Hauptthread abgetastet - keine messbaren Kosten für die Simulation.',

});

const t = (key, params) => api.i18n.t(key, params);

// --- DE: Kategorien / EN: Categories ----------------------------------------
// DE: kind bestimmt, was gemessen wird; target ist das feste Ziel der Kategorie.
// DE: Kategorien ohne target holen ihn aus den Einstellungen bzw. aus der Karte.
//
// EN: kind decides what's measured; target is the category's fixed goal.
// EN: Categories without a target get it from the settings or from the map.
const CATEGORIES = {
  '100000': { kind: 'gold', target: 100000 },
  '500000': { kind: 'gold', target: 500000 },
  '1000000': { kind: 'gold', target: 1000000 },
  artifacts: { kind: 'artifacts' },
  factory6: { kind: 'factory', target: 6 },
  factory7: { kind: 'factory', target: 7 },
  custom: { kind: 'gold' },
};

const MAX_FACTORY_LEVEL = 7;

// DE/EN: 100000 -> "100k", 1000000 -> "1M"
const shortGold = n => {
  if (n >= 1000000) {
    const m = n / 1000000;
    return (Number.isInteger(m) ? m : m.toFixed(1)) + 'M';
  }
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k';
  }
  return String(n);
};

// DE: Die Zahl der Artefakte haengt an der Karte: die meisten liegen in Prefabs,
// DE: der Rest steckt als Sensor im Gelaende. Beide Quellen liefert das Spiel erst
// DE: nach dem Laden, deshalb wird der Wert einmal pro Spielstand gemerkt.
//
// EN: The number of artifacts depends on the map: most sit in prefabs, the
// EN: rest are sensors placed in the terrain. The game only provides both
// EN: sources after loading, so the value is cached once per save.
let artifactTotalCache = null;

const detectArtifactTotal = () => {
  let total = 0;

  try {
    const pd = sandkit.engine && sandkit.engine.api && sandkit.engine.api.prefabData;
    if (pd && typeof pd.getArtifactLocations === 'function') {
      const list = pd.getArtifactLocations();
      if (Array.isArray(list)) total += list.length;
    }
  } catch (e) { /* DE: Karte ohne Prefab-Daten / EN: map has no prefab data */ }

  try {
    const sensors = sandkit.state.store.world.sensors;
    if (Array.isArray(sensors)) total += sensors.length;
  } catch (e) { /* DE: keine Sensoren im Spielstand / EN: no sensors in this save */ }

  return total;
};

const artifactTotal = () => {
  const override = api.settings.get('artifactTarget');
  if (Number.isFinite(override) && override > 0) return Math.floor(override);
  if (artifactTotalCache === null) artifactTotalCache = detectArtifactTotal();
  // DE: Liefert die Karte nichts, waere 0 sofort "geschafft" - dann lieber warten,
  // DE: bis der Wert von Hand gesetzt ist, und den Zaehler offen lassen.
  // EN: If the map yields nothing, 0 would count as "done" instantly - better to
  // EN: wait until the value is set by hand, and leave the counter open instead.
  return artifactTotalCache > 0 ? artifactTotalCache : 0;
};

const category = () => {
  const id = api.settings.get('goalPreset') || '100000';
  const def = CATEGORIES[id] || CATEGORIES['100000'];

  if (def.kind === 'gold') {
    let target = def.target;
    if (!Number.isFinite(target)) {
      const v = api.settings.get('goalGold');
      target = Number.isFinite(v) && v > 0 ? v : 100000;
    }
    return { id, kind: 'gold', target };
  }
  if (def.kind === 'artifacts') return { id, kind: 'artifacts', target: artifactTotal() };
  return { id, kind: 'factory', target: def.target };
};

// --- DE: Messwerte / EN: Measured values ------------------------------------
const getGold = () => {
  const st = sandkit.state;
  const g = st && st.store && st.store.resources ? st.store.resources.gold : 0;
  return Number.isFinite(g) ? g : 0;
};

const getArtifactsFound = () => {
  try {
    const a = sandkit.state.store.resources.artifacts;
    if (Number.isFinite(a)) return a;             // DE: sehr alte Spielstaende / EN: very old save files
    return Number.isFinite(a && a.found) ? a.found : 0;
  } catch (e) {
    return 0;
  }
};

// DE: Der wirksame Rang - die Story kann ihn zeitweise deckeln.
// EN: The effective rank - the story can temporarily cap it.
const getFactoryLevel = () => {
  try {
    const lvl = sandkit.engine.api.factory.getLevel(sandkit.state);
    if (Number.isFinite(lvl)) return lvl;
  } catch (e) { /* DE: interne API nicht verfuegbar / EN: internal API not available */ }
  try {
    const v = sandkit.state.store.viability;
    return Number.isFinite(v && v.level) ? v.level : 1;
  } catch (e) {
    return 1;
  }
};

// --- DE: Verdientes Gold / EN: Gold earned ----------------------------------
// DE: Zwei Messweisen sind moeglich:
//   'balance' - der aktuelle Kontostand. Ausgeben setzt den Fortschritt zurueck.
//   'earned'  - alles, was seit Laufbeginn eingenommen wurde. Ausgeben kostet
//               keinen Fortschritt.
//
// DE: Fuer 'earned' fuehrt der Mod selbst Buch: er vergleicht den Goldstand mit dem
// DE: vorigen Wert und addiert nur die Zugewinne. Bewusst nicht ueber das interne
// DE: viability.goldSpent des Spiels - das wird beim Laden aus Tech-Kosten
// DE: rekonstruiert und ist keine verlaessliche Laufzeit-Summe.
//
// EN: Two ways to measure it:
//   'balance' - the current account balance. Spending sets progress back.
//   'earned'  - everything taken in since the run started. Spending costs
//               no progress.
//
// EN: For 'earned' the mod keeps its own ledger: it compares the gold value
// EN: to the previous one and only adds the gains. Deliberately not via the
// EN: game's internal viability.goldSpent - that gets reconstructed from tech
// EN: costs on load and is not a reliable running total.
let earnedTotal = null;   // DE: Laufsumme im Speicher / EN: running total, in memory
let lastBalance = null;

// DE: Die dritte Wahl beim Gold-Regelwerk stellt den ganzen offiziellen Lauf ein,
// DE: nicht nur das Gold: sie zieht auch den Startmodus und den Tutorial-Skip auf
// DE: die Vorgabe. Die beiden Optionen bleiben stehen, wie sie sind - sie werden
// DE: nur nicht mehr gefragt, solange die offizielle Wahl aktiv ist.
// EN: The third choice in the gold ruleset sets up the whole official run, not
// EN: just gold: it also pulls the start mode and the tutorial skip to the
// EN: required values. Those two options stay as they are - they just stop
// EN: being consulted while the official choice is active.
const officialMode = () => api.settings.get('goldMode') === 'official';

const goldMode = () => {
  const v = api.settings.get('goldMode');
  return v === 'balance' || v === 'official' ? 'balance' : 'earned';
};

// DE: Ueberall statt api.settings.get('skipTutorial') benutzen: im offiziellen
// DE: Regelwerk laeuft das Tutorial mit, auch wenn der Schalter an ist.
// EN: Use this everywhere instead of api.settings.get('skipTutorial'): under
// EN: the official ruleset the tutorial still plays out, even if the switch is on.
const skipTutorialEnabled = () =>
  !officialMode() && api.settings.get('skipTutorial') === true;

// DE: Was das offizielle Regelwerk den uebrigen Optionen vorschreibt. Die drei
// DE: Vorgaben der Kategorieregeln stehen oben; Intro und Story kommen dazu,
// DE: damit der Spielanfang ablaeuft wie ohne Mod - sonst faengt der Lauf mit
// DE: einer uebersprungenen Sequenz an, die alle anderen mitspielen.
// EN: What the official ruleset dictates for the remaining options. The three
// EN: category-rule requirements are above; intro and story are added here so
// EN: the start of the game plays out just like without the mod - otherwise
// EN: the run would start with a skipped sequence that everyone else plays.
const OFFICIAL_FORCED = {
  startMode: 'any',
  skipTutorial: false,
  skipIntro: false,
  skipStory: false,
};

// DE: Die Werte, die vor dem Umschalten galten - damit das Zurueckschalten die
// DE: eigenen Einstellungen nicht dauerhaft verbrannt hat.
// EN: The values that were in effect before switching over - so switching
// EN: back doesn't permanently burn the player's own settings.
const OFFICIAL_BACKUP = 'goldSpeedrun.beforeOfficial';

// DE: api.settings kann nur lesen. Geschrieben wird deshalb direkt in den Topf,
// DE: aus dem es liest: state.session.settings.externalModSettings[<mod>]. Das
// DE: Spiel prueft die Werte beim naechsten Lesen gegen configSchema, ungueltiges
// DE: kaeme also gar nicht erst an.
// EN: api.settings can only read. Writes therefore go straight into the pot it
// EN: reads from: state.session.settings.externalModSettings[<mod>]. The game
// EN: validates the values against configSchema on the next read, so an
// EN: invalid value would never even get through.
const settingsBag = () => {
  const session = sandkit.state && sandkit.state.session;
  const root = session && session.settings;
  if (!root) return null;
  let all = root.externalModSettings;
  if (!all || typeof all !== 'object' || Array.isArray(all)) {
    all = {};
    root.externalModSettings = all;
  }
  let mine = all[MOD_ID];
  if (!mine || typeof mine !== 'object' || Array.isArray(mine)) {
    mine = {};
    all[MOD_ID] = mine;
  }
  return mine;
};

// DE: Schreibt einen Wert und meldet, ob er auch angekommen ist. Faellt der
// DE: Weg irgendwann weg, bleibt es bei den Ueberschreibungen beim Lesen - der
// DE: Lauf ist also auch dann korrekt, nur die Anzeige haengt hinterher.
// EN: Writes a value and reports whether it actually landed. If this route
// EN: ever breaks, the read-time overrides still apply - the run stays
// EN: correct, only the display lags behind.
const writeSetting = (key, value) => {
  const bag = settingsBag();
  if (!bag) return false;
  if (bag[key] === value) return true;
  try {
    bag[key] = value;
  } catch (e) {
    log('Einstellung nicht schreibbar:', key, e);
    return false;
  }
  return bag[key] === value;
};

// DE: Haelt die Anzeige der Einstellungen mit dem tatsaechlichen Zustand gleich:
// DE: solange das offizielle Regelwerk gewaehlt ist, stehen die beiden anderen
// DE: Optionen auf der Vorgabe und springen sofort zurueck, wenn jemand sie
// DE: verstellt. Beim Verlassen kommen die alten Werte zurueck.
// EN: Keeps the settings display in sync with the actual state: as long as the
// EN: official ruleset is selected, the other two options sit on the required
// EN: value and snap straight back if anyone changes them. Leaving it restores
// EN: the old values.
const syncOfficialSettings = () => {
  let changed = false;
  const backup = api.storage.local.get(OFFICIAL_BACKUP);
  const hasBackup = backup && typeof backup === 'object';

  if (officialMode()) {
    // DE: Fehlt die Sicherung ganz, oder kamen dem Regelwerk seit dem letzten
    // DE: Umschalten Schluessel dazu, wird sie erst vervollstaendigt - danach
    // DE: erst wird ueberschrieben, sonst sichert man den erzwungenen Wert.
    // EN: If the backup is missing entirely, or the ruleset gained keys since
    // EN: the last switch-over, it gets completed first - only then does the
    // EN: overwrite happen, otherwise the forced value would get backed up.
    const before = hasBackup ? Object.assign({}, backup) : {};
    let backupChanged = !hasBackup;
    for (const key of Object.keys(OFFICIAL_FORCED)) {
      if (before[key] !== undefined) continue;
      before[key] = api.settings.get(key);
      backupChanged = true;
    }
    if (backupChanged) api.storage.local.set(OFFICIAL_BACKUP, before);
    for (const key of Object.keys(OFFICIAL_FORCED)) {
      if (api.settings.get(key) === OFFICIAL_FORCED[key]) continue;
      if (writeSetting(key, OFFICIAL_FORCED[key])) changed = true;
    }
    if (changed) log('Offizielles Regelwerk: Einstellungen auf die Vorgabe gesetzt', OFFICIAL_FORCED);
    return changed;
  }

  if (hasBackup) {
    api.storage.local.set(OFFICIAL_BACKUP, null);
    for (const key of Object.keys(OFFICIAL_FORCED)) {
      const previous = backup[key];
      if (previous === undefined) continue;
      if (api.settings.get(key) === previous) continue;
      if (writeSetting(key, previous)) changed = true;
    }
    if (changed) log('Offizielles Regelwerk verlassen - vorherige Einstellungen wiederhergestellt');
  }
  return changed;
};

const readEarned = () => {
  const v = api.storage.get(NS, 'earned');
  return Number.isFinite(v) ? v : 0;
};

// DE: Jeden Frame aufgerufen: nur ein Zahlenvergleich, kein Schreibzugriff.
// EN: Called every frame: just a number comparison, no write access.
const sampleEarned = () => {
  const balance = getGold();
  if (earnedTotal === null) {
    earnedTotal = readEarned();
    lastBalance = balance;
    return earnedTotal;
  }
  if (balance > lastBalance) earnedTotal += balance - lastBalance;
  lastBalance = balance;
  return earnedTotal;
};

const resetEarned = () => {
  earnedTotal = 0;
  lastBalance = getGold();
  api.storage.set(NS, 'earned', 0);
};

// DE: Der Goldwert, der in der Split-Tabelle steht - dieselbe Messweise wie das Ziel.
// EN: The gold value shown in the split table - same measurement as the goal.
const goldProgress = () => (goldMode() === 'balance' ? getGold() : sampleEarned());

// DE: Der Wert, gegen den das Ziel der Kategorie geprueft wird.
// EN: The value the category's goal is checked against.
const progressOf = cat => {
  if (cat.kind === 'gold') return goldProgress();
  if (cat.kind === 'artifacts') return getArtifactsFound();
  return getFactoryLevel();
};

// DE: Kategoriename fuer HUD und Stream, z.B. "100k Gold % · Hard Mode · Ohne Tutorial".
// EN: Category name for the HUD and stream, e.g. "100k Gold % · Hard Mode · No Tutorial".
const categoryLabel = () => {
  const cat = category();
  const parts = [];

  if (cat.kind === 'gold') {
    parts.push(`${shortGold(cat.target)} Gold %`);
    parts.push(t(goldMode() === 'balance'
      ? 'mods|goldSpeedrun|modeHard'
      : 'mods|goldSpeedrun|modeNormal'));
  } else if (cat.kind === 'artifacts') {
    parts.push(t('mods|goldSpeedrun|cfg|preset|artifacts'));
  } else {
    parts.push(t(cat.target >= MAX_FACTORY_LEVEL
      ? 'mods|goldSpeedrun|cfg|preset|factory7'
      : 'mods|goldSpeedrun|cfg|preset|factory6'));
  }

  if (skipTutorialEnabled()) {
    parts.push(t('mods|goldSpeedrun|noTutorial'));
  }
  return parts.join(' · ');
};

// DE: Schluessel der Bestzeit: pro Kategorie und Regelwerk getrennt, sonst
// DE: stehen 1M-Zeiten neben 100k-Zeiten.
// DE: Die Bestzeit ist immer die Echtzeit (R) - die einzige, die sich an einem
// DE: Video nachpruefen laesst und deshalb die offizielle Wertung bleibt.
// EN: Best-time key: kept separate per category and ruleset, otherwise 1M
// EN: times would sit next to 100k times.
// EN: The best time is always real time (R) - the only one that can be
// EN: checked against a video, which is why it stays the official scoring.
const bestKey = () => {
  const cat = category();
  const bits = [cat.id, cat.kind === 'gold' ? goldMode() : 'x'];
  if (cat.id === 'custom') bits.push(String(cat.target));
  if (skipTutorialEnabled()) bits.push('notut');
  return `${BEST_PREFIX}.${bits.join('.')}`;
};

const readBest = () => {
  const v = api.storage.local.get(bestKey());
  // DE: 0 ist keine Bestzeit - das war ein Schreibfehler, der jeden echten Lauf
  // DE: als "langsamer als 00:00" verworfen hat.
  // EN: 0 is not a best time - that was a write error that made every real
  // EN: run look slower than 00:00 and so never get stored.
  if (Number.isFinite(v) && v > 0) return v;
  const fromSave = api.storage.get(NS, 'pbTime');
  if (Number.isFinite(fromSave) && fromSave > 0) return fromSave;
  const cat = category();
  if (cat.id === '100000' && goldMode() === 'earned' && !skipTutorialEnabled()) {
    const legacy = api.storage.local.get(LEGACY_BEST_KEY);
    if (Number.isFinite(legacy) && legacy > 0) return legacy;
  }
  return null;
};

const bestSplitsKey = () => bestKey() + '.splits';

const parseSplitList = v => {
  if (Array.isArray(v)) return v.filter(e => e && typeof e === 'object');
  if (typeof v === 'string' && v.charAt(0) === '[') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter(e => e && typeof e === 'object') : [];
    } catch (e) { /* DE: kein JSON / EN: not JSON */ }
  }
  return [];
};

const writeBestTime = time => {
  if (!(time > 0)) return false;
  try { api.storage.local.set(bestKey(), time); } catch (e) { /* DE: kein localStorage / EN: no localStorage */ }
  api.storage.set(NS, 'pbTime', time);
  return true;
};

const writeBestSplits = splits => {
  if (!Array.isArray(splits) || splits.length === 0) return;
  const json = JSON.stringify(splits);
  try { api.storage.local.set(bestSplitsKey(), json); } catch (e) { /* DE: localStorage voll / EN: localStorage full */ }
  api.storage.set(NS, 'pbSplits', splits);
};

const readBestSplits = () => {
  const fromLocal = parseSplitList(api.storage.local.get(bestSplitsKey()));
  if (fromLocal.length > 0) return fromLocal;
  const fromSave = parseSplitList(api.storage.get(NS, 'pbSplits'));
  if (fromSave.length > 0) {
    try { api.storage.local.set(bestSplitsKey(), JSON.stringify(fromSave)); } catch (e) { /* ignore */ }
    return fromSave;
  }
  return [];
};

const maybeBackfillBestSplits = () => {
  if (readBestSplits().length > 0) return;
  const best = readBest();
  if (best === null) return;
  const run = readRun();
  if (typeof run.finishedAt !== 'number') return;
  const splits = readSplits();
  if (splits.length === 0) return;
  const time = elapsed();
  if (!Number.isFinite(time) || Math.abs(time - best) > 50) return;
  writeBestSplits(splits);
};

const maybeAdoptFinishedAsBest = () => {
  try {
    const bogus = api.storage.local.get(bestKey());
    if (bogus === 0) api.storage.local.set(bestKey(), null);
  } catch (e) { /* ignore */ }
  const run = readRun();
  if (typeof run.finishedAt !== 'number') return;
  try {
    if (cheatsUsed() || runRulesBroken()) return;
  } catch (e) { return; }
  const time = Math.max(elapsed(), readClock('upsRms'));
  if (!(time > 0)) return;
  const best = readBest();
  if (best === null || time < best) {
    writeBestTime(time);
    writeBestSplits(readSplits());
    return;
  }
  maybeBackfillBestSplits();
};

const splitIdOf = (kind, id) => (id ? String(id) : '');

const normLabel = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const findPbSplit = (split, pbSplits) => {
  if (!split || !Array.isArray(pbSplits)) return null;
  if (split.id) {
    const byId = pbSplits.find(p => p && p.id === split.id);
    if (byId) return byId;
  }
  const exact = pbSplits.find(p => p && p.kind === split.kind && p.label === split.label);
  if (exact) return exact;
  const want = normLabel(split.label);
  return pbSplits.find(p => p && p.kind === split.kind && normLabel(p.label) === want) || null;
};

// --- DE: Zeitformat / EN: Time format ---------------------------------------
// DE: Spielzeit-Uhr in ms; laeuft nur waehrend das Spiel laeuft und wandert mit
// DE: ins Savegame. Das ist dieselbe Zahl, die auch ohne diesen Mod als playTime
// DE: im Spielstand steht - api.time.getTimeMs() liest direkt store.meta.time.
// EN: Play-clock in ms; only runs while the game is running and travels with
// EN: the save. This is the same number that shows up as playTime in the save
// EN: file even without this mod - api.time.getTimeMs() reads store.meta.time directly.
const now = () => api.time.getTimeMs() || 0;

// DE: Welche der drei Uhren gross im Bild steht. Auf die Wertung hat das keinen
// DE: Einfluss - alle drei werden immer gemessen und immer festgehalten.
// EN: Which of the three clocks stands large on screen. This has no effect on
// EN: the scoring - all three are always measured and always recorded.
const clockMode = () => {
  const v = api.settings.get('clockMode');
  return v === 'sim' || v === 'play' ? v : 'real';
};

const hudLayout = () => api.settings.get('hudLayout') === 'vertical' ? 'vertical' : 'horizontal';

const timeFormat = () => {
  const v = api.settings.get('timeFormat');
  return v === 'seconds' || v === 'centis' || v === 'millis' ? v : 'millis';
};

const pad = (n, w) => String(n).padStart(w, '0');

const formatTime = (ms, fmt) => {
  const total = Math.max(0, Math.floor(ms));
  const hh = Math.floor(total / 3600000);
  const mm = Math.floor((total % 3600000) / 60000);
  const ss = Math.floor((total % 60000) / 1000);
  let out = `${pad(hh, 2)}:${pad(mm, 2)}:${pad(ss, 2)}`;
  if (fmt === 'millis') out += '.' + pad(total % 1000, 3);
  else if (fmt === 'centis') out += '.' + pad(Math.floor((total % 1000) / 10), 2);
  return out;
};

// DE: Kurzform fuer die Tabelle - Stunden nur, wenn es welche gibt.
// EN: Short form for the table - hours only when there are any.
const formatShort = (ms, fmt) => {
  const full = formatTime(ms, fmt);
  return full.startsWith('00:') ? full.slice(3) : full;
};

// DE: Platzhalter in Uhrenlaenge, solange der Lauf noch scharf ist und wartet.
// EN: Placeholder the same length as the clock, while the run is armed and waiting.
const dashTime = fmt => {
  if (fmt === 'millis') return '--:--:--.---';
  if (fmt === 'centis') return '--:--:--.--';
  return '--:--:--';
};

const formatGold = n => api.i18n.formatNumber(Math.floor(n));

// DE: Vorzeichenbehaftete Anzeige fuer Verzoegerung/Rueckstand - negativ heisst
// DE: "hinterher", positiv heisst "kurz aufgeholt".
// EN: Signed display for slowdown/deficit - negative means "behind", positive
// EN: means "briefly caught up".
const fmtSigned = (v, d) => (v >= 0 ? '+' : '') + v.toFixed(d);

// --- DE: Laufzustand (im Savegame) / EN: Run state (in the save file) -------
// { startedAt: number|null, finishedAt: number|null, splits: Split[] }
// Split = { t: R in ms seit Start, sim: T in ms, w: W in ms, kind, label, gold }
const readRun = () => {
  api.storage.ensure(NS);
  return {
    startedAt: api.storage.get(NS, 'startedAt'),
    finishedAt: api.storage.get(NS, 'finishedAt'),
  };
};

const readSplits = () => {
  const v = api.storage.get(NS, 'splits');
  if (!Array.isArray(v)) return [];
  // DE: Laeufe aus 2.0.0 haben nur Zahlen gespeichert; die sind ohne Beschriftung
  // DE: wertlos und werden verworfen, statt die Tabelle kaputt anzuzeigen.
  // EN: Runs from 2.0.0 only stored bare numbers; without a label those are
  // EN: worthless and get discarded, instead of showing a broken table.
  return v.filter(e => e && typeof e === 'object' && Number.isFinite(e.t));
};

// DE: Der Lauf hat drei Zustaende:
//   startedAt == null                  -> scharf, wartet auf die erste Aktion
//   startedAt gesetzt, finishedAt null -> laeuft
//   finishedAt gesetzt                 -> beendet
// EN: The run has three states:
//   startedAt == null                  -> armed, waiting for the first action
//   startedAt set, finishedAt null     -> running
//   finishedAt set                     -> finished
const armRun = () => {
  api.storage.ensure(NS);
  const run = readRun();
  if (typeof run.startedAt !== 'number' && run.finishedAt !== null) {
    api.storage.set(NS, 'finishedAt', null);
  }
};

const isArmed = () => {
  const run = readRun();
  return typeof run.startedAt !== 'number' && typeof run.finishedAt !== 'number';
};

const isRunning = () => {
  const run = readRun();
  return typeof run.startedAt === 'number' && typeof run.finishedAt !== 'number';
};

// --- DE: Die drei Uhren: U, R, W / EN: The three clocks: U, R, W -----------
// DE:
// U  Ausgefuehrte Simulationsschritte seit Laufbeginn. Kommt roh aus dem
//    Simulations-Thread: worker.js schreibt dort bei jedem Schritt den
//    absoluten Stand von store.meta.tick in einen gemeinsamen Speicher, den
//    dieser Thread hier mitliest. Kein eigener Zaehler, keine Schaetzung -
//    faellt ein Schritt aus oder laeuft er doppelt, steht trotzdem die
//    richtige Zahl im Puffer.
//
// R  Echtzeit aus performance.now(), ohne Deckel, akkumuliert nur waehrend
//    der Lauf tatsaechlich unterwegs ist (Spiel laeuft, nicht pausiert). Das
//    ist die Zahl, die auch eine Stoppuhr neben dem Bildschirm zeigt, und sie
//    bleibt die offizielle Wertung: nur sie laesst sich an einem Video
//    nachpruefen. R haengt nie an der Fabrik - sie ist eine reine
//    Betriebssystem-Uhr. Was die Fabrik kostet, zeigt sich als Abstand
//    zwischen R und T, nicht an R selbst.
//
// W  api.time.getTimeMs() - die eigene Spielzeit-Uhr des Spiels, identisch
//    mit der playTime, die auch ohne diesen Mod im Spielstand steht. Sie
//    summiert Frame-Abstaende, deckelt aber jeden auf 50 ms:
//
//        let r = t - session.timestep.lastTime;
//        r > 50 && (r = 50);
//        store.meta.time += r;
//
//    Unterhalb von 20 FPS verfaellt alles ueber 50 ms pro Frame, W haengt
//    dann hinter R zurueck. W laeuft nur mit, um mit dem Spielstand und
//    frueheren Laeufen vergleichbar zu bleiben - nicht als Wertungsgrundlage.
//
// T  = U / 60, in Millisekunden also U * (1000/60) - keine eigene Messung,
//    sondern die Simulationszeit, die aus U folgt: "wie viel Welt
//    tatsaechlich passiert ist". T zaehlt nur ausgefuehrte Schritte - auf
//    einem langsamen Rechner gibt es dafuer mehr reale Bedenkzeit je
//    Weltschritt, T ist also kein Mass fuer "gleich gespielt", nur fuer
//    "gleich viel simuliert".
//
// EN:
// U  Executed simulation steps since the run started. Comes raw from the
//    simulation thread: worker.js writes the absolute value of
//    store.meta.tick into a shared buffer on every step, which this thread
//    reads back. No counter of its own, no estimate - if a step gets
//    skipped or double-counted, the buffer still holds the correct number.
//
// R  Real time from performance.now(), uncapped, only accumulated while the
//    run is actually under way (game running, not paused). This is the
//    number a stopwatch next to the screen would also show, and it stays
//    the official scoring: it's the only one that can be checked against a
//    video. R never depends on the factory - it is a pure operating-system
//    clock. What the factory costs shows up as the gap between R and T, not
//    in R itself.
//
// W  api.time.getTimeMs() - the game's own play-clock, identical to the
//    playTime shown in the save file even without this mod. It sums frame
//    deltas, but caps each one at 50 ms:
//
//        let r = t - session.timestep.lastTime;
//        r > 50 && (r = 50);
//        store.meta.time += r;
//
//    Below 20 FPS, everything above 50 ms per frame is lost, and W then
//    falls behind R. W only tags along to stay comparable with the save
//    file and earlier runs - not as a basis for scoring.
//
// T  = U / 60, in milliseconds that's U * (1000/60) - not its own
//    measurement, but the simulation time that follows from U: "how much
//    world actually happened". T only counts executed steps - on a slow
//    machine that means more real thinking time per world-tick, so T is not
//    a measure of "played the same", only of "simulated the same amount".

const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;

const TICK_BUF_KEY = 'goldSpeedrunTicks';
const TICK_BUF_SPEC = { type: 'int32', length: 1 };

let tickBuf = null;
try {
  tickBuf = api.shared.buffers.create(TICK_BUF_KEY, TICK_BUF_SPEC);
} catch (e) {
  tickBuf = null;
  log('Schritt-Speicher nicht verfuegbar -', (e && e.message) || e);
}
// DE: Schaltet das 'update:post'-Ereignis im Simulations-Thread ein, auf das
// DE: worker.js sich einhaengt - ohne das bleibt der Puffer leer.
// EN: Enables the 'update:post' event in the simulation thread, which
// EN: worker.js hooks into - without this, the buffer stays empty.
try { api.workers.setPostUpdateEnabled(true); } catch (e) { /* DE: aeltere Version / EN: older game version */ }

// DE: Roher, absoluter Schrittzaehler der Simulation - 0, solange worker.js noch
// DE: nichts geschrieben hat (neue Welten fangen bei 1 an, 0 ist also eindeutig
// DE: "noch nichts gehoert").
// EN: Raw, absolute step counter of the simulation - 0 as long as worker.js
// EN: hasn't written anything yet (new worlds start at 1, so 0 unambiguously
// EN: means "nothing heard from yet").
const rawTick = () => {
  try {
    return (tickBuf && Atomics.load(tickBuf, 0)) || 0;
  } catch (e) {
    return 0;
  }
};

const rawTickSourceReady = () => tickBuf !== null && rawTick() > 0;

// DE: Wie rawTickSourceReady(), aber eingefroren, sobald der Lauf beendet ist -
// DE: sonst koennte ein voellig unbeteiligter, spaeter geladener Spielstand die
// DE: Anzeige eines laengst abgeschlossenen Laufs nachtraeglich umschalten.
// EN: Same as rawTickSourceReady(), but frozen once the run has finished -
// EN: otherwise a completely unrelated save loaded later could retroactively
// EN: flip the display of a run that finished long ago.
const tickSourceReady = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return rawTickSourceReady();
  if (typeof run.finishedAt === 'number') return api.storage.get(NS, 'upsTickReady') === true;
  return rawTickSourceReady();
};

const gamePaused = () => {
  try {
    return sandkit.state.session.paused === true;
  } catch (e) {
    return false;
  }
};

let rMs = 0;           // DE: aufsummierte Echtzeit seit Laufstart (persistiert) / EN: accumulated real time since run start (persisted)
let wMs = 0;           // DE: aufsummierte Spielzeit / EN: accumulated play time
let uTicks = 0;        // DE: aufsummierte Weltschritte / EN: accumulated world ticks
let lastPerf = null;   // DE: performance.now() beim letzten advanceClocks() / EN: performance.now() at the last advanceClocks()
let lastPlay = null;   // DE: now() beim letzten advanceClocks() / EN: now() at the last advanceClocks()
let lastTick = null;   // DE: rawTick() beim letzten advanceClocks() / EN: rawTick() at the last advanceClocks()
let justStarted = false; // DE: Verhindert Hot-Reload Erkennung im Start-Frame / EN: Prevents hot-reload detection on start frame

const readClock = key => {
  const v = api.storage.get(NS, key);
  return Number.isFinite(v) ? v : 0;
};

const startClocks = () => {
  rMs = 0;
  wMs = 0;
  uTicks = 0;
  lastPerf = performance.now();
  lastPlay = now();
  lastTick = rawTick();
  justStarted = true;
  api.storage.set(NS, 'upsRms', 0);
  api.storage.set(NS, 'upsWElapsed', 0);
  api.storage.set(NS, 'upsUElapsed', 0);
  api.storage.set(NS, 'upsSlowdown', 0);
  api.storage.set(NS, 'upsDeficit', 0);
};

// DE: Nach dem Laden genau die gespeicherten Werte weiterzaehlen.
// EN: After a load, continue exactly from the saved values.
const resumeClocks = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') {
    rMs = 0; wMs = 0; uTicks = 0; 
    lastPerf = null; lastPlay = null; lastTick = null;
    return;
  }
  rMs = readClock('upsRms');
  wMs = readClock('upsWElapsed');
  uTicks = readClock('upsUElapsed');
  lastPerf = performance.now();
  lastPlay = null;
  lastTick = null;
};

// DE: Sandustry feuert game:ready nicht bei einem Hot-Reload (Laden im laufenden Spiel).
// DE: Wir erkennen einen Hot-Reload daran, dass der Spielstand ploetzlich eine voellig
// DE: andere Echtzeit (R) enthaelt als wir im Speicher haben.
// EN: Sandustry does not fire game:ready on a hot-reload (loading while in-game).
// EN: We detect a hot-reload by noticing that the save file suddenly contains a
// EN: completely different real time (R) than we have in memory.
const detectHotReload = () => {
  if (justStarted) {
    justStarted = false;
    return false;
  }
  const run = readRun();
  if (typeof run.startedAt !== 'number') return false;
  const savedRms = readClock('upsRms');
  if (Math.abs(savedRms - rMs) > 1000) {
    resumeClocks();
    return true;
  }
  return false;
};

const advanceClocks = () => {
  if (detectHotReload()) return;

  const stamp = performance.now();
  const prevPerf = lastPerf;
  lastPerf = stamp;

  const playStamp = now();
  const prevPlay = lastPlay;
  lastPlay = playStamp;

  const tickStamp = rawTick();
  const prevTick = lastTick;
  lastTick = tickStamp;

  if (prevPerf === null) return;
  if (!isRunning()) return;
  if (gamePaused()) return;

  let changed = false;

  const dt = stamp - prevPerf;
  if (dt > 0 && dt <= 3600000) {
    rMs += dt;
    api.storage.set(NS, 'upsRms', rMs);
    changed = true;
  }

  if (prevPlay !== null) {
    const playDt = playStamp - prevPlay;
    if (playDt > 0 && playDt <= 3600000) {
      wMs += playDt;
      api.storage.set(NS, 'upsWElapsed', wMs);
      changed = true;
    }
  }

  if (prevTick !== null && rawTickSourceReady()) {
    const tickDt = tickStamp - prevTick;
    if (tickDt > 0 && tickDt <= 3600000) {
      uTicks += tickDt;
      api.storage.set(NS, 'upsUElapsed', uTicks);
      changed = true;
    }
  }

  if (changed && rMs >= 1000) {
    const uNow = liveU();
    api.storage.set(NS, 'upsSlowdown', (uNow * TICK_MS / rMs - 1) * 100);
    api.storage.set(NS, 'upsDeficit', (rMs / 1000) * TICK_HZ - uNow);
  }
};

const liveU = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  if (typeof run.finishedAt === 'number') return Math.max(0, readClock('upsUFinal'));
  return uTicks;
};

// DE: R - Echtzeit des Laufs in ms. Die offizielle Wertung.
// EN: R - real time of the run in ms. The official scoring.
const elapsed = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  return rMs;
};

// DE: T - Simulationszeit des Laufs in ms, aus U abgeleitet.
// EN: T - simulation time of the run in ms, derived from U.
const elapsedSim = () => liveU() * TICK_MS;

// DE: W - Spielzeit-Uhr des Laufs in ms (api.time.getTimeMs(), gedeckelt s.o.).
// DE: Genau wie liveU() eingefroren, sobald der Lauf beendet ist.
// EN: W - play-clock of the run in ms (api.time.getTimeMs(), capped as above).
// EN: Frozen exactly like liveU() once the run has finished.
const elapsedPlay = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  if (typeof run.finishedAt === 'number') return Math.max(0, readClock('upsWFinal'));
  return wMs;
};

// DE: Verzoegerung in Prozent: wie weit T von R abweicht. Negativ heisst "die
// DE: Welt ist hinterher" (der uebliche Fall), ein kleiner positiver Ausschlag
// DE: heisst "die Simulation hat kurz aufgeholt" (moeglich, wenn sie
// DE: zwischenzeitlich schneller als 60 UPS lief). Etwas Jitter um 0 ist normal;
// DE: erst ein dauerhafter Ausschlag ins Negative bedeutet echten Rueckstand.
// EN: Slowdown in percent: how far T deviates from R. Negative means "the
// EN: world is behind" (the usual case), a small positive swing means "the
// EN: simulation briefly caught up" (possible if it ran faster than 60 UPS
// EN: for a while). A bit of jitter around 0 is normal; only a sustained
// EN: swing into negative means a real slowdown.
const slowdownPercent = () => {
  const r = elapsed();
  const saved = readClock('upsSlowdown');
  if (r < 1000) return saved;
  const live = (elapsedSim() / r - 1) * 100;
  return live;
};

// DE: Schritte, die eine ideale 60-UPS-Maschine in der bisherigen Echtzeit
// DE: gelaufen waere.
// EN: The number of steps a perfect 60-UPS machine would have run in the
// EN: real time elapsed so far.
const idealTicks = () => (elapsed() / 1000) * TICK_HZ;

// DE: Schritt-Rueckstand: positiv heisst "so viele Schritte fehlen noch zum
// DE: Ideal", negativ heisst "die Simulation liegt vorn" (Aufholphase).
// EN: Tick deficit: positive means "this many steps are still missing to
// EN: reach the ideal", negative means "the simulation is ahead" (a catch-up phase).
const tickDeficit = () => {
  return idealTicks() - liveU();
};
const tickDeficitMs = () => tickDeficit() * TICK_MS;

const avgUps = () => {
  const rSec = elapsed() / 1000;
  return rSec > 0 ? liveU() / rSec : 0;
};

// DE: Wie viele reale Sekunden jede simulierte Sekunde gekostet hat. 1.0 bei
// DE: durchgehend 60 UPS, groesser bei Rueckstand.
// EN: How many real seconds each simulated second has cost. 1.0 at a
// EN: constant 60 UPS, higher when running behind.
const thinkingMultiplier = () => {
  const simT = elapsedSim();
  return simT > 0 ? elapsed() / simT : 1;
};

// DE: Zeigt, wie stark der 50-ms-Deckel von api.time.getTimeMs() (siehe oben)
// DE: verzerrt: je groesser der Unterschied zu R, desto mehr Zeit hat W verloren.
// EN: Shows how much the 50 ms cap of api.time.getTimeMs() (see above)
// EN: distorts things: the bigger the difference from R, the more time W has lost.
const wMinusR = () => elapsedPlay() - elapsed();

// DE: Wurde im Spielstand jemals ein Cheat benutzt, ist der Lauf wertlos. Das Flag
// DE: setzt das Spiel selbst und nimmt es nie zurueck.
// EN: If a cheat was ever used in the save file, the run is worthless. The
// EN: game sets this flag itself and never clears it.
const cheatsUsed = () => {
  try {
    return sandkit.state.store.integrity.cheatsUsed === true;
  } catch (e) {
    return false;
  }
};

// --- DE: Namen fuer die Split-Tabelle / EN: Names for the split table -------
// DE: Forschungen tragen nicht alle einen eigenen Namensschluessel. Fehlt er,
// DE: benennt das Spiel sie ueber das, was sie freischaltet - z.B. heisst
// DE: "shaker" im Baum nach der Struktur "structures|shaker|name".
// EN: Not every research has its own name key. When it's missing, the game
// EN: names it after whatever it unlocks - e.g. "shaker" in the tree is named
// EN: after the structure "structures|shaker|name".
const prettifyId = id => String(id)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, c => c.toUpperCase());

const translateIfPresent = key => {
  if (typeof key !== 'string' || key.length === 0) return null;
  try {
    if (api.i18n.hasTranslation && !api.i18n.hasTranslation(key)) return null;
  } catch (e) { /* DE: ohne Pruefung einfach versuchen / EN: no check available, just try it */ }
  const value = t(key);
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value === key || value.startsWith('[MISSING') || value.startsWith('[NO KEY]')) return null;
  return value;
};

const techName = techId => {
  if (!techId) return '?';

  let def = null;
  try { def = api.tech.getDefinitionById(techId); } catch (e) { /* DE: unbekannt / EN: unknown */ }

  const direct = translateIfPresent(def && def.nameKey) || translateIfPresent(`tech|${techId}|name`);
  if (direct) return direct;

  const unlocks = (def || {}).unlocks || {};
  if (Array.isArray(unlocks.structures)) {
    for (const type of unlocks.structures) {
      let sdef = null;
      try { sdef = api.structures.getDefinitionByType(type); } catch (e) { /* DE: unbekannt / EN: unknown */ }
      const name = translateIfPresent(sdef && sdef.nameKey);
      if (name) return name;
    }
  }
  if (Array.isArray(unlocks.items)) {
    for (const itemId of unlocks.items) {
      const name = translateIfPresent(`items|${itemId}|name`);
      if (name) return name;
    }
  }

  return prettifyId(techId);
};

const upgradeName = (itemId, upgradeId) =>
  translateIfPresent(`upgrades|${itemId}|${upgradeId}|name`) || prettifyId(upgradeId);

// --- DE: Zwischenzeiten / EN: Splits -----------------------------------------
// DE: Jeder eingeschaltete Ausloeser haengt hier einen Eintrag an: Beschriftung,
// DE: Zeit seit Laufbeginn und der Goldstand in dem Moment.
// EN: Every enabled trigger appends an entry here: label, time since the run
// EN: started, and the gold total at that moment.
const addSplit = (kind, label, id) => {
  const run = readRun();
  if (typeof run.startedAt !== 'number' || typeof run.finishedAt === 'number') return;

  const splits = readSplits();
  splits.push({
    t: elapsed(),
    sim: elapsedSim(),
    w: elapsedPlay(),
    kind,
    label,
    id: splitIdOf(kind, id) || `${kind}:${label}`,
    gold: Math.floor(goldProgress()),
  });
  api.storage.set(NS, 'splits', splits);
};

// DE: Die Gruppen-Einstellung aus den Mod-Optionen ist nur der Ausgangswert.
// EN: The group setting from the mod options is only the starting point.
const splitOn = key => api.settings.get(key) === true;

// --- DE: Einzelne Ausloeser / EN: Individual triggers -----------------------
// DE: Fuer jede Forschung, jeden Rang und jede Gold-Marke ein eigener Schalter.
// DE: Das passt nicht in die modinfo.json - die erlaubt hoechstens 64 Felder, und
// DE: allein die Forschungen sind rund 57. Deshalb ein eigenes Fenster im Spiel
// DE: und ein Objekt im localStorage, savegame-uebergreifend.
//
//   {}                        -> alles folgt der Gruppen-Einstellung
//   { "tech:shaker": false }  -> dieser eine Ausloeser ist abgewaehlt
//
// EN: A separate switch for every research, every rank and every gold mark.
// EN: That doesn't fit in modinfo.json - it allows at most 64 fields, and the
// EN: research alone is around 57. Hence a dedicated window in-game and an
// EN: object in localStorage, shared across save files.
//
//   {}                        -> everything follows the group setting
//   { "tech:shaker": false }  -> this one trigger is switched off
const TRIGGER_KEY = 'goldSpeedrun.triggers';

const readOverrides = () => {
  const v = api.storage.local.get(TRIGGER_KEY);
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

const writeOverrides = map => {
  // DE: Leere Eintraege gar nicht erst speichern, damit spaetere Aenderungen an den
  // DE: Gruppen-Einstellungen weiter durchschlagen.
  // EN: Don't store empty entries at all, so later changes to the group
  // EN: settings keep taking effect.
  const clean = {};
  for (const [k, v] of Object.entries(map)) if (typeof v === 'boolean') clean[k] = v;
  api.storage.local.set(TRIGGER_KEY, clean);
};

const triggerKey = (kind, id) => `${kind}:${id}`;

const triggerEnabled = (kind, id, groupDefault) => {
  const v = readOverrides()[triggerKey(kind, id)];
  return typeof v === 'boolean' ? v : groupDefault;
};

const setTriggerEnabled = (kind, id, value) => {
  const map = readOverrides();
  map[triggerKey(kind, id)] = !!value;
  writeOverrides(map);
};

// DE: Setzt eine ganze Gruppe; null loescht die Einzelschalter wieder, dann gilt
// DE: erneut die Gruppen-Einstellung.
// EN: Sets a whole group; null clears the individual switches again, so the
// EN: group setting applies once more.
const setGroup = (kind, ids, value) => {
  const map = readOverrides();
  for (const id of ids) {
    const k = triggerKey(kind, id);
    if (value === null) delete map[k];
    else map[k] = !!value;
  }
  writeOverrides(map);
};

// DE: Alle Forschungs-IDs. Das Tech-Enum deckt nur einen Teil ab - von den
// DE: Definitionen des Spiels sind rund 22 als reine String-IDs hinterlegt und
// DE: tauchen im Enum nicht auf.
// EN: All research IDs. The Tech enum only covers part of them - about 22 of
// EN: the game's definitions are stored as plain string IDs and don't show up
// EN: in the enum.
const EXTRA_TECH_IDS = [
  'kineticFieldEmitter', 'reconDrone', 'fluxEmanator', 'voidOrb', 'snowmaker',
  'thermalRelay', 'burnerBelt', 'heatCannon', 'copperMold', 'electricityConnector',
  'energySiphon', 'aurixiteCrystallizer', 'swarmConsole', 'entityCount1',
  'spiralSwarm', 'prismiteWell', 'entityCount2', 'swarmZoning', 'swarmScouts',
  'volcanizer', 'flashlight', 'prismalineWell',
];

let techIdCache = null;

const allTechIds = () => {
  if (techIdCache) return techIdCache;
  const ids = new Set();
  for (const id of Object.values(enums.Tech || {})) {
    if (typeof id === 'string' && id.length > 0) ids.add(id);
  }
  for (const id of EXTRA_TECH_IDS) ids.add(id);
  try {
    for (const id of Object.keys(sandkit.state.store.player.tech || {})) ids.add(id);
  } catch (e) { /* DE: noch kein Spielstand / EN: no save loaded yet */ }
  techIdCache = [...ids];
  return techIdCache;
};

const rankIds = () => {
  const out = [];
  for (let lvl = 2; lvl <= MAX_FACTORY_LEVEL; lvl++) out.push(lvl);
  return out;
};

// DE: Gold-Marken: entweder ein Anteil des Kategorieziels oder ein fester Schritt.
// EN: Gold marks: either a share of the category goal or a fixed interval.
const goldMarks = cat => {
  const mode = api.settings.get('splitGold');
  if (!mode || mode === 'off') return [];

  if (mode === '10k' || mode === '100k') {
    const step = mode === '10k' ? 10000 : 100000;
    const out = [];
    // DE: Die Marke auf dem Ziel selbst faellt weg - dort endet der Lauf ohnehin.
    // EN: The mark right on the goal itself is dropped - the run ends there anyway.
    for (let v = step; v < cat.target; v += step) out.push({ value: v, label: shortGold(v) });
    return out;
  }

  if (cat.kind !== 'gold' || cat.target <= 0) return [];
  const shares = mode === 'tenths'
    ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    : [0.25, 0.5, 0.75];
  return shares.map(f => ({
    value: Math.ceil(cat.target * f),
    label: t('mods|goldSpeedrun|split|gold', { percent: Math.round(f * 100) }),
  }));
};

// DE: Die Marken aendern sich nur, wenn Kategorie oder Einstellung wechseln.
// EN: The marks only change when the category or the setting changes.
let markCache = { key: null, list: [] };

const currentGoldMarks = cat => {
  const key = `${cat.id}|${cat.target}|${api.settings.get('splitGold')}`;
  if (markCache.key !== key) markCache = { key, list: goldMarks(cat) };
  return markCache.list;
};

// DE: Geplante Zwischenzeiten, die noch nicht gefallen sind - wie in LiveSplit
// DE: die Zeilen unter der aktuellen. Gold-Marken, Raenge und Artefakte haben
// DE: eine feste Reihenfolge. Forschungen und Aufwertungen nur, wenn eine
// DE: Bestzeit sie schon einmal in einer Route festgehalten hat.
// EN: Planned splits that have not fired yet - like the rows below the
// EN: current one in LiveSplit. Gold marks, ranks and artifacts have a fixed
// EN: order. Research and upgrades only appear if a personal best already
// EN: recorded them as a route.
const upcomingSplits = (cat, done) => {
  const seen = new Set();
  for (const s of done) {
    if (s && s.id) seen.add(s.id);
    if (s && s.kind && s.label) seen.add(`${s.kind}\0${s.label}`);
  }
  const out = [];
  const push = (kind, label, id) => {
    const key = id || `${kind}\0${label}`;
    if (seen.has(key) || seen.has(`${kind}\0${label}`)) return;
    seen.add(key);
    seen.add(`${kind}\0${label}`);
    out.push({ kind, label, id: id || `${kind}:${label}`, upcoming: true, t: NaN });
  };

  for (const p of readBestSplits()) {
    if (p && p.kind && p.label) push(p.kind, p.label, p.id);
  }

  const marks = currentGoldMarks(cat);
  let index = api.storage.get(NS, 'goldMarkIndex');
  if (!Number.isFinite(index)) index = 0;
  for (let i = index; i < marks.length; i++) {
    if (triggerEnabled('gold', marks[i].value, true)) {
      push('gold', marks[i].label, `gold:${marks[i].value}`);
    }
  }

  const rank = getFactoryLevel();
  for (const lvl of rankIds()) {
    if (lvl <= rank) continue;
    if (!triggerEnabled('rank', lvl, splitOn('splitRank'))) continue;
    push('rank', t('mods|goldSpeedrun|split|rank', { level: lvl }), `rank:${lvl}`);
  }

  if (triggerEnabled('artifact', 'any', splitOn('splitArtifact'))) {
    const found = getArtifactsFound();
    const last = artifactTotal() > 0 ? artifactTotal() : (cat.kind === 'artifacts' ? cat.target : 0);
    for (let n = found + 1; n <= last; n++) {
      push('artifact', t('mods|goldSpeedrun|split|artifact', { index: n }), `artifact:${n}`);
    }
  }

  push('goal', t('mods|goldSpeedrun|split|goal'), 'goal');
  return out;
};

const hudSplitRows = () => {
  const v = api.settings.get('hudSplitRows');
  const n = Number.isFinite(v) ? Math.floor(v) : 6;
  return Math.max(2, Math.min(24, n));
};

const hudSplitWindow = (done, upcoming) => {
  const limit = hudSplitRows();
  const pastKeep = Math.max(1, Math.min(4, Math.floor(limit / 3)));
  if (upcoming.length === 0) {
    const rows = done.slice(-limit);
    return { rows, hiddenPast: done.length - rows.length };
  }
  if (done.length === 0) return { rows: upcoming.slice(0, limit), hiddenPast: 0 };
  const past = done.slice(-pastKeep);
  const hiddenPast = done.length - past.length;
  const room = Math.max(1, limit - past.length);
  return { rows: past.concat(upcoming.slice(0, room)), hiddenPast };
};

// --- DE: Start durch die erste Aktion / EN: Start on the first action -------
// DE: Standard ist "jede Aktion": Bewegung, Graben, Bauen, Forschen, Aufsammeln.
// DE: Damit laesst sich kein Fortschritt an der Zeitnahme vorbei erarbeiten.
// EN: The default is "any action": movement, digging, building, researching,
// EN: collecting. That way no progress can be made without it counting against the clock.

// DE: Waehrend eigener Eingriffe - vor allem des Tutorial-Skips - ist der Start
// DE: gesperrt. Als Echtzeit-Frist, damit auch verzoegerte Folgeereignisse (Story,
// DE: Freischaltungen) nicht durchrutschen und ein haengender Schalter sich von
// DE: selbst loest.
// EN: The start is locked while the mod is making its own interventions -
// EN: above all the tutorial skip. Implemented as a real-time deadline so
// EN: delayed follow-up events (story, unlocks) can't slip through either,
// EN: and a stuck lock resolves itself.
let suppressUntil = 0;

// DE: Sperren nur verlaengern, nie verkuerzen - sonst hebt ein spaeterer, kurzer
// DE: Eingriff die laengere Sperre eines frueheren wieder auf.
// EN: Only ever extends the lock, never shortens it - otherwise a later,
// EN: short intervention would cancel out the longer lock from an earlier one.
const suppressFor = ms => {
  suppressUntil = Math.max(suppressUntil, Date.now() + ms);
};

// DE: Kurze Schonfrist nach dem Laden. Sie gilt nur fuer die Ereignis-Ausloeser:
// DE: waehrend die Welt anlaeuft, kann die Simulation von sich aus Gelaende
// DE: aufloesen oder Material einsammeln. Direkte Eingaben - Taste, Klick, Bauen,
// DE: Forschen - starten auch in dieser Zeit sofort.
// EN: A short grace period after loading. It only applies to the event
// EN: triggers: while the world is spinning up, the simulation can dissolve
// EN: terrain or collect material on its own. Direct input - key, click,
// EN: building, researching - still starts the run immediately even during this time.
let eventGraceUntil = 0;

const graceFor = ms => {
  eventGraceUntil = Math.max(eventGraceUntil, Date.now() + ms);
};

// DE: Drei Regelwerke:
//   'mouse' - nur ein Druck der Maustaste startet: Graben, Greifen, Bauen,
//             Forschen. Laufen ist frei, und was ohne Klick weiterlaeuft -
//             etwa eine grabende Drohne - startet ebenfalls nichts.
//   'click' - zusaetzlich alles, was Fortschritt bedeutet, auch ohne Klick.
//   'any'   - zusaetzlich schon die erste Bewegung.
//   'move'  - nur Bewegung, wie in Version 1.x.
//
// EN: Three rulesets:
//   'mouse' - only a mouse press starts it: digging, grabbing, building,
//             researching. Walking is free, and anything that keeps running
//             without a click - say, a digging drone - doesn't start it either.
//   'click' - additionally, anything that counts as progress, even without a click.
//   'any'   - additionally, even the first movement.
//   'move'  - movement only, as in version 1.x.
const startMode = () => {
  if (officialMode()) return 'any';
  const v = api.settings.get('startMode');
  return v === 'click' || v === 'any' || v === 'move' ? v : 'mouse';
};

const startsOnMovement = () => {
  const m = startMode();
  return m === 'any' || m === 'move';
};

// DE: Der Druck der Maustaste: Werkzeug- oder Waffenaktion im Spielfeld, Bauen,
// DE: Forschen. Gilt in jedem Regelwerk ausser "nur Bewegung".
// EN: A mouse press: a tool or weapon action in the play field, building,
// EN: researching. Applies under every ruleset except "movement only".
const startsOnMouse = () => startMode() !== 'move';

// DE: Fortschritt ohne eigenen Klick - Drohnen, Foerderbaender, Aufsammeln.
// EN: Progress without a click of your own - drones, conveyor belts, picking things up.
const startsOnEvent = () => {
  const m = startMode();
  return m === 'click' || m === 'any';
};

// --- DE: Offizielles Regelwerk / EN: Official ruleset -----------------------
// DE: Die Vorgabe der offiziellen Speedrun-Kategorien: ausser diesem Mod ist
// DE: nichts aktiv, jede Aktion startet die Uhr, Gold zaehlt nach Kontostand, und
// DE: das Tutorial wird nicht automatisch uebersprungen. Nur wenn alles vier
// DE: stimmt, traegt der Lauf das Abzeichen.
// EN: What the official speedrun categories require: nothing but this mod is
// EN: active, any action starts the clock, gold counts by balance, and the
// EN: tutorial isn't auto-skipped. Only when all four hold does the run carry
// EN: the badge.
const OFFICIAL_RULES = [
  {
    id: 'startMode',
    labelKey: 'mods|goldSpeedrun|cfg|startMode',
    valueKey: 'mods|goldSpeedrun|cfg|startMode|any',
    ok: () => startMode() === 'any',
  },
  {
    id: 'goldMode',
    labelKey: 'mods|goldSpeedrun|cfg|mode',
    valueKey: 'mods|goldSpeedrun|cfg|mode|balance',
    ok: () => goldMode() === 'balance',
  },
  {
    id: 'skipTutorial',
    labelKey: 'mods|goldSpeedrun|cfg|skipTutorial',
    // DE: "Aus" - dieselbe Beschriftung wie bei den Gold-Marken.
    // EN: "Off" - the same label as used for the gold marks.
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !skipTutorialEnabled(),
  },
  {
    id: 'skipIntro',
    labelKey: 'mods|goldSpeedrun|cfg|skipIntro',
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !skipIntroEnabled(),
  },
  {
    id: 'skipStory',
    labelKey: 'mods|goldSpeedrun|cfg|skipStory',
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !skipStoryEnabled(),
  },
];

// DE: Die Mod-Verwaltung selbst greift nicht ins Spiel ein - sie ist das Werkzeug,
// DE: mit dem die anderen Mods abgeschaltet werden, und zaehlt deshalb nicht mit.
// EN: The mod manager itself doesn't intervene in the game - it's the tool
// EN: used to turn the other mods off, so it doesn't count.
const RULES_MOD_EXEMPT = [MOD_ID, 'mod-manager'];

// DE: Ladereihenfolge, die das Spiel beim Start ablegt. Sie ist die Wahrheit
// DE: darueber, was ueberhaupt geladen wurde - der Eintrag in der Mod-Verwaltung
// DE: bleibt auch stehen, wenn ein Mod-Ordner laengst wieder verschwunden ist.
// EN: The load order the game records at startup. It's the source of truth
// EN: for what actually got loaded - the mod manager's entry keeps standing
// EN: even after a mod folder has long since disappeared.
const RUNTIME_MODS_KEY = '__sandkitExternalRuntimeV1';

const loadedMods = () => {
  try {
    const st = sandkit.state;
    const entry = st && st.store && st.store.mods ? st.store.mods[RUNTIME_MODS_KEY] : null;
    const order = entry && Array.isArray(entry.order) ? entry.order : [];
    return order.filter(m => m && typeof m.id === 'string');
  } catch (e) {
    return [];
  }
};

// DE: Fremde Mods, die geladen sind und in der Mod-Verwaltung nicht abgeschaltet
// DE: wurden. Mods ohne eigenen Schalter zaehlen als aktiv - sie laufen ja.
// EN: Third-party mods that are loaded and not turned off in the mod manager.
// EN: Mods without their own switch count as active - they're running, after all.
const otherEnabledMods = () => loadedMods()
  .filter(m => RULES_MOD_EXEMPT.indexOf(m.id) < 0)
  .filter(m => {
    try {
      return api.storage.local.get(`sandkitManager.enabled.${m.id}`) !== false;
    } catch (e) {
      return true;
    }
  })
  .map(m => m.name || m.id);

// DE: Das HUD zeichnet bei Millisekunden jeden Frame. Die Pruefung liest
// DE: Einstellungen und localStorage, deshalb haelt sie ihr Ergebnis kurz fest.
// EN: The HUD redraws every frame at millisecond precision. The check reads
// EN: settings and localStorage, so it caches its result briefly.
let rulesCache = null;
let rulesCacheAt = 0;

const rulesetStatus = () => {
  const stamp = Date.now();
  if (rulesCache && stamp - rulesCacheAt < 500) return rulesCache;

  const items = OFFICIAL_RULES.map(r => ({
    id: r.id,
    label: t(r.labelKey),
    value: t(r.valueKey),
    ok: r.ok(),
    extra: [],
  }));

  const extra = otherEnabledMods();
  items.push({
    id: 'mods',
    label: t('mods|goldSpeedrun|rules|mods'),
    value: t('mods|goldSpeedrun|rules|modsNone'),
    ok: extra.length === 0,
    extra,
  });

  rulesCache = { ok: items.every(i => i.ok), items };
  rulesCacheAt = stamp;
  return rulesCache;
};

// DE: Der Lauf haelt beim Start fest, ob er offiziell begonnen hat. Wird danach
// DE: etwas daran verstellt, faellt das Kennzeichen und kommt nicht zurueck -
// DE: sonst liesse sich ein Lauf unter offiziellen Regeln beginnen und mitten
// DE: drin auf die bequeme Einstellung wechseln.
// EN: The run records at the start whether it began officially. If anything
// EN: gets changed afterwards, the flag drops and never comes back -
// EN: otherwise a run could start under the official rules and switch to a
// EN: more convenient setting partway through.
const runIsOfficial = () => {
  api.storage.ensure(NS);
  return api.storage.get(NS, 'official') === true;
};

const runRulesBroken = () => {
  api.storage.ensure(NS);
  return api.storage.get(NS, 'officialBroken') === true;
};

const dropOfficial = () => {
  api.storage.set(NS, 'official', false);
  api.storage.set(NS, 'officialBroken', true);
  log('Regelwerk waehrend des Laufs verstellt - der Lauf gilt nicht mehr als offiziell');
};

// DE: Was HUD und Ergebnisfenster anzeigen: vor dem Lauf die aktuellen
// DE: Einstellungen, waehrend und nach dem Lauf das, womit er begonnen hat.
// EN: What the HUD and result screen show: before the run, the current
// EN: settings; during and after the run, what it actually started with.
const rulesetView = () => {
  const live = rulesetStatus();
  const run = readRun();
  if (typeof run.startedAt !== 'number') {
    return { ok: live.ok, items: live.items, locked: false, broken: false };
  }
  return { ok: runIsOfficial(), items: live.items, locked: true, broken: runRulesBroken() };
};

const showRuleset = () => api.settings.get('showRuleset') !== false;

const startRun = reason => {
  if (!modEnabled()) return false;
  if (Date.now() < suppressUntil) return false;
  if (uiBlocksStart()) return false;
  // DE: Vor der eigentlichen Spielszene (Intro, Landeanflug) kann keine echte
  // DE: Spielhandlung stattfinden - die Start-Ausloeser bleiben aber die ganze
  // DE: Zeit ueber scharf geschaltet. Ohne diese Sperre kann ein Ereignis aus dem
  // DE: Setup selbst (Weltgenerierung, Intro-/Tutorial-Skip) als "erste Aktion"
  // DE: durchrutschen, sobald die feste 1,5s-Gnadenfrist von game:ready
  // DE: verstrichen ist, obwohl noch gar kein Spieler etwas getan hat.
  // EN: Before the actual game scene (intro, landing approach) no real
  // EN: in-game action is possible - but the start triggers stay armed the
  // EN: whole time regardless. Without this guard, an event from the setup
  // EN: itself (world generation, intro/tutorial skip) can slip through as
  // EN: the "first action" once the fixed 1.5 s grace period from game:ready
  // EN: has elapsed, even though no player has done anything yet.
  if (activeScene() !== enums.Scene.Game) return false;
  if (!isArmed()) return false;

  const startedAt = now();
  startClocks();
  api.storage.set(NS, 'startedAt', startedAt);
  api.storage.set(NS, 'finishedAt', null);
  api.storage.set(NS, 'splits', []);
  api.storage.set(NS, 'goldMarkIndex', 0);
  api.storage.set(NS, 'official', rulesetStatus().ok);
  api.storage.set(NS, 'officialBroken', false);
  resetEarned();
  resultDismissed = false;


  log(`Timer gestartet (${reason}), Kategorie: ${categoryLabel()}`);
  return true;
};

// DE: Bewegung: Standard ist W/A/S/D. Hat der Spieler die Bewegung umgelegt,
// DE: gelten seine Tasten ebenfalls - daher werden die Belegungen zur Laufzeit
// DE: abgefragt.
// EN: Movement: the default is W/A/S/D. If the player has rebound movement,
// EN: their keys apply too - so the bindings are looked up at runtime.
const MOVEMENT_BINDINGS = [
  enums.KeyBinding.Boost,    // DE: hoch / Jetpack (W) / EN: up / jetpack (W)
  enums.KeyBinding.Left,     // (A)
  enums.KeyBinding.Descend,  // DE: runter (S) / EN: down (S)
  enums.KeyBinding.Right,    // (D)
];

const FALLBACK_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

// DE: "Control+KeyC" -> "KeyC"; nur die eigentliche Taste ist relevant.
// EN: "Control+KeyC" -> "KeyC"; only the actual key matters.
const bareKey = k => (typeof k === 'string' ? k.split('+').pop() : '');

const movementCodes = () => {
  const codes = new Set(FALLBACK_CODES);
  for (const binding of MOVEMENT_BINDINGS) {
    if (binding === undefined) continue;
    let keys;
    try { keys = api.input.getBoundKeys(binding); } catch (e) { keys = null; }
    if (!Array.isArray(keys)) continue;
    for (const k of keys) {
      const bare = bareKey(k);
      if (bare) codes.add(bare);
    }
  }
  return codes;
};

// DE: input:keydown ist ein Interceptor - hier wird nur mitgelesen, nie abgebrochen.
// EN: input:keydown is an interceptor - this only reads along, never cancels it.
api.hooks.intercept('input:keydown', payload => {
  if (!startsOnMovement()) return;
  if (!isArmed()) return;

  const code = payload && (payload.code || payload.key);
  if (!code) return;
  if (!movementCodes().has(code)) return;

  startRun('Bewegung');
});

// DE: Jede Werkzeug-, Waffen- oder Bauaktion im Spielfeld. Feuert beim Klick,
// DE: bevor die Aktion ausgefuehrt wird - fruehestmoeglicher fairer Startpunkt.
// EN: Any tool, weapon or building action in the play field. Fires on click,
// EN: before the action is executed - the earliest fair starting point.
api.hooks.intercept('action:intercept', payload => {
  if (!startsOnMouse()) return;
  if (!isArmed()) return;
  if (!payload || !payload.action) return;   // DE: Klick ohne aktives Werkzeug / EN: click without an active tool
  startRun('Aktion');
});

api.hooks.intercept('building:place', () => {
  if (!startsOnMouse()) return;
  if (isArmed()) startRun('Bauen');
});

api.hooks.intercept('progression:purchase', () => {
  if (!startsOnMouse()) return;
  if (isArmed()) startRun('Forschen');
});

// DE: Alles, was Fortschritt bedeutet, aber ohne eigenen Klick auslaufen kann -
// DE: etwa eine Drohne, die weitergraebt, oder ein eingesammeltes Artefakt.
// EN: Anything that counts as progress but can play out without a click of
// EN: your own - say, a drone that keeps digging, or a collected artifact.
const START_EVENTS = [
  'terrain:destroyed',
  'structures:placed',
  'structures:removed',
  'structures:moved',
  'building:placed',
  'building:removed',
  'resource:collected',
  'worldItem:pickedUp',
  'entity:collected',
  'tech:unlocked',
  'upgrade:purchased',
  'factory:levelUp',
  'grabber:elementPickedUp',
  'grabber:elementPlaced',
];

const startFromEvent = name => {
  if (!startsOnEvent()) return;
  if (Date.now() < eventGraceUntil) return;
  if (isArmed()) startRun(name);
};

// --- DE: Ausloeser fuer Zwischenzeiten / EN: Triggers for splits ------------
// DE: Bewusst getrennt von den Start-Ausloesern: das Ereignis, das den Lauf erst
// DE: startet, soll keine Zwischenzeit bei 00:00 erzeugen. Deshalb werden die
// DE: Split-Ausloeser ZUERST registriert - sie sehen den Lauf dann noch als nicht
// DE: gestartet und halten sich raus, und erst danach startet ihn der Listener
// DE: weiter unten.
// DE: build() liefert den Eintrag oder null - die Entscheidung, ob dieser eine
// DE: Ausloeser eingeschaltet ist, faellt dort, weil sie von der ID abhaengt.
// EN: Deliberately kept separate from the start triggers: the event that
// EN: first starts the run shouldn't also create a split at 00:00. That's
// EN: why the split triggers are registered FIRST - they still see the run
// EN: as not started yet and stay out of the way, and only afterwards does
// EN: the listener further below start it.
// EN: build() returns the entry or null - the decision whether this
// EN: particular trigger is enabled happens there, since it depends on the ID.
const trigger = (eventName, build) => {
  try {
    api.events.on(eventName, payload => {
      if (!modEnabled()) return;
      if (!isRunning()) return;
      let entry;
      try {
        entry = build(payload);
      } catch (e) {
        // DE: Nicht stillschweigend schlucken: ein kaputter Ausloeser wuerde sonst
        // DE: einfach nie feuern, ohne dass es jemand merkt.
        // EN: Don't swallow this silently: a broken trigger would otherwise
        // EN: simply never fire, without anyone noticing.
        log(`Ausloeser "${eventName}" fehlgeschlagen:`, e);
        return;
      }
      if (entry) addSplit(entry.kind, entry.label, entry.id);
    });
  } catch (e) {
    log('Ausloeser nicht verfuegbar, uebersprungen:', eventName);
  }
};

trigger('tech:unlocked', payload => {
  const techId = payload && payload.techId;
  if (!techId) return null;
  if (!triggerEnabled('tech', techId, splitOn('splitTech'))) return null;
  return { kind: 'tech', label: techName(techId), id: `tech:${techId}` };
});

trigger('factory:levelUp', payload => {
  const level = (payload && payload.newLevel) || getFactoryLevel();
  if (!triggerEnabled('rank', level, splitOn('splitRank'))) return null;
  return { kind: 'rank', label: t('mods|goldSpeedrun|split|rank', { level }), id: `rank:${level}` };
});

// DE: Artifact ist 1; der Enum-Zugriff bleibt trotzdem der Normalweg, damit eine
// DE: spaetere Umnummerierung im Spiel mitgenommen wird.
// EN: Artifact is 1; the enum lookup remains the normal path anyway, so a
// EN: future renumbering in the game gets picked up automatically.
const ARTIFACT_TYPE = (enums.WorldItemType && enums.WorldItemType.Artifact) !== undefined
  ? enums.WorldItemType.Artifact
  : 1;

trigger('worldItem:pickedUp', payload => {
  if (!payload || payload.type !== ARTIFACT_TYPE) return null;
  if (!triggerEnabled('artifact', 'any', splitOn('splitArtifact'))) return null;
  return {
    kind: 'artifact',
    label: t('mods|goldSpeedrun|split|artifact', { index: getArtifactsFound() }),
    id: `artifact:${getArtifactsFound()}`,
  };
});

trigger('upgrade:purchased', payload => {
  if (!triggerEnabled('upgrade', 'any', splitOn('splitUpgrade'))) return null;
  return {
    kind: 'upgrade',
    label: t('mods|goldSpeedrun|split|upgrade', {
      name: upgradeName(payload && payload.itemId, payload && payload.upgradeId),
    }),
    id: `upgrade:${payload && payload.itemId}:${payload && payload.upgradeId}`,
  };
});

// DE: Erst jetzt die Start-Ausloeser: siehe Reihenfolge-Hinweis oben.
// EN: Only now the start triggers: see the ordering note above.
for (const name of START_EVENTS) {
  try {
    api.events.on(name, () => startFromEvent(name));
  } catch (e) {
    log('Ereignis nicht verfuegbar, uebersprungen:', name);
  }
}

// --- DE: Zielpruefung / EN: Goal check ---------------------------------------
let lastWrite = -1;

// DE: Wird gesetzt, sobald ein Lauf endet, und vom Ergebnisfenster gelesen.
// EN: Set as soon as a run ends, and read by the result screen.
let resultDismissed = false;

const scoredRealTime = () => {
  const live = elapsed();
  if (live > 0) return live;
  const stored = readClock('upsRms');
  if (stored > 0) {
    rMs = stored;
    return stored;
  }
  return 0;
};

const finishRun = cat => {
  // DE: Alle drei Uhren werden im selben Moment abgelesen, bevor der Lauf als
  // DE: beendet markiert wird - danach zaehlt advanceClocks() nicht mehr weiter.
  // EN: All three clocks are read at the same instant, before the run is
  // EN: marked finished - after that, advanceClocks() no longer keeps counting.
  const time = scoredRealTime();
  const simTime = elapsedSim();
  const playTime = elapsedPlay();
  const slowdown = slowdownPercent();
  const deficit = tickDeficit();

  // DE: Das Ziel selbst ist die letzte Zwischenzeit - so steht es auch in der Tabelle.
  // EN: The goal itself is the last split - that's how it appears in the table too.
  const splits = readSplits();
  splits.push({
    kind: 'goal',
    label: t('mods|goldSpeedrun|split|goal'),
    id: 'goal',
    t: time,
    sim: simTime,
    w: playTime,
    gold: Math.floor(goldProgress()),
  });
  api.storage.set(NS, 'splits', splits);
  // DE: Vor finishedAt schreiben: liveU()/elapsedPlay() frieren sich selbst ein,
  // DE: sobald finishedAt gesetzt ist, und lesen dann genau diese beiden Werte.
  // EN: Write these before finishedAt: liveU()/elapsedPlay() freeze themselves
  // EN: as soon as finishedAt is set, and then read exactly these two values.
  api.storage.set(NS, 'upsUFinal', liveU());
  api.storage.set(NS, 'upsWFinal', playTime);
  api.storage.set(NS, 'upsTickReady', rawTickSourceReady());
  api.storage.set(NS, 'finishedAt', now());
  flushHistoryToSave();

  const fmt = timeFormat();
  api.ui.toast({ key: 'mods|goldSpeedrun|done', params: { time: formatTime(time, fmt) } });

  if (cheatsUsed()) {
    log('Lauf beendet in', formatTime(time, 'millis'),
      '- ACHTUNG: Cheats wurden in diesem Spielstand benutzt, keine Bestzeit gespeichert.');
  } else if (runRulesBroken()) {
    // DE: Wer mitten im Lauf am Regelwerk dreht, misst nicht mehr dasselbe wie
    // DE: alle anderen unter diesem Schluessel. Die Zeit bleibt sichtbar, sie
    // DE: wird nur nicht abgelegt.
    // EN: Anyone who changes the ruleset mid-run is no longer measuring the
    // EN: same thing as everyone else under this key. The time stays
    // EN: visible, it just doesn't get saved.
    log('Lauf beendet in', formatTime(time, 'millis'),
      '- ACHTUNG: Regelwerk waehrend des Laufs verstellt, keine Bestzeit gespeichert.');
  } else {
    const best = readBest();
    if (time > 0 && (best === null || time < best)) {
      writeBestTime(time);
      writeBestSplits(splits);
      api.ui.toast({ key: 'mods|goldSpeedrun|newBest', params: { time: formatTime(time, fmt) } });
    } else if (time > 0 && readBestSplits().length === 0 && best !== null && Math.abs(time - best) < 50) {
      writeBestSplits(splits);
    } else if (!(time > 0)) {
      log('Lauf beendet, aber Echtzeit war 0 - Bestzeit nicht geschrieben.');
    }
  }

  resultDismissed = false;

  // DE: Fuer Nachweis und Stream-Overlay: Kategorie, Endzeit, Splits und die
  // DE: Mod-Liste des Spielstands in einem Block im Log.
  // EN: For verification and stream overlays: category, final time, splits
  // EN: and the save file's mod list, all in one log block.
  let mods = [];
  try {
    const entry = sandkit.state.store.mods['__sandkitExternalRuntimeV1'];
    if (entry && Array.isArray(entry.order)) mods = entry.order.map(m => `${m.id}@${m.version}`);
  } catch (e) { /* DE: keine Mod-Liste im Spielstand / EN: no mod list in this save */ }

  log('Lauf beendet', {
    category: categoryLabel(),
    time: formatTime(time, 'millis'),
    timeMs: time,
    simTime: formatTime(simTime, 'millis'),
    simTimeMs: simTime,
    playTimeMs: playTime,
    // DE: (T/R - 1) * 100: negativ heisst "die Welt ist hinterher".
    // EN: (T/R - 1) * 100: negative means "the world is behind".
    slowdownPercent: Math.round(slowdown * 100) / 100,
    // DE: Schritte, die einer idealen 60-UPS-Maschine gefehlt haben.
    // EN: Steps a perfect 60-UPS machine would have been missing.
    tickDeficit: Math.round(deficit),
    tickSourceReady: tickSourceReady(),
    splits: splits.map(s =>
      `${formatTime(s.t, 'millis')}  (sim ${formatTime(Number.isFinite(s.sim) ? s.sim : s.t, 'millis')})  ${s.label}  ${s.gold} Gold`),
    cheatsUsed: cheatsUsed(),
    mods,
  });
};

const checkGoal = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return;
  if (typeof run.finishedAt === 'number') return; // DE: schon durch / EN: already finished

  const cat = category();
  if (cat.target <= 0) return;                    // DE: Ziel noch unbekannt / EN: goal not known yet

  const current = progressOf(cat);

  // DE: Gold-Marken unterwegs.
  // EN: Gold marks along the way.
  const marks = currentGoldMarks(cat);
  if (marks.length > 0) {
    let index = api.storage.get(NS, 'goldMarkIndex');
    if (!Number.isFinite(index)) index = 0;
    const gold = goldProgress();
    let moved = false;
    while (index < marks.length && gold >= marks[index].value) {
      // DE: Abgewaehlte Marken werden nur uebersprungen, nicht neu geprueft.
      // EN: Deselected marks are only skipped, not re-checked.
      if (triggerEnabled('gold', marks[index].value, true)) {
        addSplit('gold', marks[index].label, `gold:${marks[index].value}`);
      }
      index++;
      moved = true;
    }
    if (moved) api.storage.set(NS, 'goldMarkIndex', index);
  }

  if (current >= cat.target) finishRun(cat);
};

api.events.on('frame:render', () => {
  // DE: Vor allem anderen und vor der Pruefung auf den Schalter der Mod-Verwaltung:
  // DE: advanceClocks() rechnet mit dem Abstand zum letzten Aufruf, ein
  // DE: uebersprungener Frame wuerde diesen Abstand aufblaehen.
  // EN: Before anything else, and before checking the mod-manager switch:
  // EN: advanceClocks() works off the gap since the last call, and a skipped
  // EN: frame would inflate that gap.
  advanceClocks();

  if (!modEnabled()) return;

  // DE: Jeden Frame messen, damit kurz aufeinander folgendes Einnehmen und Ausgeben
  // DE: nicht durch das Raster faellt. Kostet nur einen Zahlenvergleich.
  // EN: Sampled every frame so quick back-to-back earning and spending
  // EN: doesn't fall through the cracks. Costs only a number comparison.
  if (goldMode() === 'earned') sampleEarned();

  const stamp = now();

  // DE: Jeden Frame pruefen: nur so stimmt die Endzeit auf die Millisekunde.
  // EN: Checked every frame: only this way is the final time accurate to the millisecond.
  checkGoal();

  // DE: Gedrosselt: der Verlauf braucht nicht jeden Frame ins Savegame.
  // EN: Throttled: the history doesn't need to go into the save every frame.
  maybeFlushHistory();

  // DE: Solange der Lauf laeuft, darf sich am Regelwerk nichts mehr aendern.
  // DE: rulesetStatus() haelt sein Ergebnis kurz fest, das kostet also nichts.
  // EN: While the run is going, nothing about the ruleset may change anymore.
  // EN: rulesetStatus() caches its result briefly, so this costs nothing.
  if (isRunning() && runIsOfficial() && !rulesetStatus().ok) dropOfficial();

  // DE: Laufsumme gedrosselt in den Spielstand schreiben.
  // EN: Write the running total to the save, throttled.
  if (stamp - lastWrite < 500) return;
  lastWrite = stamp;

  // DE: Doppelter Boden fuer den Fall, dass eine Aenderung ohne onChange kommt.
  // EN: A safety net in case a change arrives without an onChange event.
  if (syncOfficialSettings()) refreshSettingsUi();

  if (earnedTotal !== null) api.storage.set(NS, 'earned', earnedTotal);
});

// DE: Die Uhren haengen nicht am Bild. requestAnimationFrame steht still, sobald
// DE: das Fenster in den Hintergrund geht - eine Stoppuhr tut das nicht, und ein
// DE: Lauf soll sich nicht durch Alt+Tab anhalten lassen. Ein eigener Takt haelt
// DE: sie deshalb auch dann in Gang; angehalten wird nur, wenn das Spiel selbst
// DE: pausiert. Doppelt gerufen zu werden macht advanceClocks() nichts aus, es
// DE: rechnet immer mit dem Abstand zum letzten Aufruf.
// EN: The clocks don't depend on the screen. requestAnimationFrame stops the
// EN: moment the window goes to the background - a stopwatch doesn't, and a
// EN: run shouldn't be pausable via Alt+Tab. A dedicated interval keeps them
// EN: going even then; the only thing that pauses them is the game itself
// EN: pausing. Being called twice doesn't bother advanceClocks(), it always
// EN: works off the gap since the last call.
setInterval(advanceClocks, 50);

// --- DE: Farben / EN: Colors -------------------------------------------------
const COLORS = {
  text: '#e6edf3',
  dim: '#93a1b1',
  gold: '#f0c040',
  blue: '#4a9eff',
  red: '#e05252',
  green: '#4ade80',
  border: '#3d4757',
  panel: 'rgba(12, 16, 22, 0.96)',
  box: 'rgba(15, 20, 28, 0.82)',
};

const KIND_COLOR = {
  tech: '#7dd3fc',
  rank: '#c4b5fd',
  artifact: '#f0c040',
  upgrade: '#86efac',
  gold: '#e6edf3',
  goal: '#f0c040',
};

// --- DE: HUD / EN: HUD -------------------------------------------------------
// DE: Oben rechts sitzt die Missionsziel-/Fabrikrang-Leiste des Spiels, oben links
// DE: der Goldzaehler. Standard ist deshalb oben mittig - dort ist Platz.
// EN: The game's mission-goal/factory-rank bar sits top right, the gold
// EN: counter top left. So the default is top centre - there's room there.
const CORNERS = {
  topCenter: { top: '14px', left: '50%', transform: 'translateX(-50%)' },
  topLeft: { top: '96px', left: '16px' },
  topRight: { top: '210px', right: '16px' },
  bottomLeft: { bottom: '96px', left: '16px' },
  bottomRight: { bottom: '96px', right: '16px' },
};

// DE: Millisekunden brauchen jeden Frame, Sekunden nicht. Der Takt richtet sich
// DE: deshalb nach dem gewaehlten Format.
// EN: Milliseconds need every frame, seconds don't. The refresh rate is
// EN: therefore based on the chosen format.
const HUD_INTERVAL = { seconds: 250, centis: 50, millis: 16 };

const useTick = fmt => {
  const [, bump] = react.useState(0);
  react.useEffect(() => {
    const id = setInterval(() => bump(n => (n + 1) % 1000), HUD_INTERVAL[fmt] || 50);
    return () => clearInterval(id);
  }, [fmt]);
};

// DE: Eine Zeile der Split-Tabelle. Im HUD schmal mit Delta zur Bestzeit, im
// DE: Ergebnisfenster mit Abschnittszeit und Goldstand.
// EN: One row of the split table. Narrow in the HUD with the PB delta, and
// EN: with segment time and gold total in the result screen.
function SplitRow({ split, previous, fmt, wide, pb }) {
  const upcoming = split.upcoming === true;
  const live = Number.isFinite(split.t);
  const prevT = previous && Number.isFinite(previous.t) ? previous.t : 0;
  const segment = live ? split.t - prevT : 0;
  const pbTime = pb && Number.isFinite(pb.t) ? pb.t : null;
  const delta = live && pbTime !== null ? split.t - pbTime : null;

  const cell = (key, value, style) => h('span', { key, style }, value);

  return h('div', {
    style: {
      display: 'flex', gap: '8px', alignItems: 'baseline',
      padding: wide ? '3px 0' : '1px 0',
      borderBottom: wide ? '1px solid rgba(255,255,255,0.05)' : 'none',
      fontVariantNumeric: 'tabular-nums',
      opacity: upcoming ? 0.55 : 1,
    },
  }, [
    cell('label', split.label, {
      flex: 1, minWidth: 0,
      color: upcoming ? COLORS.dim : (KIND_COLOR[split.kind] || COLORS.text),
      fontWeight: split.kind === 'goal' && !upcoming ? 700 : 500,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }),
    wide
      ? cell('seg', live && segment > 0 ? '+' + formatShort(segment, fmt) : '-', {
          color: COLORS.dim, minWidth: '72px', textAlign: 'right',
        })
      : null,
    // DE: Absolute Zeit immer vollstaendig: Stunden, Minuten, Sekunden,
    // DE: Millisekunden. Nur die Abschnittsdauer daneben wird gekuerzt, dort ist
    // DE: ein fuehrendes "00:" nur Rauschen. Kommende Zeilen zeigen die Bestzeit
    // DE: an dieser Stelle, falls eine vorliegt - sonst einen Gedankenstrich.
    // EN: The absolute time is always shown in full: hours, minutes, seconds,
    // EN: milliseconds. Only the segment duration next to it is shortened -
    // EN: there, a leading "00:" is just noise. Upcoming rows show the PB
    // EN: time in that slot if there is one - otherwise a dash.
    cell('time', live
      ? formatTime(split.t, fmt)
      : (pbTime !== null ? formatTime(pbTime, fmt) : '—'), {
      minWidth: wide ? '104px' : '92px', textAlign: 'right',
      color: upcoming ? COLORS.dim : undefined,
    }),
    wide
      ? cell('gold', live ? formatGold(split.gold) : '', {
          color: COLORS.gold, minWidth: '76px', textAlign: 'right',
        })
      : cell('delta', delta !== null
          ? (delta >= 0 ? '+' : '-') + formatShort(Math.abs(delta), fmt)
          : (!upcoming && live && segment > 0 ? '+' + formatShort(segment, fmt) : ''), {
          color: delta === null ? COLORS.dim : delta <= 0 ? COLORS.green : COLORS.red,
          minWidth: '64px', textAlign: 'right',
        }),
  ]);
}

function SplitTable({ splits, fmt, wide, pbSplits }) {
  const pbs = Array.isArray(pbSplits) ? pbSplits : [];
  return h('div', { style: { display: 'flex', flexDirection: 'column' } },
    splits.map((s, i) => h(SplitRow, {
      key: i,
      split: s,
      previous: i > 0 ? splits[i - 1] : null,
      fmt,
      wide,
      pb: findPbSplit(s, pbs),
    })));
}

// --- DE: Verlauf: UPS ueber die Zeit / EN: History: UPS over time ----------
// DE: Zwei getrennte Zwecke mit sehr unterschiedlichen Kosten:
//   - die 60-Sekunden-Live-Grafik im HUD lebt nur im Speicher, ohne Save-Impact.
//   - der Verlauf ueber den ganzen Lauf wandert (nur bei eingeschalteter
//     Option) als Min/Max/Mittel-Eimer von 1 Sekunde ins Savegame.
// DE: Beides wird ausschliesslich im Hauptthread aus dem ohnehin vorhandenen
// DE: Schrittzaehler abgeleitet - kein zusaetzlicher Simulations-Aufwand, egal ob
// DE: die Optionen an sind oder nicht.
//
// EN: Two separate purposes with very different costs:
//   - the 60-second live graph in the HUD only lives in memory, no save impact.
//   - the history over the whole run travels into the save file (only when
//     the option is enabled) as 1-second min/max/average buckets.
// EN: Both are derived purely on the main thread from the step counter that
// EN: already exists anyway - no extra simulation cost, whether the options
// EN: are on or off.
const HISTORY_SAMPLE_MS = 100;     // DE: 10 Hz Abtastung im Hauptthread / EN: 10 Hz sampling on the main thread
const HISTORY_BUCKET_MS = 1000;    // DE: 1 Hz gespeicherte Eimer / EN: 1 Hz stored buckets
const HISTORY_MAX_BUCKETS = 5000;  // DE: ab hier je zwei Eimer zu einem verschmelzen / EN: beyond this, merge two buckets into one
const SPARKLINE_MAX_BUCKETS = 60;  // DE: Live-Grafik: 60 abgeschlossene Sekunden / EN: live graph: 60 finalized seconds

let sparklineBuckets = [];    // DE: abgeschlossene 1-s-Eimer, Farbe bleibt / EN: finalized 1 s buckets, color stays
let sparklineAccum = null;    // DE: laufender Live-Eimer / EN: current live bucket
let bucketAccum = null;       // DE: laufender 1-Hz-Eimer / EN: running 1 Hz bucket
let historyBuf = [];          // DE: { min, max, avg }[] - kompletter Lauf / EN: { min, max, avg }[] - the whole run
let lastHistorySample = null; // DE: { tick, atMs } fuer die Momentan-UPS / EN: { tick, atMs } for the instantaneous UPS

const trackHistoryEnabled = () => api.settings.get('trackUpsHistory') === true;
const liveSparklineEnabled = () => api.settings.get('showLiveSparkline') === true;

const loadHistoryFromSave = () => {
  const v = api.storage.get(NS, 'upsHistory');
  historyBuf = Array.isArray(v) ? v.filter(b => b && Number.isFinite(b.avg)) : [];
  bucketAccum = null;
  const spark = api.storage.get(NS, 'upsSparkline');
  sparklineBuckets = Array.isArray(spark) ? spark.filter(b => b && Number.isFinite(b.avg)) : [];
  sparklineAccum = null;
};

const flushHistoryToSave = () => {
  api.storage.set(NS, 'upsHistory', historyBuf);
  api.storage.set(NS, 'upsSparkline', sparklineBuckets);
};

const resetHistory = () => {
  sparklineBuckets = [];
  sparklineAccum = null;
  bucketAccum = null;
  historyBuf = [];
  lastHistorySample = null;
  api.storage.set(NS, 'upsHistory', []);
  api.storage.set(NS, 'upsSparkline', []);
};

const finalizeSparklineBucket = accum => ({
  min: Math.round(accum.min * 10) / 10,
  max: Math.round(accum.max * 10) / 10,
  avg: Math.round((accum.sum / accum.n) * 10) / 10,
});

const sparklineColumns = () => {
  const out = sparklineBuckets.slice();
  if (sparklineAccum && sparklineAccum.n > 0) out.push(finalizeSparklineBucket(sparklineAccum));
  return out;
};

// DE: Haelt sehr lange Laeufe im Rahmen: benachbarte Eimer paarweise
// DE: zusammenfassen, die Aufloesung halbiert sich dabei.
// EN: Keeps very long runs within bounds: merges adjacent buckets in pairs,
// EN: which halves the resolution.
const downsampleHistory = () => {
  const merged = [];
  for (let i = 0; i < historyBuf.length - 1; i += 2) {
    const a = historyBuf[i];
    const b = historyBuf[i + 1];
    merged.push({
      min: Math.min(a.min, b.min),
      max: Math.max(a.max, b.max),
      avg: Math.round(((a.avg + b.avg) / 2) * 10) / 10,
    });
  }
  if (historyBuf.length % 2 === 1) merged.push(historyBuf[historyBuf.length - 1]);
  historyBuf = merged;
};

const sampleHistoryTick = () => {
  if (!isRunning() || gamePaused() || !tickSourceReady()) { lastHistorySample = null; return; }
  const wantSparkline = liveSparklineEnabled();
  const wantHistory = trackHistoryEnabled();
  if (!wantSparkline && !wantHistory) { lastHistorySample = null; return; }

  const atMs = performance.now();
  const tick = rawTick();

  if (lastHistorySample) {
    const dtMs = atMs - lastHistorySample.atMs;
    const dTick = tick - lastHistorySample.tick;
    if (dtMs > 0 && dTick >= 0) {
      const ups = Math.min(120, (dTick / dtMs) * 1000);

      if (wantSparkline) {
        if (!sparklineAccum) {
          sparklineAccum = { startMs: atMs, min: ups, max: ups, sum: ups, n: 1 };
        } else {
          if (ups < sparklineAccum.min) sparklineAccum.min = ups;
          if (ups > sparklineAccum.max) sparklineAccum.max = ups;
          sparklineAccum.sum += ups;
          sparklineAccum.n += 1;
        }
        if (atMs - sparklineAccum.startMs >= HISTORY_BUCKET_MS) {
          sparklineBuckets.push(finalizeSparklineBucket(sparklineAccum));
          sparklineAccum = null;
          while (sparklineBuckets.length > SPARKLINE_MAX_BUCKETS) sparklineBuckets.shift();
        }
      }

      if (wantHistory) {
        if (!bucketAccum) {
          bucketAccum = { startMs: atMs, min: ups, max: ups, sum: ups, n: 1 };
        } else {
          if (ups < bucketAccum.min) bucketAccum.min = ups;
          if (ups > bucketAccum.max) bucketAccum.max = ups;
          bucketAccum.sum += ups;
          bucketAccum.n += 1;
        }
        if (atMs - bucketAccum.startMs >= HISTORY_BUCKET_MS) {
          historyBuf.push({
            min: Math.round(bucketAccum.min * 10) / 10,
            max: Math.round(bucketAccum.max * 10) / 10,
            avg: Math.round((bucketAccum.sum / bucketAccum.n) * 10) / 10,
          });
          bucketAccum = null;
          if (historyBuf.length > HISTORY_MAX_BUCKETS) downsampleHistory();
        }
      }
    }
  }
  lastHistorySample = { tick, atMs };
};

setInterval(sampleHistoryTick, HISTORY_SAMPLE_MS);

let lastHistoryFlush = 0;
const maybeFlushHistory = () => {
  const stamp = Date.now();
  if (stamp - lastHistoryFlush < 1000) return;
  lastHistoryFlush = stamp;
  if (trackHistoryEnabled()) flushHistoryToSave();
  else if (liveSparklineEnabled()) api.storage.set(NS, 'upsSparkline', sparklineBuckets);
};

// DE: Reduziert eine Punktreihe auf eine feste Spaltenzahl fuer die Grafik - jede
// DE: Spalte behaelt Minimum, Maximum und Mittel ihres Abschnitts, damit kurze
// DE: Ausreisser (Ruckler) nicht in einem Durchschnitt verschwinden.
// EN: Reduces a series of points to a fixed number of columns for the graph -
// EN: each column keeps the minimum, maximum and average of its segment, so
// EN: brief outliers (stutters) don't vanish inside an average.
const downsampleToColumns = (items, cols, toStats) => {
  if (!items || items.length === 0) return [];
  const per = items.length / cols;
  const out = [];
  for (let c = 0; c < cols; c++) {
    const start = Math.floor(c * per);
    const end = Math.max(start + 1, Math.floor((c + 1) * per));
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    for (let i = start; i < end && i < items.length; i++) {
      const v = toStats(items[i]);
      if (v.min < min) min = v.min;
      if (v.max > max) max = v.max;
      sum += v.avg;
      n++;
    }
    if (n === 0) continue;
    out.push({ min, max, avg: sum / n });
  }
  return out;
};

const bucketStats = b => b;

// DE: Min/Max-Umschlag ueber UPS 0-60 mit gestrichelter 60er-Referenzlinie. Divs
// DE: statt Canvas/SVG - genuegt fuer ein paar Dutzend bis anderthalbhundert
// DE: Spalten und braucht keine zusaetzliche Zeichenflaeche.
// EN: Min/max envelope over UPS 0-60 with a dashed reference line at 60.
// EN: Divs instead of Canvas/SVG - good enough for a few dozen up to about a
// EN: hundred and fifty columns, and needs no extra drawing surface.
function UpsEnvelopeGraph({ columns, height }) {
  const H = height || 90;
  if (!columns || columns.length === 0) {
    return h('div', {
      style: {
        height: `${H}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.dim, fontSize: '11px', textAlign: 'center', padding: '0 12px',
      },
    }, t('mods|goldSpeedrun|graph|empty'));
  }
  const wPct = 100 / columns.length;
  const bars = columns.map((c, i) => {
    const minPct = Math.max(0, Math.min(100, (c.min / TICK_HZ) * 100));
    const maxPct = Math.max(minPct + 0.6, Math.min(100, (c.max / TICK_HZ) * 100));
    const color = c.avg >= TICK_HZ - 1 ? COLORS.green : c.avg >= TICK_HZ * 0.85 ? COLORS.gold : COLORS.red;
    return h('div', {
      key: i,
      style: {
        position: 'absolute', left: `${i * wPct}%`, width: `${Math.max(wPct, 0.6)}%`,
        bottom: `${minPct}%`, height: `${maxPct - minPct}%`,
        background: color, opacity: 0.85,
      },
    });
  });
  return h('div', {
    style: {
      position: 'relative', height: `${H}px`,
      background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden',
    },
  }, [
    ...bars,
    h('div', {
      key: 'ref',
      style: { position: 'absolute', left: 0, right: 0, top: 0, borderTop: `1px dashed ${COLORS.dim}`, opacity: 0.5 },
    }),
    h('div', {
      key: 'refLabel',
      style: { position: 'absolute', right: '3px', top: '1px', fontSize: '9px', color: COLORS.dim },
    }, String(TICK_HZ)),
  ]);
}

// DE: Kleine Metrik-Zeile fuer den erweiterten Block: Beschriftung links, Wert
// DE: rechts, beides klein und gedaempft.
// EN: Small metric row for the advanced block: label on the left, value on
// EN: the right, both small and muted.
function MetricLine({ label, value, color }) {
  return h('div', {
    style: {
      display: 'flex', justifyContent: 'space-between', gap: '10px',
      fontSize: '11px', color: COLORS.dim,
    },
  }, [
    h('span', { key: 'l' }, label),
    h('span', { key: 'v', style: { color: color || COLORS.text, fontVariantNumeric: 'tabular-nums' } }, value),
  ]);
}

function SpeedrunHud() {
  const fmt = timeFormat();
  useTick(fmt);

  if (!modEnabled()) return null;
  if (api.settings.get('showOverlay') === false) return null;

  const run = readRun();
  const waiting = typeof run.startedAt !== 'number';
  const done = typeof run.finishedAt === 'number';
  const horizontal = hudLayout() === 'horizontal';

  const cat = category();
  const current = progressOf(cat);
  const target = cat.target;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const corner = CORNERS[api.settings.get('corner')] || CORNERS.topCenter;
  const mode = clockMode();
  const rTime = elapsed();
  const simTime = elapsedSim();
  const playTime = elapsedPlay();
  const slowdown = slowdownPercent();
  const deficit = tickDeficit();
  const ready = tickSourceReady();
  const advanced = api.settings.get('showAdvancedMetrics') === true;
  const sparkline = liveSparklineEnabled();
  // DE: Die Bestzeit ist immer die Echtzeit - unabhaengig von der gross gezeigten Uhr.
  // EN: The best time is always real time - regardless of which clock is shown large.
  if (done) maybeAdoptFinishedAsBest();
  const best = readBest();
  const tainted = cheatsUsed();
  const rules = showRuleset() ? rulesetView() : null;

  const allSplits = readSplits();
  const upcoming = done ? [] : upcomingSplits(cat, allSplits);
  const windowed = hudSplitWindow(allSplits, upcoming);
  const visible = windowed.rows;
  const firstVisible = windowed.hiddenPast;
  const showSplits = api.settings.get('showSplits') !== false && visible.length > 0;
  const pbSplits = readBestSplits();

  let progressText;
  if (cat.kind === 'artifacts') {
    progressText = t('mods|goldSpeedrun|artifacts', {
      current: current,
      target: target > 0 ? target : '?',
    });
  } else if (cat.kind === 'factory') {
    progressText = t('mods|goldSpeedrun|factory', { current: current, target: target });
  } else {
    progressText = `${formatGold(current)} / ${formatGold(target)}`;
  }

  const headlineMs = mode === 'sim' ? simTime : mode === 'play' ? playTime : rTime;
  const headlineText = waiting ? dashTime(fmt) : formatTime(headlineMs, fmt);
  const otherClock = kind => {
    const ms = kind === 'sim' ? simTime : kind === 'play' ? playTime : rTime;
    const shortKey = kind === 'sim' ? 'mods|goldSpeedrun|clock|simShort'
      : kind === 'play' ? 'mods|goldSpeedrun|clock|playShort' : 'mods|goldSpeedrun|clock|realShort';
    return `${t(shortKey)} ${waiting ? dashTime(fmt) : formatTime(ms, fmt)}`;
  };
  const otherClocks = ['real', 'sim', 'play'].filter(k => k !== mode);

  const none = { pointerEvents: 'none' };
  const col = (key, children, extra) => h('div', {
    key,
    style: {
      ...none,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      ...extra,
    },
  }, children);

  const clockBlock = [
    h('div', {
      key: 'time',
      style: {
        font: `700 ${fmt === 'seconds' ? 24 : 22}px/1.1 system-ui, sans-serif`,
        color: done ? COLORS.gold : waiting ? COLORS.dim : COLORS.text,
        fontVariantNumeric: 'tabular-nums',
      },
    }, headlineText),
    !waiting
      ? h('div', {
          key: 'others',
          style: {
            marginTop: '1px', display: 'flex', gap: '10px',
            font: '600 11px/1.2 system-ui, sans-serif', color: COLORS.dim,
            fontVariantNumeric: 'tabular-nums',
          },
        }, otherClocks.map(k => h('span', { key: k }, otherClock(k))))
      : null,
    h('div', {
      key: 'always',
      style: {
        marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px',
        fontSize: '11px', fontVariantNumeric: 'tabular-nums',
      },
    }, [
      h(MetricLine, {
        key: 'slow',
        label: t('mods|goldSpeedrun|metric|slowdown'),
        value: waiting || !ready ? '—' : `${fmtSigned(slowdown, 2)}%`,
        color: waiting || !ready ? COLORS.dim : slowdown <= -5 ? COLORS.red : slowdown <= -1 ? COLORS.gold : COLORS.green,
      }),
      h(MetricLine, {
        key: 'deficit',
        label: t('mods|goldSpeedrun|metric|deficit'),
        value: waiting || !ready
          ? '—'
          : `${fmtSigned(Math.round(deficit), 0)} (${fmtSigned(deficit * TICK_MS / 1000, 1)} s)`,
        color: waiting || !ready ? COLORS.dim : deficit >= 300 ? COLORS.red : deficit >= 60 ? COLORS.gold : COLORS.green,
      }),
    ]),
    advanced && !waiting
      ? h('div', {
          key: 'advanced',
          style: {
            marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', gap: '1px',
          },
        }, [
          h(MetricLine, { key: 'u', label: t('mods|goldSpeedrun|metric|ticks'), value: ready ? api.i18n.formatNumber(liveU()) : '—' }),
          h(MetricLine, { key: 'avg', label: t('mods|goldSpeedrun|metric|avgUps'), value: ready ? avgUps().toFixed(1) : '—' }),
          h(MetricLine, { key: 'ideal', label: t('mods|goldSpeedrun|metric|idealTicks'), value: api.i18n.formatNumber(Math.round(idealTicks())) }),
          h(MetricLine, { key: 'mult', label: t('mods|goldSpeedrun|metric|thinkMult'), value: ready ? `${thinkingMultiplier().toFixed(2)}×` : '—' }),
          h(MetricLine, { key: 'wr', label: t('mods|goldSpeedrun|metric|wrProbe'), value: `${fmtSigned(wMinusR(), 0)} ms` }),
        ])
      : null,
  ];

  const progressBlock = [
    h('div', { key: 'goal', style: { marginTop: horizontal ? 0 : '4px', opacity: 0.85 } },
      waiting
        ? t(startMode() === 'move'
            ? 'mods|goldSpeedrun|waitingMove'
            : startMode() === 'any'
              ? 'mods|goldSpeedrun|waiting'
              : startMode() === 'click'
                ? 'mods|goldSpeedrun|waitingClick'
                : 'mods|goldSpeedrun|waitingMouse')
        : progressText),
    h('div', {
      key: 'bar',
      style: {
        marginTop: '5px', height: '4px', borderRadius: '2px',
        background: 'rgba(255,255,255,0.14)', overflow: 'hidden',
      },
    }, h('div', {
      style: {
        width: `${pct}%`, height: '100%',
        background: done ? COLORS.gold : COLORS.blue,
      },
    })),
    showSplits
      ? h('div', {
          key: 'splits',
          style: {
            marginTop: '6px', paddingTop: '5px',
            borderTop: '1px solid rgba(255,255,255,0.10)',
            fontSize: '11px',
          },
        }, [
          firstVisible > 0
            ? h('div', {
                key: 'more',
                style: { color: COLORS.dim, opacity: 0.7, paddingBottom: '2px' },
              }, `+${firstVisible} …`)
            : null,
          h(SplitTable, { key: 'tbl', splits: visible, fmt, wide: false, pbSplits }),
        ])
      : null,
  ];

  const graphBlock = sparkline && !waiting
    ? h('div', { key: 'spark', style: { marginTop: horizontal ? 0 : '5px', minWidth: horizontal ? '180px' : undefined } },
        h(UpsEnvelopeGraph, {
          columns: sparklineColumns(),
          height: horizontal ? 52 : 26,
        }))
    : null;

  const infoBlock = [
    h('div', {
      key: 'foot',
      style: {
        marginTop: graphBlock ? '5px' : 0, fontSize: '11px', opacity: 0.6,
        display: 'flex', gap: '10px', justifyContent: 'space-between',
      },
    }, [
      h('span', { key: 'mode' }, categoryLabel()),
      best !== null && best > 0 ? h('span', { key: 'pb' }, `PB ${formatTime(best, fmt)}`) : null,
    ]),
    rules
      ? h('div', {
          key: 'rules',
          style: {
            marginTop: '3px',
            font: '700 10px/1.3 system-ui, sans-serif',
            letterSpacing: '0.07em',
            color: rules.ok ? COLORS.green : rules.broken ? COLORS.red : COLORS.dim,
            opacity: rules.ok || rules.broken ? 0.95 : 0.5,
          },
        }, rules.ok
          ? `✓ ${t('mods|goldSpeedrun|rules|badge')}`
          : rules.broken
            ? t('mods|goldSpeedrun|rules|broken')
            : t('mods|goldSpeedrun|rules|custom'))
      : null,
    tainted
      ? h('div', {
          key: 'tainted',
          style: { marginTop: '4px', fontSize: '11px', color: COLORS.red, fontWeight: 700 },
        }, t('mods|goldSpeedrun|tainted'))
      : null,
  ];

  const box = {
    position: 'absolute',
    ...corner,
    width: 'fit-content',
    maxWidth: '92vw',
    minWidth: horizontal ? undefined : (fmt === 'seconds' ? '210px' : '235px'),
    padding: horizontal ? '6px 8px' : '8px 10px',
    borderRadius: '6px',
    border: `1px solid ${tainted ? COLORS.red : done ? COLORS.gold : waiting ? COLORS.border : '#5a6472'}`,
    opacity: waiting ? 0.75 : 1,
    background: COLORS.box,
    color: COLORS.text,
    font: '500 13px/1.35 system-ui, sans-serif',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: horizontal ? 'row' : 'column',
    alignItems: horizontal ? 'flex-start' : 'stretch',
    gap: horizontal ? '12px' : 0,
    // DE: Ueber der Tutorial-Box (die liegt auf 10006) - sonst verdeckt sie den
    // DE: Timer genau dort, wo er standardmaessig sitzt.
    // EN: Above the tutorial box (which sits at 10006) - otherwise it would
    // EN: cover the timer exactly where it sits by default.
    zIndex: 10010,
  };

  if (horizontal) {
    return h('div', { style: box }, [
      col('left', progressBlock, { minWidth: '210px', maxWidth: '280px' }),
      col('mid', clockBlock, { minWidth: fmt === 'seconds' ? '200px' : '220px' }),
      col('right', [graphBlock, ...infoBlock], { minWidth: sparkline ? '180px' : '140px' }),
    ]);
  }

  return h('div', { style: box }, [
    ...clockBlock,
    graphBlock,
    ...progressBlock,
    ...infoBlock,
  ]);
}

api.ui.inject('hud', SpeedrunHud);

// --- DE: Ergebnisfenster / EN: Result screen ---------------------------------
// DE: Erscheint, sobald ein Lauf endet, und zeigt die vollstaendige Tabelle mit
// DE: Abschnittszeiten und Goldstand. F10 holt es zurueck.
// EN: Appears as soon as a run ends, and shows the full table with segment
// EN: times and gold total. F10 brings it back.
const resultListeners = new Set();
const notifyResult = () => resultListeners.forEach(fn => {
  try { fn(); } catch (e) { /* DE: ignorieren / EN: ignore */ }
});

const setResultDismissed = v => { resultDismissed = !!v; notifyResult(); };

function ResultScreen() {
  const [, bump] = react.useState(0);
  const [expanded, setExpanded] = react.useState(false);

  react.useEffect(() => {
    const fn = () => bump(n => (n + 1) % 100000);
    resultListeners.add(fn);
    // DE: Der Lauf kann jederzeit enden, ohne dass jemand klickt - also nachsehen.
    // EN: The run can end at any time without anyone clicking anything - so check periodically.
    const id = setInterval(fn, 300);
    return () => { resultListeners.delete(fn); clearInterval(id); };
  }, []);

  if (!modEnabled()) return null;
  if (resultDismissed) return null;

  const run = readRun();
  if (typeof run.finishedAt !== 'number' || typeof run.startedAt !== 'number') return null;

  const fmt = timeFormat();
  const total = elapsed();
  const totalSim = elapsedSim();
  const totalPlay = elapsedPlay();
  const slowdown = slowdownPercent();
  const deficit = tickDeficit();
  const ready = tickSourceReady();
  const splits = readSplits();
  const best = readBest();
  const tainted = cheatsUsed();
  const delta = best !== null ? total - best : null;
  const rules = showRuleset() ? rulesetView() : null;

  const line = (label, value, color) => h('div', {
    style: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'baseline' },
  }, [
    h('span', { key: 'l', style: { color: COLORS.dim, fontSize: '12px' } }, label),
    h('span', {
      key: 'v',
      style: {
        color: color || COLORS.text,
        fontVariantNumeric: 'tabular-nums',
        font: '700 15px/1.2 system-ui, sans-serif',
      },
    }, value),
  ]);

  return h('div', {
    style: {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: expanded ? '560px' : '460px', maxWidth: '92vw', maxHeight: '86vh',
      display: 'flex', flexDirection: 'column',
      padding: '16px 18px',
      borderRadius: '8px',
      border: `1px solid ${tainted ? COLORS.red : COLORS.gold}`,
      background: COLORS.panel,
      boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
      color: COLORS.text,
      font: '500 13px/1.4 system-ui, sans-serif',
      zIndex: 60,
    },
  }, [
    h('div', {
      key: 'head',
      style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' },
    }, [
      h('div', {
        key: 'title',
        style: { flex: 1, font: '700 17px/1 system-ui, sans-serif', letterSpacing: '0.04em' },
      }, t('mods|goldSpeedrun|result|title')),
      h('div', {
        key: 'cat',
        style: { font: '400 12px/1 system-ui, sans-serif', color: COLORS.dim },
      }, categoryLabel()),
    ]),

    h('div', {
      key: 'summary',
      style: {
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '8px 10px', marginBottom: '10px',
        borderRadius: '5px', background: 'rgba(255,255,255,0.04)',
      },
    }, [
      h('div', { key: 'total' },
        line(t('mods|goldSpeedrun|result|total'), formatTime(total, fmt), COLORS.gold)),
      h('div', { key: 'best' },
        line(
          t('mods|goldSpeedrun|result|best'),
          best === null
            ? t('mods|goldSpeedrun|result|noBest')
            : `${formatTime(best, fmt)}  (${delta <= 0 ? '-' : '+'}${formatShort(Math.abs(delta), fmt)})`,
          best === null ? COLORS.dim : delta <= 0 ? COLORS.green : COLORS.red,
        )),

      // DE: Verzoegerung und Schritt-Rueckstand stehen immer mit im Ergebnis,
      // DE: klein und ohne Umschalter - dieselbe Vorgabe wie im HUD.
      // EN: Slowdown and tick deficit always appear in the result, small and
      // EN: with no way to turn them off - the same requirement as in the HUD.
      h('div', {
        key: 'metrics',
        style: {
          marginTop: '3px', display: 'flex', gap: '16px',
          fontSize: '11px', color: COLORS.dim, fontVariantNumeric: 'tabular-nums',
        },
      }, [
        h('span', { key: 'slow' },
          `${t('mods|goldSpeedrun|metric|slowdown')}: ${ready ? `${fmtSigned(slowdown, 2)}%` : '—'}`),
        h('span', { key: 'deficit' },
          `${t('mods|goldSpeedrun|metric|deficit')}: ${ready ? `${fmtSigned(Math.round(deficit), 0)} (${fmtSigned(deficit * TICK_MS / 1000, 1)} s)` : '—'}`),
      ]),

      h('button', {
        key: 'expand',
        onClick: () => setExpanded(v => !v),
        style: {
          marginTop: '6px', alignSelf: 'flex-start', cursor: 'pointer',
          padding: '3px 9px', borderRadius: '4px',
          border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.blue,
          font: '600 11px/1 system-ui, sans-serif',
        },
      }, t(expanded ? 'mods|goldSpeedrun|result|collapse' : 'mods|goldSpeedrun|result|expand')),

      expanded
        ? h('div', {
            key: 'full',
            style: {
              marginTop: '8px', paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            },
          }, [
            h('div', { key: 'sim' },
              line(t('mods|goldSpeedrun|result|sim'), ready ? formatTime(totalSim, fmt) : '—', COLORS.text)),
            h('div', { key: 'play' },
              line(t('mods|goldSpeedrun|result|play'), formatTime(totalPlay, fmt), COLORS.text)),

            !ready
              ? h('div', {
                  key: 'noTick',
                  style: { fontSize: '11px', color: COLORS.dim, marginTop: '2px' },
                }, t('mods|goldSpeedrun|result|tickSourceMissing'))
              : null,

            h('div', {
              key: 'advanced',
              style: {
                marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px',
              },
            }, [
              h(MetricLine, { key: 'u', label: t('mods|goldSpeedrun|metric|ticks'), value: ready ? api.i18n.formatNumber(Math.round(totalSim / TICK_MS)) : '—' }),
              h(MetricLine, { key: 'avg', label: t('mods|goldSpeedrun|metric|avgUps'), value: ready && total > 0 ? ((totalSim / TICK_MS) / (total / 1000)).toFixed(1) : '—' }),
              h(MetricLine, { key: 'ideal', label: t('mods|goldSpeedrun|metric|idealTicks'), value: api.i18n.formatNumber(Math.round((total / 1000) * TICK_HZ)) }),
              h(MetricLine, { key: 'mult', label: t('mods|goldSpeedrun|metric|thinkMult'), value: ready && totalSim > 0 ? `${(total / totalSim).toFixed(2)}×` : '—' }),
              h(MetricLine, { key: 'wr', label: t('mods|goldSpeedrun|metric|wrProbe'), value: `${fmtSigned(totalPlay - total, 0)} ms` }),
            ]),

            h('div', { key: 'graphTitle', style: { marginTop: '6px', fontSize: '11px', color: COLORS.dim } },
              t('mods|goldSpeedrun|graph|title')),
            h('div', { key: 'graph', style: { marginTop: '2px' } },
              h(UpsEnvelopeGraph, { columns: downsampleToColumns(historyBuf, 120, bucketStats), height: 90 })),
          ])
        : null,
    ]),

    // DE: Regelwerk: bestaetigt den Lauf, oder benennt genau die Einstellungen,
    // DE: die von den offiziellen Kategorien abweichen.
    // EN: Ruleset: confirms the run, or names exactly the settings that
    // EN: deviate from the official categories.
    rules
      ? h('div', {
          key: 'rules',
          style: {
            marginBottom: '10px', padding: '7px 10px', borderRadius: '5px',
            border: `1px solid ${rules.ok
              ? 'rgba(74, 222, 128, 0.45)'
              : rules.broken ? 'rgba(224, 82, 82, 0.55)' : COLORS.border}`,
            background: rules.ok
              ? 'rgba(74, 222, 128, 0.08)'
              : rules.broken ? 'rgba(224, 82, 82, 0.10)' : 'rgba(255,255,255,0.03)',
          },
        }, [
          h('div', {
            key: 'title',
            style: {
              font: '700 11px/1.3 system-ui, sans-serif', letterSpacing: '0.07em',
              color: rules.ok ? COLORS.green : rules.broken ? COLORS.red : COLORS.dim,
            },
          }, rules.ok
            ? `✓ ${t('mods|goldSpeedrun|rules|badge')}`
            : rules.broken
              ? t('mods|goldSpeedrun|rules|broken')
              : t('mods|goldSpeedrun|rules|title')),

          h('div', {
            key: 'desc',
            style: { marginTop: '3px', fontSize: '11px', color: COLORS.dim },
          }, rules.broken
            ? t('mods|goldSpeedrun|rules|brokenDesc')
            : t(rules.ok ? 'mods|goldSpeedrun|rules|ok' : 'mods|goldSpeedrun|rules|bad')
              + (rules.ok && rules.locked ? ` (${t('mods|goldSpeedrun|rules|locked')})` : '')
              + (!rules.locked && officialMode() ? ` (${t('mods|goldSpeedrun|rules|forced')})` : '')),

          rules.ok || rules.broken ? null : h('div', {
            key: 'list',
            style: {
              marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px',
              fontSize: '11px',
            },
          }, rules.items.filter(i => !i.ok).map(i => h('div', {
            key: i.id,
            style: { display: 'flex', justifyContent: 'space-between', gap: '12px' },
          }, [
            h('span', { key: 'l' }, i.label),
            h('span', {
              key: 'v',
              style: { color: COLORS.red, textAlign: 'right' },
            }, i.extra.length > 0
              ? i.extra.join(', ')
              : t('mods|goldSpeedrun|rules|need', { value: i.value })),
          ]))),
        ])
      : null,

    tainted
      ? h('div', {
          key: 'tainted',
          style: { marginBottom: '10px', color: COLORS.red, fontWeight: 700, fontSize: '12px' },
        }, t('mods|goldSpeedrun|tainted'))
      : null,

    h('div', {
      key: 'cols',
      style: {
        display: 'flex', gap: '8px', fontSize: '11px', color: COLORS.dim,
        paddingBottom: '4px', borderBottom: `1px solid ${COLORS.border}`,
      },
    }, [
      h('span', { key: 'a', style: { flex: 1 } }, t('mods|goldSpeedrun|result|colSplit')),
      h('span', { key: 'b', style: { minWidth: '72px', textAlign: 'right' } }, t('mods|goldSpeedrun|result|colSegment')),
      h('span', { key: 'c', style: { minWidth: '104px', textAlign: 'right' } }, t('mods|goldSpeedrun|result|colTime')),
      h('span', { key: 'd', style: { minWidth: '76px', textAlign: 'right' } }, t('mods|goldSpeedrun|result|colGold')),
    ]),

    h('div', {
      key: 'list',
      style: { overflowY: 'auto', flex: 1, fontSize: '12px', paddingTop: '2px' },
    }, splits.length > 0
      ? h(SplitTable, { splits, fmt, wide: true })
      : h('div', { style: { color: COLORS.dim, padding: '10px 0' } },
          t('mods|goldSpeedrun|result|noSplits'))),

    h('div', {
      key: 'foot',
      style: {
        marginTop: '12px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px',
      },
    }, [
      h('span', {
        key: 'hint',
        style: { fontSize: '11px', color: COLORS.dim },
      }, t('mods|goldSpeedrun|result|hint')),
      h('button', {
        key: 'close',
        onClick: () => setResultDismissed(true),
        style: {
          cursor: 'pointer', padding: '5px 14px', borderRadius: '4px',
          border: `1px solid ${COLORS.border}`, background: '#000', color: COLORS.text,
          font: '600 12px/1 system-ui, sans-serif',
        },
      }, t('mods|goldSpeedrun|result|close')),
    ]),
  ]);
}

api.ui.inject('panel', ResultScreen);

// --- DE: Ausloeser-Fenster / EN: Triggers window ----------------------------
// DE: Ein Schalter je Forschung, je Fabrikrang und je Gold-Marke. Damit stellt
// DE: sich jeder seinen Lauf selbst zusammen, ohne dass die Mod-Einstellungen mit
// DE: Dutzenden Feldern zugestellt werden.
// EN: A switch for every research, every factory rank and every gold mark.
// EN: This lets everyone put their own run together, without cluttering the
// EN: mod settings with dozens of fields.
let triggerPanelOpen = false;
let techFilter = '';

const panelListeners = new Set();
const notifyPanel = () => panelListeners.forEach(fn => {
  try { fn(); } catch (e) { /* DE: ignorieren / EN: ignore */ }
});

const setTriggerPanelOpen = v => { triggerPanelOpen = !!v; notifyPanel(); };

function Switch({ on, onClick, label }) {
  return h('button', {
    onClick,
    style: {
      cursor: 'pointer',
      minWidth: '46px',
      padding: '2px 7px',
      borderRadius: '4px',
      border: `1px solid ${on ? COLORS.green : '#64748b'}`,
      background: on ? 'rgba(74, 222, 128, 0.16)' : 'rgba(100, 116, 139, 0.14)',
      color: on ? COLORS.green : COLORS.dim,
      font: '700 10px/1 system-ui, sans-serif',
      letterSpacing: '0.06em',
    },
  }, label || t(on ? 'mods|goldSpeedrun|btn|on' : 'mods|goldSpeedrun|btn|off'));
}

function SmallButton({ onClick, children }) {
  return h('button', {
    onClick,
    style: {
      cursor: 'pointer', padding: '3px 9px', borderRadius: '4px',
      border: `1px solid ${COLORS.border}`, background: '#000', color: COLORS.dim,
      font: '600 10px/1 system-ui, sans-serif',
    },
  }, children);
}

function TriggerRow({ label, on, onToggle, overridden }) {
  return h('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '4px 2px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
  }, [
    h('span', {
      key: 'l',
      style: {
        flex: 1, minWidth: 0,
        color: on ? COLORS.text : COLORS.dim,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: '12px',
      },
    }, label),
    // DE: Ein Punkt markiert, was vom Gruppen-Standard abweicht.
    // EN: A dot marks anything that deviates from the group default.
    h('span', {
      key: 'd',
      style: { width: '6px', color: COLORS.blue, fontSize: '10px' },
    }, overridden ? '•' : ''),
    h(Switch, { key: 's', on, onClick: onToggle }),
  ]);
}

function Section({ title, count, total, actions, children }) {
  return h('div', { style: { marginBottom: '12px' } }, [
    h('div', {
      key: 'head',
      style: {
        display: 'flex', alignItems: 'center', gap: '8px',
        paddingBottom: '4px', borderBottom: `1px solid ${COLORS.border}`,
        marginBottom: '4px',
      },
    }, [
      h('span', {
        key: 't',
        style: { flex: 1, font: '700 12px/1 system-ui, sans-serif', letterSpacing: '0.04em' },
      }, title),
      total !== undefined
        ? h('span', { key: 'c', style: { fontSize: '11px', color: COLORS.dim } },
            t('mods|goldSpeedrun|trg|count', { on: count, total }))
        : null,
      ...(actions || []),
    ]),
    children,
  ]);
}

function TriggerPanel() {
  const [, bump] = react.useState(0);

  react.useEffect(() => {
    const fn = () => bump(n => (n + 1) % 100000);
    panelListeners.add(fn);
    return () => panelListeners.delete(fn);
  }, []);

  if (!modEnabled()) return null;
  if (!triggerPanelOpen) return null;

  const overrides = readOverrides();
  const isOverridden = (kind, id) => typeof overrides[triggerKey(kind, id)] === 'boolean';
  const toggle = (kind, id, current) => () => {
    setTriggerEnabled(kind, id, !current);
    notifyPanel();
  };
  const group = (kind, ids, value) => () => { setGroup(kind, ids, value); notifyPanel(); };

  // DE: Forschungen, nach angezeigtem Namen sortiert - die IDs sagen wenig.
  // EN: Research, sorted by its displayed name - the IDs don't say much.
  const techs = allTechIds()
    .map(id => ({ id, name: techName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const filter = techFilter.trim().toLowerCase();
  const shownTechs = filter
    ? techs.filter(x => x.name.toLowerCase().includes(filter) || x.id.toLowerCase().includes(filter))
    : techs;
  const techDefault = splitOn('splitTech');
  const techOn = techs.filter(x => triggerEnabled('tech', x.id, techDefault)).length;

  const ranks = rankIds();
  const rankDefault = splitOn('splitRank');
  const rankOn = ranks.filter(l => triggerEnabled('rank', l, rankDefault)).length;

  const marks = currentGoldMarks(category());
  const markOn = marks.filter(m => triggerEnabled('gold', m.value, true)).length;

  return h('div', {
    style: {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '520px', maxWidth: '94vw', height: '78vh',
      display: 'flex', flexDirection: 'column',
      padding: '16px 18px',
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      background: COLORS.panel,
      boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
      color: COLORS.text,
      font: '500 13px/1.4 system-ui, sans-serif',
      zIndex: 55,
    },
  }, [
    h('div', {
      key: 'head',
      style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' },
    }, [
      h('div', {
        key: 't',
        style: { flex: 1, font: '700 17px/1 system-ui, sans-serif', letterSpacing: '0.04em' },
      }, t('mods|goldSpeedrun|trg|title')),
      h('div', {
        key: 'c',
        style: { font: '400 12px/1 system-ui, sans-serif', color: COLORS.dim },
      }, categoryLabel()),
    ]),

    isRunning()
      ? h('div', {
          key: 'lock',
          style: {
            marginBottom: '8px', padding: '6px 8px', borderRadius: '4px',
            background: 'rgba(240,192,64,0.10)', color: COLORS.gold, fontSize: '11px',
          },
        }, t('mods|goldSpeedrun|trg|locked'))
      : null,

    h('div', { key: 'scroll', style: { flex: 1, overflowY: 'auto', paddingRight: '4px' } }, [

      // --- Weitere ---------------------------------------------------------
      h(Section, { key: 'other', title: t('mods|goldSpeedrun|trg|other') },
        h('div', {}, [
          h(TriggerRow, {
            key: 'art',
            label: t('mods|goldSpeedrun|trg|artifactAll'),
            on: triggerEnabled('artifact', 'any', splitOn('splitArtifact')),
            overridden: isOverridden('artifact', 'any'),
            onToggle: toggle('artifact', 'any', triggerEnabled('artifact', 'any', splitOn('splitArtifact'))),
          }),
          h(TriggerRow, {
            key: 'upg',
            label: t('mods|goldSpeedrun|trg|upgradeAll'),
            on: triggerEnabled('upgrade', 'any', splitOn('splitUpgrade')),
            overridden: isOverridden('upgrade', 'any'),
            onToggle: toggle('upgrade', 'any', triggerEnabled('upgrade', 'any', splitOn('splitUpgrade'))),
          }),
        ])),

      // --- Fabrikraenge ----------------------------------------------------
      h(Section, {
        key: 'ranks',
        title: t('mods|goldSpeedrun|trg|rank'),
        count: rankOn,
        total: ranks.length,
        actions: [
          h(SmallButton, { key: 'on', onClick: group('rank', ranks, true) }, t('mods|goldSpeedrun|trg|allOn')),
          h(SmallButton, { key: 'off', onClick: group('rank', ranks, false) }, t('mods|goldSpeedrun|trg|allOff')),
          h(SmallButton, { key: 'def', onClick: group('rank', ranks, null) }, t('mods|goldSpeedrun|trg|default')),
        ],
      }, h('div', {}, ranks.map(lvl => h(TriggerRow, {
        key: lvl,
        label: t('mods|goldSpeedrun|split|rank', { level: lvl }),
        on: triggerEnabled('rank', lvl, rankDefault),
        overridden: isOverridden('rank', lvl),
        onToggle: toggle('rank', lvl, triggerEnabled('rank', lvl, rankDefault)),
      })))),

      // --- Gold-Marken -----------------------------------------------------
      h(Section, {
        key: 'gold',
        title: t('mods|goldSpeedrun|trg|gold'),
        count: markOn,
        total: marks.length,
        actions: marks.length > 0 ? [
          h(SmallButton, { key: 'on', onClick: group('gold', marks.map(m => m.value), true) }, t('mods|goldSpeedrun|trg|allOn')),
          h(SmallButton, { key: 'off', onClick: group('gold', marks.map(m => m.value), false) }, t('mods|goldSpeedrun|trg|allOff')),
        ] : [],
      }, marks.length > 0
        ? h('div', {}, marks.map(m => h(TriggerRow, {
            key: m.value,
            label: `${m.label}  ·  ${formatGold(m.value)}`,
            on: triggerEnabled('gold', m.value, true),
            overridden: isOverridden('gold', m.value),
            onToggle: toggle('gold', m.value, triggerEnabled('gold', m.value, true)),
          })))
        : h('div', { style: { color: COLORS.dim, fontSize: '11px', padding: '6px 0' } },
            t('mods|goldSpeedrun|trg|noGoldMarks'))),

      // --- Forschungen -----------------------------------------------------
      h(Section, {
        key: 'tech',
        title: t('mods|goldSpeedrun|trg|tech'),
        count: techOn,
        total: techs.length,
        actions: [
          h(SmallButton, { key: 'on', onClick: group('tech', techs.map(x => x.id), true) }, t('mods|goldSpeedrun|trg|allOn')),
          h(SmallButton, { key: 'off', onClick: group('tech', techs.map(x => x.id), false) }, t('mods|goldSpeedrun|trg|allOff')),
          h(SmallButton, { key: 'def', onClick: group('tech', techs.map(x => x.id), null) }, t('mods|goldSpeedrun|trg|default')),
        ],
      }, h('div', {}, [
        h('input', {
          key: 'filter',
          value: techFilter,
          placeholder: t('mods|goldSpeedrun|trg|filter'),
          onChange: e => { techFilter = e.target.value; notifyPanel(); },
          style: {
            width: '100%', marginBottom: '6px', padding: '4px 7px',
            borderRadius: '4px', border: `1px solid ${COLORS.border}`,
            background: '#000', color: COLORS.text,
            font: '500 12px/1.2 system-ui, sans-serif',
          },
        }),
        ...shownTechs.map(x => h(TriggerRow, {
          key: x.id,
          label: x.name,
          on: triggerEnabled('tech', x.id, techDefault),
          overridden: isOverridden('tech', x.id),
          onToggle: toggle('tech', x.id, triggerEnabled('tech', x.id, techDefault)),
        })),
      ])),
    ]),

    h('div', {
      key: 'foot',
      style: {
        marginTop: '10px', paddingTop: '9px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'flex-end', gap: '12px',
      },
    }, [
      h('span', {
        key: 'hint',
        style: { flex: 1, fontSize: '11px', color: COLORS.dim, lineHeight: 1.45 },
      }, t('mods|goldSpeedrun|trg|hint')),
      h('button', {
        key: 'close',
        onClick: () => setTriggerPanelOpen(false),
        style: {
          cursor: 'pointer', padding: '5px 14px', borderRadius: '4px',
          border: `1px solid ${COLORS.border}`, background: '#000', color: COLORS.text,
          font: '600 12px/1 system-ui, sans-serif',
        },
      }, t('mods|goldSpeedrun|result|close')),
    ]),
  ]);
}

api.ui.inject('panel', TriggerPanel);

// --- DE: Tastenkuerzel / EN: Keyboard shortcuts ------------------------------
// DE: F8 und F10 sind in den Standardbelegungen frei (belegt sind F2, F4, F5, F9).
// EN: F8 and F10 are free in the default bindings (F2, F4, F5, F9 are taken).
let lastResetToggle = 0;
api.input.registerBinding('GoldSpeedrunReset', ['F8'], {
  displayNameKey: 'mods|goldSpeedrun|resetKey',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => {
      if (Date.now() - lastResetToggle < 250) return;
      lastResetToggle = Date.now();
      api.storage.set(NS, 'startedAt', null);
      api.storage.set(NS, 'finishedAt', null);
      api.storage.set(NS, 'splits', []);
      api.storage.set(NS, 'goldMarkIndex', 0);
      api.storage.set(NS, 'official', false);
      api.storage.set(NS, 'officialBroken', false);
      startClocks();
      resetHistory();
      resetEarned();
      setResultDismissed(true);
      api.ui.toast({ key: 'mods|goldSpeedrun|reset' });
    },
  },
});

api.input.registerBinding('GoldSpeedrunResult', ['F10'], {
  displayNameKey: 'mods|goldSpeedrun|resultKey',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => setResultDismissed(!resultDismissed),
  },
});

let lastTriggerToggle = 0;
// DE: F3 ist in den Standardbelegungen frei (belegt sind F2, F4, F5, F9).
// EN: F3 is free in the default bindings (F2, F4, F5, F9 are taken).
api.input.registerBinding('GoldSpeedrunTriggers', ['F3'], {
  displayNameKey: 'mods|goldSpeedrun|trg|key',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => {
      if (Date.now() - lastTriggerToggle < 250) return;
      lastTriggerToggle = Date.now();
      setTriggerPanelOpen(!triggerPanelOpen);
    },
  },
});

// --- DE: Tutorial ueberspringen / EN: Skipping the tutorial ------------------
// DE: Beendet das Tutorial genau wie der Knopf im Spiel: die Simulations-Threads
// DE: werden informiert und die normalen Freischaltungen (Shaker) vergeben.
// DE: Waehrenddessen ist der Start gesperrt, sonst wuerde das dabei ausgeloeste
// DE: "tech:unlocked" den Timer starten.
// DE: Intro und Landeanflug ueberspringen. Genau das, was der Knopf
// DE: "Skip Intro" im Spiel tut: Intro-Bildschirm zu, Musik aus, und die interne
// DE: game.start(..., {skip:true}), die direkt in die Spielszene springt.
//
// DE: Wichtig fuer die Zeitnahme: der uebersprungene Landeanflug setzt die
// DE: Szenen-Trigger und laesst die Kapsel aufschlagen. Das kann Gelaende
// DE: zerstoeren - ohne Sperre wuerde das den Timer starten.
//
// EN: Ends the tutorial exactly like the in-game button: the simulation
// EN: threads get notified and the normal unlocks (Shaker) are granted. The
// EN: start is locked while this happens, otherwise the "tech:unlocked" it
// EN: triggers would start the timer.
// EN: Skips the intro and landing approach. Exactly what the "Skip Intro"
// EN: button in the game does: closes the intro screen, stops the music, and
// EN: calls the internal game.start(..., {skip:true}), which jumps straight
// EN: into the game scene.
//
// EN: Important for timing: the skipped landing approach sets the scene
// EN: triggers and lets the capsule crash down. That can destroy terrain -
// EN: without a lock, that would start the timer.
const activeScene = () => {
  try { return sandkit.state.store.scene.active; } catch (e) { return null; }
};

const introVisible = () => {
  try { return sandkit.state.session.ui.introScreen.visible === true; } catch (e) { return false; }
};

// --- DE: Story-Textboxen / EN: Story text boxes ------------------------------
// DE: Das Spiel schiebt sie unter anderem beim Beenden des Tutorials nach - mit
// DE: Verzoegerung, deshalb tauchen sie erst nach dem Skip auf.
//
// DE: Weggeklickt werden sie im Spiel so: aus session.notifications.story
// DE: entfernen und "story:notificationDismissed" feuern. Das zweite ist wichtig -
// DE: erst dadurch merkt sich die Story, dass der Schritt gezeigt wurde. Ein
// DE: blosses Leeren der Liste liesse sie spaeter wiederkommen.
//
// EN: The game queues these up, among other things, when the tutorial ends -
// EN: with a delay, so they only show up after the skip.
//
// EN: The game dismisses them like this: remove from
// EN: session.notifications.story and fire "story:notificationDismissed".
// EN: The second part matters - only that makes the story remember the step
// EN: was shown. Just clearing the list would let them come back later.
const storyNotifications = () => {
  try {
    const list = sandkit.state.session.notifications.story;
    return Array.isArray(list) ? list : null;
  } catch (e) {
    return null;
  }
};

const dismissStoryNotifications = () => {
  const list = storyNotifications();
  if (!list || list.length === 0) return 0;

  const pending = list.slice();
  sandkit.state.session.notifications.story = [];

  for (const notification of pending) {
    try {
      api.events.emit('story:notificationDismissed', { notification });
    } catch (e) { /* DE: Story-System nicht aktiv / EN: story system not active */ }
  }
  for (const id of ['StoryNotifications', 'Notifications', 'Objectives']) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* DE: Komponente inaktiv / EN: component not active */ }
  }

  log(`${pending.length} Story-Textbox(en) weggeblendet`);
  return pending.length;
};

// DE: Wie bei skipTutorialEnabled: im offiziellen Regelwerk laeuft der Anfang ab,
// DE: egal was in den Schaltern steht.
// EN: Just like skipTutorialEnabled: under the official ruleset, the opening
// EN: plays out normally, no matter what the switches say.
const skipStoryEnabled = () => !officialMode() && api.settings.get('skipStory') !== false;

const skipIntroEnabled = () => !officialMode() && api.settings.get('skipIntro') !== false;

// DE: Eigener Takt in Echtzeit: die Boxen kommen verzoegert und auch mitten im
// DE: Lauf, das Spiel-Update ist dafuer der falsche Aufhaenger.
// EN: Its own real-time interval: the boxes arrive with a delay, and also
// EN: mid-run, so the game update is the wrong thing to hook this to.
setInterval(() => {
  if (!modEnabled()) return;
  if (!skipStoryEnabled()) return;
  try { dismissStoryNotifications(); } catch (e) { /* DE: naechster Takt / EN: try again next tick */ }
}, 500);

// DE: Solange eine Textbox oder der Intro-Bildschirm im Weg steht, spielt niemand -
// DE: ein Klick oder Tastendruck dagegen darf den Timer nicht anwerfen. Bei
// DE: eingeschaltetem Wegblenden sind die Boxen binnen einer halben Sekunde weg,
// DE: es blockiert also nichts dauerhaft.
// EN: As long as a text box or the intro screen is in the way, nobody is
// EN: playing - a click or key press against it must not start the timer.
// EN: With auto-dismiss enabled, the boxes are gone within half a second, so
// EN: nothing blocks permanently.
const uiBlocksStart = () => {
  try {
    const session = sandkit.state.session;
    if (session.ui && session.ui.introScreen && session.ui.introScreen.visible) return true;
    if (Array.isArray(session.ui && session.ui.dialogs) && session.ui.dialogs.length > 0) return true;
    // DE: Auch ohne Wegblenden: solange eine Box im Bild steht, spielt niemand,
    // DE: und der Klick, der sie wegmacht, ist keine Spielhandlung.
    // EN: Even without auto-dismiss: as long as a box is on screen, nobody is
    // EN: playing, and the click that dismisses it isn't an in-game action.
    const list = storyNotifications();
    if (list && list.length > 0) return true;
  } catch (e) { /* DE: Sitzung noch nicht vollstaendig / EN: session not fully initialized yet */ }
  return false;
};

const closeIntroScreen = () => {
  try { sandkit.state.session.ui.introScreen.visible = false; } catch (e) { return; }
  for (const id of ['IntroScreen', 'Root']) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* DE: Komponente inaktiv / EN: component not active */ }
  }
};

const skipIntro = () => {
  // DE: Gleicher Riegel wie beim Tutorial: die Einstellung entscheidet, nicht
  // DE: der Aufrufer.
  // EN: Same guard as with the tutorial: the setting decides, not the caller.
  if (!skipIntroEnabled()) {
    log('Intro-Skip abgelehnt - die Einstellung steht auf aus'
      + (officialMode() ? ' (offizielles Regelwerk)' : ''));
    return false;
  }

  const state = sandkit.state;
  const start = sandkit.engine
    && sandkit.engine.api
    && sandkit.engine.api.game
    && sandkit.engine.api.game.start;
  if (typeof start !== 'function') {
    log('Intro-Skip nicht moeglich: game.start fehlt in dieser Spielversion.');
    return false;
  }

  suppressFor(2000);
  graceFor(4000);

  closeIntroScreen();
  try { state.session.music.engine.stop(); } catch (e) { /* DE: keine Musik / EN: no music engine */ }

  start(state, { skip: true });
  log('Intro uebersprungen');
  return true;
};

// DE: Nach einem Schreibvorgang muss das Menue neu zeichnen, sonst steht dort
// DE: weiter der Wert, den der Spieler gerade angeklickt hat.
// EN: After a write, the menu has to redraw, otherwise it would keep showing
// EN: the value the player just clicked.
const SETTINGS_UI = ['ModsScreen', 'Options', 'Menu', 'Root'];

const refreshSettingsUi = () => {
  for (const id of SETTINGS_UI) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* DE: Komponente inaktiv / EN: component not active */ }
  }
};

const TUTORIAL_UI = ['Tutorial', 'Objectives', 'ShortcutHelper', 'Root'];

const refreshTutorialUi = () => {
  for (const id of TUTORIAL_UI) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* DE: Komponente inaktiv / EN: component not active */ }
  }
};

// DE: Was der Knopf im Spiel ueber grantNormalUnlocks() mitgibt: die
// DE: Shaker-Forschung. Bricht der regulaere Weg vorher ab, fehlt sie - und der
// DE: Lauf startet mit weniger als bei jedem anderen.
// EN: What the in-game button grants via grantNormalUnlocks(): the Shaker
// EN: research. If the normal path aborts before that, it's missing - and
// EN: the run would start with less than everyone else's.
const grantTutorialUnlocks = () => {
  try {
    const player = sandkit.state.store.player;
    if (!player.tech) player.tech = {};
    const shaker = (enums.Tech && enums.Tech.Shaker) || 'shaker';
    if (player.tech[shaker]) return;

    player.tech[shaker] = true;
    try {
      api.player.buildings.unlockByType(enums.StructureType.ShakerRight);
    } catch (e) { /* DE: Struktur unbekannt / EN: structure unknown */ }
    for (const id of ['Hotbar', 'TechTree', 'Management', 'Resources']) {
      try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* DE: inaktiv / EN: not active */ }
    }
    log('Shaker-Freischaltung nachgezogen - der Knopf im Spiel vergibt sie ebenfalls');
  } catch (e) {
    log('Shaker-Freischaltung fehlgeschlagen:', e);
  }
};

const skipTutorial = () => {
  // DE: Letzter Riegel vor der Tuer: egal, wer hier hereinkommt - steht der
  // DE: Schalter auf aus oder gilt das offizielle Regelwerk, wird nichts
  // DE: uebersprungen. Der Waechter prueft das schon, aber diese Funktion
  // DE: beendet das Tutorial unwiderruflich; ein zweiter Riegel kostet nichts.
  // EN: One last gate before the door: no matter who walks in here, if the
  // EN: switch is off or the official ruleset applies, nothing gets skipped.
  // EN: The guard already checks this, but this function ends the tutorial
  // EN: irreversibly; a second gate costs nothing.
  if (!skipTutorialEnabled()) {
    log('Tutorial-Skip abgelehnt - die Einstellung steht auf aus'
      + (officialMode() ? ' (offizielles Regelwerk)' : ''));
    return false;
  }

  const store = sandkit.state.store;
  if (!store.tutorial || !store.tutorial.active) return false;
  log('Tutorial wird uebersprungen');

  suppressFor(1000);

  // DE: Das Spiel setzt in progression.complete das Flag als ERSTES und frischt
  // DE: das Bild als LETZTES auf. Bricht etwas dazwischen ab - etwa der
  // DE: postAll an die Simulations-Threads -, gilt das Tutorial intern als
  // DE: beendet, die Box steht aber weiter im Bild, die Shaker-Forschung fehlt
  // DE: und "tutorial:completed" ist nie gefeuert worden.
  // EN: In progression.complete, the game sets the flag FIRST and refreshes
  // EN: the screen LAST. If something aborts in between - say, the postAll to
  // EN: the simulation threads - the tutorial counts as finished internally,
  // EN: but the box still shows on screen, the Shaker research is missing,
  // EN: and "tutorial:completed" never fired.
  let clean = false;
  try {
    // DE: Identisch zum Knopf "Tutorial ueberspringen" im Spiel.
    // EN: Identical to the "Skip Tutorial" button in the game.
    clean = api.progression.complete({ domain: 'tutorial', grantNormalUnlocks: true }) !== false;
  } catch (e) {
    log('Tutorial regulaer beenden abgebrochen:', e);
  }

  // DE: Ab hier immer nachziehen. Doppelt schadet nicht, fehlend schon.
  // EN: From here on, always follow through. Doing it twice doesn't hurt,
  // EN: missing it does.
  store.tutorial.active = false;
  if (!store.tutorial.data) store.tutorial.data = {};
  refreshTutorialUi();

  if (!clean) {
    log('Regulaerer Weg unvollstaendig - Freischaltung und Ereignis werden nachgeholt');
    grantTutorialUnlocks();
    try {
      api.events.emit('tutorial:completed', { skipped: true });
    } catch (e) { /* DE: Empfaenger nicht aktiv / EN: no listener active */ }
  }

  api.ui.toast({ key: 'mods|goldSpeedrun|tutorialSkipped' });
  return true;
};

// --- DE: Tutorial-Waechter / EN: Tutorial guard ------------------------------
// DE: Bewusst ohne Szenen- und Ablaufbedingungen, und in Echtzeit statt im
// DE: Boot-Takt: der Skip hatte zu viele Voraussetzungen, von denen jede einzelne
// DE: ihn lautlos ausfallen liess. Hier zaehlt nur noch: Einstellung an, Tutorial
// DE: aktiv - dann weg damit.
//
// DE: Der Vorbehalt "nicht mitten im Lauf" gilt weiter, aber nicht in den ersten
// DE: Sekunden nach dem Laden. Sonst genuegt ein Klick beim Startvorgang, um den
// DE: Skip dauerhaft zu verhindern - und genau dann bleibt die Box stehen.
//
// EN: Deliberately without scene or sequence conditions, and in real time
// EN: instead of on the boot interval: the skip had too many prerequisites,
// EN: any one of which could make it silently fail. All that matters here
// EN: now: setting on, tutorial active - then get rid of it.
//
// EN: The "not mid-run" caveat still applies, but not in the first few
// EN: seconds after loading. Otherwise a single click during startup would
// EN: be enough to permanently prevent the skip - and that's exactly when
// EN: the box would stay stuck on screen.
let bootPhaseUntil = 0;

const tutorialWatchTick = () => {
  if (!modEnabled()) return false;
  if (!skipTutorialEnabled()) return false;

  let active = false;
  try { active = sandkit.state.store.tutorial.active === true; } catch (e) { return false; }
  if (!active) return false;
  if (Date.now() >= bootPhaseUntil && !isArmed()) return false;

  try { return skipTutorial(); } catch (e) { log('Tutorial-Skip fehlgeschlagen:', e); }
  return false;
};

// DE: Der Waechter ist das Sicherheitsnetz; angestossen wird er zusaetzlich direkt
// DE: bei game:ready und in jedem Boot-Takt, damit die Box nicht erst nach einer
// DE: halben Sekunde verschwindet.
// EN: The guard is the safety net; it's also triggered directly on
// EN: game:ready and on every boot tick, so the box doesn't take up to half
// EN: a second to disappear.
setInterval(tutorialWatchTick, 500);

// --- DE: Einstellungen im Blick behalten / EN: Keeping an eye on settings ---
// DE: Feuert, sobald jemand im Mod-Menue etwas umstellt. Das Zurueckschreiben
// DE: geht am Setter des Spiels vorbei und loest deshalb keinen zweiten Aufruf
// DE: aus - eine Schleife ist nicht moeglich.
// EN: Fires as soon as anyone changes something in the mod menu. Writing the
// EN: value back bypasses the game's own setter and therefore doesn't
// EN: trigger a second call - a loop isn't possible.
try {
  api.settings.onChange(() => {
    if (!modEnabled()) return;
    if (syncOfficialSettings()) refreshSettingsUi();
  });
} catch (e) { log('Einstellungen nicht beobachtbar:', e); }

// --- DE: Start / EN: Startup -------------------------------------------------
// DE: Handle des Boot-Takts ausserhalb des Handlers: kommt game:ready ein zweites
// DE: Mal, wuerden sich sonst zwei Takte gegenseitig in die Quere kommen - der
// DE: eine macht den Intro-Bildschirm zu, den der andere noch sehen will.
// EN: The boot-interval handle lives outside the handler: if game:ready fires
// EN: a second time, two intervals would otherwise get in each other's way -
// EN: one closing the intro screen the other still wants to see.
let bootTimer = null;

api.events.on('game:ready', () => {
  // DE: Uhren immer wiederherstellen, auch wenn der Mod gerade aus ist - ein
  // DE: laufender Lauf zaehlt im Hintergrund weiter und darf nach dem Laden
  // DE: nicht bei 0 neu beginnen.
  // EN: Always restore the clocks, even if the mod is currently off - a run
  // EN: in progress keeps counting in the background and must not restart at
  // EN: 0 after a load.
  resumeClocks();
  loadHistoryFromSave();
  maybeAdoptFinishedAsBest();

  if (!modEnabled()) return;
  if (bootTimer !== null) {
    clearInterval(bootTimer);
    bootTimer = null;
  }

  artifactTotalCache = null;
  markCache = { key: null, list: [] };
  techIdCache = null;   // DE: andere Karte, evtl. andere Mods, andere Forschungen / EN: different map, maybe different mods, different research
  eventGraceUntil = 0;
  graceFor(1500);
  bootPhaseUntil = Date.now() + 20000;

  // DE: Eine Zeile mit dem tatsaechlichen Zustand. Wenn Intro oder Tutorial doch
  // DE: nicht verschwinden, steht hier, woran es lag - statt dass man raten muss.
  // EN: One line with the actual state. If the intro or tutorial fail to
  // EN: disappear after all, this shows why - instead of having to guess.
  try {
    log('Startzustand', {
      scene: sandkit.state.store.scene.active,
      sceneGame: enums.Scene.Game,
      tutorialActive: sandkit.state.store.tutorial && sandkit.state.store.tutorial.active,
      tutorialStep: sandkit.state.store.tutorial && sandkit.state.store.tutorial.currentStep,
      armed: isArmed(),
      skipIntro: skipIntroEnabled(),
      skipTutorial: skipTutorialEnabled(),
    });
  } catch (e) { log('Startzustand nicht lesbar:', e); }

  // DE: Vor allem anderen: steht das offizielle Regelwerk, gelten seine Werte.
  // DE: Das muss vor dem Tutorial-Waechter passieren, der liest den Schalter.
  // EN: Before anything else: if the official ruleset is set, its values
  // EN: apply. This has to happen before the tutorial guard, which reads that switch.
  syncOfficialSettings();

  // DE: Sofort versuchen, nicht erst beim naechsten Waechter-Takt.
  // EN: Try immediately, rather than waiting for the next guard tick.
  tutorialWatchTick();
  // DE: Ein beim Laden bereits beendeter Lauf soll nicht sofort ins Gesicht
  // DE: springen - F10 holt das Ergebnis bei Bedarf zurueck.
  // EN: A run that was already finished at load time shouldn't pop up
  // EN: immediately - F10 brings the result back if needed.
  resultDismissed = true;
  armRun();

  // DE: Intro und Tutorial laufen ueber einen eigenen Takt statt ueber
  // DE: schedule.nextTick. Grund: nextTick haengt am Spiel-Update, und beim
  // DE: Startvorgang ist noch nicht gesagt, dass das schon laeuft. Ein echter
  // DE: Timer ist davon unabhaengig.
  //
  // DE: Der Ablauf beim Start ist:
  //   emit "game:ready"        -> Szene steht schon auf Intro
  //   emit "game:started", await ...
  //   introScreen.visible = true   -> erst hier stehen die Textboxen
  //
  // DE: Deshalb wird gewartet, bis der Intro-Bildschirm wirklich sichtbar ist,
  // DE: und erst dann gesprungen - sonst blendet der Startvorgang ihn nach dem
  // DE: Sprung noch einmal ein.
  //
  // EN: The intro and tutorial run on their own interval instead of via
  // EN: schedule.nextTick. Reason: nextTick depends on the game update, and
  // EN: during startup it isn't guaranteed that's already running. A real
  // EN: timer doesn't depend on that.
  //
  // EN: The sequence at startup is:
  //   emit "game:ready"        -> scene is already set to Intro
  //   emit "game:started", await ...
  //   introScreen.visible = true   -> only now do the text boxes exist
  //
  // EN: That's why the code waits until the intro screen is actually
  // EN: visible, and only jumps after that - otherwise the startup sequence
  // EN: would show it again right after the jump.
  const wantIntro = skipIntroEnabled();
  const wantTutorial = skipTutorialEnabled();

  let ticks = 0;
  let introDone = !wantIntro;
  let tutorialDone = false;
  let announced = false;
  let refreshTicks = 0;

  const announce = () => {
    if (announced) return;
    announced = true;
    const cat = category();
    if (cat.kind === 'artifacts' && cat.target === 0) {
      log('WARNUNG: Auf dieser Karte wurden keine Artefakte gefunden. '
        + 'Bitte das Artefakt-Ziel in den Einstellungen von Hand setzen.');
    }
    api.ui.toast({ key: 'mods|goldSpeedrun|running', params: { category: categoryLabel() } });
    log('Lauf scharf, Kategorie =', categoryLabel(), '| Ziel =', cat.target);
  };

  const bootTick = () => {
    ticks++;
    const scene = activeScene();

    if (wantIntro) {
      // DE: Sicherheitsnetz: taucht der Bildschirm nach dem Sprung wieder auf,
      // DE: wird er zugemacht.
      // EN: Safety net: if the screen reappears after the jump, it gets closed again.
      if (introDone && introVisible()) closeIntroScreen();

      if (!introDone) {
        if (scene === enums.Scene.Deploy) {
          // DE: Landeanflug laeuft schon - direkt durchspringen.
          // EN: The landing approach is already running - jump straight through.
          try { introDone = skipIntro(); } catch (e) { log('Intro-Skip fehlgeschlagen:', e); introDone = true; }
        } else if (scene === enums.Scene.Intro && introVisible()) {
          // DE: Genau der Zustand, in dem auch der Knopf im Spiel arbeitet.
          // EN: Exactly the state the in-game button also relies on.
          try { introDone = skipIntro(); } catch (e) { log('Intro-Skip fehlgeschlagen:', e); introDone = true; }
        } else if (scene !== enums.Scene.Intro && scene !== enums.Scene.Deploy) {
          // DE: Geladener Spielstand: es gibt gar kein Intro.
          // EN: A loaded save: there is no intro at all.
          introDone = true;
        }
      }
    }

    // DE: Das Tutorial macht der Waechter oben - hier wird nur noch abgewartet,
    // DE: bis er fertig ist. Frueher standen an dieser Stelle Bedingungen
    // DE: (Szene, isArmed), die den Skip lautlos ausfallen lassen konnten.
    // EN: The guard above handles the tutorial - this just waits for it to
    // EN: finish. Conditions used to sit here (scene, isArmed) that could
    // EN: make the skip silently fail.
    if (!tutorialDone) {
      if (!wantTutorial) {
        tutorialDone = true;
      } else {
        tutorialWatchTick();
        try { tutorialDone = sandkit.state.store.tutorial.active !== true; } catch (e) { /* DE: noch nicht da / EN: not available yet */ }
        if (tutorialDone) refreshTicks = 5;
      }
    }

    // DE: Nach dem Skip noch ein paar Takte das Bild auffrischen: die
    // DE: Tutorial-Box wird beim Startvorgang mehrfach gezeichnet, und eine
    // DE: Auffrischung zum falschen Zeitpunkt verpufft.
    // EN: A few more ticks of refreshing the screen after the skip: the
    // EN: tutorial box gets redrawn several times during startup, and a
    // EN: refresh at the wrong moment fizzles out.
    if (refreshTicks > 0) {
      refreshTicks--;
      refreshTutorialUi();
    }

    if (introDone && tutorialDone) announce();

    // DE: Auch wenn alles erledigt ist, laeuft der Takt noch rund drei Sekunden
    // DE: weiter: der Startvorgang kann den Intro-Bildschirm nach dem Sprung
    // DE: erneut einblenden, und dann muss ihn noch jemand zumachen.
    // EN: Even once everything is done, the interval keeps running for about
    // EN: three more seconds: the startup sequence can show the intro screen
    // EN: again after the jump, and someone still has to close it.
    if ((introDone && tutorialDone && ticks >= 30) || ticks >= 150) {
      clearInterval(bootTimer);
      bootTimer = null;
      if (!introDone || !tutorialDone) {
        log('Startvorgang: Intro/Tutorial nicht abgeschlossen',
          { introDone, tutorialDone, scene: activeScene() });
      }
      announce();
    }
  };

  bootTimer = setInterval(bootTick, 100);
  bootTick();

  // DE: Falls der Takt haengen bleibt, soll die Kategorie trotzdem gemeldet werden.
  // EN: If the interval ever gets stuck, the category should still get announced.
  setTimeout(announce, 16000);
});

log('geladen - der Timer startet mit der ersten Aktion (Graben, Bauen, Forschen, Aufsammeln)');
