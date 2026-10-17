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
const MIN_PB_MS = 60000; // DE: Kuerzere Laeufe zaehlen nicht als Bestzeit / EN: shorter runs are never stored as a best
const LOAD_ARTIFACT_MS = 2000; // DE: Ziel schon in den ersten 2s = Load-Artefakt / EN: goal met in the first 2s is a load artifact
const CATEGORIES_KEY = 'goldSpeedrun.categories.v1';
const ACTIVE_CATEGORY_KEY = 'goldSpeedrun.activeCategory';
const TRIGGER_KEY = 'goldSpeedrun.triggers'; // DE: Legacy-Global, Fallback / EN: legacy global, fallback
const TRIGGER_PREFIX = 'goldSpeedrun.triggers.';
const GOLD_MODE_HARD_MIGRATE_KEY = 'goldSpeedrun.migratedGoldModeHard.v1';
const KEY_STABILITY_MIGRATE_KEY = 'goldSpeedrun.migratedKeyStability.v1';
const ENFORCE_VALID_DEFAULTS_KEY = 'goldSpeedrun.enforceValidDefaultsV1';
const PB_RUN_ID = '__pb__';

const MOD_VERSION = '3.11.0';
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
  'mods|goldSpeedrun|pbTooShort': 'Finished in {time} — under the 1:00 minimum, not stored as a best time',
  'mods|goldSpeedrun|waiting': 'Any action starts the run',
  'mods|goldSpeedrun|toast|defaultsReset': 'Settings reset to valid speedrun rules (Hard Mode, no skips).',
  'mods|goldSpeedrun|resultKey': 'Show last result',
  'mods|goldSpeedrun|tutorialSkipped': 'Tutorial skipped automatically',
  'mods|goldSpeedrun|artifacts': '{current} / {target} artifacts',
  'mods|goldSpeedrun|factory': 'Rank {current} / {target}',
  'mods|goldSpeedrun|tainted': 'CHEATS USED - run does not count',
  'mods|goldSpeedrun|noTutorial': 'No Tutorial',
  'mods|goldSpeedrun|category|blueprints': 'Blueprints',
  'mods|goldSpeedrun|dash|noBp': 'No Blueprints',
  'mods|goldSpeedrun|dash|bpUsed': 'Blueprints',
  'mods|goldSpeedrun|toast|bpTriggered': 'Switched to Blueprints category',
  'mods|goldSpeedrun|dash|exportPng': 'Export share card as PNG',
  'mods|goldSpeedrun|toast|pngSaved': 'Dashboard PNG saved',
  'mods|goldSpeedrun|toast|pngCopied': 'Dashboard PNG copied to clipboard & saved',

  // DE: Ausloeser und Ergebnis / EN: Triggers and result
  'mods|goldSpeedrun|split|rank': 'Factory rank {level}',
  'mods|goldSpeedrun|split|artifact': 'Artifact {index}',
  'mods|goldSpeedrun|split|gold': '{percent}% gold',
  'mods|goldSpeedrun|split|upgrade': 'Upgrade: {name}',
  'mods|goldSpeedrun|split|goal': 'GOAL',
  'mods|goldSpeedrun|result|title': 'Run complete',
  'mods|goldSpeedrun|result|total': 'Final time',
  'mods|goldSpeedrun|result|best': 'Personal Best / Target',
  'mods|goldSpeedrun|result|noBest': 'first finish',
  'mods|goldSpeedrun|result|sim': 'Simulation time',
  'mods|goldSpeedrun|result|play': 'Play-clock',
  'mods|goldSpeedrun|result|real': 'Pause aware real time',
  'mods|goldSpeedrun|result|tickSourceMissing': 'No tick source - the simulation thread did not report step counts this run, so simulation time and the derived metrics are unavailable.',
  'mods|goldSpeedrun|clock|simShort': 'sim',
  'mods|goldSpeedrun|clock|realShort': 'p-real',
  'mods|goldSpeedrun|clock|playShort': 'play',
  'mods|goldSpeedrun|result|colSplit': 'Trigger',
  'mods|goldSpeedrun|result|colTime': 'Time',
  'mods|goldSpeedrun|result|colSegment': 'Segment duration',
  'mods|goldSpeedrun|result|colDelta': 'Δ vs PB',
  'mods|goldSpeedrun|result|colGold': 'Gold',
  'mods|goldSpeedrun|result|noSplits': 'No triggers fired - enable some under Splits.',
  'mods|goldSpeedrun|result|close': 'Close',
  'mods|goldSpeedrun|result|hint': 'F10 shows this again',
  'mods|goldSpeedrun|result|wallStart': 'Wall start',
  'mods|goldSpeedrun|result|wallEnd': 'Wall end',
  'mods|goldSpeedrun|result|wallSpan': 'Wall span',
  'mods|goldSpeedrun|result|wallNow': 'now',
  'mods|goldSpeedrun|hud|openDashboard': 'Press F10 for Speedrun Dashboard',
  'mods|goldSpeedrun|result|expand': 'Show full statistics',
  'mods|goldSpeedrun|result|collapse': 'Hide full statistics',

  // DE: Metriken (U, R, W und was sich daraus ergibt) / EN: Metrics (U, R, W and what follows from them)
  'mods|goldSpeedrun|metric|slowdown': 'Slowdown',
  'mods|goldSpeedrun|metric|deficit': 'Tick deficit',
  'mods|goldSpeedrun|metric|jamRate': 'Jam Rate',
  'mods|goldSpeedrun|metric|jamLoad': 'Jam Load',
  'mods|goldSpeedrun|metric|jamShare': 'Jam Share',
  'mods|goldSpeedrun|metric|ticks': 'Executed ticks (U)',
  'mods|goldSpeedrun|metric|avgUps': 'Average UPS',
  'mods|goldSpeedrun|metric|idealTicks': 'Ideal ticks (60×R)',
  'mods|goldSpeedrun|metric|thinkMult': 'Thinking multiplier',
  'mods|goldSpeedrun|metric|wrProbe': 'Play-clock − pause aware real time (W−R)',
  'mods|goldSpeedrun|metric|goldPerSec': 'Gold/s',
  'mods|goldSpeedrun|metric|goldReq': '(req {rate} g/s)',
  'mods|goldSpeedrun|metric|goldBehindPb': '(behind PB)',
  'mods|goldSpeedrun|metric|dash': 'waiting for the run to start',

  // DE: Verlaufsgrafik / EN: History graph
  'mods|goldSpeedrun|graph|title': 'UPS over the whole run',
  'mods|goldSpeedrun|graph|live': 'Live UPS (last 60 s)',
  'mods|goldSpeedrun|graph|empty': 'No data yet - set Simulation monitoring to Standard or Full in the mod options.',
  'mods|goldSpeedrun|graph|emptyRun': 'No data yet - start a run (or wait a second) to record UPS.',

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
  'mods|goldSpeedrun|cfg|mode|desc': 'Hard Mode is required for a valid speedrun: gold is your current balance, so researching sets you back. Total Earned is practice only and INVALID FOR SPEEDRUNS: it counts every bit of gold you take in, so spending costs no progress. Recording must start at or before the create-world menu. No other mods may be enabled.',
  'mods|goldSpeedrun|cfg|mode|earned': 'Total Earned (INVALID FOR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|mode|balance': 'Hard Mode',
  'mods|goldSpeedrun|modeNormal': 'Total Earned',
  'mods|goldSpeedrun|modeHard': 'Hard Mode',
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
  'mods|goldSpeedrun|cfg|clockMode': 'Headline clock',
  'mods|goldSpeedrun|cfg|clockMode|desc': 'All three times are always measured and always recorded - this only decides which one stands large on the timer, the other two stay underneath. Play-clock (W) is the official community metric: the game\'s own save-file clock. Pause aware real time (R) counts real milliseconds only while the game is running - pausing the game pauses this clock too. Simulation time (T) counts the simulation steps the world actually ran, divided by 60.',
  'mods|goldSpeedrun|cfg|clockMode|real': 'Pause aware real time (R)',
  'mods|goldSpeedrun|cfg|clockMode|sim': 'Simulation time (T)',
  'mods|goldSpeedrun|cfg|clockMode|play': 'Play-clock (W)',
  'mods|goldSpeedrun|cfg|timeFormat': 'Timer precision',
  'mods|goldSpeedrun|cfg|timeFormat|seconds': 'Seconds (00:00:00)',
  'mods|goldSpeedrun|cfg|timeFormat|centis': 'Hundredths (00:00:00.00)',
  'mods|goldSpeedrun|cfg|timeFormat|millis': 'Milliseconds (00:00:00.000)',
  'mods|goldSpeedrun|cfg|skipIntro': 'Skip intro and landing (INVALID FOR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|skipIntro|desc': 'INVALID FOR SPEEDRUNS — practice only. Jumps straight into the world on a new game, exactly like the in-game Skip Intro button. Leave this off for a valid speedrun. Recording must start at or before the create-world menu.',
  'mods|goldSpeedrun|cfg|skipStory': 'Dismiss story text boxes (INVALID FOR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|skipStory|desc': 'INVALID FOR SPEEDRUNS — practice only. Closes the story pop-ups the moment they appear - the same as clicking them away, so the story still counts them as seen. Leave this off for a valid speedrun.',
  'mods|goldSpeedrun|cfg|skipTutorial': 'Skip the tutorial automatically (INVALID FOR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|skipTutorial|desc': 'INVALID FOR SPEEDRUNS — practice only. Ends the tutorial as soon as a save is loaded, exactly like the in-game skip button. Only happens while the timer is still waiting, never during a run. Leave this off for a valid speedrun.',
  'mods|goldSpeedrun|cfg|showOverlay': 'Show timer on screen',
  'mods|goldSpeedrun|cfg|showSplits': 'Show split table',
  'mods|goldSpeedrun|cfg|showSplits|desc': 'Lists the last triggers under the timer with time and the LiveSplit-style delta versus the personal best. The full table appears on the result screen when the run ends.',
  'mods|goldSpeedrun|cfg|hudSplitRows': 'Splits visible on the timer',
  'mods|goldSpeedrun|cfg|hudSplitRows|desc': 'How many split rows the timer shows at once. The last completed ones stay visible; the rest look ahead to upcoming marks. 6 is the default.',
  'mods|goldSpeedrun|cfg|hudLayout': 'Timer layout',
  'mods|goldSpeedrun|cfg|hudLayout|desc': 'Horizontal puts splits, clocks and the UPS graph side by side to save height. Vertical is the old single-column stack.',
  'mods|goldSpeedrun|cfg|hudLayout|horizontal': 'Horizontal (compact)',
  'mods|goldSpeedrun|cfg|hudLayout|vertical': 'Vertical',
  'mods|goldSpeedrun|cfg|streamerMode': 'Streamer mode',
  'mods|goldSpeedrun|cfg|streamerMode|desc': 'Enlarges splits, the official play-clock and the LiveSplit-style ahead/behind indicator for viewers. Everything else stays small and bundled. Works with both timer layouts.',
  'mods|goldSpeedrun|cfg|streamerFontScale': 'Streamer text size',
  'mods|goldSpeedrun|cfg|streamerFontScale|desc': 'Size of the stream-facing parts: splits, official time, ahead/behind and slowdown. Whole-pixel steps only, so the overlay stays sharp on stream.',
  'mods|goldSpeedrun|cfg|streamerFontScale|S': 'S',
  'mods|goldSpeedrun|cfg|streamerFontScale|M': 'M',
  'mods|goldSpeedrun|cfg|streamerFontScale|L': 'L',
  'mods|goldSpeedrun|cfg|streamerFontScale|XL': 'XL',
  'mods|goldSpeedrun|cfg|streamerFontScale|XXL': 'XXL',
  'mods|goldSpeedrun|cfg|streamerFontScale|XXXL': 'XXXL',
  'mods|goldSpeedrun|cfg|secondaryFontScale': 'Secondary text size',
  'mods|goldSpeedrun|cfg|secondaryFontScale|desc': 'Size of the remaining HUD stats (clocks, seed, deficit, badges). Separate from the stream-facing size.',
  'mods|goldSpeedrun|cfg|secondaryFontScale|S': 'S',
  'mods|goldSpeedrun|cfg|secondaryFontScale|M': 'M',
  'mods|goldSpeedrun|cfg|secondaryFontScale|L': 'L',
  'mods|goldSpeedrun|hud|totalAhead': 'vs comparison',
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
  'mods|goldSpeedrun|rules|custom': 'INVALID RUN',
  'mods|goldSpeedrun|rules|invalid': 'INVALID RUN',
  'mods|goldSpeedrun|rules|invalidBanner': 'INVALID RUN — not speedrun-legal settings',
  'mods|goldSpeedrun|rules|title': 'Official speedrun ruleset',
  'mods|goldSpeedrun|rules|ok': 'Every setting matches the official speedrun rules.',
  'mods|goldSpeedrun|rules|bad': 'These settings are not speedrun-legal:',
  'mods|goldSpeedrun|rules|need': 'needs: {value}',
  'mods|goldSpeedrun|rules|broken': 'RULESET CHANGED',
  'mods|goldSpeedrun|rules|brokenDesc': 'A setting of the official ruleset was changed while the run was going. The run no longer counts as official and is not stored as a best time.',
  'mods|goldSpeedrun|rules|locked': 'locked in when the run started',
  'mods|goldSpeedrun|rules|skipIntro': 'Skip intro and landing',
  'mods|goldSpeedrun|rules|skipStory': 'Dismiss story text boxes',
  'mods|goldSpeedrun|rules|skipTutorial': 'Skip the tutorial automatically',
  'mods|goldSpeedrun|rules|mods': 'Other mods enabled',
  'mods|goldSpeedrun|rules|modsNone': 'none',
  'mods|goldSpeedrun|rules|debugMode': 'Debug mode',
  'mods|goldSpeedrun|rules|cinematicMode': 'Cinematic mode',
  'mods|goldSpeedrun|btn|deactivateDebug': 'Deactivate debug',
  'mods|goldSpeedrun|toast|debugDeactivated': 'Debug and cinematic mode deactivated. This run stays invalid.',
  'mods|goldSpeedrun|toast|debugEnabled': 'Debug mode on. This save will not count as a speedrun.',
  'mods|goldSpeedrun|cfg|debugMode': 'Debug mode',
  'mods|goldSpeedrun|cfg|debugMode|desc': 'Turns on the in-game debug panel without the console command. WARNING: debug mode invalidates every speedrun. Turning it off also clears cinematic mode and the other disallowed engine states. A save that had either on before the goal stays flagged.',
  'mods|goldSpeedrun|mods|clean': 'No additional mods',
  'mods|goldSpeedrun|mods|count': '{count} other mods',
  'mods|goldSpeedrun|cfg|showRuleset': 'Show ruleset badge',
  'mods|goldSpeedrun|cfg|showRuleset|desc': 'Marks on the timer and on the result screen whether the settings are speedrun-legal: gold ruleset Hard Mode, intro/story/tutorial skips off, no other mod enabled, and debug mode and cinematic mode off. Invalid settings show a red INVALID RUN banner naming what is wrong.',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics': 'Show advanced metrics',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics|desc': 'Adds average UPS under the timer. Tick count, ideal ticks, the thinking multiplier and the play-clock gap stay on the dashboard.',
  'mods|goldSpeedrun|cfg|monitoringMode': 'Simulation monitoring',
  'mods|goldSpeedrun|cfg|monitoringMode|desc': 'Off: no simulation hooks and no UPS graph. Standard: ballistic (thrown) particles plus passive reads — light overhead. Full: intercepts every moving CA pixel (settled vs active collisions) — measurable sim cost, for diagnostics only.',
  'mods|goldSpeedrun|cfg|monitoringMode|off': 'Disabled (zero overhead)',
  'mods|goldSpeedrun|cfg|monitoringMode|standard': 'Standard (ballistic particles)',
  'mods|goldSpeedrun|cfg|monitoringMode|full': 'Full diagnostics (all matter)',
  'mods|goldSpeedrun|cfg|showLiveSparkline': 'Show live UPS graph',
  'mods|goldSpeedrun|cfg|showLiveSparkline|desc': 'Adds a small live graph of the last 60 seconds of UPS under the timer. Sampled on the main thread only - no measurable cost to the simulation.',
  'mods|goldSpeedrun|metrics|title': 'Simulation & Performance Diagnostics',
  'mods|goldSpeedrun|metrics|openBtn': 'Fullscreen Graph (F7)',
  'mods|goldSpeedrun|metrics|close': 'Close (ESC)',
  'mods|goldSpeedrun|metrics|timeRange': 'Range:',
  'mods|goldSpeedrun|metrics|range60s': 'Last 60s (10 Hz)',
  'mods|goldSpeedrun|metrics|range180s': 'Last 3m (10 Hz)',
  'mods|goldSpeedrun|metrics|rangeFull': 'Full Run (1 Hz)',
  'mods|goldSpeedrun|metrics|layerUps': 'UPS (dynamic)',
  'mods|goldSpeedrun|metrics|layerBlocks': 'Collisions',
  'mods|goldSpeedrun|metrics|layerMoves': 'Moves',
  'mods|goldSpeedrun|metrics|layerAwake': 'Awake Chunks',
  'mods|goldSpeedrun|metrics|layerSimTime': 'Sim Step Time',
  'mods|goldSpeedrun|metrics|layerLive': 'Live Dynamic Population',
  'mods|goldSpeedrun|metrics|layerJamLoad': 'Jam Load (blk/upd)',
  'mods|goldSpeedrun|metrics|layerJamShare': 'Jam Share (%)',
  'mods|goldSpeedrun|metrics|layerJamRate': 'Jam Rate (%)',
  'mods|goldSpeedrun|metrics|layerJamIntensity': 'Jam Load (blk/upd)',
  'mods|goldSpeedrun|metrics|layerBlocksSettled': 'Collisions (Settled)',
  'mods|goldSpeedrun|metrics|layerBlocksActive': 'Collisions (Active)',
  'mods|goldSpeedrun|metrics|layerDeficit': 'Lost time (s)',
  'mods|goldSpeedrun|metrics|layerGold': 'Gold',
  'mods|goldSpeedrun|metrics|scaleLinear': 'Linear',
  'mods|goldSpeedrun|metrics|scaleLog': 'Logarithmic',
  'mods|goldSpeedrun|metrics|scaleMode': 'Scale:',
  'mods|goldSpeedrun|metrics|smooth': 'Smooth:',
  'mods|goldSpeedrun|metrics|smoothOff': 'Off',
  'mods|goldSpeedrun|metrics|smoothRolling': '5s Rolling Avg',
  'mods|goldSpeedrun|metrics|smoothBands': 'Confidence Bands',
  'mods|goldSpeedrun|metrics|curUps': 'Current UPS',
  'mods|goldSpeedrun|metrics|jamRate': 'Jam Rate',
  'mods|goldSpeedrun|metrics|jamLoad': 'Jam Load',
  'mods|goldSpeedrun|metrics|jamShare': 'Jam Share',
  'mods|goldSpeedrun|metrics|flightActivity': 'Flight Activity',
  'mods|goldSpeedrun|metrics|activeChunks': 'Active Chunks',
  'mods|goldSpeedrun|metrics|simStep': 'Sim Step',
  'mods|goldSpeedrun|metrics|hintSimBottleneck': 'Sim Load: If UPS drops while Sim Step Time exceeds 16.6 ms, cellular automata physics rules are overloading the worker threads.',
  'mods|goldSpeedrun|metrics|hintRenderBottleneck': 'Sync / Thread Wait: If UPS drops while Sim Step Time is low, worker thread barrier synchronization (waitMs) or OS core starvation is the bottleneck. (Render FPS is untied).',
  'mods|goldSpeedrun|metrics|hintJamRate': 'Jam Share (%) is a dimensionless ratio (blocked / total events). Jam Load (blk/upd) is blocked attempts normalized per simulation tick — in 60 UPS play, it is collisions scaled by 1/60. Neither metric directly measures CPU workload.',
  'mods|goldSpeedrun|metrics|cardUpsTitle': 'UPS (Simulation Rate)',
  'mods|goldSpeedrun|metrics|cardUps': 'Simulation steps completed per real second by the background physics worker threads (target: 60 UPS = 16.67 ms/step). Below 60 means the game world is losing time (running in slow motion). NOTE: UPS is completely untied from render FPS! The simulation runs in independent Web Workers, so GPU or UI lag drops FPS, not UPS. If UPS drops below 60, compare Sim Step Time against Worker Wait: high compute time means CA physics rules are overloaded; high wait time means thread barrier synchronization or CPU core starvation.',
  'mods|goldSpeedrun|metrics|cardBlocksTitle': 'Collisions',
  'mods|goldSpeedrun|metrics|cardBlocks': 'Total element:blocked events in the interval: movement attempts where the destination cell was occupied. In Standard mode, only ballistic projectiles (thrown items) are captured. In Full mode, all matter is captured (where resting piles naturally dominate as gravity probes support each tick). Collision checks are simple O(1) grid reads and do NOT intrinsically cause high CPU load; they reflect physical obstruction, not processing cost.',
  'mods|goldSpeedrun|metrics|cardMovesTitle': 'Moves',
  'mods|goldSpeedrun|metrics|cardMoves': 'Total element:moved events: successful displacements of matter into free cells. In Standard mode, counts projectile steps in flight; in Full mode, counts all particle displacements and swaps (a swap produces 2 moves and 0 blocks). High moves represent actual mass throughput. A high collision count with low moves in Standard mode means thrown items are trapped against a blockage.',
  'mods|goldSpeedrun|metrics|cardJamShareTitle': 'Jam Share (%)',
  'mods|goldSpeedrun|metrics|cardJamShare': 'Formula: collisions / (collisions + moves) × 100. A pure dimensionless ratio measuring what percentage of movement attempts were obstructed. Because it measures proportion rather than volume, 2 blocked particles in a completely idle world will register ~100% Jam Share with zero performance impact. Never use Jam Share alone as a performance or load metric.',
  'mods|goldSpeedrun|metrics|cardJamLoadTitle': 'Jam Load (blk/upd)',
  'mods|goldSpeedrun|metrics|cardJamLoad': 'Formula: collisions / simulation_ticks. Average collisions occurring per simulation tick. In steady 60 UPS play, this is literally collisions / (60 × seconds) (collision count scaled by a constant factor). Normalizing by ticks ensures the value remains comparable if the simulation slows down. It reflects physical collision density per tick, NOT CPU execution cost (checking an occupied cell is computationally trivial).',
  'mods|goldSpeedrun|metrics|cardAwakeTitle': 'Awake Chunks',
  'mods|goldSpeedrun|metrics|cardAwake': 'Count of 40×40 cell grid chunks actively simulated this tick (chunkShouldUpdate === 1). Sleeping chunks with resting matter consume near-zero CPU. Awake chunks are partitioned across worker threads during simulation phases 1–4. Rising awake chunk counts directly increase worker thread dispatch overhead and total CA cell evaluations.',
  'mods|goldSpeedrun|metrics|cardSimTimeTitle': 'Sim Step Time',
  'mods|goldSpeedrun|metrics|cardSimTime': 'Wall-clock milliseconds spent by the simulation worker threads executing one step. Budget is 16.67 ms at 60 UPS. Primary simulation workload indicator: if this exceeds 16.67 ms, CA physics is overloaded. If this is low (<16.67 ms) but UPS still drops below 60, the bottleneck is worker thread synchronization/barrier wait (waitMs), phase dispatch (postMs), or OS thread starvation — NOT rendering, GPU, or DOM!',
  'mods|goldSpeedrun|metrics|cardLiveTitle': 'Live Dynamic Population',
  'mods|goldSpeedrun|metrics|cardLive': 'Total dynamic element slots allocated in engine shared memory (sim.liveElementCount): moving sands, liquids, gases, and projectiles (excludes static terrain). Represents active matter memory footprint. These slots remain allocated even when matter comes to rest and chunks go to sleep.',
  'mods|goldSpeedrun|metrics|cardSettledTitle': 'Collisions (Settled)',
  'mods|goldSpeedrun|metrics|cardSettled': 'Full Diagnostics split: blocked movement attempts with direction === "down" against terrain or an element. Downward gravity probes resting support every tick. Large totals are completely normal for settled piles and indicate static equilibrium, not lag.',
  'mods|goldSpeedrun|metrics|cardActiveTitle': 'Collisions (Active)',
  'mods|goldSpeedrun|metrics|cardActive': 'Full Diagnostics split: all non-downward blocked attempts (lateral flow, upward movement, unauthorized transitions). Tracks dynamic resistance: material avalanches, fluid pressure, compression in chutes, and launcher impacts.',
  'mods|goldSpeedrun|metrics|cardDeficitTitle': 'Lost time (signed deficit)',
  'mods|goldSpeedrun|metrics|cardDeficit': 'Neutral count from two raw counters: D = (real-ms / 1000 × 60) − ticks executed, accumulated over the window. No rate estimate, no clamp. Positive D = simulation behind real time; negative D = simulation ran ahead of 60 UPS (over-run). Unrecovered loss D_perm is the running floor of D over the next 2 s, so hitch-and-catch-up wobble is not counted. Shaded bands mark intervals where D_perm rose. Hover a band to scrub the bottleneck map to that time.',
  'mods|goldSpeedrun|metrics|ttDeficit': 'Deficit D:',
  'mods|goldSpeedrun|metrics|ttDeficitPerm': 'Unrecovered:',
  'mods|goldSpeedrun|metrics|slowdownIn': 'In slowdown',
  'mods|goldSpeedrun|metrics|slowdownNone': 'none',
  'mods|goldSpeedrun|metrics|unrecovered': 'Unrecovered',
  'mods|goldSpeedrun|metrics|heatmapBoundCompute': 'Compute-bound at this time — the map may show a hotspot.',
  'mods|goldSpeedrun|metrics|heatmapBoundWait': 'Sync/wait-bound at this time — chunk colours are not the cause.',
  'mods|goldSpeedrun|metrics|heatmapBoundEmpty': 'No phase timing at this time.',
  'mods|goldSpeedrun|metrics|heatmapDisclaimer': 'Highest per-tick calculation chunks. Indicative, not definitive: exactly one chunk is always reported as slowest each tick, even if it is not causing UPS loss. Use as a place to look, not as blame.',
  'mods|goldSpeedrun|metrics|monitoringOffTitle': 'Simulation monitoring is disabled',
  'mods|goldSpeedrun|metrics|monitoringOffBody': 'The worker hooks and UPS history are off. Enable Standard monitoring to record ballistic particles with light overhead, or Full diagnostics for all-matter capture.',
  'mods|goldSpeedrun|metrics|monitoringOffEnable': 'Enable Standard monitoring',
  'mods|goldSpeedrun|metrics|benchConfirmTitle': 'Run Metric Cost Matrix',
  'mods|goldSpeedrun|metrics|benchConfirmLead': 'This is an advanced ~15 minute test of metric-hook overhead. Mis-reading the result is easy. Do not run it on a speedrun.',
  'mods|goldSpeedrun|metrics|benchConfirmHow': 'How to run: use a dedicated test world that has already been at steady-state particle movement for at least 10 minutes. Keep performance load between 90% and 100% so any extra cost shows up as an immediate UPS drop — but do not start already in the red (UPS already collapsing).',
  'mods|goldSpeedrun|metrics|benchConfirmInterp': 'The matrix compares baseline (hooks off) against each metric package. A higher sim-step or lower UPS while a package is ON is that package’s overhead. Results depend on the current world; they do not name a single “problem chunk”.',
  'mods|goldSpeedrun|metrics|benchConfirmForce': 'The test forces ballistic-only capture for the duration and will cancel if a speedrun is running or the game is paused.',
  'mods|goldSpeedrun|metrics|benchConfirmStart': 'I understand — start the test',
  'mods|goldSpeedrun|metrics|benchConfirmCancel': 'Cancel',
  'mods|goldSpeedrun|metrics|ttSettled': 'Settled collisions:',
  'mods|goldSpeedrun|metrics|ttActive': 'Active collisions:',
  'mods|goldSpeedrun|metrics|samplePoint': 'Sample Point',
  'mods|goldSpeedrun|metrics|ttUps': 'UPS:',
  'mods|goldSpeedrun|metrics|ttGold': 'Gold:',
  'mods|goldSpeedrun|metrics|ttCollisions': 'Collisions:',
  'mods|goldSpeedrun|metrics|ttMoves': 'Moves:',
  'mods|goldSpeedrun|metrics|ttSimUpdates': 'Sim Updates:',
  'mods|goldSpeedrun|metrics|ttJamLoad': 'Jam Load:',
  'mods|goldSpeedrun|metrics|ttJamShare': 'Jam Share:',
  'mods|goldSpeedrun|metrics|ttFlightActivity': 'Flight Activity:',
  'mods|goldSpeedrun|metrics|ttJamRate': 'Jam Rate:',
  'mods|goldSpeedrun|metrics|ttJamIntensity': 'Jam Load:',
  'mods|goldSpeedrun|metrics|ttDynamic': 'Live Dynamic Pop:',
  'mods|goldSpeedrun|metrics|ttDynamicDesc': 'Total allocated dynamic element slots in engine (includes resting sand, liquids, gases; not movers).',
  'mods|goldSpeedrun|metrics|ttAwake': 'Awake Chunks:',
  'mods|goldSpeedrun|metrics|ttSimCompute': 'Sim Compute:',
  'mods|goldSpeedrun|metrics|ttScope': 'Capture Scope:',
  'mods|goldSpeedrun|metrics|scopeBallistic': 'Ballistic Only',
  'mods|goldSpeedrun|metrics|scopeAllMatter': 'All Matter (Diagnostic)',
  'mods|goldSpeedrun|metrics|scopeSwitch': 'Capture Scope:',
  'mods|goldSpeedrun|metrics|scopeWarn': 'Notice: Exact all-matter capture intercepts every moving cellular automata pixel. Designed for benchmarking/diagnostics; can reduce simulation UPS.',
  'mods|goldSpeedrun|metrics|benchBtn': 'Run Metric Cost Matrix (~15 min)',
  'mods|goldSpeedrun|metrics|benchRunning': '{phase} · repeat {totalPhase} · {mode}',
  'mods|goldSpeedrun|metrics|benchTitle': 'Metric Cost Matrix',
  'mods|goldSpeedrun|metrics|benchBaseline': 'OFF (Baseline):',
  'mods|goldSpeedrun|metrics|benchActive': 'ON (Active):',
  'mods|goldSpeedrun|metrics|benchOverhead': 'Estimated Overhead:',
  'mods|goldSpeedrun|metrics|benchCancel': 'Cancel',
  'mods|goldSpeedrun|metrics|benchCopy': 'Copy Report',
  'mods|goldSpeedrun|metrics|benchCopied': 'Copied to Clipboard!',
  'mods|goldSpeedrun|metrics|benchClose': 'Close',
  'mods|goldSpeedrun|metrics|key': 'Toggle Simulation Diagnostics Graph',
  'mods|goldSpeedrun|metrics|causeTitle': 'Where the sim spends time',
  'mods|goldSpeedrun|metrics|causeCompute': 'Compute',
  'mods|goldSpeedrun|metrics|causeWait': 'Wait (sync)',
  'mods|goldSpeedrun|metrics|causePost': 'Post',
  'mods|goldSpeedrun|metrics|causeBoundCompute': 'Compute-bound',
  'mods|goldSpeedrun|metrics|causeBoundWait': 'Sync-bound',
  'mods|goldSpeedrun|metrics|causeSlowest': 'Slowest region',
  'mods|goldSpeedrun|metrics|causeChunk': 'chunk ({x}, {y})',
  'mods|goldSpeedrun|metrics|causeColumn': 'column {x}',
  'mods|goldSpeedrun|metrics|causeEmpty': 'No phase timing yet — load a world and wait one tick.',
  'mods|goldSpeedrun|metrics|causeNote': 'Scheduling-phase time, not a physics-rule split. Shows where the sim is spending time and whether it is computing or waiting on other threads.',
  'mods|goldSpeedrun|metrics|heatmapTitle': 'Bottleneck map (ms)',
  'mods|goldSpeedrun|metrics|heatmapSum': 'Cumulative',
  'mods|goldSpeedrun|metrics|heatmapExp': 'Exp Decay',
  'mods|goldSpeedrun|metrics|heatmapLinear': 'Linear Decay',
  'mods|goldSpeedrun|metrics|heatmapPeak': 'Peak tick',
  'mods|goldSpeedrun|metrics|heatmapLive': 'This tick',
  'mods|goldSpeedrun|metrics|heatmapFloor': 'Outline',
  'mods|goldSpeedrun|metrics|heatmapHalfLife': 'Half-life',
  'mods|goldSpeedrun|metrics|heatmapWindow': 'Window',
  'mods|goldSpeedrun|metrics|heatmapEmpty': 'No bottleneck map yet — load a world and wait one tick.',
  'mods|goldSpeedrun|metrics|heatmapHint': 'Each cell is a 40×40 chunk. Colour shows worker bottleneck ms. Wheel to zoom, drag to pan, double-click to reset.',
  'mods|goldSpeedrun|metrics|heatmapScale': 'Max: {ms}',
  'mods|goldSpeedrun|metrics|heatmapCell': 'chunk ({x}, {y})  {ms}',
  'mods|goldSpeedrun|metrics|heatmapCellDetail': 'chunk ({x}, {y})  {val} ({sub})',
  'mods|goldSpeedrun|metrics|heatmapLiveBtn': 'Live',
  'mods|goldSpeedrun|metrics|heatmapZoomReset': 'Reset',
  'mods|goldSpeedrun|metrics|heatmapTimeline': 'Timeline',
  'mods|goldSpeedrun|metrics|ttCompute': 'Compute:',
  'mods|goldSpeedrun|metrics|ttWait': 'Wait:',
  'mods|goldSpeedrun|metrics|ttPost': 'Post:',
  'mods|goldSpeedrun|metrics|ttSlowest': 'Slowest chunk:',
  'mods|goldSpeedrun|cfg|allMatterCapture': 'Capture all-matter events',
  'mods|goldSpeedrun|cfg|allMatterCapture|desc': 'Diagnostic mode: intercepts all moving cellular automata pixels instead of ballistic particles only. Has a measurable simulation overhead; recommended only for short diagnostics.',

  // DE: Kategorien und Routen / EN: Categories and routes
  'mods|goldSpeedrun|dash|run': 'Run',
  'mods|goldSpeedrun|dash|categories': 'Categories',
  'mods|goldSpeedrun|cat|title': 'Categories',
  'mods|goldSpeedrun|cat|preset': 'preset',
  'mods|goldSpeedrun|cat|custom': 'custom',
  'mods|goldSpeedrun|cat|active': 'Active',
  'mods|goldSpeedrun|cat|activate': 'Activate',
  'mods|goldSpeedrun|cat|new': 'New category',
  'mods|goldSpeedrun|cat|name': 'Name',
  'mods|goldSpeedrun|cat|kind': 'Goal',
  'mods|goldSpeedrun|cat|kind|gold': 'Gold',
  'mods|goldSpeedrun|cat|kind|artifacts': 'Artifacts',
  'mods|goldSpeedrun|cat|kind|factory': 'Factory rank',
  'mods|goldSpeedrun|cat|kind|fluxite': 'Fluxite',
  'mods|goldSpeedrun|cat|kind|energy': 'Energy',
  'mods|goldSpeedrun|cat|kind|aura': 'Aura',
  'mods|goldSpeedrun|cat|kind|combined': 'Combined',
  'mods|goldSpeedrun|cat|templateFactoryGold': 'Factory 6 + 100k Gold',
  'mods|goldSpeedrun|cat|target': 'Target',
  'mods|goldSpeedrun|cat|goldMode': 'Gold ruleset',
  'mods|goldSpeedrun|cat|countMode': 'Counting',
  'mods|goldSpeedrun|cat|create': 'Create',
  'mods|goldSpeedrun|cat|rename': 'Rename',
  'mods|goldSpeedrun|cat|delete': 'Delete',
  'mods|goldSpeedrun|cat|clearPb': 'Clear PB',
  'mods|goldSpeedrun|cat|openTriggers': 'Edit split triggers (F3)',
  'mods|goldSpeedrun|cat|noPb': 'no PB',
  'mods|goldSpeedrun|route|title': 'Runs',
  'mods|goldSpeedrun|route|fromPb': 'Auto-updates on PB',
  'mods|goldSpeedrun|route|new': 'New run',
  'mods|goldSpeedrun|route|duplicate': 'Duplicate',
  'mods|goldSpeedrun|route|delete': 'Delete',
  'mods|goldSpeedrun|route|rename': 'Rename',
  'mods|goldSpeedrun|route|empty': 'No splits yet — import a CSV or add one below.',
  'mods|goldSpeedrun|route|up': 'Up',
  'mods|goldSpeedrun|route|down': 'Down',
  'mods|goldSpeedrun|route|remove': 'Remove',
  'mods|goldSpeedrun|route|add': 'Add',
  'mods|goldSpeedrun|route|addLabel': 'Type to search triggers…',
  'mods|goldSpeedrun|route|addTime': 'm:ss.s',
  'mods|goldSpeedrun|route|invalidTime': 'Could not read that time. Use m:ss or h:mm:ss.',
  'mods|goldSpeedrun|route|export': 'Export',
  'mods|goldSpeedrun|route|import': 'Import CSV',
  'mods|goldSpeedrun|route|setPb': 'Mark as PB',
  'mods|goldSpeedrun|route|setPbDone': 'Personal Best set to {time} (previous PB backed up)',
  'mods|goldSpeedrun|route|setPbFail': 'Need a split of at least 1:00 to set a PB.',
  'mods|goldSpeedrun|route|compareTitle': 'In-game comparison target',
  'mods|goldSpeedrun|route|comparePb': 'Official Personal Best',
  'mods|goldSpeedrun|route|compareCustom': 'Custom route: {name}',
  'mods|goldSpeedrun|route|noRoutes': 'No other runs yet. Comparing against Personal Best.',
  'mods|goldSpeedrun|route|editing': 'Editing: {name}',
  'mods|goldSpeedrun|route|editSplits': 'Edit',
  'mods|goldSpeedrun|route|doneEdit': 'Done',
  'mods|goldSpeedrun|route|searchTrigger': 'Type to search triggers…',
  'mods|goldSpeedrun|route|customTrigger': 'Custom: {label}',
  'mods|goldSpeedrun|route|customGroup': 'Custom / imported',
  'mods|goldSpeedrun|route|noMatch': 'No matching triggers',
  'mods|goldSpeedrun|route|splitsCount': '{count} splits',
  'mods|goldSpeedrun|run|title': 'Runs',
  'mods|goldSpeedrun|run|pb': 'Personal Best',
  'mods|goldSpeedrun|run|compareThis': 'Compare against this',
  'mods|goldSpeedrun|run|markPb': 'Mark as PB',
  'mods|goldSpeedrun|run|new': 'New run',
  'mods|goldSpeedrun|run|edit': 'Edit',
  'mods|goldSpeedrun|run|history': 'Previous PBs ({count})',
  'mods|goldSpeedrun|run|deletePbConfirm': 'Clear this Personal Best? It will be saved in Previous PBs.',
  'mods|goldSpeedrun|run|badgePb': 'PB',
  'mods|goldSpeedrun|csv|imported': 'Imported {count} splits as “{name}”',
  'mods|goldSpeedrun|csv|importEmpty': 'No splits in that CSV — nothing imported.',
  'mods|goldSpeedrun|csv|importedName': 'Imported route',
  'mods|goldSpeedrun|csv|exportRun': 'Export this run',
  'mods|goldSpeedrun|csv|exportPb': 'Export PB CSV',
  'mods|goldSpeedrun|csv|importPb': 'Import CSV as PB',
  'mods|goldSpeedrun|csv|importedPb': 'Imported {count} splits as PB/Target {time}',
  'mods|goldSpeedrun|pb|history': 'PB History ({count})',
  'mods|goldSpeedrun|pb|historyEmpty': 'No previous PBs saved yet.',
  'mods|goldSpeedrun|pb|restore': 'Restore',
  'mods|goldSpeedrun|pb|restored': 'Restored PB to {time}',
  'mods|goldSpeedrun|pb|historyHide': 'Hide history',
  'mods|goldSpeedrun|pb|sourceInGame': 'In-game run',
  'mods|goldSpeedrun|pb|sourcePromote': 'Replaced by route: {name}',
  'mods|goldSpeedrun|pb|sourceImport': 'Replaced by CSV import',
  'mods|goldSpeedrun|pb|sourceClear': 'Cleared',
  'mods|goldSpeedrun|pb|sourceRestore': 'Replaced by restore',
  'mods|goldSpeedrun|pb|sourceEdit': 'Edited by hand',

});

api.i18n.register('de', {
  'mods|goldSpeedrun|name': 'Gold Speedrun',
  'mods|goldSpeedrun|running': 'Kategorie: {category}',
  'mods|goldSpeedrun|done': 'Challenge geschafft! Zeit: {time}',
  'mods|goldSpeedrun|newBest': 'Neue Bestzeit: {time}',
  'mods|goldSpeedrun|pbTooShort': 'Geschafft in {time} — unter der 1:00-Mindestzeit, nicht als Bestzeit gespeichert',
  'mods|goldSpeedrun|waiting': 'Jede Aktion startet den Lauf',
  'mods|goldSpeedrun|toast|defaultsReset': 'Einstellungen auf gültige Speedrun-Regeln gesetzt (Hard Mode, keine Skips).',
  'mods|goldSpeedrun|resultKey': 'Letztes Ergebnis zeigen',
  'mods|goldSpeedrun|tutorialSkipped': 'Tutorial automatisch übersprungen',
  'mods|goldSpeedrun|artifacts': '{current} / {target} Artefakte',
  'mods|goldSpeedrun|factory': 'Rang {current} / {target}',
  'mods|goldSpeedrun|tainted': 'CHEATS BENUTZT - Lauf zählt nicht',
  'mods|goldSpeedrun|noTutorial': 'Ohne Tutorial',
  'mods|goldSpeedrun|category|blueprints': 'Blueprints',
  'mods|goldSpeedrun|dash|noBp': 'Ohne Blueprints',
  'mods|goldSpeedrun|dash|bpUsed': 'Blueprints',
  'mods|goldSpeedrun|toast|bpTriggered': 'Zur Blueprint-Kategorie gewechselt',
  'mods|goldSpeedrun|dash|exportPng': 'Ergebniskarte als PNG exportieren',
  'mods|goldSpeedrun|toast|pngSaved': 'Dashboard-PNG gespeichert',
  'mods|goldSpeedrun|toast|pngCopied': 'Dashboard-PNG in die Zwischenablage kopiert & gespeichert',

  'mods|goldSpeedrun|split|rank': 'Fabrikrang {level}',
  'mods|goldSpeedrun|split|artifact': 'Artefakt {index}',
  'mods|goldSpeedrun|split|gold': '{percent}% Gold',
  'mods|goldSpeedrun|split|upgrade': 'Aufwertung: {name}',
  'mods|goldSpeedrun|split|goal': 'ZIEL',
  'mods|goldSpeedrun|result|title': 'Lauf beendet',
  'mods|goldSpeedrun|result|total': 'Endzeit',
  'mods|goldSpeedrun|result|best': 'Bestzeit / Ziel',
  'mods|goldSpeedrun|result|noBest': 'erster Durchlauf',
  'mods|goldSpeedrun|result|sim': 'Simulationszeit',
  'mods|goldSpeedrun|result|play': 'Spielzeit-Uhr',
  'mods|goldSpeedrun|result|real': 'Pausenbewusste Echtzeit',
  'mods|goldSpeedrun|result|tickSourceMissing': 'Kein Schrittzähler - die Simulation hat diesen Lauf keine Schritte gemeldet, Simulationszeit und die daraus abgeleiteten Werte fehlen deshalb.',
  'mods|goldSpeedrun|clock|simShort': 'sim',
  'mods|goldSpeedrun|clock|realShort': 'p-echt',
  'mods|goldSpeedrun|clock|playShort': 'spiel',
  'mods|goldSpeedrun|result|colSplit': 'Auslöser',
  'mods|goldSpeedrun|result|colTime': 'Zeit',
  'mods|goldSpeedrun|result|colSegment': 'Abschnittsdauer',
  'mods|goldSpeedrun|result|colDelta': 'Δ zur PB',
  'mods|goldSpeedrun|result|colGold': 'Gold',
  'mods|goldSpeedrun|result|noSplits': 'Kein Auslöser gefeuert - unter Splits welche einschalten.',
  'mods|goldSpeedrun|result|close': 'Schließen',
  'mods|goldSpeedrun|result|hint': 'F10 zeigt das nochmal',
  'mods|goldSpeedrun|result|wallStart': 'Wanduhr Start',
  'mods|goldSpeedrun|result|wallEnd': 'Wanduhr Ende',
  'mods|goldSpeedrun|result|wallSpan': 'Wanduhr-Dauer',
  'mods|goldSpeedrun|result|wallNow': 'jetzt',
  'mods|goldSpeedrun|hud|openDashboard': 'F10 öffnet das Speedrun-Dashboard',
  'mods|goldSpeedrun|result|expand': 'Alle Werte zeigen',
  'mods|goldSpeedrun|result|collapse': 'Alle Werte ausblenden',

  // DE: Metriken (U, R, W und Ableitungen) / EN: Metrics (U, R, W and derived values)
  'mods|goldSpeedrun|metric|slowdown': 'Verzögerung',
  'mods|goldSpeedrun|metric|deficit': 'Schritt-Rückstand',
  'mods|goldSpeedrun|metric|jamRate': 'Blockrate',
  'mods|goldSpeedrun|metric|jamLoad': 'Blocklast',
  'mods|goldSpeedrun|metric|jamShare': 'Blockanteil',
  'mods|goldSpeedrun|metric|ticks': 'Ausgeführte Schritte (U)',
  'mods|goldSpeedrun|metric|avgUps': 'Mittlere UPS',
  'mods|goldSpeedrun|metric|idealTicks': 'Soll-Schritte (60×R)',
  'mods|goldSpeedrun|metric|thinkMult': 'Denk-Faktor',
  'mods|goldSpeedrun|metric|wrProbe': 'Spielzeit-Uhr minus pausenbewusste Echtzeit (W−R)',
  'mods|goldSpeedrun|metric|goldPerSec': 'Gold/s',
  'mods|goldSpeedrun|metric|goldReq': '(benötigt {rate} g/s)',
  'mods|goldSpeedrun|metric|goldBehindPb': '(hinter PB)',
  'mods|goldSpeedrun|metric|dash': 'wartet auf den Laufstart',

  // DE: Verlaufsgrafik / EN: History graph
  'mods|goldSpeedrun|graph|title': 'UPS über den ganzen Lauf',
  'mods|goldSpeedrun|graph|live': 'UPS live (letzte 60 s)',
  'mods|goldSpeedrun|graph|empty': 'Noch keine Daten - setze Simulationsüberwachung auf Standard oder Voll in den Mod-Optionen.',
  'mods|goldSpeedrun|graph|emptyRun': 'Noch keine Daten - starte einen Lauf (oder warte eine Sekunde), um UPS aufzuzeichnen.',

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
  'mods|goldSpeedrun|cfg|mode|desc': 'Hard Mode ist für einen gültigen Speedrun vorgeschrieben: Gold ist der aktuelle Kontostand, Forschen wirft also zurück. Total Earned ist nur Training und UNGÜLTIG FÜR SPEEDRUNS: es zählt jedes eingenommene Gold, Ausgeben kostet also keinen Fortschritt. Die Aufnahme muss im oder vor dem Welt-erstellen-Menü beginnen. Keine anderen Mods dürfen aktiv sein.',
  'mods|goldSpeedrun|cfg|mode|earned': 'Total Earned (UNGÜLTIG FÜR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|mode|balance': 'Hard Mode',
  'mods|goldSpeedrun|modeNormal': 'Total Earned',
  'mods|goldSpeedrun|modeHard': 'Hard Mode',
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
  'mods|goldSpeedrun|cfg|clockMode': 'Große Uhr',
  'mods|goldSpeedrun|cfg|clockMode|desc': 'Alle drei Zeiten werden immer gemessen und immer festgehalten - das hier entscheidet nur, welche groß auf dem Timer steht, die anderen beiden stehen darunter. Die Spielzeit-Uhr (W) ist die offizielle Community-Wertung: die eigene Uhr des Spielstands. Die pausenbewusste Echtzeit (R) zählt reale Millisekunden nur, solange das Spiel läuft - Pausieren hält sie an. Die Simulationszeit (T) zählt die Schritte, die die Welt tatsächlich gelaufen ist, geteilt durch 60.',
  'mods|goldSpeedrun|cfg|clockMode|real': 'Pausenbewusste Echtzeit (R)',
  'mods|goldSpeedrun|cfg|clockMode|sim': 'Simulationszeit (T)',
  'mods|goldSpeedrun|cfg|clockMode|play': 'Spielzeit-Uhr (W)',
  'mods|goldSpeedrun|cfg|timeFormat': 'Genauigkeit der Uhr',
  'mods|goldSpeedrun|cfg|timeFormat|seconds': 'Sekunden (00:00:00)',
  'mods|goldSpeedrun|cfg|timeFormat|centis': 'Hundertstel (00:00:00.00)',
  'mods|goldSpeedrun|cfg|timeFormat|millis': 'Millisekunden (00:00:00.000)',
  'mods|goldSpeedrun|cfg|skipIntro': 'Intro und Landeanflug überspringen (UNGÜLTIG FÜR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|skipIntro|desc': 'UNGÜLTIG FÜR SPEEDRUNS — nur Training. Springt bei einem neuen Spiel direkt in die Welt, genau wie der Knopf "Skip Intro" im Spiel. Für einen gültigen Speedrun auslassen. Die Aufnahme muss im oder vor dem Welt-erstellen-Menü beginnen.',
  'mods|goldSpeedrun|cfg|skipStory': 'Story-Textboxen wegblenden (UNGÜLTIG FÜR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|skipStory|desc': 'UNGÜLTIG FÜR SPEEDRUNS — nur Training. Schließt die Story-Einblendungen, sobald sie auftauchen - dasselbe wie Wegklicken, die Story zählt sie also weiter als gesehen. Für einen gültigen Speedrun auslassen.',
  'mods|goldSpeedrun|cfg|skipTutorial': 'Tutorial automatisch überspringen (UNGÜLTIG FÜR SPEEDRUNS)',
  'mods|goldSpeedrun|cfg|skipTutorial|desc': 'UNGÜLTIG FÜR SPEEDRUNS — nur Training. Beendet das Tutorial beim Laden eines Spielstands, genau wie der Knopf im Spiel. Passiert nur, solange der Timer noch wartet - nie mitten im Lauf. Für einen gültigen Speedrun auslassen.',
  'mods|goldSpeedrun|cfg|showOverlay': 'Timer einblenden',
  'mods|goldSpeedrun|cfg|showSplits': 'Split-Tabelle zeigen',
  'mods|goldSpeedrun|cfg|showSplits|desc': 'Listet die letzten Auslöser unter der Uhr mit Zeit und dem LiveSplit-Delta zur Bestzeit. Die vollständige Tabelle erscheint am Ende im Ergebnisfenster.',
  'mods|goldSpeedrun|cfg|hudSplitRows': 'Splits am Timer',
  'mods|goldSpeedrun|cfg|hudSplitRows|desc': 'Wie viele Split-Zeilen der Timer gleichzeitig zeigt. Die letzten erledigten bleiben stehen, der Rest blickt auf die kommenden Marken. Standard ist 6.',
  'mods|goldSpeedrun|cfg|hudLayout': 'Anordnung des Timers',
  'mods|goldSpeedrun|cfg|hudLayout|desc': 'Waagerecht stellt Splits, Uhren und die UPS-Grafik nebeneinander, damit der Kasten weniger hoch wird. Senkrecht ist der alte Stapel.',
  'mods|goldSpeedrun|cfg|hudLayout|horizontal': 'Waagerecht (kompakt)',
  'mods|goldSpeedrun|cfg|hudLayout|vertical': 'Senkrecht',
  'mods|goldSpeedrun|cfg|streamerMode': 'Streamer-Modus',
  'mods|goldSpeedrun|cfg|streamerMode|desc': 'Vergrößert Splits, die offizielle Spielzeit-Uhr und den LiveSplit-Vorsprung für Zuschauer. Alles andere bleibt klein und gebündelt. Funktioniert mit beiden Timer-Anordnungen.',
  'mods|goldSpeedrun|cfg|streamerFontScale': 'Streamer-Schriftgröße',
  'mods|goldSpeedrun|cfg|streamerFontScale|desc': 'Größe der stream-relevanten Teile: Splits, offizielle Zeit, Vorsprung/Rückstand und Verzögerung. Nur ganze Pixelstufen, damit die Einblendung scharf bleibt.',
  'mods|goldSpeedrun|cfg|streamerFontScale|S': 'S',
  'mods|goldSpeedrun|cfg|streamerFontScale|M': 'M',
  'mods|goldSpeedrun|cfg|streamerFontScale|L': 'L',
  'mods|goldSpeedrun|cfg|streamerFontScale|XL': 'XL',
  'mods|goldSpeedrun|cfg|streamerFontScale|XXL': 'XXL',
  'mods|goldSpeedrun|cfg|streamerFontScale|XXXL': 'XXXL',
  'mods|goldSpeedrun|cfg|secondaryFontScale': 'Schriftgröße der übrigen Werte',
  'mods|goldSpeedrun|cfg|secondaryFontScale|desc': 'Größe der übrigen HUD-Werte (Uhren, Seed, Schritt-Rückstand, Abzeichen). Getrennt von der Stream-Schriftgröße.',
  'mods|goldSpeedrun|cfg|secondaryFontScale|S': 'S',
  'mods|goldSpeedrun|cfg|secondaryFontScale|M': 'M',
  'mods|goldSpeedrun|cfg|secondaryFontScale|L': 'L',
  'mods|goldSpeedrun|hud|totalAhead': 'gegen Vergleich',
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
  'mods|goldSpeedrun|rules|custom': 'UNGÜLTIGER LAUF',
  'mods|goldSpeedrun|rules|invalid': 'UNGÜLTIGER LAUF',
  'mods|goldSpeedrun|rules|invalidBanner': 'UNGÜLTIGER LAUF — Einstellungen sind nicht speedrun-tauglich',
  'mods|goldSpeedrun|rules|title': 'Offizielles Speedrun-Regelwerk',
  'mods|goldSpeedrun|rules|ok': 'Alle Einstellungen entsprechen den offiziellen Speedrun-Regeln.',
  'mods|goldSpeedrun|rules|bad': 'Diese Einstellungen sind nicht speedrun-tauglich:',
  'mods|goldSpeedrun|rules|need': 'nötig: {value}',
  'mods|goldSpeedrun|rules|broken': 'REGELWERK VERSTELLT',
  'mods|goldSpeedrun|rules|brokenDesc': 'Während des laufenden Laufs wurde eine Einstellung des offiziellen Regelwerks geändert. Der Lauf gilt nicht mehr als offiziell und wird nicht als Bestzeit gespeichert.',
  'mods|goldSpeedrun|rules|locked': 'festgehalten beim Start des Laufs',
  'mods|goldSpeedrun|rules|skipIntro': 'Intro und Landeanflug überspringen',
  'mods|goldSpeedrun|rules|skipStory': 'Story-Textboxen wegblenden',
  'mods|goldSpeedrun|rules|skipTutorial': 'Tutorial automatisch überspringen',
  'mods|goldSpeedrun|rules|mods': 'Andere Mods aktiv',
  'mods|goldSpeedrun|rules|modsNone': 'keine',
  'mods|goldSpeedrun|rules|debugMode': 'Debug-Modus',
  'mods|goldSpeedrun|rules|cinematicMode': 'Cinematik-Modus',
  'mods|goldSpeedrun|btn|deactivateDebug': 'Debug deaktivieren',
  'mods|goldSpeedrun|toast|debugDeactivated': 'Debug- und Cinematik-Modus deaktiviert. Dieser Lauf bleibt ungültig.',
  'mods|goldSpeedrun|toast|debugEnabled': 'Debug-Modus an. Dieser Spielstand zählt nicht als Speedrun.',
  'mods|goldSpeedrun|cfg|debugMode': 'Debug-Modus',
  'mods|goldSpeedrun|cfg|debugMode|desc': 'Schaltet das Debug-Menü ein, ohne den Konsolenbefehl. ACHTUNG: Debug-Modus macht jeden Speedrun ungültig. Ausschalten räumt auch den Cinematik-Modus und die anderen nicht erlaubten Motor-Zustände ab. Ein Spielstand, in dem eines von beiden vor dem Ziel an war, bleibt markiert.',
  'mods|goldSpeedrun|mods|clean': 'Keine weiteren Mods',
  'mods|goldSpeedrun|mods|count': '{count} weitere Mods',
  'mods|goldSpeedrun|cfg|showRuleset': 'Regelwerk-Abzeichen zeigen',
  'mods|goldSpeedrun|cfg|showRuleset|desc': 'Zeigt am Timer und im Ergebnisfenster, ob die Einstellungen speedrun-tauglich sind: Gold-Regelwerk Hard Mode, Intro-/Story-/Tutorial-Skip aus, kein anderer Mod aktiv, und Debug- sowie Cinematik-Modus aus. Ungültige Einstellungen zeigen ein rotes UNGÜLTIGER LAUF mit der abweichenden Option.',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics': 'Erweiterte Messwerte zeigen',
  'mods|goldSpeedrun|cfg|showAdvancedMetrics|desc': 'Zeigt die mittleren UPS unter dem Timer. Schrittzahl, Soll-Schritte, Denk-Faktor und der Abstand der Spielzeit-Uhr bleiben im Dashboard.',
  'mods|goldSpeedrun|cfg|monitoringMode': 'Simulationsüberwachung',
  'mods|goldSpeedrun|cfg|monitoringMode|desc': 'Aus: keine Simulations-Hooks und keine UPS-Grafik. Standard: Wurfpartikel plus passive Werte — geringer Overhead. Voll: fängt jedes bewegte CA-Pixel ab (ruhend vs. aktiv) — messbare Sim-Kosten, nur zur Diagnose.',
  'mods|goldSpeedrun|cfg|monitoringMode|off': 'Aus (kein Overhead)',
  'mods|goldSpeedrun|cfg|monitoringMode|standard': 'Standard (Wurfpartikel)',
  'mods|goldSpeedrun|cfg|monitoringMode|full': 'Volldiagnose (gesamte Materie)',
  'mods|goldSpeedrun|cfg|showLiveSparkline': 'Live-UPS-Grafik zeigen',
  'mods|goldSpeedrun|cfg|showLiveSparkline|desc': 'Zeigt eine kleine Live-Grafik der letzten 60 Sekunden UPS unter dem Timer. Wird nur im Hauptthread abgetastet - keine messbaren Kosten für die Simulation.',
  'mods|goldSpeedrun|metrics|title': 'Simulations- & Leistungsdiagnose',
  'mods|goldSpeedrun|metrics|openBtn': 'Vollbild-Graph (F7)',
  'mods|goldSpeedrun|metrics|close': 'Schließen (ESC)',
  'mods|goldSpeedrun|metrics|timeRange': 'Zeitbereich:',
  'mods|goldSpeedrun|metrics|range60s': 'Letzte 60s (10 Hz)',
  'mods|goldSpeedrun|metrics|range180s': 'Letzte 3m (10 Hz)',
  'mods|goldSpeedrun|metrics|rangeFull': 'Kompletter Lauf (1 Hz)',
  'mods|goldSpeedrun|metrics|layerUps': 'UPS (dynamisch)',
  'mods|goldSpeedrun|metrics|layerBlocks': 'Kollisionen',
  'mods|goldSpeedrun|metrics|layerMoves': 'Bewegungen',
  'mods|goldSpeedrun|metrics|layerAwake': 'Aktive Abschnitte',
  'mods|goldSpeedrun|metrics|layerSimTime': 'Sim-Rechenzeit',
  'mods|goldSpeedrun|metrics|layerLive': 'Dynamische Population (Live)',
  'mods|goldSpeedrun|metrics|layerJamLoad': 'Blocklast (Block/Schritt)',
  'mods|goldSpeedrun|metrics|layerJamShare': 'Blockanteil (%)',
  'mods|goldSpeedrun|metrics|layerJamRate': 'Blockrate (%)',
  'mods|goldSpeedrun|metrics|layerJamIntensity': 'Blocklast (Block/Schritt)',
  'mods|goldSpeedrun|metrics|layerBlocksSettled': 'Kollisionen (Ruhend)',
  'mods|goldSpeedrun|metrics|layerBlocksActive': 'Kollisionen (Aktiv)',
  'mods|goldSpeedrun|metrics|layerDeficit': 'Verlorene Zeit (s)',
  'mods|goldSpeedrun|metrics|layerGold': 'Gold',
  'mods|goldSpeedrun|metrics|scaleLinear': 'Linear',
  'mods|goldSpeedrun|metrics|scaleLog': 'Logarithmisch',
  'mods|goldSpeedrun|metrics|scaleMode': 'Skala:',
  'mods|goldSpeedrun|metrics|smooth': 'Glättung:',
  'mods|goldSpeedrun|metrics|smoothOff': 'Aus',
  'mods|goldSpeedrun|metrics|smoothRolling': '5s Gleit. Schnitt',
  'mods|goldSpeedrun|metrics|smoothBands': 'Konfidenzbänder',
  'mods|goldSpeedrun|metrics|curUps': 'Momentan-UPS',
  'mods|goldSpeedrun|metrics|jamRate': 'Blockrate',
  'mods|goldSpeedrun|metrics|jamLoad': 'Blocklast',
  'mods|goldSpeedrun|metrics|jamShare': 'Blockanteil',
  'mods|goldSpeedrun|metrics|flightActivity': 'Flugaktivität',
  'mods|goldSpeedrun|metrics|activeChunks': 'Aktive Chunks',
  'mods|goldSpeedrun|metrics|simStep': 'Sim-Schritt',
  'mods|goldSpeedrun|metrics|hintSimBottleneck': 'Sim-Last: Fällt UPS bei Sim-Schrittzeiten über 16,6 ms, überlasten die CA-Physikregeln die Worker-Threads.',
  'mods|goldSpeedrun|metrics|hintRenderBottleneck': 'Sync / Thread-Warten: Fällt UPS bei niedriger Schrittzeit, sind Thread-Barrieren (waitMs) oder CPU-Kern-Engpässe die Ursache. (Render-FPS ist entkoppelt).',
  'mods|goldSpeedrun|metrics|hintJamRate': 'Blockanteil (%) ist eine reine Prozentquote (Block / Gesamt). Blocklast (Block/Schritt) normiert Kollisionen je Tick — bei 60 UPS entspricht dies Kollisionen mal 1/60. Keine der beiden Metriken misst direkt CPU-Aufwand.',
  'mods|goldSpeedrun|metrics|cardUpsTitle': 'UPS (Simulationsrate)',
  'mods|goldSpeedrun|metrics|cardUps': 'Simulationsschritte pro realer Sekunde, ausgeführt durch den Hintergrund-Worker-Threadpool (Ziel: 60 UPS = 16,67 ms/Schritt). Unter 60 verliert die Spielwelt Zeit (Zeitdehnung/Slowmotion). HINWEIS: UPS ist komplett von den Render-FPS entkoppelt! Die Simulation läuft in separaten Web Workern; GPU- oder UI-Lag senkt FPS, nicht UPS. Fällt UPS unter 60, prüfe Sim-Rechenzeit vs. Worker-Warten: hohe Rechenzeit = CA-Physik überlastet; hohes Warten = Thread-Synchronisation/Barrieren oder CPU-Kern-Engpass.',
  'mods|goldSpeedrun|metrics|cardBlocksTitle': 'Kollisionen',
  'mods|goldSpeedrun|metrics|cardBlocks': 'Anzahl der element:blocked-Ereignisse im Intervall: Bewegungsversuche, deren Zielzelle belegt war. Im Standardmodus werden nur ballistische Partikel (geworfene Objekte) erfasst. Im Vollmodus wird sämtliche Materie erfasst (wo ruhende Haufen dominieren, da die Schwerkraft jeden Tick die Auflage prüft). Kollisionsprüfungen sind triviale O(1)-Gitterabfragen und erzeugen für sich kaum CPU-Last; sie messen physische Hindernisse, nicht Rechenaufwand.',
  'mods|goldSpeedrun|metrics|cardMovesTitle': 'Bewegungen',
  'mods|goldSpeedrun|metrics|cardMoves': 'Anzahl der element:moved-Ereignisse: erfolgreiche Verschiebungen von Materie in freie Zellen. Im Standardmodus zählt dies Wurfpartikel im Flug; im Vollmodus alle CA-Partikelbewegungen und -Tausche (ein Platztausch erzeugt 2 Moves und 0 Blöcke). Hohe Moves bedeuten echten Massendurchsatz. Hohe Kollisionen bei wenigen Moves im Standardmodus bedeuten blockierte Wurfgeschosse an Hindernissen.',
  'mods|goldSpeedrun|metrics|cardJamShareTitle': 'Blockanteil (%)',
  'mods|goldSpeedrun|metrics|cardJamShare': 'Formel: Kollisionen / (Kollisionen + Bewegungen) × 100. Ein reines dimensionsloses Verhältnis, das den Prozentsatz blockierter Bewegungsversuche angibt. Da es Anteile statt Mengen misst, ergeben 2 festsitzende Partikel in einer sonst stillen Welt ~100% Blockanteil bei null Auswirkung auf die Performance. Nie als isolierten Leistungs- oder Lastwert interpretieren.',
  'mods|goldSpeedrun|metrics|cardJamLoadTitle': 'Blocklast (Block/Schritt)',
  'mods|goldSpeedrun|metrics|cardJamLoad': 'Formel: Kollisionen / Simulationsschritte. Durchschnittliche Kollisionen pro Simulationstick. Bei stabilen 60 UPS entspricht dies buchstäblich Kollisionen / (60 × Sekunden) (Kollisionsanzahl mal konstanter Faktor). Die Normierung über Ticks hält den Wert stabil, wenn die Simulation verlangsamt. Sie spiegelt die physische Kollisionsdichte je Schritt wider, NICHT den CPU-Aufwand (Zellbelegungsprüfungen sind rechnerisch trivial).',
  'mods|goldSpeedrun|metrics|cardAwakeTitle': 'Aktive Chunks',
  'mods|goldSpeedrun|metrics|cardAwake': 'Anzahl der 40×40-Gitterabschnitte, die diesen Tick aktiv simuliert werden (chunkShouldUpdate === 1). Schlafende Chunks mit ruhender Materie verbrauchen nahezu null CPU. Aktive Chunks werden in den Simulationsphasen 1–4 auf die Worker-Threads aufgeteilt. Ein Anstieg aktiver Chunks treibt den Dispatch-Overhead und die Anzahl der CA-Zellberechnungen direkt nach oben.',
  'mods|goldSpeedrun|metrics|cardSimTimeTitle': 'Sim-Rechenzeit',
  'mods|goldSpeedrun|metrics|cardSimTime': 'Wanduhren-Millisekunden, die die Simulations-Worker-Threads für die Ausführung eines Schritts benötigen. Das Budget bei 60 UPS beträgt 16,67 ms. Primärer Indikator für Simulationslast: übersteigt die Zeit 16,67 ms, ist die CA-Physik überlastet. Liegt sie niedrig (<16,67 ms), aber UPS sinkt trotzdem unter 60, liegt der Engpass bei Thread-Synchronisation/Barrieren (waitMs), Manager-Dispatch (postMs) oder CPU-Kern-Drosselung — NICHT an Render/GPU/DOM!',
  'mods|goldSpeedrun|metrics|cardLiveTitle': 'Dynamische Population (Live)',
  'mods|goldSpeedrun|metrics|cardLive': 'Im Shared Memory der Engine allozierte dynamische Elementslots (sim.liveElementCount): fallender Sand, Flüssigkeiten, Gase und Geschosse (ohne statisches Terrain). Repräsentiert den Speicher-Footprint aktiver Materie. Slots bleiben belegt, auch wenn Materie zur Ruhe kommt und Chunks einschlafen.',
  'mods|goldSpeedrun|metrics|cardSettledTitle': 'Kollisionen (Ruhend)',
  'mods|goldSpeedrun|metrics|cardSettled': 'Volldiagnose-Aufteilung: blockierte Bewegungsversuche mit direction === "down" gegen Terrain oder ein Element. Die Schwerkraft prüft die tragende Auflage jeden Tick neu. Hohe Zahlen sind bei ruhenden Haufen völlig normal und zeigen statisches Gleichgewicht, keinen Lag.',
  'mods|goldSpeedrun|metrics|cardActiveTitle': 'Kollisionen (Aktiv)',
  'mods|goldSpeedrun|metrics|cardActive': 'Volldiagnose-Aufteilung: alle nicht nach unten gerichteten Blockversuche (seitlicher Fluss, Aufwärtsdrang, unerlaubte Übergänge). Erfasst dynamischen Widerstand: Schüttkegel-Lawinen, Flüssigkeitsdruck, Stau in Trichtern und Werfer-Aufschläge.',
  'mods|goldSpeedrun|metrics|cardDeficitTitle': 'Verlorene Zeit (vorzeichenbehaftetes Defizit)',
  'mods|goldSpeedrun|metrics|cardDeficit': 'Neutrale Zählung aus zwei Rohzählern: D = (Echt-ms / 1000 × 60) − ausgeführte Ticks, aufsummiert über das Fenster. Keine Rate, kein Clamp. Positives D = Simulation hinter der Echtzeit; negatives D = Simulation lief vor 60 UPS (Überlauf). Unaufgeholte Last D_perm ist das laufende Minimum von D über die nächsten 2 s, damit Hitch-und-Aufhol-Wobble nicht zählt. Schattierte Bänder markieren Intervalle, in denen D_perm stieg. Ein Band hovern, um die Engpasskarte dorthin zu setzen.',
  'mods|goldSpeedrun|metrics|ttDeficit': 'Defizit D:',
  'mods|goldSpeedrun|metrics|ttDeficitPerm': 'Unaufgeholt:',
  'mods|goldSpeedrun|metrics|slowdownIn': 'In Verlangsamung',
  'mods|goldSpeedrun|metrics|slowdownNone': 'keine',
  'mods|goldSpeedrun|metrics|unrecovered': 'Unaufgeholt',
  'mods|goldSpeedrun|metrics|heatmapBoundCompute': 'Rechenbegrenzt zu diesem Zeitpunkt — die Karte kann einen Hotspot zeigen.',
  'mods|goldSpeedrun|metrics|heatmapBoundWait': 'Sync/Warte-begrenzt zu diesem Zeitpunkt — Abschnittfarben sind nicht die Ursache.',
  'mods|goldSpeedrun|metrics|heatmapBoundEmpty': 'Keine Phasenzeit zu diesem Zeitpunkt.',
  'mods|goldSpeedrun|metrics|heatmapDisclaimer': 'Höchste Rechenzeiten je Tick. Hinweis, kein Urteil: genau ein Abschnitt ist immer der langsamste Tick und wird gemeldet, auch wenn er keinen UPS-Verlust verursacht. Ort zum Nachschauen, keine Schuldzuweisung.',
  'mods|goldSpeedrun|metrics|monitoringOffTitle': 'Simulationsüberwachung ist aus',
  'mods|goldSpeedrun|metrics|monitoringOffBody': 'Worker-Hooks und UPS-Verlauf sind aus. Aktiviere Standard, um Wurfpartikel mit geringem Overhead aufzuzeichnen, oder Volldiagnose für Gesamtmaterie.',
  'mods|goldSpeedrun|metrics|monitoringOffEnable': 'Standardüberwachung einschalten',
  'mods|goldSpeedrun|metrics|benchConfirmTitle': 'Metrik-Kostenmatrix starten',
  'mods|goldSpeedrun|metrics|benchConfirmLead': 'Das ist ein fortgeschrittener Test von etwa 15 Minuten zum Overhead der Metrik-Hooks. Fehlinterpretation ist leicht. Nicht in einem Speedrun starten.',
  'mods|goldSpeedrun|metrics|benchConfirmHow': 'So testen: eigene Testwelt, die bereits mindestens 10 Minuten im stationären Partikelbetrieb läuft. Last zwischen 90 % und 100 %, damit extra Kosten sofort als UPS-Abfall sichtbar werden — aber nicht schon im Roten starten (UPS bricht schon ein).',
  'mods|goldSpeedrun|metrics|benchConfirmInterp': 'Die Matrix vergleicht die Basislinie (Hooks aus) mit jedem Metrikpaket. Höhere Sim-Schrittzeit oder niedrigere UPS bei EIN ist der Overhead dieses Pakets. Ergebnisse hängen von der aktuellen Welt ab; sie benennen keinen einzelnen „Problem-Abschnitt“.',
  'mods|goldSpeedrun|metrics|benchConfirmForce': 'Der Test erzwingt für die Dauer nur Wurfpartikel und bricht ab, wenn ein Speedrun läuft oder das Spiel pausiert ist.',
  'mods|goldSpeedrun|metrics|benchConfirmStart': 'Verstanden — Test starten',
  'mods|goldSpeedrun|metrics|benchConfirmCancel': 'Abbrechen',
  'mods|goldSpeedrun|metrics|ttSettled': 'Ruhende Kollisionen:',
  'mods|goldSpeedrun|metrics|ttActive': 'Aktive Kollisionen:',
  'mods|goldSpeedrun|metrics|samplePoint': 'Messpunkt',
  'mods|goldSpeedrun|metrics|ttUps': 'UPS:',
  'mods|goldSpeedrun|metrics|ttGold': 'Gold:',
  'mods|goldSpeedrun|metrics|ttCollisions': 'Kollisionen:',
  'mods|goldSpeedrun|metrics|ttMoves': 'Bewegungen:',
  'mods|goldSpeedrun|metrics|ttSimUpdates': 'Sim-Schritte:',
  'mods|goldSpeedrun|metrics|ttJamLoad': 'Blocklast:',
  'mods|goldSpeedrun|metrics|ttJamShare': 'Blockanteil:',
  'mods|goldSpeedrun|metrics|ttFlightActivity': 'Flugaktivität:',
  'mods|goldSpeedrun|metrics|ttJamRate': 'Blockrate:',
  'mods|goldSpeedrun|metrics|ttJamIntensity': 'Blocklast:',
  'mods|goldSpeedrun|metrics|ttDynamic': 'Dynamische Pop (Live):',
  'mods|goldSpeedrun|metrics|ttDynamicDesc': 'Belegte dynamische Elementslots in der Engine (inkl. ruhendem Sand, Flüssigkeiten, Gasen; keine reinen Beweger).',
  'mods|goldSpeedrun|metrics|ttAwake': 'Aktive Chunks:',
  'mods|goldSpeedrun|metrics|ttSimCompute': 'Sim-Rechenzeit:',
  'mods|goldSpeedrun|metrics|ttScope': 'Erfassungsbereich:',
  'mods|goldSpeedrun|metrics|scopeBallistic': 'Nur Wurfpartikel',
  'mods|goldSpeedrun|metrics|scopeAllMatter': 'Alle Materie (Diagnose)',
  'mods|goldSpeedrun|metrics|scopeSwitch': 'Erfassungsbereich:',
  'mods|goldSpeedrun|metrics|scopeWarn': 'Hinweis: Die Gesamtmaterie-Erfassung fängt alle bewegten CA-Pixel ab. Dient zu Benchmark-/Diagnosezwecken und kann die UPS senken.',
  'mods|goldSpeedrun|metrics|benchBtn': 'Metrik-Kostenmatrix starten (~15 Min.)',
  'mods|goldSpeedrun|metrics|benchRunning': '{phase} · Wiederholung {totalPhase} · {mode}',
  'mods|goldSpeedrun|metrics|benchTitle': 'Metrik-Kostenmatrix',
  'mods|goldSpeedrun|metrics|benchBaseline': 'AUS (Basislinie):',
  'mods|goldSpeedrun|metrics|benchActive': 'EIN (Aktiv):',
  'mods|goldSpeedrun|metrics|benchOverhead': 'Geschätzter Overhead:',
  'mods|goldSpeedrun|metrics|benchCancel': 'Abbrechen',
  'mods|goldSpeedrun|metrics|benchCopy': 'Bericht kopieren',
  'mods|goldSpeedrun|metrics|benchCopied': 'In Zwischenablage kopiert!',
  'mods|goldSpeedrun|metrics|benchClose': 'Schließen',
  'mods|goldSpeedrun|metrics|key': 'Simulationsdiagnose-Graph umschalten',
  'mods|goldSpeedrun|metrics|causeTitle': 'Wohin die Simulationszeit geht',
  'mods|goldSpeedrun|metrics|causeCompute': 'Rechnen',
  'mods|goldSpeedrun|metrics|causeWait': 'Warten (Sync)',
  'mods|goldSpeedrun|metrics|causePost': 'Nachlauf',
  'mods|goldSpeedrun|metrics|causeBoundCompute': 'Rechenbegrenzt',
  'mods|goldSpeedrun|metrics|causeBoundWait': 'Sync-begrenzt',
  'mods|goldSpeedrun|metrics|causeSlowest': 'Langsamste Region',
  'mods|goldSpeedrun|metrics|causeChunk': 'Abschnitt ({x}, {y})',
  'mods|goldSpeedrun|metrics|causeColumn': 'Spalte {x}',
  'mods|goldSpeedrun|metrics|causeEmpty': 'Noch keine Phasenzeit — Welt laden und einen Tick abwarten.',
  'mods|goldSpeedrun|metrics|causeNote': 'Zeit der Scheduling-Phasen, keine Aufteilung nach Physikregeln. Zeigt wo die Simulation Zeit verbringt und ob sie rechnet oder auf andere Threads wartet.',
  'mods|goldSpeedrun|metrics|heatmapTitle': 'Engpasskarte (ms)',
  'mods|goldSpeedrun|metrics|heatmapSum': 'Kumulativ',
  'mods|goldSpeedrun|metrics|heatmapExp': 'Exp. Abkühlung',
  'mods|goldSpeedrun|metrics|heatmapLinear': 'Lin. Abkühlung',
  'mods|goldSpeedrun|metrics|heatmapPeak': 'Max. Tick',
  'mods|goldSpeedrun|metrics|heatmapLive': 'Dieser Tick',
  'mods|goldSpeedrun|metrics|heatmapFloor': 'Umriss',
  'mods|goldSpeedrun|metrics|heatmapHalfLife': 'Halbwertszeit',
  'mods|goldSpeedrun|metrics|heatmapWindow': 'Fenster',
  'mods|goldSpeedrun|metrics|heatmapEmpty': 'Noch keine Engpasskarte — Welt laden und einen Tick abwarten.',
  'mods|goldSpeedrun|metrics|heatmapHint': 'Jede Zelle ist ein 40×40-Abschnitt. Farbe zeigt Engpass-Millisekunden der Worker. Mausrad zum Zoomen, Ziehen zum Verschieben, Doppelklick zum Zurücksetzen.',
  'mods|goldSpeedrun|metrics|heatmapScale': 'Max: {ms}',
  'mods|goldSpeedrun|metrics|heatmapCell': 'Abschnitt ({x}, {y})  {ms}',
  'mods|goldSpeedrun|metrics|heatmapCellDetail': 'Abschnitt ({x}, {y})  {val} ({sub})',
  'mods|goldSpeedrun|metrics|heatmapLiveBtn': 'Live',
  'mods|goldSpeedrun|metrics|heatmapZoomReset': 'Reset',
  'mods|goldSpeedrun|metrics|heatmapTimeline': 'Zeitachse',
  'mods|goldSpeedrun|metrics|ttCompute': 'Rechnen:',
  'mods|goldSpeedrun|metrics|ttWait': 'Warten:',
  'mods|goldSpeedrun|metrics|ttPost': 'Nachlauf:',
  'mods|goldSpeedrun|metrics|ttSlowest': 'Langsamster Abschnitt:',
  'mods|goldSpeedrun|cfg|allMatterCapture': 'Gesamtmaterie erfassen',
  'mods|goldSpeedrun|cfg|allMatterCapture|desc': 'Diagnose-Modus: fängt alle bewegten CA-Pixel anstelle von nur Wurfpartikeln ab. Hat messbaren Simulations-Overhead; nur für kurze Diagnosen empfohlen.',

  'mods|goldSpeedrun|dash|run': 'Lauf',
  'mods|goldSpeedrun|dash|categories': 'Kategorien',
  'mods|goldSpeedrun|cat|title': 'Kategorien',
  'mods|goldSpeedrun|cat|preset': 'Vorgabe',
  'mods|goldSpeedrun|cat|custom': 'eigen',
  'mods|goldSpeedrun|cat|active': 'Aktiv',
  'mods|goldSpeedrun|cat|activate': 'Aktivieren',
  'mods|goldSpeedrun|cat|new': 'Neue Kategorie',
  'mods|goldSpeedrun|cat|name': 'Name',
  'mods|goldSpeedrun|cat|kind': 'Ziel',
  'mods|goldSpeedrun|cat|kind|gold': 'Gold',
  'mods|goldSpeedrun|cat|kind|artifacts': 'Artefakte',
  'mods|goldSpeedrun|cat|kind|factory': 'Fabrikrang',
  'mods|goldSpeedrun|cat|kind|fluxite': 'Fluxit',
  'mods|goldSpeedrun|cat|kind|energy': 'Energie',
  'mods|goldSpeedrun|cat|kind|aura': 'Aura',
  'mods|goldSpeedrun|cat|kind|combined': 'Kombiniert',
  'mods|goldSpeedrun|cat|templateFactoryGold': 'Fabrik 6 + 100k Gold',
  'mods|goldSpeedrun|cat|target': 'Zielwert',
  'mods|goldSpeedrun|cat|goldMode': 'Gold-Regelwerk',
  'mods|goldSpeedrun|cat|countMode': 'Zählweise',
  'mods|goldSpeedrun|cat|create': 'Anlegen',
  'mods|goldSpeedrun|cat|rename': 'Umbenennen',
  'mods|goldSpeedrun|cat|delete': 'Löschen',
  'mods|goldSpeedrun|cat|clearPb': 'Bestzeit löschen',
  'mods|goldSpeedrun|cat|openTriggers': 'Split-Auslöser bearbeiten (F3)',
  'mods|goldSpeedrun|cat|noPb': 'keine PB',
  'mods|goldSpeedrun|route|title': 'Läufe',
  'mods|goldSpeedrun|route|fromPb': 'wird bei neuer PB überschrieben',
  'mods|goldSpeedrun|route|new': 'Neuer Lauf',
  'mods|goldSpeedrun|route|duplicate': 'Duplizieren',
  'mods|goldSpeedrun|route|delete': 'Löschen',
  'mods|goldSpeedrun|route|rename': 'Umbenennen',
  'mods|goldSpeedrun|route|empty': 'Noch keine Splits — CSV importieren oder unten eine Zeile anlegen.',
  'mods|goldSpeedrun|route|up': 'Hoch',
  'mods|goldSpeedrun|route|down': 'Runter',
  'mods|goldSpeedrun|route|remove': 'Entfernen',
  'mods|goldSpeedrun|route|add': 'Hinzufügen',
  'mods|goldSpeedrun|route|addLabel': 'Auslöser suchen…',
  'mods|goldSpeedrun|route|addTime': 'm:ss.s',
  'mods|goldSpeedrun|route|invalidTime': 'Zeit nicht erkannt. Nutze m:ss oder h:mm:ss.',
  'mods|goldSpeedrun|route|export': 'Export',
  'mods|goldSpeedrun|route|import': 'CSV importieren',
  'mods|goldSpeedrun|route|setPb': 'Als Bestzeit setzen',
  'mods|goldSpeedrun|route|setPbDone': 'Bestzeit auf {time} gesetzt (vorherige PB gesichert)',
  'mods|goldSpeedrun|route|setPbFail': 'Zum Setzen braucht es einen Split von mindestens 1:00.',
  'mods|goldSpeedrun|route|compareTitle': 'Vergleichsziel im Spiel',
  'mods|goldSpeedrun|route|comparePb': 'Offizielle Bestzeit',
  'mods|goldSpeedrun|route|compareCustom': 'Eigene Route: {name}',
  'mods|goldSpeedrun|route|noRoutes': 'Noch keine weiteren Läufe. Vergleich gegen die Bestzeit.',
  'mods|goldSpeedrun|route|editing': 'Bearbeiten: {name}',
  'mods|goldSpeedrun|route|editSplits': 'Bearbeiten',
  'mods|goldSpeedrun|route|doneEdit': 'Fertig',
  'mods|goldSpeedrun|route|searchTrigger': 'Auslöser suchen…',
  'mods|goldSpeedrun|route|customTrigger': 'Eigene: {label}',
  'mods|goldSpeedrun|route|customGroup': 'Eigene / importiert',
  'mods|goldSpeedrun|route|noMatch': 'Kein passender Auslöser',
  'mods|goldSpeedrun|route|splitsCount': '{count} Splits',
  'mods|goldSpeedrun|run|title': 'Läufe',
  'mods|goldSpeedrun|run|pb': 'Bestzeit',
  'mods|goldSpeedrun|run|compareThis': 'Hiermit vergleichen',
  'mods|goldSpeedrun|run|markPb': 'Als Bestzeit setzen',
  'mods|goldSpeedrun|run|new': 'Neuer Lauf',
  'mods|goldSpeedrun|run|edit': 'Bearbeiten',
  'mods|goldSpeedrun|run|history': 'Frühere Bestzeiten ({count})',
  'mods|goldSpeedrun|run|deletePbConfirm': 'Diese Bestzeit löschen? Sie wird unter Frühere Bestzeiten gesichert.',
  'mods|goldSpeedrun|run|badgePb': 'PB',
  'mods|goldSpeedrun|csv|imported': '{count} Splits als „{name}“ importiert',
  'mods|goldSpeedrun|csv|importEmpty': 'Keine Splits in dieser CSV — nichts importiert.',
  'mods|goldSpeedrun|csv|importedName': 'Importierte Route',
  'mods|goldSpeedrun|csv|exportRun': 'Diesen Lauf exportieren',
  'mods|goldSpeedrun|csv|exportPb': 'PB als CSV',
  'mods|goldSpeedrun|csv|importPb': 'CSV als PB importieren',
  'mods|goldSpeedrun|csv|importedPb': '{count} Splits als PB/Ziel {time} importiert',
  'mods|goldSpeedrun|pb|history': 'PB-Verlauf ({count})',
  'mods|goldSpeedrun|pb|historyEmpty': 'Noch keine früheren Bestzeiten gesichert.',
  'mods|goldSpeedrun|pb|restore': 'Wiederherstellen',
  'mods|goldSpeedrun|pb|restored': 'Bestzeit auf {time} wiederhergestellt',
  'mods|goldSpeedrun|pb|historyHide': 'Verlauf schließen',
  'mods|goldSpeedrun|pb|sourceInGame': 'Lauf im Spiel',
  'mods|goldSpeedrun|pb|sourcePromote': 'Ersetzt durch Route: {name}',
  'mods|goldSpeedrun|pb|sourceImport': 'Ersetzt durch CSV-Import',
  'mods|goldSpeedrun|pb|sourceClear': 'Gelöscht',
  'mods|goldSpeedrun|pb|sourceRestore': 'Ersetzt durch Wiederherstellung',
  'mods|goldSpeedrun|pb|sourceEdit': 'Von Hand bearbeitet',

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

const parseStoredJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  if (typeof v === 'string' && (v.charAt(0) === '{' || v.charAt(0) === '[')) {
    try { return JSON.parse(v); } catch (e) { /* DE: kein JSON / EN: not JSON */ }
  }
  return fallback;
};

const readCustomCategories = () => {
  const list = parseStoredJson(api.storage.local.get(CATEGORIES_KEY), []);
  return Array.isArray(list) ? list.filter(c => c && typeof c === 'object' && typeof c.id === 'string') : [];
};

const writeCustomCategories = list => {
  try { api.storage.local.set(CATEGORIES_KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch (e) { /* ignore */ }
};

const getActiveCategoryId = () => {
  const v = api.storage.local.get(ACTIVE_CATEGORY_KEY);
  return typeof v === 'string' && v.length > 0 ? v : null;
};

const setActiveCategoryId = id => {
  try { api.storage.local.set(ACTIVE_CATEGORY_KEY, id || null); } catch (e) { /* ignore */ }
};

const newCustomId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);

const presetCategoryFromId = id => {
  const def = CATEGORIES[id] || CATEGORIES['100000'];
  const resolved = CATEGORIES[id] ? id : '100000';
  if (def.kind === 'gold') {
    let target = def.target;
    if (!Number.isFinite(target)) {
      const v = api.settings.get('goalGold');
      target = Number.isFinite(v) && v > 0 ? v : 100000;
    }
    return { id: resolved, kind: 'gold', target, custom: false };
  }
  if (def.kind === 'artifacts') return { id: resolved, kind: 'artifacts', target: artifactTotal(), custom: false };
  return { id: resolved, kind: 'factory', target: def.target, custom: false };
};

const GOAL_KINDS = ['gold', 'artifacts', 'factory', 'fluxite', 'energy', 'aura'];

const normalizeStoredGoal = raw => {
  if (!raw || typeof raw !== 'object') return null;
  const kind = GOAL_KINDS.indexOf(raw.kind) >= 0 ? raw.kind : null;
  if (!kind) return null;
  let target = Number(raw.target);
  if (kind === 'artifacts') target = target > 0 ? Math.floor(target) : 0;
  else if (kind === 'factory') target = target > 0 ? Math.min(MAX_FACTORY_LEVEL, Math.floor(target)) : 6;
  else if (kind === 'aura') target = target > 0 ? Math.floor(target) : 10000;
  else if (kind === 'fluxite' || kind === 'energy') target = target > 0 ? Math.floor(target) : 1000;
  else target = target > 0 ? Math.floor(target) : 100000;
  return { kind, target };
};

const categoryFromCustom = custom => {
  const name = typeof custom.name === 'string' && custom.name.trim() ? custom.name.trim() : custom.id;
  if (custom.kind === 'combined' && Array.isArray(custom.goals)) {
    const goals = custom.goals.map(normalizeStoredGoal).filter(Boolean);
    return { id: custom.id, kind: 'combined', goals, target: 0, name, custom: true };
  }
  const kind = GOAL_KINDS.indexOf(custom.kind) >= 0 ? custom.kind : 'gold';
  const goal = normalizeStoredGoal({ kind, target: custom.target });
  return {
    id: custom.id,
    kind,
    target: goal ? goal.target : 100000,
    name,
    custom: true,
  };
};

const category = () => {
  const activeId = getActiveCategoryId();
  if (activeId && !CATEGORIES[activeId]) {
    const custom = readCustomCategories().find(c => c.id === activeId);
    if (custom) return categoryFromCustom(custom);
  }
  const presetId = (activeId && CATEGORIES[activeId])
    ? activeId
    : (api.settings.get('goalPreset') || '100000');
  return presetCategoryFromId(presetId);
};

let lastSeenPreset = null;
const syncActiveFromPresetSetting = () => {
  const preset = api.settings.get('goalPreset') || '100000';
  if (lastSeenPreset === null) {
    lastSeenPreset = preset;
    if (!getActiveCategoryId()) setActiveCategoryId(preset);
    return;
  }
  if (preset !== lastSeenPreset) {
    lastSeenPreset = preset;
    setActiveCategoryId(preset);
  }
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

const goldMode = () => (api.settings.get('goldMode') === 'earned' ? 'earned' : 'balance');

const skipTutorialEnabled = () => api.settings.get('skipTutorial') === true;
const skipStoryEnabled = () => api.settings.get('skipStory') === true;
const skipIntroEnabled = () => api.settings.get('skipIntro') === true;

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

// DE: Einmalige Umstellung auf die gültigen Speedrun-Vorgaben: Hard Mode und
// DE: alle drei Skips aus. Bestehende Installationen dürfen nicht still auf
// DE: ungültigen Defaults weiterlaufen.
// EN: One-time switch to the valid speedrun defaults: Hard Mode and all three
// EN: skips off. Existing installs must not keep silently running on invalid defaults.
const enforceValidDefaults = () => {
  try {
    if (api.storage.local.get(ENFORCE_VALID_DEFAULTS_KEY) === true) return false;
  } catch (e) {
    return false;
  }
  if (!settingsBag()) return false;

  let changed = false;
  if (api.settings.get('goldMode') !== 'balance' && writeSetting('goldMode', 'balance')) changed = true;
  if (api.settings.get('skipIntro') !== false && writeSetting('skipIntro', false)) changed = true;
  if (api.settings.get('skipStory') !== false && writeSetting('skipStory', false)) changed = true;
  if (api.settings.get('skipTutorial') !== false && writeSetting('skipTutorial', false)) changed = true;

  try { api.storage.local.set('goldSpeedrun.beforeOfficial', null); } catch (e) { /* ignore */ }
  try { api.storage.local.set(GOLD_MODE_HARD_MIGRATE_KEY, null); } catch (e) { /* ignore */ }
  try { api.storage.local.set(ENFORCE_VALID_DEFAULTS_KEY, true); } catch (e) { /* ignore */ }

  log('Einstellungen auf gültige Speedrun-Vorgaben gesetzt (Hard Mode, keine Skips)');
  try { api.ui.toast({ key: 'mods|goldSpeedrun|toast|defaultsReset' }); } catch (e) { /* ignore */ }
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

const getFluxite = () => {
  try {
    const v = sandkit.state.store.resources.fluxite;
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
};

let fluxiteEarnedTotal = null;
let lastFluxiteBalance = null;

const readFluxiteEarned = () => {
  const v = api.storage.get(NS, 'fluxiteEarned');
  return Number.isFinite(v) ? v : 0;
};

const sampleFluxiteEarned = () => {
  const balance = getFluxite();
  if (fluxiteEarnedTotal === null) {
    fluxiteEarnedTotal = readFluxiteEarned();
    lastFluxiteBalance = balance;
    return fluxiteEarnedTotal;
  }
  if (balance > lastFluxiteBalance) fluxiteEarnedTotal += balance - lastFluxiteBalance;
  lastFluxiteBalance = balance;
  return fluxiteEarnedTotal;
};

const resetFluxiteEarned = () => {
  fluxiteEarnedTotal = 0;
  lastFluxiteBalance = getFluxite();
  api.storage.set(NS, 'fluxiteEarned', 0);
};

const getAura = () => {
  try {
    const sc = sandkit.engine && sandkit.engine.api && sandkit.engine.api.swarmConsole;
    if (sc && typeof sc.getCrystalMined === 'function') {
      const v = sc.getCrystalMined(sandkit.state);
      if (Number.isFinite(v)) return v;
    }
  } catch (e) { /* DE: Swarm-API fehlt / EN: swarm API missing */ }
  try {
    const sh = sandkit.engine && sandkit.engine.api && sandkit.engine.api.workers && sandkit.engine.api.workers.shared;
    if (sh && typeof sh.get === 'function') {
      const buf = sh.get(sandkit.state, 'swarmConsole.crystalMined');
      if (buf) return Atomics.load(buf, 0) || 0;
    }
  } catch (e) { /* DE: gemeinsamer Puffer fehlt / EN: shared buffer missing */ }
  return 0;
};

const categoryGoals = cat => {
  if (!cat) return [];
  if (cat.kind === 'combined' && Array.isArray(cat.goals)) return cat.goals.filter(Boolean);
  const goal = { kind: cat.kind || 'gold', target: cat.target };
  return [goal];
};

const goldGoalOf = cat => categoryGoals(cat).find(g => g && g.kind === 'gold') || null;

const goalTargetOf = goal => {
  if (!goal) return 0;
  if (goal.kind === 'artifacts') {
    const stored = Number(goal.target);
    if (stored > 0) return stored;
    return artifactTotal();
  }
  const t = Number(goal.target);
  return Number.isFinite(t) ? t : 0;
};

const fluxiteProgress = () => (goldMode() === 'earned' ? sampleFluxiteEarned() : getFluxite());

const getEnergy = () => {
  try {
    const v = sandkit.state.store.resources.energy;
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
};

let energyEarnedTotal = null;
let lastEnergyBalance = null;

const readEnergyEarned = () => {
  const v = api.storage.get(NS, 'energyEarned');
  return Number.isFinite(v) ? v : 0;
};

const sampleEnergyEarned = () => {
  const balance = getEnergy();
  if (energyEarnedTotal === null) {
    energyEarnedTotal = readEnergyEarned();
    lastEnergyBalance = balance;
    return energyEarnedTotal;
  }
  if (balance > lastEnergyBalance) energyEarnedTotal += balance - lastEnergyBalance;
  lastEnergyBalance = balance;
  return energyEarnedTotal;
};

const resetEnergyEarned = () => {
  energyEarnedTotal = 0;
  lastEnergyBalance = getEnergy();
  api.storage.set(NS, 'energyEarned', 0);
};

const energyProgress = () => (goldMode() === 'earned' ? sampleEnergyEarned() : getEnergy());

const progressOfGoal = goal => {
  if (!goal) return 0;
  if (goal.kind === 'gold') return goldProgress();
  if (goal.kind === 'fluxite') return fluxiteProgress();
  if (goal.kind === 'energy') return energyProgress();
  if (goal.kind === 'aura') return getAura();
  if (goal.kind === 'artifacts') return getArtifactsFound();
  return getFactoryLevel();
};

const goalMet = goal => {
  const target = goalTargetOf(goal);
  if (!(target > 0)) return false;
  return progressOfGoal(goal) >= target;
};

const allGoalsMet = cat => {
  const goals = categoryGoals(cat);
  return goals.length > 0 && goals.every(goalMet);
};

const goldAlreadyStocked = cat => {
  const gold = goldGoalOf(cat);
  if (!gold) return false;
  const target = goalTargetOf(gold);
  return target > 0 && getGold() >= target;
};

// DE: Der Wert, gegen den das Ziel der Kategorie geprueft wird.
// EN: The value the category's goal is checked against.
const progressOf = cat => {
  const goals = categoryGoals(cat);
  if (goals.length === 1) return progressOfGoal(goals[0]);
  if (cat.kind === 'gold') return goldProgress();
  if (cat.kind === 'artifacts') return getArtifactsFound();
  if (cat.kind === 'fluxite') return getFluxite();
  if (cat.kind === 'energy') return getEnergy();
  if (cat.kind === 'aura') return getAura();
  return getFactoryLevel();
};

let goldRateSamples = [];
let lastGoldRateSampleTime = 0;

const resetGoldRate = () => {
  goldRateSamples = [];
  lastGoldRateSampleTime = 0;
};

const sampleGoldRate = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') {
    resetGoldRate();
    return;
  }
  if (typeof run.finishedAt === 'number') return;
  const t = elapsed();
  if (t - lastGoldRateSampleTime < 250) return;
  lastGoldRateSampleTime = t;
  goldRateSamples.push({ t, g: goldProgress() });
  const cutoff = t - 60000;
  while (goldRateSamples.length > 2 && goldRateSamples[0].t < cutoff) goldRateSamples.shift();
};

// DE: null, solange noch kein echtes Intervall da ist. Vorzeichen bleibt:
// DE: Hard Mode darf negativ werden, Total Earned nicht, weil nur Zugewinne zaehlen.
// EN: null until a real interval exists. The sign is kept: Hard Mode may go
// EN: negative, Total Earned does not, because only gains are counted.
const goldPerSec = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return null;
  if (goldRateSamples.length < 2) return null;
  const oldest = goldRateSamples[0];
  const latest = goldRateSamples[goldRateSamples.length - 1];
  const dt = (latest.t - oldest.t) / 1000;
  if (!(dt >= 1)) return null;
  return (latest.g - oldest.g) / dt;
};

const formatGoldPerSec = () => {
  const v = goldPerSec();
  if (v === null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}${Math.abs(v).toFixed(1)} g/s`;
};

const goldPacingInfo = (best, playTime, waiting, done, cat) => {
  const g = goldGoalOf(cat);
  if (!g || best === null || best <= 0 || waiting || done) return null;
  const cur = progressOfGoal(g);
  const target = goalTargetOf(g);
  const remGold = target - cur;
  if (remGold <= 0) return null;
  const remSec = (best - playTime) / 1000;
  if (remSec <= 0) {
    return {
      text: t('mods|goldSpeedrun|metric|goldBehindPb'),
      color: COLORS.red,
    };
  }
  const reqRate = remGold / remSec;
  const rateFmt = reqRate >= 100 ? reqRate.toFixed(0) : reqRate.toFixed(1);
  const curRate = goldPerSec();
  let color = COLORS.dim;
  if (curRate !== null && Number.isFinite(curRate)) {
    if (curRate >= reqRate) color = COLORS.green;
    else if (curRate >= reqRate * 0.85) color = COLORS.gold;
    else color = COLORS.red;
  }
  return {
    reqRate,
    text: t('mods|goldSpeedrun|metric|goldReq', { rate: rateFmt }),
    color,
  };
};

const formatGoldPerSecWithReq = (best, playTime, waiting, done, cat) => {
  const currentStr = waiting ? '—' : formatGoldPerSec();
  const pacing = goldPacingInfo(best, playTime, waiting, done, cat);
  if (!pacing) return currentStr;
  return `${currentStr} ${pacing.text}`;
};

// DE: Kategoriename fuer HUD und Stream, z.B. "100k Gold % · Hard Mode · Ohne Tutorial".
// EN: Category name for the HUD and stream, e.g. "100k Gold % · Hard Mode · No Tutorial".
// --- DE: Blueprint-Kategorie / EN: Blueprint category -----------------------
// DE: Ein Lauf unter Standardregeln erlaubt keine externen oder gespeicherten
// DE: Blueprints. In-Game-Kopieren (Ctrl+C) von existierenden Strukturen im
// DE: aktuellen Lauf ist erlaubt. Sobald ein Blueprint importiert, geladen oder
// DE: aus einem anderen Spielstand eingefuegt wird, wechselt der Lauf in die
// DE: Blueprint-Kategorie.
//
// EN: A run under standard rules does not allow external or saved blueprints.
// EN: In-game copy (Ctrl+C) of existing structures in the current run is allowed.
// EN: Once a blueprint is imported, loaded, or pasted from another save,
// EN: the run transitions to the Blueprint category.
const runUsesBlueprints = () => {
  try {
    api.storage.ensure(NS);
    return api.storage.get(NS, 'blueprintsUsed') === true;
  } catch (e) {
    return false;
  }
};

const markBlueprintsUsed = reason => {
  if (runUsesBlueprints()) return;
  try {
    api.storage.ensure(NS);
    api.storage.set(NS, 'blueprintsUsed', true);
  } catch (e) { /* ignore */ }
  log(`Lauf auf Blueprint-Kategorie umgestellt (${reason})`);
  try {
    api.ui.toast({ key: 'mods|goldSpeedrun|toast|bpTriggered' });
  } catch (e) { /* ignore */ }
  notifyResult();
};

let currentRunToken = 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
let sessionCopyOk = false;

const resetRunProvenance = () => {
  currentRunToken = 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  sessionCopyOk = false;
  try {
    const cb = sandkit.engine && sandkit.engine.api && sandkit.engine.api.clipboard;
    if (cb && typeof cb.clear === 'function') {
      cb.clear();
    }
  } catch (e) { /* ignore */ }
};

const handleClipboardSet = (structures, signalLinks) => {
  try {
    const sceneOk = (typeof activeScene === 'function' && activeScene() === enums.Scene.Game);
    const armedOrRunning = (typeof isArmed === 'function' && isArmed()) || (typeof isRunning === 'function' && isRunning());
    if (sceneOk && armedOrRunning) {
      sessionCopyOk = true;
    }
  } catch (e) { /* ignore */ }
};

const goalPartLabel = goal => {
  const target = goalTargetOf(goal);
  if (goal.kind === 'gold') return `${shortGold(target)} Gold %`;
  if (goal.kind === 'fluxite') return `${shortGold(target)} Fluxite`;
  if (goal.kind === 'energy') return `${shortGold(target)} Energy`;
  if (goal.kind === 'aura') return `${shortGold(target)} Aura`;
  if (goal.kind === 'artifacts') return t('mods|goldSpeedrun|cfg|preset|artifacts');
  return t(target >= MAX_FACTORY_LEVEL
    ? 'mods|goldSpeedrun|cfg|preset|factory7'
    : 'mods|goldSpeedrun|cfg|preset|factory6');
};

const categoryLabel = () => {
  const cat = category();
  const parts = [];
  const goals = categoryGoals(cat);
  const summary = goals.map(goalPartLabel).join(' + ');

  if (cat.custom && cat.name) {
    parts.push(cat.name);
    if (cat.kind === 'combined' && cat.name !== summary) parts.push(summary);
  } else if (cat.kind === 'combined') {
    parts.push(summary);
  } else if (cat.kind === 'gold') {
    parts.push(`${shortGold(cat.target)} Gold %`);
  } else if (cat.kind === 'fluxite') {
    parts.push(`${shortGold(cat.target)} Fluxite`);
  } else if (cat.kind === 'energy') {
    parts.push(`${shortGold(cat.target)} Energy`);
  } else if (cat.kind === 'aura') {
    parts.push(`${shortGold(cat.target)} Aura`);
  } else if (cat.kind === 'artifacts') {
    parts.push(t('mods|goldSpeedrun|cfg|preset|artifacts'));
  } else {
    parts.push(t(cat.target >= MAX_FACTORY_LEVEL
      ? 'mods|goldSpeedrun|cfg|preset|factory7'
      : 'mods|goldSpeedrun|cfg|preset|factory6'));
  }

  const countsBalance = goals.some(g => g && (g.kind === 'gold' || g.kind === 'fluxite' || g.kind === 'energy'));
  if (countsBalance) {
    parts.push(t(goldMode() === 'balance'
      ? 'mods|goldSpeedrun|modeHard'
      : 'mods|goldSpeedrun|modeNormal'));
  }

  if (skipTutorialEnabled()) {
    parts.push(t('mods|goldSpeedrun|noTutorial'));
  }
  if (runUsesBlueprints()) {
    parts.push(t('mods|goldSpeedrun|category|blueprints'));
  }
  return parts.join(' · ');
};

// DE: Schluessel der Bestzeit: pro Kategorie und Regelwerk getrennt, sonst
// DE: stehen 1M-Zeiten neben 100k-Zeiten.
// DE: Die Bestzeit ist die Spielzeit-Uhr (W) - die offizielle Community-Wertung.
// EN: Best-time key: kept separate per category and ruleset, otherwise 1M
// EN: times would sit next to 100k times.
// EN: The best time is the play-clock (W) - the official community metric.
const goldModeFor = () => goldMode();

const bestKeyFor = (cat, mode, bpOverride) => {
  const c = cat || category();
  const countsBalance = categoryGoals(c).some(g => g && (g.kind === 'gold' || g.kind === 'fluxite' || g.kind === 'energy'));
  const gm = countsBalance ? (mode || goldMode()) : 'x';
  const useBp = bpOverride !== undefined ? bpOverride : runUsesBlueprints();
  const bp = useBp ? '.bp' : '';
  if (c.custom) return `${BEST_PREFIX}.custom.${c.id}.${gm}${bp}`;
  const bits = [c.id, gm];
  if (c.id === 'custom') bits.push(String(c.target));
  return `${BEST_PREFIX}.${bits.join('.')}${bp}`;
};

const bestKey = () => bestKeyFor(category());

const acceptBest = v => (Number.isFinite(v) && v >= MIN_PB_MS) ? v : null;

const clearStoredBest = key => {
  try { api.storage.local.set(key, null); } catch (e) { /* ignore */ }
};

const readBestAt = key => {
  const v = api.storage.local.get(key);
  if (Number.isFinite(v) && v > 0 && v < MIN_PB_MS) clearStoredBest(key);
  return acceptBest(v);
};

const readBest = () => {
  const key = bestKey();
  const fromLocal = readBestAt(key);
  if (fromLocal !== null) return fromLocal;
  const fromSave = api.storage.get(NS, 'pbTime');
  if (Number.isFinite(fromSave) && fromSave > 0 && fromSave < MIN_PB_MS) {
    api.storage.set(NS, 'pbTime', null);
  }
  if (acceptBest(fromSave)) return fromSave;
  const cat = category();
  if (cat.id === '100000' && goldMode() === 'earned' && !skipTutorialEnabled()) {
    const legacy = api.storage.local.get(LEGACY_BEST_KEY);
    if (Number.isFinite(legacy) && legacy > 0 && legacy < MIN_PB_MS) clearStoredBest(LEGACY_BEST_KEY);
    if (acceptBest(legacy)) return legacy;
  }
  return null;
};

const globalBestsKey = () => bestKey() + '.global';

const readGlobalBests = () => {
  let v = api.storage.local.get(globalBestsKey());
  if (typeof v === 'string' && v.startsWith('{')) {
    try { v = JSON.parse(v); } catch (e) { v = null; }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : { seq: {}, abs: {} };
};

const writeGlobalBests = (bests) => {
  if (!bests || typeof bests !== 'object') return;
  try { api.storage.local.set(globalBestsKey(), JSON.stringify(bests)); } catch (e) { /* ignore */ }
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

const writeBestTimeAt = (key, time) => {
  if (!(time >= MIN_PB_MS) || !key) return false;
  try { api.storage.local.set(key, time); } catch (e) { /* DE: kein localStorage / EN: no localStorage */ }
  if (key === bestKey()) api.storage.set(NS, 'pbTime', time);
  return true;
};

const writeBestSplitsAt = (key, splits) => {
  if (!key || !Array.isArray(splits) || splits.length === 0) return;
  try { api.storage.local.set(key + '.splits', JSON.stringify(splits)); } catch (e) { /* DE: localStorage voll / EN: localStorage full */ }
  if (key === bestKey()) api.storage.set(NS, 'pbSplits', splits);
};

const writeBestTime = time => writeBestTimeAt(bestKey(), time);

const writeBestSplits = splits => writeBestSplitsAt(bestKey(), splits);

const readBestSplitsAt = key => parseSplitList(api.storage.local.get(key + '.splits'));

const PB_HISTORY_MAX = 5;

const pbHistoryKey = cat => bestKeyFor(cat) + '.history.v1';

const readPbHistory = cat => {
  const raw = parseStoredJson(api.storage.local.get(pbHistoryKey(cat)), []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(e => e && typeof e === 'object' && (Number.isFinite(e.time) || (Array.isArray(e.splits) && e.splits.length > 0)));
};

const writePbHistory = (cat, list) => {
  try {
    api.storage.local.set(pbHistoryKey(cat), JSON.stringify((list || []).slice(0, PB_HISTORY_MAX)));
  } catch (e) { /* ignore */ }
};

const pushPbHistory = (cat, previousTime, previousSplits, source, sourceName) => {
  const time = Number.isFinite(previousTime) ? previousTime : null;
  const splits = Array.isArray(previousSplits) ? previousSplits.slice() : [];
  if (time === null && splits.length === 0) return;
  const prev = readPbHistory(cat);
  if (prev[0] && prev[0].time === time && (prev[0].splits || []).length === splits.length) return;
  writePbHistory(cat, [{
    time,
    splits,
    timestamp: Date.now(),
    source: source || 'unknown',
    sourceName: sourceName || '',
  }].concat(prev));
};

const backupCurrentPb = (cat, source, sourceName) => {
  const key = bestKeyFor(cat);
  pushPbHistory(cat, readBestAt(key), readBestSplitsAt(key), source, sourceName);
};

const commitBestFor = (cat, time, splits, source, sourceName) => {
  backupCurrentPb(cat, source, sourceName);
  const key = bestKeyFor(cat);
  writeBestTimeAt(key, time);
  writeBestSplitsAt(key, splits);
};

const restorePbFromHistory = (cat, index) => {
  const list = readPbHistory(cat);
  const entry = list[index];
  if (!entry) return null;
  backupCurrentPb(cat, 'restore', '');
  const key = bestKeyFor(cat);
  if (Number.isFinite(entry.time) && entry.time >= MIN_PB_MS) writeBestTimeAt(key, entry.time);
  if (Array.isArray(entry.splits) && entry.splits.length > 0) writeBestSplitsAt(key, entry.splits);
  return entry;
};

const clearBest = (cat) => {
  backupCurrentPb(cat, 'clear', '');
  const key = bestKeyFor(cat);
  clearStoredBest(key);
  try { api.storage.local.set(key + '.splits', null); } catch (e) { /* ignore */ }
  try { api.storage.local.set(key + '.global', null); } catch (e) { /* ignore */ }
  if (!cat || cat.id === category().id) {
    api.storage.set(NS, 'pbTime', null);
    api.storage.set(NS, 'pbSplits', null);
  }
};

const readBestSplits = () => {
  const fromLocal = readBestSplitsAt(bestKey());
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
  const time = scoredTime();
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
  const time = scoredTime();
  if (!(time >= MIN_PB_MS)) return;
  const best = readBest();
  if (best === null || time < best) {
    commitBestFor(category(), time, readSplits(), 'in_game', '');
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

// DE: Pflicht-Splits (Rang, Gold-Marke, Ziel) sind streng geordnet und tragen
// DE: das LiveSplit-Gesamt-Delta. Der Rest (Forschung, Artefakt, Aufwertung)
// DE: bleibt zwischen zwei Pflicht-Marken sichtbar, auch wenn die Reihenfolge
// DE: wechselt, und faellt erst raus, wenn die naechste Pflicht-Marke faellt.
// EN: Mandatory splits (rank, gold mark, goal) are strictly ordered and carry
// EN: the LiveSplit-style total delta. The rest (research, artifact, upgrade)
// EN: stay visible between two mandatory marks even if their order changes,
// EN: and drop only when the next mandatory mark fires.
const MANDATORY_KINDS = new Set(['rank', 'gold', 'goal']);

const isMandatory = split => !!(split && MANDATORY_KINDS.has(split.kind));

const lastReachedMandatoryPbIndex = (done, pbSplits) => {
  if (!Array.isArray(done) || !Array.isArray(pbSplits) || pbSplits.length === 0) return -1;
  let last = -1;
  for (const s of done) {
    if (!isMandatory(s)) continue;
    const pb = findPbSplit(s, pbSplits);
    if (!pb) continue;
    const idx = pbSplits.indexOf(pb);
    if (idx > last) last = idx;
  }
  return last;
};

const newRouteId = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);

const routesKeyFor = key => (key || bestKey()) + '.routes.v1';

const emptyRoutes = () => ({ activeRouteId: null, routes: [] });

const readRoutesStore = key => {
  const raw = parseStoredJson(api.storage.local.get(routesKeyFor(key)), null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.routes)) return emptyRoutes();
  const hadFromPb = raw.routes.some(r => r && r.fromPb);
  const routes = raw.routes.filter(r => r && typeof r === 'object' && r.id && !r.fromPb);
  const active = typeof raw.activeRouteId === 'string' && routes.some(r => r.id === raw.activeRouteId)
    ? raw.activeRouteId
    : null;
  const store = { activeRouteId: active, routes };
  if (hadFromPb) writeRoutesStore(store, key);
  return store;
};

const writeRoutesStore = (store, key) => {
  if (!store || typeof store !== 'object') return;
  const routes = (store.routes || []).filter(r => r && r.id && !r.fromPb);
  const active = store.activeRouteId && routes.some(r => r.id === store.activeRouteId)
    ? store.activeRouteId
    : null;
  try { api.storage.local.set(routesKeyFor(key), JSON.stringify({ activeRouteId: active, routes })); } catch (e) { /* ignore */ }
};

const copyLocalIfEmpty = (fromKey, toKey) => {
  if (!fromKey || !toKey || fromKey === toKey) return;
  let dest;
  let src;
  try { dest = api.storage.local.get(toKey); } catch (e) { dest = null; }
  try { src = api.storage.local.get(fromKey); } catch (e) { src = null; }
  const destEmpty = dest == null || dest === '';
  const srcEmpty = src == null || src === '';
  if (!destEmpty || srcEmpty) return;
  try { api.storage.local.set(toKey, src); } catch (e) { /* ignore */ }
};

const migrateNotutAlias = stableKey => {
  const legacy = stableKey + '.notut';
  copyLocalIfEmpty(legacy, stableKey);
  copyLocalIfEmpty(legacy + '.splits', stableKey + '.splits');
  copyLocalIfEmpty(legacy + '.routes.v1', stableKey + '.routes.v1');
  copyLocalIfEmpty(legacy + '.history.v1', stableKey + '.history.v1');
  copyLocalIfEmpty(legacy + '.global', stableKey + '.global');
};

const migrateKeyStability = () => {
  try {
    if (api.storage.local.get(KEY_STABILITY_MIGRATE_KEY) === true) return;
  } catch (e) { return; }
  const cats = [];
  try {
    for (const id of Object.keys(CATEGORIES)) cats.push(presetCategoryFromId(id));
    for (const c of readCustomCategories()) cats.push(categoryFromCustom(c));
  } catch (e) { /* ignore */ }
  for (const cat of cats) {
    if (cat.kind === 'gold') {
      migrateNotutAlias(bestKeyFor(cat, 'earned'));
      migrateNotutAlias(bestKeyFor(cat, 'balance'));
    } else {
      migrateNotutAlias(bestKeyFor(cat));
    }
  }
  try { api.storage.local.set(KEY_STABILITY_MIGRATE_KEY, true); } catch (e) { /* ignore */ }
};

const purgeFromPbRoutes = () => {
  const cats = [];
  try {
    for (const id of Object.keys(CATEGORIES)) cats.push(presetCategoryFromId(id));
    for (const c of readCustomCategories()) cats.push(categoryFromCustom(c));
  } catch (e) { /* ignore */ }
  const keys = new Set();
  for (const cat of cats) {
    if (cat.kind === 'gold') {
      keys.add(bestKeyFor(cat, 'earned'));
      keys.add(bestKeyFor(cat, 'balance'));
    } else {
      keys.add(bestKeyFor(cat));
    }
  }
  for (const key of keys) {
    const raw = parseStoredJson(api.storage.local.get(routesKeyFor(key)), null);
    if (!raw || !Array.isArray(raw.routes) || !raw.routes.some(r => r && r.fromPb)) continue;
    writeRoutesStore(raw, key);
  }
};

const splitTriggerOn = split => {
  if (!split || split.kind === 'goal') return true;
  const id = String(split.id || '');
  if (split.kind === 'artifact') return triggerEnabled('artifact', 'any', splitOn('splitArtifact'));
  if (split.kind === 'upgrade') return triggerEnabled('upgrade', 'any', splitOn('splitUpgrade'));
  if (split.kind === 'gold') {
    const val = Number(id.replace(/^gold:/, ''));
    return triggerEnabled('gold', Number.isFinite(val) ? val : id, true);
  }
  if (split.kind === 'rank') {
    const val = Number(id.replace(/^rank:/, ''));
    return triggerEnabled('rank', Number.isFinite(val) ? val : id, splitOn('splitRank'));
  }
  if (split.kind === 'tech') {
    return triggerEnabled('tech', id.replace(/^tech:/, '') || split.label, splitOn('splitTech'));
  }
  return true;
};

const readComparisonSplits = () => {
  const store = readRoutesStore();
  const activeRoute = store.routes.find(r => r.id === store.activeRouteId);
  const list = (activeRoute && Array.isArray(activeRoute.splits) && activeRoute.splits.length > 0)
    ? activeRoute.splits
    : readBestSplits();
  return Array.isArray(list) ? list : [];
};

// DE: Ergebnis und PNG vergleichen einen neuen Rekord mit der vorherigen Bestzeit.
// DE: Die Live-Anzeige waehrend des Laufs bleibt bei der stehenden Bestzeit.
// EN: The result screen and PNG compare a new record with the previous best.
// EN: The live HUD during a run keeps using the standing best.
const readResultComparison = () => {
  const store = readRoutesStore();
  const activeRoute = store.routes.find(r => r.id === store.activeRouteId);
  const hasRoute = !!(activeRoute && Array.isArray(activeRoute.splits) && activeRoute.splits.length > 0);
  const standing = readBest();
  const run = readRun();
  const finished = typeof run.finishedAt === 'number';
  let scored = null;
  if (finished) {
    try { scored = scoredTime(); } catch (e) { scored = null; }
  }
  const isStoredPb = finished && standing !== null && Number.isFinite(scored) && Math.abs(scored - standing) <= 50;
  if (!isStoredPb) {
    return {
      time: standing,
      splits: hasRoute ? activeRoute.splits : readBestSplits(),
    };
  }
  const prev = readPbHistory(category())[0];
  const prevTime = prev && Number.isFinite(prev.time) ? prev.time : null;
  const prevSplits = prev && Array.isArray(prev.splits) ? prev.splits : [];
  return {
    time: prevTime,
    splits: hasRoute ? activeRoute.splits : prevSplits,
  };
};

// --- DE: Zeitformat / EN: Time format ---------------------------------------
// DE: Spielzeit-Uhr in ms; laeuft nur waehrend das Spiel laeuft und wandert mit
// DE: ins Savegame. Das ist dieselbe Zahl, die auch ohne diesen Mod als playTime
// DE: im Spielstand steht - api.time.getTimeMs() liest direkt store.meta.time.
// EN: Play-clock in ms; only runs while the game is running and travels with
// EN: the save. This is the same number that shows up as playTime in the save
// EN: file even without this mod - api.time.getTimeMs() reads store.meta.time directly.
const now = () => api.time.getTimeMs() || 0;

const getMapSeed = () => {
  try {
    const seed = sandkit.state.store.meta.seed;
    if (typeof seed === 'number' || typeof seed === 'string') return seed;
  } catch (e) { /* ignore */ }
  return 0;
};

// DE: Welche der drei Uhren gross im Bild steht. Die Wertung ist die
// DE: Spielzeit-Uhr (W); alle drei werden immer gemessen und festgehalten.
// EN: Which of the three clocks stands large on screen. Scoring is the
// EN: play-clock (W); all three are always measured and recorded.
const clockMode = () => {
  const v = api.settings.get('clockMode');
  return v === 'sim' || v === 'play' ? v : 'real';
};

const hudLayout = () => api.settings.get('hudLayout') === 'vertical' ? 'vertical' : 'horizontal';

const streamerModeOn = () => api.settings.get('streamerMode') === true;

const STREAMER_SCALES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SECONDARY_SCALES = ['S', 'M', 'L'];

const streamerScaleIndex = () => {
  const v = String(api.settings.get('streamerFontScale') || 'M').toUpperCase();
  const i = STREAMER_SCALES.indexOf(v);
  return i >= 0 ? i : 1;
};

const secondaryScaleIndex = () => {
  const v = String(api.settings.get('secondaryFontScale') || 'S').toUpperCase();
  const i = SECONDARY_SCALES.indexOf(v);
  return i >= 0 ? i : 0;
};

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

const formatWallClock = ts => {
  if (!Number.isFinite(ts) || ts <= 0) return '—';
  try { return new Date(ts).toLocaleString(); } catch (e) { return '—'; }
};

const readWallBounds = () => {
  api.storage.ensure(NS);
  const startedAtWall = api.storage.get(NS, 'startedAtWall');
  const finishedAtWall = api.storage.get(NS, 'finishedAtWall');
  return {
    startedAtWall: Number.isFinite(startedAtWall) ? startedAtWall : null,
    finishedAtWall: Number.isFinite(finishedAtWall) ? finishedAtWall : null,
  };
};

const wallClockSummary = () => {
  const { startedAtWall, finishedAtWall } = readWallBounds();
  const end = finishedAtWall || Date.now();
  const span = startedAtWall ? Math.max(0, end - startedAtWall) : null;
  return { startedAtWall, finishedAtWall, end, span };
};

const gameVersionLabel = () => {
  const candidates = [];
  try { candidates.push(sandkit && sandkit.version); } catch (e) {}
  try { candidates.push(sandkit && sandkit.engine && sandkit.engine.version); } catch (e) {}
  try { candidates.push(sandkit && sandkit.state && sandkit.state.store && sandkit.state.store.meta && sandkit.state.store.meta.gameVersion); } catch (e) {}
  try { candidates.push(sandkit && sandkit.state && sandkit.state.store && sandkit.state.store.meta && sandkit.state.store.meta.version); } catch (e) {}
  try { candidates.push(api && (api.gameVersion || api.version)); } catch (e) {}
  try { if (typeof window !== 'undefined') candidates.push(window.__SANDKIT_VERSION__ || window.GAME_VERSION); } catch (e) {}
  try {
    if (typeof document !== 'undefined' && document.title) {
      const m = document.title.match(/v?(\d+\.\d+(?:\.\d+)?[\w.-]*)/i);
      if (m) candidates.push(m[1]);
    }
  } catch (e) {}
  for (let i = 0; i < candidates.length; i++) {
    const v = candidates[i];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
};

const exportVersionLine = () => {
  const game = gameVersionLabel();
  return game
    ? `Sandustry v${game} · Speedrun Mod v${MOD_VERSION}`
    : `Sandustry Gold Speedrun Challenge v${MOD_VERSION}`;
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
  if (typeof run.startedAt !== 'number') {
    if (run.finishedAt !== null) {
      api.storage.set(NS, 'finishedAt', null);
    }
    resetRunProvenance();
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
// R  Pausenbewusste Echtzeit aus performance.now(), ohne Deckel, akkumuliert
//    nur waehrend der Lauf tatsaechlich unterwegs ist (Spiel laeuft, nicht
//    pausiert). Das ist keine Wanduhr: Pausieren haelt R mit an. Sie bleibt
//    die Video-Referenz fuer die unpausierten Abschnitte, und R haengt nie
//    an der Fabrik - sie ist eine reine Betriebssystem-Uhr. Was die Fabrik
//    kostet, zeigt sich als Abstand zwischen R und T, nicht an R selbst.
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
// R  Pause-aware real time from performance.now(), uncapped, only accumulated
//    while the run is actually under way (game running, not paused). This
//    is not wall-clock time: pausing the game pauses R too. It stays the
//    video reference for unpaused segments, and it never depends on the
//    factory - it is a pure operating-system clock. What the factory costs
//    shows up as the gap between R and T, not in R itself.
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

// DE: Gemeinsamer Speicher fuer Simulations-Metriken (16 Kanaele):
// DE: Index 0: tick (store.meta.tick - exakter Schrittzaehler)
// DE: Index 1: awakeChunks (aktive 40x40-Abschnitte)
// DE: Index 2: ballisticBlocks (Werfer-Kollisionen)
// DE: Index 3: ballisticMoves (Werfer-Bewegungen)
// DE: Index 4: liveElements (aktive Elemente)
// DE: Index 5: simTimeMs * 100 (Dauer des Simulationsschritts in ms)
//
// EN: Shared memory for simulation metrics (16 channels):
// EN: Index 0: tick (store.meta.tick - exact step counter)
// EN: Index 1: awakeChunks (active 40x40 chunks)
// EN: Index 2: ballisticBlocks (thrown particle collisions)
// EN: Index 3: ballisticMoves (thrown particle moves)
// EN: Index 4: liveElements (active elements)
// EN: Index 5: simTimeMs * 100 (sim step duration in ms)
// EN: Index 6: allMatterBlocks (all-matter collisions - diagnostic)
// EN: Index 7: allMatterMoves (all-matter moves - diagnostic)
// EN: Index 8: allMatterControl (0 = off, 1 = on - written by main thread)
// EN: Index 9: allMatterActive (0 = inactive, 1 = active - confirmed by worker)
// EN: Index 10: metricControlMask (individually switchable benchmark measurements)
// EN: Index 11: metricActiveMask (confirmed by worker 0)
// EN: Index 12: metricControlGeneration (main-thread transition number)
// EN: Index 13: metricAckCount (workers that applied the current generation)
// EN: Index 14: allMatterBlocksSettled (direction=down against terrain/element)
// EN: Index 15: allMatterBlocksActive (all other all-matter blocks)
// EN: goldSpeedrunPhaseV1 (float32): compute/wait/post + phase work/spin + slowest chunk
// EN: goldSpeedrunHeatmapV3 (int32): 16-int header + 128x128 live bottleneck ms + 128x128 sum ms + 128x128 peak ms
// EN: header 8 = resetControl, 9 = restoreControl, 10 = restoreAck
const METRICS_BUF_KEY = 'goldSpeedrunMetricsV4';
const METRICS_BUF_SPEC = { type: 'int32', length: 16 };
const PHASE_BUF_KEY = 'goldSpeedrunPhaseV1';
const PHASE_BUF_SPEC = { type: 'float32', length: 16 };
const HEATMAP_MAX = 128;
const HEATMAP_HEADER = 16;
const HEATMAP_CELLS = HEATMAP_MAX * HEATMAP_MAX;
const HEATMAP_BUF_KEY = 'goldSpeedrunHeatmapV3';
const HEATMAP_BUF_SPEC = { type: 'int32', length: HEATMAP_HEADER + 3 * HEATMAP_CELLS };
const HEATMAP_LIVE_OFF = HEATMAP_HEADER;
const HEATMAP_SUM_OFF = HEATMAP_HEADER + HEATMAP_CELLS;
const HEATMAP_PEAK_OFF = HEATMAP_HEADER + 2 * HEATMAP_CELLS;
const CHUNK_SIZE = 40;
const METRIC_BALLISTIC_BLOCKS = 1 << 0;
const METRIC_BALLISTIC_MOVES = 1 << 1;
const METRIC_ALL_BLOCKS = 1 << 2;
const METRIC_ALL_MOVES = 1 << 3;
const METRIC_AWAKE = 1 << 4;
const METRIC_LIVE = 1 << 5;
const METRIC_SIM_TIME = 1 << 6;
const METRIC_PASSIVE = METRIC_AWAKE | METRIC_LIVE | METRIC_SIM_TIME;
const METRIC_BALLISTIC = METRIC_BALLISTIC_BLOCKS | METRIC_BALLISTIC_MOVES;
const METRIC_ALL_MATTER = METRIC_ALL_BLOCKS | METRIC_ALL_MOVES;
const METRIC_NORMAL = METRIC_BALLISTIC | METRIC_PASSIVE;
const METRIC_COMPLETE = METRIC_NORMAL | METRIC_ALL_MATTER;

let tickBuf = null;
try {
  tickBuf = api.shared.buffers.create(METRICS_BUF_KEY, METRICS_BUF_SPEC);
} catch (e) {
  tickBuf = null;
  log('Metrik-Speicher nicht verfuegbar -', (e && e.message) || e);
}

let phaseBuf = null;
try {
  phaseBuf = api.shared.buffers.create(PHASE_BUF_KEY, PHASE_BUF_SPEC);
} catch (e) {
  try { phaseBuf = api.shared.buffers.get(PHASE_BUF_KEY); } catch (e2) { phaseBuf = null; }
  if (!phaseBuf) log('Phasen-Speicher nicht verfuegbar -', (e && e.message) || e);
}

let heatmapBuf = null;
try {
  heatmapBuf = api.shared.buffers.create(HEATMAP_BUF_KEY, HEATMAP_BUF_SPEC);
} catch (e) {
  try { heatmapBuf = api.shared.buffers.get(HEATMAP_BUF_KEY); } catch (e2) { heatmapBuf = null; }
  if (!heatmapBuf) log('Heatmap-Speicher nicht verfuegbar -', (e && e.message) || e);
}
try {
  if (tickBuf) setMetricCaptureMask(METRIC_NORMAL);
} catch (e) {}
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

const rawAwakeChunks = () => {
  try {
    return (tickBuf && Atomics.load(tickBuf, 1)) || 0;
  } catch (e) {
    return 0;
  }
};

let totalBallisticBlocks = 0;
let totalBallisticMoves = 0;
let totalAllBlocks = 0;
let totalAllMoves = 0;
let totalAllBlocksSettled = 0;
let totalAllBlocksActive = 0;
let lastRawBlocks = 0;
let lastRawMoves = 0;
let lastRawAllBlocks = 0;
let lastRawAllMoves = 0;
let lastRawAllBlocksSettled = 0;
let lastRawAllBlocksActive = 0;
let rawSyncInitialized = false;

const syncEventCounters = () => {
  if (!tickBuf) return;
  try {
    const rb = Atomics.load(tickBuf, 2);
    const rm = Atomics.load(tickBuf, 3);
    const rab = Atomics.load(tickBuf, 6);
    const ram = Atomics.load(tickBuf, 7);
    const ras = Atomics.load(tickBuf, 14);
    const raa = Atomics.load(tickBuf, 15);
    if (!rawSyncInitialized) {
      lastRawBlocks = rb;
      lastRawMoves = rm;
      lastRawAllBlocks = rab;
      lastRawAllMoves = ram;
      lastRawAllBlocksSettled = ras;
      lastRawAllBlocksActive = raa;
      totalBallisticBlocks = rb >>> 0;
      totalBallisticMoves = rm >>> 0;
      totalAllBlocks = rab >>> 0;
      totalAllMoves = ram >>> 0;
      totalAllBlocksSettled = ras >>> 0;
      totalAllBlocksActive = raa >>> 0;
      rawSyncInitialized = true;
      return;
    }
    totalBallisticBlocks += ((rb - lastRawBlocks) >>> 0);
    totalBallisticMoves += ((rm - lastRawMoves) >>> 0);
    totalAllBlocks += ((rab - lastRawAllBlocks) >>> 0);
    totalAllMoves += ((ram - lastRawAllMoves) >>> 0);
    totalAllBlocksSettled += ((ras - lastRawAllBlocksSettled) >>> 0);
    totalAllBlocksActive += ((raa - lastRawAllBlocksActive) >>> 0);
    lastRawBlocks = rb;
    lastRawMoves = rm;
    lastRawAllBlocks = rab;
    lastRawAllMoves = ram;
    lastRawAllBlocksSettled = ras;
    lastRawAllBlocksActive = raa;
  } catch (e) {}
};

const rawBallisticBlocks = () => {
  syncEventCounters();
  return totalBallisticBlocks;
};

const rawBallisticMoves = () => {
  syncEventCounters();
  return totalBallisticMoves;
};

const rawLiveElements = () => {
  try {
    return (tickBuf && Atomics.load(tickBuf, 4)) || 0;
  } catch (e) {
    return 0;
  }
};

const rawSimTimeMs = () => {
  try {
    const v = tickBuf && Atomics.load(tickBuf, 5);
    return v ? Math.round(v) / 100 : 0;
  } catch (e) {
    return 0;
  }
};

const rawAllMatterBlocks = () => {
  syncEventCounters();
  return totalAllBlocks;
};

const rawAllMatterMoves = () => {
  syncEventCounters();
  return totalAllMoves;
};

const rawAllMatterBlocksSettled = () => {
  syncEventCounters();
  return totalAllBlocksSettled;
};

const rawAllMatterBlocksActive = () => {
  syncEventCounters();
  return totalAllBlocksActive;
};

const roundMs2 = v => Math.round((Number(v) || 0) * 100) / 100;

const readPhaseSnapshot = () => {
  try {
    const flag = sandkit.state.shared && sandkit.state.shared.workerDetailEnabled;
    if (flag && flag[0] !== 1) flag[0] = 1;
  } catch (e) {}
  if (!phaseBuf) return null;
  try {
    const tick = phaseBuf[0];
    if (!Number.isFinite(tick) || tick <= 0) return null;
    return {
      tick,
      computeMs: roundMs2(phaseBuf[1]),
      waitMs: roundMs2(phaseBuf[2]),
      postMs: roundMs2(phaseBuf[3]),
      phaseWork: [roundMs2(phaseBuf[4]), roundMs2(phaseBuf[5]), roundMs2(phaseBuf[6]), roundMs2(phaseBuf[7])],
      phaseSpin: [roundMs2(phaseBuf[8]), roundMs2(phaseBuf[9]), roundMs2(phaseBuf[10]), roundMs2(phaseBuf[11])],
      slowestMs: roundMs2(phaseBuf[12]),
      slowestX: Number.isFinite(phaseBuf[13]) ? phaseBuf[13] : -1,
      slowestY: Number.isFinite(phaseBuf[14]) ? phaseBuf[14] : -1,
      processedUnits: Number.isFinite(phaseBuf[15]) ? phaseBuf[15] : 0,
    };
  } catch (e) {
    return null;
  }
};

const worldCellSize = () => {
  try {
    const sz = sandkit.state.store.world.size;
    const width = sz && sz.width;
    const height = sz && sz.height;
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  } catch (e) {}
  return { width: 0, height: 0 };
};

let pendingHeatmapRestore = null;

const requestHeatmapReset = () => {
  pendingHeatmapRestore = null;
  try {
    if (heatmapBuf) Atomics.add(heatmapBuf, 8, 1);
    lastHistorySumGrid.fill(0);
    api.storage.set(NS, 'heatmapSnapshot', null);
  } catch (e) {}
};

const heatmapMeta = () => {
  if (!heatmapBuf) return null;
  try {
    const chunkWidth = heatmapBuf[1] | 0;
    const chunkHeight = heatmapBuf[2] | 0;
    const gridW = heatmapBuf[3] | 0;
    const gridH = heatmapBuf[4] | 0;
    if (gridW < 1 || gridH < 1 || gridW > HEATMAP_MAX || gridH > HEATMAP_MAX || chunkWidth <= 0 || chunkHeight <= 0) return null;
    return {
      tick: heatmapBuf[0] | 0,
      chunkWidth,
      chunkHeight,
      gridW,
      gridH,
      lastMs: (heatmapBuf[5] | 0) / 100,
      sumMaxMs: heatmapBuf[6] | 0,
      peakMaxMs: (heatmapBuf[7] | 0) / 100,
    };
  } catch (e) {
    return null;
  }
};

const heatmapLiveCopy = new Int32Array(HEATMAP_CELLS);
const heatmapSumCopy = new Int32Array(HEATMAP_CELLS);
const heatmapPeakCopy = new Int32Array(HEATMAP_CELLS);
const lastHistorySumGrid = new Int32Array(HEATMAP_CELLS);
const scratchScrubGrid = new Int32Array(HEATMAP_CELLS);
const scratchCumulGrid = new Int32Array(HEATMAP_CELLS);
const scratchHeatGrid = new Float32Array(HEATMAP_CELLS);

const getSparseHeatmapSnapshot = () => {
  if (!heatmapBuf) return null;
  const sums = [];
  const peaks = [];
  try {
    for (let i = 0; i < HEATMAP_CELLS; i++) {
      const s = heatmapBuf[HEATMAP_SUM_OFF + i] | 0;
      if (s > 0) sums.push([i, s]);
      const p = heatmapBuf[HEATMAP_PEAK_OFF + i] | 0;
      if (p > 0) peaks.push([i, p]);
    }
    return {
      sums,
      peaks,
      sumMax: heatmapBuf[6] | 0,
      peakMax: heatmapBuf[7] | 0,
      worldTimeMs: now(),
    };
  } catch (e) {
    return null;
  }
};

const heatmapSnapshotFromHistory = () => {
  const sumsMap = new Map();
  let sumMax = 0;
  for (let i = 0; i < historyBuf.length; i++) {
    const hits = historyBuf[i] && historyBuf[i].hits;
    if (!hits) continue;
    for (let j = 0; j < hits.length; j++) {
      const gi = hits[j][0] | 0;
      const delta = hits[j][1] | 0;
      if (gi < 0 || gi >= HEATMAP_CELLS || delta <= 0) continue;
      const next = (sumsMap.get(gi) || 0) + delta;
      sumsMap.set(gi, next);
      if (next > sumMax) sumMax = next;
    }
  }
  if (sumsMap.size === 0) return null;
  return {
    sums: Array.from(sumsMap.entries()),
    peaks: [],
    sumMax,
    peakMax: 0,
    worldTimeMs: now(),
  };
};

const heatmapSnapshotHasData = snap => Boolean(
  snap && (
    (Array.isArray(snap.sums) && snap.sums.length > 0) ||
    (Array.isArray(snap.peaks) && snap.peaks.length > 0)
  )
);

const applyHeatmapSnapshotToBuf = snap => {
  if (!heatmapBuf || !snap) return false;
  try {
    heatmapBuf.fill(0, HEATMAP_SUM_OFF, HEATMAP_SUM_OFF + HEATMAP_CELLS);
    heatmapBuf.fill(0, HEATMAP_PEAK_OFF, HEATMAP_PEAK_OFF + HEATMAP_CELLS);
    lastHistorySumGrid.fill(0);
    let sumMax = 0;
    let peakMax = 0;
    const sums = Array.isArray(snap.sums) ? snap.sums : [];
    for (let i = 0; i < sums.length; i++) {
      const gi = sums[i][0] | 0;
      const ms = sums[i][1] | 0;
      if (gi < 0 || gi >= HEATMAP_CELLS || ms <= 0) continue;
      heatmapBuf[HEATMAP_SUM_OFF + gi] = ms;
      lastHistorySumGrid[gi] = ms;
      if (ms > sumMax) sumMax = ms;
    }
    const peaks = Array.isArray(snap.peaks) ? snap.peaks : [];
    for (let i = 0; i < peaks.length; i++) {
      const gi = peaks[i][0] | 0;
      const ms100 = peaks[i][1] | 0;
      if (gi < 0 || gi >= HEATMAP_CELLS || ms100 <= 0) continue;
      heatmapBuf[HEATMAP_PEAK_OFF + gi] = ms100;
      if (ms100 > peakMax) peakMax = ms100;
    }
    heatmapBuf[6] = (snap.sumMax | 0) > 0 ? (snap.sumMax | 0) : sumMax;
    heatmapBuf[7] = (snap.peakMax | 0) > 0 ? (snap.peakMax | 0) : peakMax;
    return true;
  } catch (e) {
    return false;
  }
};

const retryHeatmapRestoreIfNeeded = () => {
  if (!pendingHeatmapRestore || !heatmapBuf) return;
  try {
    const req = Atomics.load(heatmapBuf, 9);
    const ack = Atomics.load(heatmapBuf, 10);
    const sumMax = heatmapBuf[6] | 0;
    const expected = pendingHeatmapRestore.sumMax | 0;
    if (ack === req && (expected <= 0 || sumMax >= expected)) {
      lastHistorySumGrid.set(heatmapBuf.subarray(HEATMAP_SUM_OFF, HEATMAP_SUM_OFF + HEATMAP_CELLS));
      pendingHeatmapRestore = null;
      return;
    }
    applyHeatmapSnapshotToBuf(pendingHeatmapRestore);
    if (ack === req) Atomics.add(heatmapBuf, 9, 1);
  } catch (e) {}
};

const restoreHeatmapFromSave = () => {
  let snap = null;
  try { snap = api.storage.get(NS, 'heatmapSnapshot'); } catch (e) { snap = null; }
  if (!heatmapSnapshotHasData(snap)) snap = heatmapSnapshotFromHistory();
  if (!heatmapSnapshotHasData(snap)) {
    requestHeatmapReset();
    return;
  }
  if (!applyHeatmapSnapshotToBuf(snap)) {
    requestHeatmapReset();
    return;
  }
  pendingHeatmapRestore = snap;
  try {
    if (heatmapBuf) Atomics.add(heatmapBuf, 9, 1);
  } catch (e) {}
};

const formatMsOrSec = ms => {
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms';
  if (ms >= 3600000) {
    const hrs = Math.floor(ms / 3600000);
    const remMins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${remMins}m`;
  }
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
};

const getHeatmapData = (mode, scrubRelMs, rangeType, maxRelMs, decayFloor = 0.06, decayHalfLife = 30000, linearWindow = 60000) => {
  const meta = heatmapMeta();
  if (!meta || !heatmapBuf) return null;

  if (mode === 'live') {
    heatmapLiveCopy.set(heatmapBuf.subarray(HEATMAP_LIVE_OFF, HEATMAP_LIVE_OFF + HEATMAP_CELLS));
    return { meta, cells: heatmapLiveCopy, maxVal: Math.max(1, Math.round(meta.lastMs * 100)), isMs100: true };
  }

  if (mode === 'peak' && scrubRelMs === null) {
    heatmapPeakCopy.set(heatmapBuf.subarray(HEATMAP_PEAK_OFF, HEATMAP_PEAK_OFF + HEATMAP_CELLS));
    return { meta, cells: heatmapPeakCopy, maxVal: Math.max(1, Math.round(meta.peakMaxMs * 100)), isMs100: true };
  }

  const targetEndMs = scrubRelMs !== null ? scrubRelMs : maxRelMs;

  if (mode === 'sum') {
    if (scrubRelMs === null) {
      heatmapSumCopy.set(heatmapBuf.subarray(HEATMAP_SUM_OFF, HEATMAP_SUM_OFF + HEATMAP_CELLS));
      return { meta, cells: heatmapSumCopy, maxVal: Math.max(1, meta.sumMaxMs), isMs100: false };
    }
    scratchScrubGrid.fill(0);
    let maxVal = 0;
    const len = historyBuf.length;
    for (let i = 0; i < len; i++) {
      const b = historyBuf[i];
      const rel = b.relMs || 0;
      if (rel > targetEndMs) break;
      const hits = b.hits;
      if (!hits) continue;
      for (let j = 0; j < hits.length; j++) {
        const [gi, delta] = hits[j];
        const next = scratchScrubGrid[gi] + delta;
        scratchScrubGrid[gi] = next;
        if (next > maxVal) maxVal = next;
      }
    }
    return { meta, cells: scratchScrubGrid, maxVal: Math.max(1, maxVal), isMs100: false };
  }

  // Decay modes: 'exp' or 'linear'
  scratchScrubGrid.fill(0);
  scratchHeatGrid.fill(0);
  if (scrubRelMs !== null) {
    scratchCumulGrid.fill(0);
  }

  const tHalf = Number.isFinite(decayHalfLife) && decayHalfLife > 0 ? decayHalfLife : 30000;
  const tWin = Number.isFinite(linearWindow) && linearWindow > 0 ? linearWindow : 60000;
  const maxLookback = mode === 'exp' ? (tHalf * 5) : tWin;
  const floorRatio = Number.isFinite(decayFloor) ? decayFloor : 0.06;

  let maxRecentHeat = 0;
  let maxCumul = (scrubRelMs === null && meta.sumMaxMs > 0) ? meta.sumMaxMs : 0;
  const len = historyBuf.length;

  for (let i = 0; i < len; i++) {
    const b = historyBuf[i];
    const rel = b.relMs || 0;
    if (rel > targetEndMs) break;
    const hits = b.hits;
    if (!hits) continue;

    if (scrubRelMs !== null) {
      for (let j = 0; j < hits.length; j++) {
        const [gi, delta] = hits[j];
        const nextC = scratchCumulGrid[gi] + delta;
        scratchCumulGrid[gi] = nextC;
        if (nextC > maxCumul) maxCumul = nextC;
      }
    }

    const ageMs = targetEndMs - rel;
    if (ageMs < 0 || ageMs > maxLookback) continue;
    const weight = mode === 'exp'
      ? Math.pow(0.5, ageMs / tHalf)
      : Math.max(0, 1 - (ageMs / tWin));
    if (weight <= 0) continue;

    for (let j = 0; j < hits.length; j++) {
      const [gi, delta] = hits[j];
      const nextH = scratchHeatGrid[gi] + delta * weight;
      scratchHeatGrid[gi] = nextH;
      if (nextH > maxRecentHeat) maxRecentHeat = nextH;
    }
  }

  const cumulSource = (scrubRelMs === null)
    ? heatmapBuf.subarray(HEATMAP_SUM_OFF, HEATMAP_SUM_OFF + HEATMAP_CELLS)
    : scratchCumulGrid;
  if (scrubRelMs === null && maxCumul === 0) {
    maxCumul = meta.sumMaxMs;
  }

  let maxDisplayVal = 0;
  if (maxRecentHeat > 0 && maxCumul > 0) {
    const floorBase = floorRatio * maxRecentHeat;
    for (let gi = 0; gi < HEATMAP_CELLS; gi++) {
      const h = scratchHeatGrid[gi];
      const c = cumulSource[gi] | 0;
      if (h <= 0 && c <= 0) continue;
      const floorVal = c > 0 ? (floorBase * (c / maxCumul)) : 0;
      const totalVal = Math.round((h + floorVal) * 100);
      scratchScrubGrid[gi] = totalVal;
      if (totalVal > maxDisplayVal) maxDisplayVal = totalVal;
    }
  } else if (maxCumul > 0) {
    for (let gi = 0; gi < HEATMAP_CELLS; gi++) {
      const c = cumulSource[gi] | 0;
      if (c <= 0) continue;
      const totalVal = Math.round(c * 0.05 * 100);
      scratchScrubGrid[gi] = totalVal;
      if (totalVal > maxDisplayVal) maxDisplayVal = totalVal;
    }
  }

  return {
    meta,
    cells: scratchScrubGrid,
    maxVal: Math.max(1, maxDisplayVal),
    isMs100: true,
    cumulSource,
    recentHeat: scratchHeatGrid,
    isDecay: true,
  };
};

const copyHeatmapGrid = kind => {
  const meta = heatmapMeta();
  if (!meta || !heatmapBuf) return null;
  try {
    let off = HEATMAP_LIVE_OFF;
    let dest = heatmapLiveCopy;
    if (kind === 'run' || kind === 'sum') {
      off = HEATMAP_SUM_OFF;
      dest = heatmapSumCopy;
    } else if (kind === 'peak') {
      off = HEATMAP_PEAK_OFF;
      dest = heatmapPeakCopy;
    }
    dest.set(heatmapBuf.subarray(off, off + HEATMAP_CELLS));
    return { meta, cells: dest };
  } catch (e) {
    return null;
  }
};

const emptyCauseFields = () => ({
  computeMs: 0,
  waitMs: 0,
  postMs: 0,
  slowestMs: 0,
  slowestX: -1,
  slowestY: -1,
});

const causeFieldsFromPhase = phase => {
  if (!phase) return emptyCauseFields();
  return {
    computeMs: phase.computeMs,
    waitMs: phase.waitMs,
    postMs: phase.postMs,
    slowestMs: phase.slowestMs,
    slowestX: phase.slowestX,
    slowestY: phase.slowestY,
  };
};

const causeTotal = s => (Number(s.computeMs) || 0) + (Number(s.waitMs) || 0) + (Number(s.postMs) || 0);

const mergeCausePreferHotter = (a, b) => {
  const aTot = causeTotal(a);
  const bTot = causeTotal(b);
  const hotter = bTot > aTot ? b : a;
  return {
    computeMs: Math.max(a.computeMs || 0, b.computeMs || 0),
    waitMs: Math.max(a.waitMs || 0, b.waitMs || 0),
    postMs: Math.max(a.postMs || 0, b.postMs || 0),
    slowestMs: Math.max(a.slowestMs || 0, b.slowestMs || 0),
    slowestX: hotter.slowestX,
    slowestY: hotter.slowestY,
  };
};

const aggregateCauseStats = samples => {
  if (!samples || !samples.length) return null;
  let sumC = 0;
  let sumW = 0;
  let sumP = 0;
  let n = 0;
  let best = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const c = Number(s.computeMs);
    const w = Number(s.waitMs);
    const p = Number(s.postMs);
    if (!Number.isFinite(c) && !Number.isFinite(w) && !Number.isFinite(p)) continue;
    const cc = Number.isFinite(c) ? c : 0;
    const ww = Number.isFinite(w) ? w : 0;
    const pp = Number.isFinite(p) ? p : 0;
    if (cc <= 0 && ww <= 0 && pp <= 0) continue;
    sumC += cc;
    sumW += ww;
    sumP += pp;
    n++;
    const tot = cc + ww + pp;
    if (!best || tot > best.total) {
      best = {
        total: tot,
        x: Number.isFinite(s.slowestX) ? s.slowestX : -1,
        y: Number.isFinite(s.slowestY) ? s.slowestY : -1,
        ms: Number(s.slowestMs) || 0,
      };
    }
  }
  if (!n) return null;
  const computeMs = sumC / n;
  const waitMs = sumW / n;
  const postMs = sumP / n;
  const total = computeMs + waitMs + postMs;
  return {
    computeMs,
    waitMs,
    postMs,
    total,
    computeShare: total > 0 ? computeMs / total : 0,
    waitShare: total > 0 ? waitMs / total : 0,
    postShare: total > 0 ? postMs / total : 0,
    bound: waitMs > computeMs ? 'wait' : 'compute',
    slowestX: best ? best.x : -1,
    slowestY: best ? best.y : -1,
    slowestMs: best ? best.ms : 0,
    samples: n,
  };
};

const setAllMatterCapture = enabled => {
  try {
    if (tickBuf) {
      Atomics.store(tickBuf, 8, enabled ? 1 : 0);
      setMetricCaptureMask(METRIC_NORMAL | (enabled ? METRIC_ALL_MATTER : 0));
    }
  } catch (e) {}
};

function setMetricCaptureMask(mask) {
  try {
    if (!tickBuf) return;
    const next = mask | 0;
    if (Atomics.load(tickBuf, 10) === next) return;
    Atomics.store(tickBuf, 10, next);
    Atomics.store(tickBuf, 13, 0);
    Atomics.add(tickBuf, 12, 1);
  } catch (e) {}
}

const activeMetricMask = () => {
  try {
    return tickBuf ? Atomics.load(tickBuf, 11) : 0;
  } catch (e) {
    return 0;
  }
};

const metricMaskSettled = mask => {
  try {
    return activeMetricMask() === mask
      && Boolean(tickBuf)
      && Atomics.load(tickBuf, 13) >= workerCount();
  } catch (e) {
    return false;
  }
};

const isAllMatterCaptureRequested = () => {
  try {
    return Boolean(tickBuf && Atomics.load(tickBuf, 8) === 1);
  } catch (e) {
    return false;
  }
};

const isAllMatterCaptureActive = () => {
  try {
    const mask = activeMetricMask();
    return Boolean((mask & METRIC_ALL_BLOCKS) && (mask & METRIC_ALL_MOVES));
  } catch (e) {
    return false;
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
let wasPaused = false;

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
  wasPaused = false;
  api.storage.set(NS, 'pauseCount', 0);
  api.storage.set(NS, 'reloadCount', 0);
  api.storage.set(NS, 'upsRms', 0);
  api.storage.set(NS, 'upsWElapsed', 0);
  api.storage.set(NS, 'upsUElapsed', 0);
  api.storage.set(NS, 'upsSlowdown', 0);
  api.storage.set(NS, 'upsDeficit', 0);
  api.storage.set(NS, 'upsBlocksStart', rawBallisticBlocks());
  api.storage.set(NS, 'upsMovesStart', rawBallisticMoves());
  api.storage.set(NS, 'upsBlocksFinal', 0);
  api.storage.set(NS, 'upsMovesFinal', 0);
  api.storage.set(NS, 'upsJamRateFinal', 0);
  api.storage.set(NS, 'upsJamShareFinal', 0);
  api.storage.set(NS, 'upsJamLoadFinal', 0);
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
  api.storage.set(NS, 'reloadCount', readClock('reloadCount') + 1);
  wasPaused = gamePaused();
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
    loadHistoryFromSave();
    restoreHeatmapFromSave();
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

  const paused = gamePaused();
  if (paused !== wasPaused) {
    if (paused) {
      api.storage.set(NS, 'pauseCount', readClock('pauseCount') + 1);
    }
    wasPaused = paused;
  }
  if (paused) return;

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

// DE: R - pausenbewusste Echtzeit des Laufs in ms. Wird weiter gemessen, Wertung ist W.
// EN: R - pause-aware real time of the run in ms. Still measured; scoring is W.
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

// DE: Offizielle Wertung: Spielzeit-Uhr (W). Alle drei Uhren werden weiter gemessen.
// EN: Official scoring: play-clock (W). All three clocks are still measured.
const scoredTime = () => {
  const w = elapsedPlay();
  if (w > 0) return w;
  const stored = readClock('upsWFinal') || readClock('upsWElapsed');
  return stored > 0 ? stored : 0;
};

const splitMs = split => {
  if (!split) return NaN;
  if (Number.isFinite(split.w)) return split.w;
  if (Number.isFinite(split.t)) return split.t;
  return NaN;
};

const viewedElapsed = () => elapsedPlay();

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

// DE: Neutrale Defizit-Zaehlung fuer die F7-Diagnose. Nur spanMs und ticks
// DE: der Eimer, vorzeichenbehaftet, ohne Rate und ohne Clamp. D_perm ist das
// DE: laufende Minimum von D ueber den naechsten Horizont H, damit Aufhol-
// DE: Wobble nicht als bleibender Verlust zaehlt.
// EN: Neutral deficit count for F7 diagnostics. Only bucket spanMs and ticks,
// EN: signed, no rate and no clamp. D_perm is the running floor of D over the
// EN: next horizon H, so catch-up wobble is not counted as kept loss.
const SLOWDOWN_HORIZON_MS = 2000;
const SLOWDOWN_EXIT_BUCKETS = 2;
const SLOWDOWN_RISE_EPS = 1;

const bucketSpanMsOf = b => {
  const s = Number(b && b.spanMs);
  return Number.isFinite(s) && s > 0 ? s : 1000;
};

const bucketTicksOf = b => {
  const ticks = Number(b && b.ticks);
  if (Number.isFinite(ticks) && ticks >= 0) return ticks;
  const ups = Number(b && (b.avg !== undefined ? b.avg : b.ups));
  if (Number.isFinite(ups)) return Math.max(0, ups * (bucketSpanMsOf(b) / 1000));
  return 0;
};

const bucketDeltaD = b => (bucketSpanMsOf(b) / 1000) * TICK_HZ - bucketTicksOf(b);

const emptyDeficitInfo = () => ({
  d: [],
  dPerm: [],
  phaseMask: [],
  phases: [],
  lastD: 0,
  lastDPerm: 0,
  unrecoveredTicks: 0,
  unrecoveredSec: 0,
  slowdownMs: 0,
});

const annotateDeficitSeries = (samples, horizonMs) => {
  const H = Number.isFinite(horizonMs) && horizonMs > 0 ? horizonMs : SLOWDOWN_HORIZON_MS;
  const n = samples && samples.length ? samples.length : 0;
  if (!n) return emptyDeficitInfo();

  const relAt = i => {
    const r = Number(samples[i] && samples[i].relMs);
    return Number.isFinite(r) ? r : i * bucketSpanMsOf(samples[i]);
  };

  const d = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += bucketDeltaD(samples[i]);
    d[i] = acc;
  }

  const dPerm = new Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const endRel = relAt(i) + H;
    if (k < i) k = i;
    while (k + 1 < n && relAt(k + 1) <= endRel) k++;
    let mn = d[i];
    for (let j = i + 1; j <= k; j++) {
      if (d[j] < mn) mn = d[j];
    }
    dPerm[i] = mn;
  }

  const phaseMask = new Array(n).fill(false);
  const phases = [];
  let inPhase = false;
  let healthy = 0;
  let start = 0;
  let startD = 0;
  let peakD = 0;

  for (let i = 1; i < n; i++) {
    const rise = dPerm[i] - dPerm[i - 1];
    const up = rise > SLOWDOWN_RISE_EPS;
    if (!inPhase) {
      if (up) {
        inPhase = true;
        healthy = 0;
        start = i;
        startD = dPerm[i - 1];
        peakD = dPerm[i];
        phaseMask[i] = true;
      }
    } else if (up) {
      healthy = 0;
      if (dPerm[i] > peakD) peakD = dPerm[i];
      phaseMask[i] = true;
    } else {
      healthy += 1;
      if (healthy < SLOWDOWN_EXIT_BUCKETS) {
        phaseMask[i] = true;
      } else {
        const end = i - healthy;
        const lost = peakD - startD;
        if (lost > SLOWDOWN_RISE_EPS && end >= start) {
          for (let j = start; j <= end; j++) phaseMask[j] = true;
          phases.push({
            startIdx: start,
            endIdx: end,
            startRelMs: relAt(start),
            endRelMs: relAt(end),
            lostTicks: lost,
          });
        } else {
          for (let j = start; j <= i; j++) phaseMask[j] = false;
        }
        inPhase = false;
        healthy = 0;
      }
    }
  }
  if (inPhase) {
    const end = n - 1;
    const lost = peakD - startD;
    if (lost > SLOWDOWN_RISE_EPS) {
      for (let j = start; j <= end; j++) phaseMask[j] = true;
      phases.push({
        startIdx: start,
        endIdx: end,
        startRelMs: relAt(start),
        endRelMs: relAt(end),
        lostTicks: lost,
      });
    } else {
      for (let j = start; j <= end; j++) phaseMask[j] = false;
    }
  }

  let unrecoveredTicks = 0;
  let slowdownMs = 0;
  for (let p = 0; p < phases.length; p++) {
    const ph = phases[p];
    unrecoveredTicks += ph.lostTicks;
    slowdownMs += Math.max(0, ph.endRelMs - ph.startRelMs + bucketSpanMsOf(samples[ph.endIdx]));
  }

  return {
    d,
    dPerm,
    phaseMask,
    phases,
    lastD: d[n - 1],
    lastDPerm: dPerm[n - 1],
    unrecoveredTicks,
    unrecoveredSec: unrecoveredTicks / TICK_HZ,
    slowdownMs,
  };
};

const sampleAtRelMs = relMs => {
  const pick = arr => {
    if (!arr || !arr.length) return null;
    if (relMs === null || !Number.isFinite(relMs)) return arr[arr.length - 1];
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const r = Number(arr[i].relMs);
      if (!Number.isFinite(r)) continue;
      const dist = Math.abs(r - relMs);
      if (dist < bestD) {
        bestD = dist;
        best = arr[i];
      }
    }
    return best || arr[arr.length - 1];
  };
  const hi = pick(highResBuffer);
  const lo = pick(historyBuf);
  if (relMs === null || !Number.isFinite(relMs)) return hi || lo;
  if (hi && lo) {
    const dh = Math.abs((Number(hi.relMs) || 0) - relMs);
    const dl = Math.abs((Number(lo.relMs) || 0) - relMs);
    return dh <= dl ? hi : lo;
  }
  return hi || lo;
};

const causeBoundOfSample = s => {
  if (!s) return null;
  const c = Number(s.computeMs) || 0;
  const w = Number(s.waitMs) || 0;
  if (c <= 0 && w <= 0) return null;
  return { bound: w > c ? 'wait' : 'compute', computeMs: c, waitMs: w, postMs: Number(s.postMs) || 0 };
};

const formatSecSigned = v => {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const txt = abs >= 10 ? abs.toFixed(1) : abs.toFixed(2);
  return (v > 0 ? '+' : v < 0 ? '-' : '') + txt + ' s';
};

// DE: Blocklast (Kollisionen pro Simulationsschritt) ueber den gesamten Lauf
// EN: Jam load (blocked attempts per simulation update) over the entire run
const jamLoadPerUpdate = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  if (typeof run.finishedAt === 'number') {
    const finalVal = readClock('upsJamLoadFinal');
    if (Number.isFinite(finalVal) && finalVal >= 0) return finalVal;
  }
  const curB = rawBallisticBlocks();
  const startB = readClock('upsBlocksStart');
  const dB = Math.max(0, curB - startB);
  const u = liveU();
  return u > 0 ? dB / u : 0;
};

// DE: Blockanteil (Kollisionen / (Kollisionen + Bewegungen)) in Prozent ueber den gesamten Lauf
// EN: Jam share (collisions / (collisions + moves)) in percent over the entire run
const jamSharePercent = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  if (typeof run.finishedAt === 'number') {
    const finalVal = readClock('upsJamShareFinal') || readClock('upsJamRateFinal');
    if (Number.isFinite(finalVal)) return finalVal;
  }
  const curB = rawBallisticBlocks();
  const curM = rawBallisticMoves();
  const startB = readClock('upsBlocksStart');
  const startM = readClock('upsMovesStart');
  const dB = Math.max(0, curB - startB);
  const dM = Math.max(0, curM - startM);
  return (dB + dM > 0) ? (dB / (dB + dM)) * 100 : 0;
};

// DE: Flugaktivitaet (Bewegungsversuche pro Simulationsschritt) ueber den gesamten Lauf
// EN: Flight activity (ballistic attempts per simulation update) over the entire run
const flightActivityPerUpdate = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  const curB = rawBallisticBlocks();
  const curM = rawBallisticMoves();
  const startB = readClock('upsBlocksStart');
  const startM = readClock('upsMovesStart');
  const dB = Math.max(0, curB - startB);
  const dM = Math.max(0, curM - startM);
  const u = liveU();
  return u > 0 ? (dB + dM) / u : 0;
};

// DE: Rueckwaertskompatible Aliase
const jamRatePercent = jamSharePercent;
const jamIntensityPerK = () => jamLoadPerUpdate() * 1000;

const JAM_WINDOW_MS = 5000;

const sampleSpanMs = (c, fallbackMs) => (
  c && Number.isFinite(c.spanMs) && c.spanMs > 0 ? c.spanMs : (fallbackMs || 100)
);

const sampleTicksOf = (c, fallbackMs) => {
  if (c && Number.isFinite(c.ticks) && c.ticks > 0) return c.ticks;
  const span = sampleSpanMs(c, fallbackMs);
  const ups = c && Number.isFinite(c.avg) ? c.avg : (c && Number.isFinite(c.ups) ? c.ups : 60);
  return Math.max(0, Number.isFinite(ups) ? ups * (span / 1000) : 0);
};

const sampleEventCount = (c, kind, scope) => {
  if (!c) return null;
  if (scope === 'allMatter') {
    let v;
    if (kind === 'settled') v = c.allBlocksSettled;
    else if (kind === 'active') v = c.allBlocksActive;
    else v = kind === 'blocks' ? c.allBlocks : c.allMoves;
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    return Math.max(0, v);
  }
  if (kind === 'settled' || kind === 'active') return null;
  const v = kind === 'blocks' ? (c.blocks || 0) : (c.moves || 0);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
};

const sampleJamInstant = (c, scope, fallbackMs) => {
  const blocks = sampleEventCount(c, 'blocks', scope);
  const moves = sampleEventCount(c, 'moves', scope);
  const ticks = sampleTicksOf(c, fallbackMs);
  if (blocks === null || moves === null) return null;
  const events = blocks + moves;
  return {
    blocks,
    moves,
    ticks,
    jamShare: events > 0 ? blocks / events : 0,
    jamLoad: ticks > 0 ? blocks / ticks : 0,
    flight: ticks > 0 ? events / ticks : 0,
  };
};

const trailingJamWindow = (src, idx, scope, fallbackMs, targetMs) => {
  if (!src || idx < 0 || idx >= src.length) return null;
  let blocks = 0;
  let moves = 0;
  let ticks = 0;
  let span = 0;
  let n = 0;
  let minShare = Infinity;
  let maxShare = -Infinity;
  let minLoad = Infinity;
  let maxLoad = -Infinity;
  for (let j = idx; j >= 0; j--) {
    const inst = sampleJamInstant(src[j], scope, fallbackMs);
    if (!inst) return null;
    blocks += inst.blocks;
    moves += inst.moves;
    ticks += inst.ticks;
    span += sampleSpanMs(src[j], fallbackMs);
    n += 1;
    if (Number.isFinite(inst.jamShare)) {
      if (inst.jamShare < minShare) minShare = inst.jamShare;
      if (inst.jamShare > maxShare) maxShare = inst.jamShare;
    }
    if (Number.isFinite(inst.jamLoad)) {
      if (inst.jamLoad < minLoad) minLoad = inst.jamLoad;
      if (inst.jamLoad > maxLoad) maxLoad = inst.jamLoad;
    }
    if (span >= (targetMs || JAM_WINDOW_MS) && n >= 1) break;
  }
  const events = blocks + moves;
  return {
    blocks,
    moves,
    ticks,
    spanMs: span,
    jamShare: events > 0 ? blocks / events : 0,
    jamLoad: ticks > 0 ? blocks / ticks : 0,
    flight: ticks > 0 ? events / ticks : 0,
    minShare: minShare === Infinity ? 0 : minShare,
    maxShare: maxShare === -Infinity ? 0 : maxShare,
    minLoad: minLoad === Infinity ? 0 : minLoad,
    maxLoad: maxLoad === -Infinity ? 0 : maxLoad,
  };
};

const percentile = (arr, p) => {
  if (!arr || arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
};

const medianOf = arr => {
  if (!arr || arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const workerCount = () => {
  try {
    return (sandkit.state.environment && sandkit.state.environment.threadMeta && sandkit.state.environment.threadMeta.threadCount) || 1;
  } catch (e) {
    return 1;
  }
};

let allMatterRuntimeOverride = null;
const monitoringMode = () => {
  try {
    const v = api.settings.get('monitoringMode');
    if (v === 'off' || v === 'standard' || v === 'full') return v;
  } catch (e) {}
  try {
    if (api.settings.get('allMatterCapture') === true) return 'full';
    if (api.settings.get('trackUpsHistory') === false) return 'off';
  } catch (e) {}
  return 'standard';
};
const monitoringEnabled = () => monitoringMode() !== 'off' || allMatterRuntimeOverride !== null;
const allMatterCaptureWanted = () => (
  allMatterRuntimeOverride !== null
    ? allMatterRuntimeOverride === true
    : monitoringMode() === 'full'
);

const applyMonitoringMask = () => {
  if (benchState.running) return;
  if (monitoringMode() === 'off' && allMatterRuntimeOverride === null) {
    try { if (tickBuf) Atomics.store(tickBuf, 8, 0); } catch (e) {}
    setMetricCaptureMask(0);
    return;
  }
  setAllMatterCapture(allMatterCaptureWanted());
};

const syncAllMatterCaptureControl = () => {
  applyMonitoringMask();
};

const BENCH_PHASE_MS = 15000;
const BENCH_REPEATS = 3;
const BENCH_TESTS = [
  { id: 'ballistic-blocks', label: 'Ballistic blocks', mask: METRIC_BALLISTIC_BLOCKS },
  { id: 'ballistic-moves', label: 'Ballistic moves', mask: METRIC_BALLISTIC_MOVES },
  { id: 'all-blocks', label: 'All-matter blocks', mask: METRIC_ALL_BLOCKS },
  { id: 'all-moves', label: 'All-matter moves', mask: METRIC_ALL_MOVES },
  { id: 'awake-chunks', label: 'Awake-chunk scan', mask: METRIC_AWAKE },
  { id: 'live-elements', label: 'Live-population read', mask: METRIC_LIVE },
  { id: 'sim-time', label: 'Simulation-time read', mask: METRIC_SIM_TIME },
  { id: 'ballistic-bundle', label: 'Ballistic bundle', mask: METRIC_BALLISTIC },
  { id: 'all-matter-bundle', label: 'All-matter bundle', mask: METRIC_ALL_MATTER },
  { id: 'complete-bundle', label: 'Complete diagnostics', mask: METRIC_COMPLETE },
];
let benchState = {
  running: false,
  testIndex: 0,
  repeat: 0,
  mode: 'idle',
  pendingMode: null,
  targetMask: 0,
  phaseStart: 0,
  bucket: null,
  records: [],
  restoreOverride: null,
  restoreWanted: false,
  result: null,
  copiedAt: 0,
};

const resetBenchState = extra => {
  benchState = {
    running: false,
    testIndex: 0,
    repeat: 0,
    mode: 'idle',
    pendingMode: null,
    targetMask: 0,
    phaseStart: 0,
    bucket: null,
    records: [],
    restoreOverride: null,
    restoreWanted: false,
    result: null,
    copiedAt: 0,
    ...extra,
  };
};

try { applyMonitoringMask(); } catch (e) {}

const summarizeBenchSide = records => {
  const sim = records.map(s => s.simMsAvg).filter(n => Number.isFinite(n));
  const ups = records.map(s => s.ups).filter(n => Number.isFinite(n));
  const wall = records.map(s => s.wallMsPerTick).filter(n => Number.isFinite(n));
  return {
    n: records.length,
    simMed: medianOf(sim),
    simP95: percentile(sim, 0.95),
    upsMed: medianOf(ups),
    upsP05: percentile(ups, 0.05),
    upsP95: percentile(ups, 0.95),
    wallMed: medianOf(wall),
    wallP95: percentile(wall, 0.95),
  };
};

const benchCurrentTest = () => BENCH_TESTS[Math.min(benchState.testIndex, BENCH_TESTS.length - 1)];

const finalizeBenchBucket = () => {
  const b = benchState.bucket;
  if (!b || b.spanMs <= 0 || !benchState.running) return;
  const test = benchCurrentTest();
  const simEnabled = benchState.mode === 'test' && Boolean(test.mask & METRIC_SIM_TIME);
  benchState.records.push({
    testId: test.id,
    testLabel: test.label,
    repeat: benchState.repeat + 1,
    phase: benchState.mode,
    second: b.second + 1,
    mask: benchState.mode === 'test' ? test.mask : 0,
    spanMs: Math.round(b.spanMs),
    ticks: b.ticks,
    ups: b.spanMs > 0 ? (b.ticks * 1000) / b.spanMs : 0,
    wallMsPerTick: b.ticks > 0 ? b.spanMs / b.ticks : null,
    ballisticBlocks: b.ballisticBlocks,
    ballisticMoves: b.ballisticMoves,
    allBlocks: b.allBlocks,
    allMoves: b.allMoves,
    awakeAvg: benchState.mode === 'test' && (test.mask & METRIC_AWAKE) ? b.awakeSum / b.spanMs : null,
    awakeMax: benchState.mode === 'test' && (test.mask & METRIC_AWAKE) ? b.awakeMax : null,
    liveAvg: benchState.mode === 'test' && (test.mask & METRIC_LIVE) ? b.liveSum / b.spanMs : null,
    liveMax: benchState.mode === 'test' && (test.mask & METRIC_LIVE) ? b.liveMax : null,
    simMsAvg: simEnabled ? b.simMsSum / b.spanMs : null,
    simMsMax: simEnabled ? b.simMsMax : null,
  });
  benchState.bucket = null;
};

const startBenchPhase = mode => {
  const test = benchCurrentTest();
  benchState.mode = 'settling';
  benchState.pendingMode = mode;
  benchState.targetMask = mode === 'test' ? test.mask : 0;
  benchState.phaseStart = 0;
  benchState.bucket = null;
  setMetricCaptureMask(benchState.targetMask);
};

const finishMetricBenchmark = () => {
  finalizeBenchBucket();
  const summaries = BENCH_TESTS.map(test => {
    const baselineRecords = benchState.records.filter(r => r.testId === test.id && r.phase === 'baseline');
    const testRecords = benchState.records.filter(r => r.testId === test.id && r.phase === 'test');
    const baseline = summarizeBenchSide(baselineRecords);
    const active = summarizeBenchSide(testRecords);
    const wallDelta = active.wallMed - baseline.wallMed;
    const wallPct = baseline.wallMed > 0 ? (wallDelta / baseline.wallMed) * 100 : 0;
    const upsDelta = active.upsMed - baseline.upsMed;
    const upsPct = baseline.upsMed > 0 ? (upsDelta / baseline.upsMed) * 100 : 0;
    return { test, baseline, active, wallDelta, wallPct, upsDelta, upsPct };
  });
  const summaryLines = [
    'Gold Speedrun metric cost matrix (scene-dependent)',
    `build ${MOD_VERSION}  workers ${workerCount()}  ${BENCH_TESTS.length} packages x ${BENCH_REPEATS} repeats x ${BENCH_PHASE_MS / 1000}s baseline/test`,
    'Baseline = tick publication only. wallMs/tick is derived from wall time and ticks.',
  ];
  summaries.forEach(s => {
    summaryLines.push(
      `${s.test.id}  wall med/p95 ${s.baseline.wallMed.toFixed(3)}/${s.baseline.wallP95.toFixed(3)} -> ${s.active.wallMed.toFixed(3)}/${s.active.wallP95.toFixed(3)} ms/tick  delta ${s.wallDelta >= 0 ? '+' : ''}${s.wallDelta.toFixed(3)} (${s.wallPct >= 0 ? '+' : ''}${s.wallPct.toFixed(1)}%)  UPS med ${s.baseline.upsMed.toFixed(2)} -> ${s.active.upsMed.toFixed(2)} (${s.upsPct >= 0 ? '+' : ''}${s.upsPct.toFixed(1)}%)`
    );
  });
  const baselineBySlot = new Map();
  benchState.records.forEach(r => {
    if (r.phase === 'baseline') baselineBySlot.set(`${r.testId}|${r.repeat}|${r.second}`, r);
  });
  const csvHeader = 'test,repeat,phase,second,mask,spanMs,ticks,ups,wallMsPerTick,baselineUps,upsDelta,baselineWallMsPerTick,wallMsPerTickDelta,ballisticBlocks,ballisticMoves,allBlocks,allMoves,awakeAvg,awakeMax,liveAvg,liveMax,simMsAvg,simMsMax';
  const csvValue = v => Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : '';
  const csvRows = benchState.records.map(r => {
    const paired = r.phase === 'test' ? baselineBySlot.get(`${r.testId}|${r.repeat}|${r.second}`) : null;
    return [
    r.testId, r.repeat, r.phase, r.second, r.mask, r.spanMs, csvValue(r.ticks),
    csvValue(r.ups), csvValue(r.wallMsPerTick),
    csvValue(paired && paired.ups), csvValue(paired ? r.ups - paired.ups : null),
    csvValue(paired && paired.wallMsPerTick), csvValue(paired && Number.isFinite(paired.wallMsPerTick) && Number.isFinite(r.wallMsPerTick) ? r.wallMsPerTick - paired.wallMsPerTick : null),
    csvValue(r.ballisticBlocks), csvValue(r.ballisticMoves), csvValue(r.allBlocks), csvValue(r.allMoves),
    csvValue(r.awakeAvg), csvValue(r.awakeMax), csvValue(r.liveAvg), csvValue(r.liveMax),
    csvValue(r.simMsAvg), csvValue(r.simMsMax),
  ].join(',');
  });
  const report = summaryLines.concat(['', 'ONE_SECOND_PROGRESSION_CSV', csvHeader], csvRows).join('\n');
  allMatterRuntimeOverride = benchState.restoreOverride;
  benchState.running = false;
  benchState.mode = 'idle';
  benchState.result = { summaries, report, preview: summaryLines.join('\n') };
  applyMonitoringMask();
  try { notifyMetrics(); } catch (e) {}
};

const startMetricBenchmark = () => {
  if (benchState.running || isRunning() || gamePaused() || !rawTickSourceReady()) return;
  resetBenchState({
    running: true,
    testIndex: 0,
    repeat: 0,
    mode: 'settling',
    pendingMode: 'baseline',
    targetMask: 0,
    phaseStart: 0,
    bucket: null,
    records: [],
    restoreOverride: allMatterRuntimeOverride,
    restoreWanted: allMatterCaptureWanted(),
    result: null,
    copiedAt: 0,
  });
  allMatterRuntimeOverride = false;
  bucketAccum = null;
  sparklineAccum = null;
  try { if (tickBuf) Atomics.store(tickBuf, 8, 0); } catch (e) {}
  setMetricCaptureMask(0);
  try { notifyMetrics(); } catch (e) {}
};

const cancelMetricBenchmark = () => {
  if (!benchState.running) return;
  allMatterRuntimeOverride = benchState.restoreOverride;
  benchState.running = false;
  benchState.mode = 'idle';
  benchState.bucket = null;
  applyMonitoringMask();
  try { notifyMetrics(); } catch (e) {}
};

const tickMetricBenchmark = sample => {
  if (!benchState.running) return;
  const now = performance.now();
  if (benchState.mode === 'settling') {
    if (!metricMaskSettled(benchState.targetMask)) return;
    benchState.mode = benchState.pendingMode;
    benchState.pendingMode = null;
    benchState.phaseStart = now;
    benchState.bucket = null;
    return;
  }

  const phaseEnd = benchState.phaseStart + BENCH_PHASE_MS;
  if (sample) {
    const sampleEnd = Number.isFinite(sample.timeMs) ? sample.timeMs : now;
    const sampleSpan = Math.max(1, Number.isFinite(sample.spanMs) ? sample.spanMs : 100);
    let partStart = Math.max(benchState.phaseStart, sampleEnd - sampleSpan);
    const clippedEnd = Math.min(phaseEnd, sampleEnd);
    while (partStart < clippedEnd) {
      const second = Math.min(14, Math.floor((partStart - benchState.phaseStart) / 1000));
      const secondEnd = Math.min(clippedEnd, benchState.phaseStart + (second + 1) * 1000);
      const partMs = secondEnd - partStart;
      const ratio = partMs / sampleSpan;
      if (!benchState.bucket || benchState.bucket.second !== second) {
        finalizeBenchBucket();
        benchState.bucket = {
          second, spanMs: 0, ticks: 0,
          ballisticBlocks: 0, ballisticMoves: 0, allBlocks: 0, allMoves: 0,
          awakeSum: 0, awakeMax: 0, liveSum: 0, liveMax: 0, simMsSum: 0, simMsMax: 0,
        };
      }
      const b = benchState.bucket;
      b.spanMs += partMs;
      b.ticks += sampleTicksOf(sample, 100) * ratio;
      b.ballisticBlocks += (Number.isFinite(sample.blocks) ? sample.blocks : 0) * ratio;
      b.ballisticMoves += (Number.isFinite(sample.moves) ? sample.moves : 0) * ratio;
      b.allBlocks += (Number.isFinite(sample.allBlocks) ? sample.allBlocks : 0) * ratio;
      b.allMoves += (Number.isFinite(sample.allMoves) ? sample.allMoves : 0) * ratio;
      const awake = Number.isFinite(sample.awake) ? sample.awake : 0;
      const live = Number.isFinite(sample.live) ? sample.live : 0;
      const simMs = Number.isFinite(sample.simMs) ? sample.simMs : 0;
      b.awakeSum += awake * partMs;
      b.awakeMax = Math.max(b.awakeMax, awake);
      b.liveSum += live * partMs;
      b.liveMax = Math.max(b.liveMax, live);
      b.simMsSum += simMs * partMs;
      b.simMsMax = Math.max(b.simMsMax, simMs);
      partStart = secondEnd;
    }
  }

  if (now >= phaseEnd) {
    finalizeBenchBucket();
    if (benchState.mode === 'baseline') {
      startBenchPhase('test');
      return;
    }
    if (benchState.repeat + 1 < BENCH_REPEATS) {
      benchState.repeat += 1;
      startBenchPhase('baseline');
      return;
    }
    benchState.repeat = 0;
    benchState.testIndex += 1;
    if (benchState.testIndex >= BENCH_TESTS.length) {
      finishMetricBenchmark();
      return;
    }
    startBenchPhase('baseline');
    return;
  }
};

const benchmarkProgress = () => {
  if (!benchState.running) return null;
  const test = benchCurrentTest();
  const elapsedSec = benchState.phaseStart > 0 ? Math.min(15, Math.floor((performance.now() - benchState.phaseStart) / 1000) + 1) : 0;
  return {
    package: `${benchState.testIndex + 1}/${BENCH_TESTS.length} ${test.label}`,
    repeat: `${benchState.repeat + 1}/${BENCH_REPEATS}`,
    phase: benchState.mode === 'settling' ? `settling ${benchState.pendingMode || ''}` : benchState.mode,
    seconds: `${elapsedSec}/15s`,
  };
};

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
// DE: setzt das Spiel selbst (Max-Everything) und nimmt es nie zurueck. Dieser Mod
// DE: setzt dasselbe Flag, wenn vor dem Ziel Debug- oder Cinematik-Modus an war.
// EN: If a cheat was ever used in the save file, the run is worthless. The
// EN: game sets this flag itself (Max Everything) and never clears it. This mod
// EN: sets the same flag when debug or cinematic mode was on before the goal.
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

const enumName = (en, id) => {
  try {
    const mapped = en && en[id];
    if (typeof mapped === 'string' && mapped.length > 0 && mapped !== String(id)) return mapped;
  } catch (e) { /* DE: Enum fehlt / EN: enum missing */ }
  return null;
};

const i18nId = name => String(name).replace(/^./, c => c.toLowerCase());

const itemName = itemId => {
  const direct = translateIfPresent(`items|${itemId}|name`);
  if (direct) return direct;
  const named = enumName(enums.ItemId, itemId);
  if (named) {
    const fromEnum = translateIfPresent(`items|${i18nId(named)}|name`)
      || translateIfPresent(`items|${named}|name`);
    if (fromEnum) return fromEnum;
  }
  try {
    const idef = api.items.getDefinitionById(itemId);
    const fromDef = translateIfPresent(idef && idef.nameKey) || (idef && typeof idef.name === 'string' ? idef.name : null);
    if (fromDef) return fromDef;
  } catch (e) { /* DE: nur Mod-Items / EN: mod items only */ }
  try {
    const created = api.items.createFromId && api.items.createFromId(itemId);
    const fromCreate = translateIfPresent(created && created.nameKey)
      || (created && typeof created.name === 'string' ? created.name : null);
    if (fromCreate) return fromCreate;
  } catch (e) { /* DE: Vanilla-Item ohne API / EN: vanilla item has no API */ }
  return named ? prettifyId(named) : null;
};

const structureName = type => {
  try {
    const sdef = api.structures.getDefinitionByType(type);
    const name = translateIfPresent(sdef && sdef.nameKey)
      || (sdef && typeof sdef.name === 'string' ? sdef.name : null);
    if (name) return name;
  } catch (e) { /* DE: unbekannt / EN: unknown */ }
  const named = enumName(enums.StructureType, type);
  return translateIfPresent(`structures|${type}|name`)
    || (named ? translateIfPresent(`structures|${i18nId(named)}|name`) : null);
};

const techName = techId => {
  if (techId == null || techId === '') return '?';

  const resolved = enumName(enums.Tech, techId);
  let def = null;
  try { def = api.tech.getDefinitionById(techId); } catch (e) { /* DE: unbekannt / EN: unknown */ }
  if (!def && resolved) {
    try { def = api.tech.getDefinitionById(resolved); } catch (e) { /* ignore */ }
  }

  if (def) {
    const fromDef = translateIfPresent(def.nameKey)
      || (typeof def.name === 'string' && def.name ? def.name : null);
    if (fromDef) return fromDef;
  }

  const direct = translateIfPresent(`tech|${techId}|name`)
    || (resolved ? translateIfPresent(`tech|${i18nId(resolved)}|name`) : null)
    || (resolved ? translateIfPresent(`tech|${resolved}|name`) : null);
  if (direct) return direct;

  const unlocks = (def || {}).unlocks || {};
  if (Array.isArray(unlocks.items)) {
    for (const itemId of unlocks.items) {
      const name = itemName(itemId);
      if (name) return name;
    }
  }
  if (Array.isArray(unlocks.structures)) {
    for (const type of unlocks.structures) {
      const name = structureName(type);
      if (name) return name;
    }
  }

  return prettifyId(resolved || techId);
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
  const t = elapsed();
  const w = elapsedPlay();
  const sid = splitIdOf(kind, id) || `${kind}:${label}`;

  const bests = readGlobalBests();
  if (!bests.seq) bests.seq = {};
  if (!bests.abs) bests.abs = {};

  const isSeq = kind === 'rank' || kind === 'goal' || kind === 'gold';
  if (isSeq) {
    let prevSeqW = 0;
    for (let i = splits.length - 1; i >= 0; i--) {
      if (splits[i].kind === 'rank' || splits[i].kind === 'goal' || splits[i].kind === 'gold') {
        prevSeqW = splitMs(splits[i]) || 0;
        break;
      }
    }
    const segment = w - prevSeqW;
    if (bests.seq[sid] === undefined || segment < bests.seq[sid]) {
      bests.seq[sid] = segment;
    }
  } else {
    if (bests.abs[sid] === undefined || w < bests.abs[sid]) {
      bests.abs[sid] = w;
    }
  }
  writeGlobalBests(bests);

  splits.push({
    t,
    sim: elapsedSim(),
    w: elapsedPlay(),
    kind,
    label,
    id: sid,
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
const categoryTriggerId = () => {
  try { return category().id; } catch (e) { return '100000'; }
};

const readOverrideMap = key => {
  const v = api.storage.local.get(key);
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

const readOverrides = () => {
  const per = readOverrideMap(TRIGGER_PREFIX + categoryTriggerId());
  if (Object.keys(per).length > 0) return per;
  return readOverrideMap(TRIGGER_KEY);
};

const writeOverrides = map => {
  // DE: Leere Eintraege gar nicht erst speichern, damit spaetere Aenderungen an den
  // DE: Gruppen-Einstellungen weiter durchschlagen.
  // EN: Don't store empty entries at all, so later changes to the group
  // EN: settings keep taking effect.
  const clean = {};
  for (const [k, v] of Object.entries(map)) if (typeof v === 'boolean') clean[k] = v;
  api.storage.local.set(TRIGGER_PREFIX + categoryTriggerId(), clean);
};

const triggerKey = (kind, id) => `${kind}:${id}`;

const triggerEnabled = (kind, id, groupDefault) => {
  const map = readOverrides();
  const keys = [triggerKey(kind, id)];
  if (kind === 'tech') {
    const named = enumName(enums.Tech, id);
    if (named) keys.push(triggerKey(kind, named));
    try {
      const num = enums.Tech && enums.Tech[id];
      if (typeof num === 'number') keys.push(triggerKey(kind, num));
    } catch (e) { /* ignore */ }
  }
  for (const k of keys) {
    if (typeof map[k] === 'boolean') return map[k];
  }
  return groupDefault;
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
    for (const id of Object.keys(sandkit.state.store.player.tech || {})) {
      const named = enumName(enums.Tech, id);
      if (named) ids.add(named);
      else ids.add(id);
    }
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
  const gold = goldGoalOf(cat);
  const target = gold ? goalTargetOf(gold) : 0;

  if (mode === '10k' || mode === '100k') {
    const step = mode === '10k' ? 10000 : 100000;
    const out = [];
    const cap = target > 0 ? target : 0;
    if (!(cap > step)) return [];
    for (let v = step; v < cap; v += step) out.push({ value: v, label: shortGold(v) });
    return out;
  }

  if (!gold || target <= 0) return [];
  const shares = mode === 'tenths'
    ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    : [0.25, 0.5, 0.75];
  return shares.map(f => ({
    value: Math.ceil(target * f),
    label: t('mods|goldSpeedrun|split|gold', { percent: Math.round(f * 100) }),
  }));
};

// DE: Die Marken aendern sich nur, wenn Kategorie oder Einstellung wechseln.
// EN: The marks only change when the category or the setting changes.
let markCache = { key: null, list: [] };

const currentGoldMarks = cat => {
  const gold = goldGoalOf(cat);
  const target = gold ? goalTargetOf(gold) : 0;
  const key = `${cat.id}|${target}|${api.settings.get('splitGold')}`;
  if (markCache.key !== key) markCache = { key, list: goldMarks(cat) };
  return markCache.list;
};

// DE: Geplante Zwischenzeiten, die noch nicht gefallen sind - wie in LiveSplit
// DE: die Zeilen unter der aktuellen. Gold-Marken, Raenge und das Ziel sind
// DE: Pflicht und streng geordnet. Optionale Splits (Forschung, Artefakt,
// DE: Aufwertung) bleiben im aktuellen Pflicht-Intervall sichtbar, auch wenn
// DE: ihre Reihenfolge wechselt, und fallen erst raus, sobald die naechste
// DE: Pflicht-Marke erreicht ist. Forschungen und Aufwertungen erscheinen
// DE: nur, wenn eine Vergleichsroute sie schon einmal festgehalten hat.
// EN: Planned splits that have not fired yet - like the rows below the
// EN: current one in LiveSplit. Gold marks, ranks and the goal are mandatory
// EN: and strictly ordered. Optional splits (research, artifact, upgrade)
// EN: stay visible in the current mandatory interval even if their order
// EN: changes, and drop only once the next mandatory mark is reached.
// EN: Research and upgrades only appear if a comparison route already
// EN: recorded them.
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

  const route = readComparisonSplits();
  const lastMand = lastReachedMandatoryPbIndex(done, route);
  for (let i = 0; i < route.length; i++) {
    const p = route[i];
    if (!p || !p.kind || !p.label) continue;
    if (!isMandatory(p) && i < lastMand) {
      // DE: Optionale Reste eines abgeschlossenen Intervalls nicht erneut
      // DE: einspielen (z. B. Artefakt-Schleife weiter unten).
      // EN: Do not re-inject leftover optionals from a completed interval
      // EN: (e.g. the artifact loop further down).
      if (p.id) seen.add(p.id);
      seen.add(`${p.kind}\0${p.label}`);
      continue;
    }
    push(p.kind, p.label, p.id);
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
    const last = artifactTotal() > 0 ? artifactTotal() : (cat.kind === 'artifacts' ? goalTargetOf(categoryGoals(cat)[0]) : 0);
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

// DE: LiveSplit-Gesamt-Delta (W): eingefrorenes Delta des letzten erreichten
// DE: Vergleichs-Splits, solange die Uhr noch vor der naechsten Pflicht-Marke
// DE: liegt; wechselt auf den live wachsenden Wert, sobald diese PB-Zeit
// DE: ueberschritten ist (Delta-with-fallback). Am Ende: Endzeit minus PB.
// EN: LiveSplit-style total delta (W): frozen last-completed comparison
// EN: delta while still ahead of the next mandatory mark; switches to the
// EN: live growing value once that PB time is passed (delta-with-fallback).
// EN: When finished: final time minus PB.
const totalAheadDelta = (done, upcoming, pbSplits) => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return null;
  if (typeof run.finishedAt === 'number') {
    const best = readBest();
    if (best === null || best <= 0) return null;
    return scoredTime() - best;
  }
  const pbs = Array.isArray(pbSplits) ? pbSplits : [];
  let lastDelta = null;
  for (let i = done.length - 1; i >= 0; i--) {
    const pb = findPbSplit(done[i], pbs);
    const routeMs = pb ? splitMs(pb) : NaN;
    const liveMs = splitMs(done[i]);
    if (Number.isFinite(routeMs) && Number.isFinite(liveMs)) {
      lastDelta = liveMs - routeMs;
      break;
    }
  }
  let anchorMs = NaN;
  for (const s of upcoming) {
    if (!isMandatory(s)) continue;
    const pb = findPbSplit(s, pbs);
    const routeMs = pb ? splitMs(pb) : NaN;
    if (Number.isFinite(routeMs)) {
      anchorMs = routeMs;
      break;
    }
  }
  const elapsed = viewedElapsed();
  const liveVsAnchor = Number.isFinite(anchorMs) ? elapsed - anchorMs : null;
  if (lastDelta !== null && (liveVsAnchor === null || elapsed <= anchorMs)) return lastDelta;
  if (lastDelta === null) {
    if (liveVsAnchor !== null && liveVsAnchor > 0) return liveVsAnchor;
    return null;
  }
  return liveVsAnchor;
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

// --- DE: Debug- und Cinematik-Modus / EN: Debug and cinematic mode -----------
// DE: session.debug existiert immer (Standard-Pinsel). Allein die Anwesenheit
// DE: ist kein Signal. Gezaehlt wird, was der Motor wirklich scharf schaltet:
// DE: config.debug, localStorage, der Debug-Pinsel im Inventar, und der
// DE: Cinematik-Zustand. Cinematik ist das experimentelle Video-Werkzeug
// DE: (Freecam, Zeitlupe), nicht Intro, Drohnen oder Tooltips.
// EN: session.debug always exists (the default brush). Its mere presence is
// EN: not a signal. What counts is what the engine actually arms: config.debug,
// EN: localStorage, the debug brush in the inventory, and the cinematic state.
// EN: Cinematic mode is the experimental video tool (freecam, time scale), not
// EN: the intro, drones, or tooltips.
const DEBUG_BRUSH_ID = 'debugPaintBrush';
// DE: Worker-Nachricht in Sandustry 0.5.6. tools/verify-engine.js prueft den Wert.
// EN: Worker message in Sandustry 0.5.6. tools/verify-engine.js checks the value.
const SIM_SPEED_MESSAGE = 68;

const legacyConfig = () => {
  try {
    const cfgApi = sandkit.engine && sandkit.engine.api && sandkit.engine.api.config;
    if (cfgApi && typeof cfgApi.getLegacy === 'function') return cfgApi.getLegacy();
  } catch (e) { /* DE: Engine-Config fehlt / EN: engine config missing */ }
  return null;
};

const localFlag = key => {
  try { return localStorage.getItem(key) === 'true'; } catch (e) { return false; }
};

const debugBrushInInventory = () => {
  try {
    const inv = sandkit.state.store.player.inventory;
    return Array.isArray(inv) && inv.some(item => item && item.id === DEBUG_BRUSH_ID);
  } catch (e) {
    return false;
  }
};

const isDebugActive = () => {
  try {
    const cfg = legacyConfig();
    const debug = cfg && cfg.debug;
    if (debug && (debug.active === true || debug.drawChunks === true)) return true;
  } catch (e) { /* DE: Config nicht lesbar / EN: config not readable */ }
  if (localFlag('debug.active') || localFlag('debug.drawChunks')) return true;
  if (debugBrushInInventory()) return true;
  try {
    const items = sandkit.state.sandkit && sandkit.state.sandkit.mods && sandkit.state.sandkit.mods.items;
    if (items && items[DEBUG_BRUSH_ID]) return true;
  } catch (e) { /* DE: Mod-Item-Liste fehlt / EN: mod item list missing */ }
  try {
    const brush = sandkit.state.session.debug && sandkit.state.session.debug.brush;
    if (brush && (brush.overwrite === true || brush.skipPhysics === 1)) return true;
  } catch (e) { /* DE: session.debug fehlt / EN: session.debug missing */ }
  return false;
};

const isCinematicActive = () => {
  try {
    const cinematic = sandkit.state.session.cinematic;
    if (cinematic && typeof cinematic === 'object') return true;
  } catch (e) { /* DE: keine Session / EN: no session */ }
  return localFlag('cinematic.enabled');
};

// DE: Der Timer startet immer bei der ersten echten Spielhandlung: Bewegung,
// DE: Graben, Bauen, Forschen, und auch Fortschritt ohne eigenen Klick
// DE: (Drohnen, Foerderbaender). Das ist die offizielle Speedrun-Vorgabe.
// EN: The timer always starts on the first real in-game action: movement,
// EN: digging, building, researching, and also progress without a click of
// EN: your own (drones, belts). That is the official speedrun requirement.

// --- DE: Offizielles Regelwerk / EN: Official ruleset -----------------------
// DE: Gueltig ist ein Lauf nur, wenn Gold nach Kontostand zaehlt, Intro,
// DE: Story und Tutorial nicht uebersprungen werden, ausser diesem Mod nichts
// DE: aktiv ist, und weder Debug- noch Cinematik-Modus an ist.
// EN: A run is valid only when gold counts by balance, intro, story and
// EN: tutorial are not skipped, nothing but this mod is active, and neither
// EN: debug mode nor cinematic mode is on.
const OFFICIAL_RULES = [
  {
    id: 'goldMode',
    labelKey: 'mods|goldSpeedrun|cfg|mode',
    valueKey: 'mods|goldSpeedrun|cfg|mode|balance',
    ok: () => goldMode() === 'balance',
  },
  {
    id: 'skipTutorial',
    labelKey: 'mods|goldSpeedrun|rules|skipTutorial',
    // DE: "Aus" - dieselbe Beschriftung wie bei den Gold-Marken.
    // EN: "Off" - the same label as used for the gold marks.
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !skipTutorialEnabled(),
  },
  {
    id: 'skipIntro',
    labelKey: 'mods|goldSpeedrun|rules|skipIntro',
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !skipIntroEnabled(),
  },
  {
    id: 'skipStory',
    labelKey: 'mods|goldSpeedrun|rules|skipStory',
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !skipStoryEnabled(),
  },
  {
    id: 'debugMode',
    labelKey: 'mods|goldSpeedrun|rules|debugMode',
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !isDebugActive(),
  },
  {
    id: 'cinematicMode',
    labelKey: 'mods|goldSpeedrun|rules|cinematicMode',
    valueKey: 'mods|goldSpeedrun|cfg|splitGold|off',
    ok: () => !isCinematicActive(),
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
  const extraCount = extra.length;
  items.push({
    id: 'mods',
    label: t('mods|goldSpeedrun|rules|mods'),
    value: extraCount > 0 ? `${extraCount} Mods` : t('mods|goldSpeedrun|rules|modsNone'),
    ok: extraCount === 0,
    extra,
  });

  rulesCache = { ok: items.every(i => i.ok), items, extraCount };
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

// DE: Debug oder Cinematik vor dem Ziel markiert den Spielstand dauerhaft.
// DE: store.integrity.cheatsUsed schreibt das Spiel mit in die Datei und nimmt
// DE: es nie zurueck. Nach dem Ziel wird nichts mehr nachgetragen.
// EN: Debug or cinematic mode before the goal marks the save for good.
// EN: store.integrity.cheatsUsed is what the game writes into the file, and it
// EN: never clears it. Nothing is applied after the goal has already been reached.
const flagSaveForDisallowedEngine = () => {
  if (!isDebugActive() && !isCinematicActive()) return;
  const run = readRun();
  if (typeof run.finishedAt === 'number') return;

  try {
    const store = sandkit.state && sandkit.state.store;
    if (store) {
      if (!store.integrity || typeof store.integrity !== 'object') {
        store.integrity = { cheatsUsed: false, modsUsed: false };
      }
      if (store.integrity.cheatsUsed !== true) {
        store.integrity.cheatsUsed = true;
        log('Debug- oder Cinematik-Modus vor dem Ziel - Spielstand als Cheats markiert');
      }
    }
  } catch (e) { /* DE: Spielstand noch nicht da / EN: save not loaded yet */ }

  try {
    api.storage.ensure(NS);
    if (api.storage.get(NS, 'debugUsed') !== true) api.storage.set(NS, 'debugUsed', true);
  } catch (e) { /* DE: Speicher fehlt / EN: storage missing */ }

  if (isRunning() && runIsOfficial()) dropOfficial();
};

let debugSettingApplied = null;

const activateDebugMode = () => {
  const already = isDebugActive();
  try { localStorage.setItem('debug.active', 'true'); } catch (e) { /* DE: kein localStorage / EN: no localStorage */ }
  try {
    const cfg = legacyConfig();
    if (cfg && cfg.debug) cfg.debug.active = true;
  } catch (e) { /* DE: Config nicht schreibbar / EN: config not writable */ }
  rulesCache = null;
  if (already) return;
  log('Debug-Modus ueber die Mod-Einstellung eingeschaltet');
  try { api.ui.toast({ key: 'mods|goldSpeedrun|toast|debugEnabled' }); } catch (e) { /* ignore */ }
};

// DE: Schaltet Debug aus und raeumt dabei jeden nicht erlaubten Motor-Zustand
// DE: mit ab (Chunk-Gitter, Debug-Pinsel, Cinematik, Kamera, Sim-Geschwindigkeit).
// DE: Der Lauf wird davon nicht wieder gueltig.
// EN: Turns debug off and clears every disallowed engine state along with it
// EN: (chunk grid, debug brush, cinematic mode, camera, sim speed).
// EN: That does not make the run valid again.
const deactivateDisallowedEngineStates = () => {
  const wasActive = isDebugActive() || isCinematicActive();
  debugSettingApplied = false;

  try { localStorage.setItem('debug.active', 'false'); } catch (e) { /* ignore */ }
  try { localStorage.setItem('debug.drawChunks', 'false'); } catch (e) { /* ignore */ }
  try { localStorage.setItem('cinematic.enabled', 'false'); } catch (e) { /* ignore */ }

  try {
    const cfg = legacyConfig();
    if (cfg && cfg.debug) {
      cfg.debug.active = false;
      cfg.debug.drawChunks = false;
    }
  } catch (e) { /* DE: Config nicht schreibbar / EN: config not writable */ }

  try {
    const session = sandkit.state && sandkit.state.session;
    if (session) {
      const brush = session.debug && session.debug.brush;
      if (brush) {
        brush.overwrite = false;
        brush.skipPhysics = 0;
      }
      session.overrideCamera = false;
      session.lerpCamera = false;
      if (session.cinematic && typeof session.cinematic === 'object') {
        try {
          if (session.cinematic.speed) session.cinematic.speed.multiplier = 1;
        } catch (e) { /* DE: Zeitfaktor nicht schreibbar / EN: time scale not writable */ }
        try {
          if (session.settings) session.settings.videoZoom = 1;
        } catch (e) { /* DE: Zoom nicht schreibbar / EN: zoom not writable */ }
      }
      session.cinematic = undefined;
    }
  } catch (e) { /* DE: Session fehlt / EN: session missing */ }

  try {
    const inv = sandkit.state.store.player.inventory;
    if (Array.isArray(inv)) {
      sandkit.state.store.player.inventory = inv.filter(item => !item || item.id !== DEBUG_BRUSH_ID);
    }
  } catch (e) { /* DE: Inventar fehlt / EN: inventory missing */ }

  try {
    const items = sandkit.state.sandkit && sandkit.state.sandkit.mods && sandkit.state.sandkit.mods.items;
    if (items && items[DEBUG_BRUSH_ID]) delete items[DEBUG_BRUSH_ID];
  } catch (e) { /* DE: Mod-Items nicht angefasst / EN: mod items left as they are */ }

  try {
    const manager = sandkit.state.environment
      && sandkit.state.environment.multithreading
      && sandkit.state.environment.multithreading.simulation
      && sandkit.state.environment.multithreading.simulation.manager;
    if (manager && typeof manager.postMessage === 'function') {
      manager.postMessage([SIM_SPEED_MESSAGE, 1]);
    }
  } catch (e) { /* DE: Simulations-Thread nicht erreichbar / EN: simulation thread not reachable */ }

  try { writeSetting('debugMode', false); } catch (e) { /* ignore */ }
  rulesCache = null;

  if (wasActive) {
    log('Debug- und Cinematik-Zustand ausgeschaltet - der Lauf bleibt ungueltig');
    try { api.ui.toast({ key: 'mods|goldSpeedrun|toast|debugDeactivated' }); } catch (e) { /* ignore */ }
  }

  for (const id of ['Options', 'CinematicPanel', 'Root', 'Menu', 'ModsScreen']) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* DE: Komponente inaktiv / EN: component not active */ }
  }
  try { notifyResult(); } catch (e) { /* DE: Dashboard noch nicht da / EN: dashboard not ready yet */ }
};

// DE: Die Mod-Einstellung schaltet nur Debug. Aus raeumt zusaetzlich Cinematik
// DE: und die anderen nicht erlaubten Zustaende ab. Der erste Blick (Standard
// DE: aus) schaltet einen schon laufenden Debug-Modus nicht still ab - dafuer
// DE: ist der Knopf im HUD.
// EN: The mod setting toggles debug only. Off also clears cinematic mode and
// EN: the other disallowed states. The first look (default off) does not
// EN: silently kill a debug mode that is already running - the HUD button is
// EN: there for that.
const syncDebugSetting = () => {
  let want = false;
  try { want = api.settings.get('debugMode') === true; } catch (e) { return; }
  if (debugSettingApplied === want) return;
  const prev = debugSettingApplied;
  debugSettingApplied = want;
  if (prev === null && !want) return;
  if (want) activateDebugMode();
  else deactivateDisallowedEngineStates();
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
  if (!modEnabled()) {
    log('Start verweigert: Mod aus');
    return false;
  }
  if (Date.now() < suppressUntil) {
    log('Start verweigert: suppressUntil', { reason, remainingMs: suppressUntil - Date.now() });
    return false;
  }
  if (uiBlocksStart()) {
    log('Start verweigert: Intro-Bildschirm', { reason });
    return false;
  }
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
  if (activeScene() !== enums.Scene.Game) {
    log('Start verweigert: Szene ist nicht Game', { reason, scene: activeScene() });
    return false;
  }
  if (!isArmed()) {
    log('Start verweigert: nicht scharf', { reason });
    return false;
  }

  // DE: Schon geschaffte Spielstaende (Creative, 1M Gold, fertige Karte) duerfen
  // DE: keinen Lauf starten - sonst endet er in Millisekunden und stoert die PB.
  // EN: Saves that already beat the goal (creative, 1M gold, finished map)
  // EN: must not start a run - otherwise it ends in milliseconds and disturbs the PB.
  const cat = category();
  if (allGoalsMet(cat) || goldAlreadyStocked(cat)) {
    log('Ziel bereits erreicht - Lauf wird nicht gestartet');
    return false;
  }

  if (benchState.running) {
    log('Start verweigert: Benchmark laeuft', { reason });
    cancelMetricBenchmark();
    return false;
  }
  const startedAt = now();
  startClocks();
  api.storage.set(NS, 'startedAt', startedAt);
  api.storage.set(NS, 'finishedAt', null);
  api.storage.set(NS, 'startedAtWall', Date.now());
  api.storage.set(NS, 'finishedAtWall', null);
  api.storage.set(NS, 'splits', []);
  api.storage.set(NS, 'goldMarkIndex', 0);
  api.storage.set(NS, 'official', rulesetStatus().ok);
  api.storage.set(NS, 'officialBroken', false);
  if (api.storage.get(NS, 'blueprintsUsed') !== true) {
    api.storage.set(NS, 'blueprintsUsed', false);
  }
  resetEarned();
  resetFluxiteEarned();
  resetEnergyEarned();
  resetGoldRate();
  api.storage.set(NS, 'goalHits', []);
  setResultDismissed(true);
  requestHeatmapReset();

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
  if (!isArmed()) return;
  if (!payload || !payload.action) return;   // DE: Klick ohne aktives Werkzeug / EN: click without an active tool
  startRun('Aktion');
});

api.hooks.intercept('building:place', () => {
  if (isArmed()) startRun('Bauen');
});

api.hooks.intercept('progression:purchase', () => {
  if (isArmed()) startRun('Forschen');
});

// --- DE: Blueprint- und Zwischenablage-Hooks / EN: Blueprint and clipboard hooks ---
let blueprintHooksInstalled = false;
const installBlueprintHooks = () => {
  if (blueprintHooksInstalled) return true;
  try {
    const eng = sandkit.engine && sandkit.engine.api;
    if (!eng) return false;
    const bp = eng.blueprints;
    const cb = eng.clipboard;
    if (!bp && !cb) return false;

    // 1. Wrap blueprints.importString
    if (bp && typeof bp.importString === 'function' && !bp.importString.__gsWrapped) {
      const origImport = bp.importString;
      bp.importString = function(str) {
        if (isArmed() || isRunning()) {
          markBlueprintsUsed('import_string');
        }
        return origImport.apply(this, arguments);
      };
      bp.importString.__gsWrapped = true;
    }

    // 2. Wrap blueprints.load
    if (bp && typeof bp.load === 'function' && !bp.load.__gsWrapped) {
      const origLoad = bp.load;
      bp.load = function(id) {
        if (isArmed() || isRunning()) {
          markBlueprintsUsed('blueprint_load');
        }
        return origLoad.apply(this, arguments);
      };
      bp.load.__gsWrapped = true;
    }

    // 3. Wrap blueprints.save
    if (bp && typeof bp.save === 'function' && !bp.save.__gsWrapped) {
      const origSave = bp.save;
      bp.save = function(name, data, signalLinks) {
        if (isArmed() || isRunning()) {
          markBlueprintsUsed('blueprint_save');
        }
        return origSave.apply(this, arguments);
      };
      bp.save.__gsWrapped = true;
    }

    // 4. Wrap blueprints.exportString
    if (bp && typeof bp.exportString === 'function' && !bp.exportString.__gsWrapped) {
      const origExportString = bp.exportString;
      bp.exportString = function(id) {
        if (isArmed() || isRunning()) {
          markBlueprintsUsed('blueprint_export');
        }
        return origExportString.apply(this, arguments);
      };
      bp.exportString.__gsWrapped = true;
    }

    // 5. Wrap blueprints.exportAllString
    if (bp && typeof bp.exportAllString === 'function' && !bp.exportAllString.__gsWrapped) {
      const origExportAllString = bp.exportAllString;
      bp.exportAllString = function() {
        if (isArmed() || isRunning()) {
          markBlueprintsUsed('blueprint_export_all');
        }
        return origExportAllString.apply(this, arguments);
      };
      bp.exportAllString.__gsWrapped = true;
    }

    // 6. Wrap clipboard.selectFromHistory
    if (cb && typeof cb.selectFromHistory === 'function' && !cb.selectFromHistory.__gsWrapped) {
      const origSelectFromHistory = cb.selectFromHistory;
      cb.selectFromHistory = function(id) {
        if (isArmed() || isRunning()) {
          markBlueprintsUsed('clipboard_history');
        }
        return origSelectFromHistory.apply(this, arguments);
      };
      cb.selectFromHistory.__gsWrapped = true;
    }

    // 7. Wrap clipboard.set for session copy tracking
    if (cb && typeof cb.set === 'function' && !cb.set.__gsWrapped) {
      const origSet = cb.set;
      cb.set = function(structures, signalLinks) {
        handleClipboardSet(structures, signalLinks);
        return origSet.apply(this, arguments);
      };
      cb.set.__gsWrapped = true;
    }

    const bpReady = !bp || !!(bp.importString && bp.importString.__gsWrapped);
    const cbReady = !cb || !!(cb.set && cb.set.__gsWrapped);

    if (bp && cb && bpReady && cbReady) {
      blueprintHooksInstalled = true;
      log('Blueprint-Hooks erfolgreich installiert');
      return true;
    }
  } catch (e) {
    log('Fehler beim Installieren der Blueprint-Hooks:', e);
  }
  return false;
};

api.events.on('structures:pasted', payload => {
  if (!isArmed() && !isRunning()) return;
  if (runUsesBlueprints()) return;

  const placed = (payload && Array.isArray(payload.structures)) ? payload.structures : [];
  if (placed.length === 0) return;

  if (sessionCopyOk) {
    return;
  }

  markBlueprintsUsed('unverified_paste');
});

// Try installing immediately
installBlueprintHooks();

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
  const index = getArtifactsFound() + 1;
  return {
    kind: 'artifact',
    label: t('mods|goldSpeedrun|split|artifact', { index }),
    id: `artifact:${index}`,
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

// DE: Wird beim Start auf true gesetzt, beim Beenden auf false.
// EN: Set to true at start, false at finish.
let resultDismissed = true;
let triggerPanelOpen = false;
let openedF3FromDashboard = false;

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

// DE: Ungueltigen Lauf verwerfen und auf den Neutralzustand (scharf / Waiting)
// DE: zuruecksetzen. Kein finishedAt, keine Splits, kein Ergebnis-Dashboard.
// EN: Discard an invalid run and reset to the neutral (armed / waiting) state.
// EN: No finishedAt, no splits, no result dashboard.
const discardRun = reason => {
  api.storage.set(NS, 'startedAt', null);
  api.storage.set(NS, 'finishedAt', null);
  api.storage.set(NS, 'startedAtWall', null);
  api.storage.set(NS, 'finishedAtWall', null);
  api.storage.set(NS, 'splits', []);
  api.storage.set(NS, 'goldMarkIndex', 0);
  api.storage.set(NS, 'official', false);
  api.storage.set(NS, 'officialBroken', false);
  startClocks();
  resetHistory();
  resetEarned();
  resetFluxiteEarned();
  resetEnergyEarned();
  resetGoldRate();
  setResultDismissed(true);
  log(reason);
};

// DE: Beim Laden: gespeicherte Schein-Laeufe (unter 1:00 oder schon am Ziel
// DE: laufend) verwerfen, damit sie nicht jedes Mal wieder angezeigt werden.
// EN: On load: discard stored bogus runs (under 1:00, or already at the goal
// EN: while still "running") so they do not reappear every reload.
const sanitizeLoadedRun = () => {
  const run = readRun();
  if (typeof run.finishedAt === 'number' && scoredTime() < MIN_PB_MS) {
    discardRun('Beim Laden erkannt: ungueltiger Lauf verworfen');
    return;
  }
  if (typeof run.startedAt === 'number' && typeof run.finishedAt !== 'number') {
    const cat = category();
    if (allGoalsMet(cat)) {
      discardRun('Beim Laden erkannt: ungueltiger Lauf verworfen');
    }
  }
};

const finishRun = cat => {
  // DE: Alle drei Uhren werden im selben Moment abgelesen, bevor der Lauf als
  // DE: beendet markiert wird - danach zaehlt advanceClocks() nicht mehr weiter.
  // EN: All three clocks are read at the same instant, before the run is
  // EN: marked finished - after that, advanceClocks() no longer keeps counting.
  const time = scoredRealTime();
  const simTime = elapsedSim();
  const playTime = elapsedPlay();
  const scored = scoredTime();
  const slowdown = slowdownPercent();
  const deficit = tickDeficit();

  // DE: Unter 1:00 und kein Cheat-/Regelbruch-Fall: nicht aufzeichnen, nicht anzeigen.
  // EN: Under 1:00 and not a cheats/broken-rules case: do not record or display.
  let cheated = false;
  let broken = false;
  try { cheated = cheatsUsed(); } catch (e) { /* ignore */ }
  try { broken = runRulesBroken(); } catch (e) { /* ignore */ }
  if (!(scored >= MIN_PB_MS) && !cheated && !broken) {
    const fmt = timeFormat();
    discardRun('Lauf zu kurz / bereits geschafft - nicht angezeigt');
    api.ui.toast({ key: 'mods|goldSpeedrun|pbTooShort', params: { time: formatTime(scored, fmt) } });
    return;
  }

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

  const curB = rawBallisticBlocks();
  const curM = rawBallisticMoves();
  const startB = readClock('upsBlocksStart');
  const startM = readClock('upsMovesStart');
  const dB = Math.max(0, curB - startB);
  const dM = Math.max(0, curM - startM);
  const finalJam = (dB + dM > 0) ? (dB / (dB + dM)) * 100 : 0;
  const finalJamLoad = liveU() > 0 ? (dB / liveU()) : 0;
  api.storage.set(NS, 'upsBlocksFinal', curB);
  api.storage.set(NS, 'upsMovesFinal', curM);
  api.storage.set(NS, 'upsJamRateFinal', finalJam);
  api.storage.set(NS, 'upsJamShareFinal', finalJam);
  api.storage.set(NS, 'upsJamLoadFinal', finalJamLoad);

  api.storage.set(NS, 'finishedAt', now());
  api.storage.set(NS, 'finishedAtWall', Date.now());
  flushHistoryToSave();

  const fmt = timeFormat();
  api.ui.toast({ key: 'mods|goldSpeedrun|done', params: { time: formatTime(playTime, fmt) } });

  if (cheatsUsed()) {
    log('Lauf beendet in', formatTime(playTime, 'millis'),
      '- ACHTUNG: Cheats wurden in diesem Spielstand benutzt, keine Bestzeit gespeichert.');
  } else if (runRulesBroken()) {
    // DE: Wer mitten im Lauf am Regelwerk dreht, misst nicht mehr dasselbe wie
    // DE: alle anderen unter diesem Schluessel. Die Zeit bleibt sichtbar, sie
    // DE: wird nur nicht abgelegt.
    // EN: Anyone who changes the ruleset mid-run is no longer measuring the
    // EN: same thing as everyone else under this key. The time stays
    // EN: visible, it just doesn't get saved.
    log('Lauf beendet in', formatTime(playTime, 'millis'),
      '- ACHTUNG: Regelwerk waehrend des Laufs verstellt, keine Bestzeit gespeichert.');
  } else {
    const best = readBest();
    if (scored >= MIN_PB_MS && (best === null || scored < best)) {
      commitBestFor(category(), scored, splits, 'in_game', '');
      api.ui.toast({ key: 'mods|goldSpeedrun|newBest', params: { time: formatTime(scored, fmt) } });
    } else if (scored >= MIN_PB_MS && readBestSplits().length === 0 && best !== null && Math.abs(scored - best) < 50) {
      writeBestSplits(splits);
    } else if (!(scored > 0)) {
      log('Lauf beendet, aber Spielzeit-Uhr war 0 - Bestzeit nicht geschrieben.');
    }
  }

  setResultDismissed(false);

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
    jamRatePercent: Math.round(finalJam * 100) / 100,
    jamLoad: Math.round(finalJamLoad * 1000) / 1000,
    // DE: Schritte, die einer idealen 60-UPS-Maschine gefehlt haben.
    // EN: Steps a perfect 60-UPS machine would have been missing.
    tickDeficit: Math.round(deficit),
    tickSourceReady: tickSourceReady(),
    splits: splits.map(s =>
      `${formatTime(s.t, 'millis')}  (sim ${formatTime(Number.isFinite(s.sim) ? s.sim : s.t, 'millis')})  ${displaySplitLabel(s, splits)}  ${s.gold} Gold`),
    cheatsUsed: cheatsUsed(),
    debugUsed: (() => {
      try { return api.storage.get(NS, 'debugUsed') === true; } catch (e) { return false; }
    })(),
    blueprintsUsed: runUsesBlueprints(),
    mods,
  });
};

const goalHitId = goal => `${goal.kind}:${goalTargetOf(goal)}`;

const notePartialGoalHits = cat => {
  if (allGoalsMet(cat)) return;
  let hits = api.storage.get(NS, 'goalHits');
  if (!Array.isArray(hits)) hits = [];
  let changed = false;
  categoryGoals(cat).forEach(goal => {
    if (!goal || goal.kind === 'factory' || !goalMet(goal)) return;
    const id = goalHitId(goal);
    if (hits.indexOf(id) >= 0) return;
    hits.push(id);
    changed = true;
    addSplit(goal.kind, goalPartLabel(goal), id);
  });
  if (changed) api.storage.set(NS, 'goalHits', hits);
};

const checkGoal = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return;
  if (typeof run.finishedAt === 'number') return; // DE: schon durch / EN: already finished

  const cat = category();
  const goals = categoryGoals(cat);
  if (goals.length === 0 || goals.every(g => !(goalTargetOf(g) > 0))) return;

  // DE: Ziel schon in den ersten Momenten = bereits geschaffter Spielstand, kein Lauf.
  // EN: Goal already met in the first moments = already-beaten save, not a run.
  if (allGoalsMet(cat) && elapsedPlay() < LOAD_ARTIFACT_MS) {
    discardRun('Ziel schon beim Start erreicht (Load-Artefakt)');
    return;
  }

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

  notePartialGoalHits(cat);
  if (allGoalsMet(cat)) finishRun(cat);
};

api.events.on('frame:render', () => {
  // DE: Vor allem anderen und vor der Pruefung auf den Schalter der Mod-Verwaltung:
  // DE: advanceClocks() rechnet mit dem Abstand zum letzten Aufruf, ein
  // DE: uebersprungener Frame wuerde diesen Abstand aufblaehen.
  // EN: Before anything else, and before checking the mod-manager switch:
  // EN: advanceClocks() works off the gap since the last call, and a skipped
  // EN: frame would inflate that gap.
  advanceClocks();

  if (!blueprintHooksInstalled) installBlueprintHooks();

  if (!modEnabled()) return;

  // DE: Jeden Frame messen, damit kurz aufeinander folgendes Einnehmen und Ausgeben
  // DE: nicht durch das Raster faellt. Kostet nur einen Zahlenvergleich.
  // EN: Sampled every frame so quick back-to-back earning and spending
  // EN: doesn't fall through the cracks. Costs only a number comparison.
  if (goldMode() === 'earned') sampleEarned();
  sampleFluxiteEarned();
  sampleEnergyEarned();
  sampleGoldRate();

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
  flagSaveForDisallowedEngine();

  // DE: Laufsumme gedrosselt in den Spielstand schreiben.
  // EN: Write the running total to the save, throttled.
  if (stamp - lastWrite < 500) return;
  lastWrite = stamp;

  // DE: Doppelter Boden fuer den Fall, dass eine Aenderung ohne onChange kommt.
  // EN: A safety net in case a change arrives without an onChange event.
  syncActiveFromPresetSetting();

  if (earnedTotal !== null) api.storage.set(NS, 'earned', earnedTotal);
  if (fluxiteEarnedTotal !== null) api.storage.set(NS, 'fluxiteEarned', fluxiteEarnedTotal);
  if (energyEarnedTotal !== null) api.storage.set(NS, 'energyEarned', energyEarnedTotal);
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

// DE: Ganze Pixel pro Groessenstufe - keine Zwischenwerte, kein CSS-scale,
// DE: damit der Stream-Overlay nicht verwischt.
// EN: Whole pixels per size step - no in-between values, no CSS scale,
// EN: so the stream overlay stays sharp.
const STREAMER_PX = {
  bigTime:  [28, 36, 46, 58, 72, 88],
  split:    [14, 18, 22, 27, 33, 40],
  delta:    [14, 18, 22, 27, 33, 40],
  slowdown: [14, 17, 21, 25, 30, 36],
};

const SECONDARY_PX = {
  meta:    [11, 13, 15],
  deficit: [11, 13, 15],
  badge:   [10, 12, 14],
  footer:  [11, 13, 15],
};

const spx = role => {
  const row = STREAMER_PX[role];
  return row ? row[streamerScaleIndex()] : 18;
};

const npx = role => {
  const row = SECONDARY_PX[role];
  return row ? row[secondaryScaleIndex()] : 11;
};

const sfont = (role, weight, lh) => `${weight || 500} ${spx(role)}px/${lh || 1.2} system-ui, sans-serif`;
const nfont = (role, weight, lh) => `${weight || 500} ${npx(role)}px/${lh || 1.25} system-ui, sans-serif`;

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
    const fn = () => bump(n => (n + 1) % 1000);
    const id = setInterval(fn, HUD_INTERVAL[fmt] || 50);
    resultListeners.add(fn);
    return () => {
      clearInterval(id);
      resultListeners.delete(fn);
    };
  }, [fmt]);
};

// DE: Eine Zeile der Split-Tabelle. LiveSplit: Abschnittsdauer und Split-Delta
// DE: gegen die Vergleichsroute (W). Im HUD zaehlt das aktuelle Split-Delta live.
// EN: One row of the split table. LiveSplit: segment duration and split delta
// EN: versus the comparison route (W). In the HUD the current split delta runs live.
function SplitRow({ split, previous, fmt, wide, pb, bests, current, liveDelta, scalePx }) {
  const upcoming = split.upcoming === true;
  const liveMs = splitMs(split);
  const live = Number.isFinite(liveMs);
  const prevMs = previous ? splitMs(previous) : 0;
  const prevOk = Number.isFinite(prevMs) ? prevMs : 0;
  const segment = live ? liveMs - prevOk : 0;
  const routeMs = pb ? splitMs(pb) : NaN;
  const routeOk = Number.isFinite(routeMs);
  const px = Number.isFinite(scalePx) ? Math.round(scalePx) : 0;

  let delta = null;
  if (liveDelta && routeOk && isRunning()) {
    delta = viewedElapsed() - routeMs;
  } else if (live && routeOk) {
    delta = liveMs - routeMs;
  }

  const isSeq = split.kind === 'rank' || split.kind === 'goal' || split.kind === 'gold';
  const goldSeg = !!(bests && live && (
    (isSeq && bests.seq && bests.seq[split.id] !== undefined && (liveMs - prevOk) <= bests.seq[split.id] + 0.5)
    || (!isSeq && bests.abs && bests.abs[split.id] !== undefined && liveMs <= bests.abs[split.id] + 0.5)
  ));

  const cell = (key, value, style) => h('span', { key, style }, value);
  const deltaText = delta !== null
    ? (delta >= 0 ? '+' : '-') + formatShort(Math.abs(delta), fmt)
    : '';
  const deltaColor = delta === null ? COLORS.dim : delta <= 0 ? COLORS.green : COLORS.red;
  const timeMin = wide ? undefined : (px ? (px * 7) + 'px' : '92px');
  const deltaMin = wide ? '72px' : (px ? (px * 5) + 'px' : '64px');

  return h('div', {
    style: {
      display: wide ? 'grid' : 'flex',
      gridTemplateColumns: wide ? '1fr 110px 110px 110px 92px' : undefined,
      gap: wide ? '12px' : (px ? Math.max(8, Math.round(px * 0.4)) + 'px' : '8px'),
      alignItems: 'baseline',
      padding: wide ? '8px 6px' : (px ? '2px 0' : '1px 0'),
      borderBottom: wide ? '1px solid rgba(255,255,255,0.04)' : 'none',
      fontVariantNumeric: 'tabular-nums',
      fontSize: px ? px + 'px' : (wide ? '15px' : undefined),
      opacity: upcoming && !liveDelta && !current ? 0.55 : 1,
    },
  }, [
    cell('label', split.label, {
      flex: wide ? undefined : 1,
      minWidth: 0,
      color: upcoming ? COLORS.dim : (KIND_COLOR[split.kind] || COLORS.text),
      fontWeight: current ? 700 : (split.kind === 'goal' && !upcoming ? 800 : (wide ? 600 : 500)),
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }),
    wide
      ? cell('seg', live && segment >= 0 ? formatShort(segment, fmt) : '—', {
          color: COLORS.dim, minWidth: '72px', textAlign: 'right', fontSize: '14px',
        })
      : null,
    cell('time', live
      ? formatTime(liveMs, fmt)
      : (routeOk ? formatTime(routeMs, fmt) : '—'), {
      minWidth: timeMin, textAlign: 'right',
      color: upcoming ? COLORS.dim : '#ffffff',
      fontWeight: wide || current ? 600 : undefined,
    }),
    wide
      ? cell('delta', deltaText || '—', {
          color: deltaColor, minWidth: '72px', textAlign: 'right', fontWeight: 700,
        })
      : null,
    wide
      ? cell('gold', live ? formatGold(split.gold) : '', {
          color: COLORS.gold, minWidth: '76px', textAlign: 'right',
          fontWeight: 600,
        })
      : cell('delta', deltaText, {
          color: goldSeg ? COLORS.gold : deltaColor,
          minWidth: deltaMin, textAlign: 'right',
          fontWeight: current ? 700 : undefined,
        }),
  ]);
}

function SplitTable({ splits, fmt, wide, pbSplits, scalePx }) {
  const pbs = Array.isArray(pbSplits) ? pbSplits : readComparisonSplits();
  const bests = readGlobalBests();
  let anchorIdx = -1;
  if (!wide) {
    anchorIdx = splits.findIndex(s => s && s.upcoming === true && isMandatory(s)
      && findPbSplit(s, pbs) && Number.isFinite(splitMs(findPbSplit(s, pbs))));
    if (anchorIdx < 0) {
      anchorIdx = splits.findIndex(s => s && s.upcoming === true
        && findPbSplit(s, pbs) && Number.isFinite(splitMs(findPbSplit(s, pbs))));
    }
  }
  const px = Number.isFinite(scalePx) ? Math.round(scalePx) : 0;
  return h('div', { style: { display: 'flex', flexDirection: 'column', fontSize: px ? px + 'px' : undefined } },
    splits.map((s, i) => {
      const upcoming = !!(s && s.upcoming === true);
      const pb = findPbSplit(s, pbs);
      const hasRoute = !!(pb && Number.isFinite(splitMs(pb)));
      const liveDelta = !wide && upcoming && hasRoute && (anchorIdx < 0 || i <= anchorIdx);
      return h(SplitRow, {
        key: i,
        split: { ...s, label: displaySplitLabel(s, splits) },
        previous: i > 0 ? splits[i - 1] : null,
        fmt,
        wide,
        pb,
        bests,
        current: i === anchorIdx,
        liveDelta,
        scalePx: px || undefined,
      });
    }));
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
const HIGHRES_MAX_SAMPLES = 3000;  // DE: 3000 x 100 ms = 300 s (5 min) hochaufloesender Ringspeicher / EN: 5 min high-res ring buffer

let sparklineBuckets = [];    // DE: abgeschlossene 1-s-Eimer, Farbe bleibt / EN: finalized 1 s buckets, color stays
let sparklineAccum = null;    // DE: laufender Live-Eimer / EN: current live bucket
let bucketAccum = null;       // DE: laufender 1-Hz-Eimer / EN: running 1 Hz bucket
let historyBuf = [];          // DE: { min, max, avg, blocks, moves, awake, live, simMs }[] - kompletter Lauf
let highResBuffer = [];       // DE: 10 Hz hochaufloesende Messpunkte fuer Diagnose / EN: 10 Hz diagnostic samples
let lastHistorySample = null; // DE: { tick, atMs, blocks, moves }

const trackHistoryEnabled = () => monitoringMode() !== 'off';
const liveSparklineEnabled = () => api.settings.get('showLiveSparkline') === true;

const loadHistoryFromSave = () => {
  const v = api.storage.get(NS, 'upsHistory');
  historyBuf = Array.isArray(v)
    ? v.filter(b => b && Number.isFinite(b.avg)).map(b => {
      const avgUps = Number.isFinite(b.avg) ? b.avg : 60;
      const spanMs = Number.isFinite(b.spanMs) && b.spanMs > 0 ? b.spanMs : 1000;
      const ticks = Number.isFinite(b.ticks) ? b.ticks : Math.max(0, Math.round(avgUps * (spanMs / 1000)));
      return {
        relMs: Number.isFinite(b.relMs) ? b.relMs : 0,
        spanMs,
        ticks,
        min: Number.isFinite(b.min) ? b.min : b.avg,
        max: Number.isFinite(b.max) ? b.max : b.avg,
        avg: b.avg,
        blocks: Number.isFinite(b.blocks) ? b.blocks : 0,
        moves: Number.isFinite(b.moves) ? b.moves : 0,
        allBlocks: Number.isFinite(b.allBlocks) ? b.allBlocks : null,
        allMoves: Number.isFinite(b.allMoves) ? b.allMoves : null,
        awake: Number.isFinite(b.awake) ? b.awake : 0,
        live: Number.isFinite(b.live) ? b.live : 0,
        simMs: Number.isFinite(b.simMs) ? b.simMs : 0,
        computeMs: Number.isFinite(b.computeMs) ? b.computeMs : 0,
        waitMs: Number.isFinite(b.waitMs) ? b.waitMs : 0,
        postMs: Number.isFinite(b.postMs) ? b.postMs : 0,
        slowestMs: Number.isFinite(b.slowestMs) ? b.slowestMs : 0,
        slowestX: Number.isFinite(b.slowestX) ? b.slowestX : -1,
        slowestY: Number.isFinite(b.slowestY) ? b.slowestY : -1,
        gold: Number.isFinite(b.gold) ? b.gold : null,
        hits: Array.isArray(b.hits) ? b.hits : null,
      };
    })
    : [];
  const curWorldTime = now();
  if (historyBuf.length > 0) {
    const hasValidRel = historyBuf.some(b => Number.isFinite(b.relMs) && b.relMs > 0);
    if (!hasValidRel) {
      const len = historyBuf.length;
      const stepMs = 1000;
      const endMs = curWorldTime > 0 ? curWorldTime : Math.max(0, (len - 1) * stepMs);
      for (let i = 0; i < len; i++) {
        historyBuf[i].relMs = Math.max(0, endMs - (len - 1 - i) * stepMs);
      }
    }
  }
  bucketAccum = null;
  const spark = api.storage.get(NS, 'upsSparkline');
  sparklineBuckets = Array.isArray(spark) ? spark.filter(b => b && Number.isFinite(b.avg)) : [];
  sparklineAccum = null;
};

const flushHistoryToSave = () => {
  api.storage.set(NS, 'upsHistory', historyBuf);
  api.storage.set(NS, 'upsSparkline', sparklineBuckets);
  if (!pendingHeatmapRestore) {
    const snap = getSparseHeatmapSnapshot();
    if (heatmapSnapshotHasData(snap)) api.storage.set(NS, 'heatmapSnapshot', snap);
  }
};

const resetHistory = () => {
  sparklineBuckets = [];
  sparklineAccum = null;
  bucketAccum = null;
  historyBuf = [];
  highResBuffer = [];
  lastHistorySample = null;
  lastHistorySumGrid.fill(0);
  rawSyncInitialized = false;
  totalBallisticBlocks = 0;
  totalBallisticMoves = 0;
  totalAllBlocks = 0;
  totalAllMoves = 0;
  api.storage.set(NS, 'upsHistory', []);
  api.storage.set(NS, 'upsSparkline', []);
  api.storage.set(NS, 'heatmapSnapshot', null);
  requestHeatmapReset();
};

const finalizeSparklineBucket = accum => ({
  min: Math.round(accum.min * 10) / 10,
  max: Math.round(accum.max * 10) / 10,
  avg: Math.round((accum.sum / accum.n) * 10) / 10,
  blocks: accum.blocks || 0,
  moves: accum.moves || 0,
  awake: Math.round((accum.awakeMax !== undefined ? accum.awakeMax : ((accum.awakeSum || 0) / accum.n)) * 10) / 10,
  live: Math.round(accum.liveMax !== undefined ? accum.liveMax : ((accum.liveSum || 0) / accum.n)),
  simMs: Math.round((accum.simMsMax !== undefined ? accum.simMsMax : ((accum.simMsSum || 0) / accum.n)) * 10) / 10,
});

const sparklineColumns = () => {
  const out = sparklineBuckets.slice();
  if (sparklineAccum && sparklineAccum.n > 0) out.push(finalizeSparklineBucket(sparklineAccum));
  return out;
};

const mergeHits = (h1, h2) => {
  if (!h1 && !h2) return null;
  if (!h1) return h2;
  if (!h2) return h1;
  const m = new Map(h1);
  for (let j = 0; j < h2.length; j++) {
    const [gi, ms] = h2[j];
    m.set(gi, (m.get(gi) || 0) + ms);
  }
  return Array.from(m.entries());
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
    const aHasAll = a.allBlocks !== null && a.allBlocks !== undefined;
    const bHasAll = b.allBlocks !== null && b.allBlocks !== undefined;
    merged.push({
      relMs: a.relMs !== undefined ? a.relMs : (b.relMs !== undefined ? b.relMs : 0),
      spanMs: (a.spanMs || 1000) + (b.spanMs || 1000),
      ticks: (a.ticks || 0) + (b.ticks || 0),
      min: Math.min(a.min, b.min),
      max: Math.max(a.max, b.max),
      avg: Math.round(((a.avg + b.avg) / 2) * 10) / 10,
      blocks: (a.blocks || 0) + (b.blocks || 0),
      moves: (a.moves || 0) + (b.moves || 0),
      allBlocks: (aHasAll && bHasAll) ? (a.allBlocks + b.allBlocks) : null,
      allMoves: (aHasAll && bHasAll) ? (a.allMoves + b.allMoves) : null,
      allBlocksSettled: (aHasAll && bHasAll) ? ((a.allBlocksSettled || 0) + (b.allBlocksSettled || 0)) : null,
      allBlocksActive: (aHasAll && bHasAll) ? ((a.allBlocksActive || 0) + (b.allBlocksActive || 0)) : null,
      awake: Math.max(a.awake || 0, b.awake || 0),
      live: Math.max(a.live || 0, b.live || 0),
      simMs: Math.max(a.simMs || 0, b.simMs || 0),
      gold: Number.isFinite(b.gold) ? b.gold : (Number.isFinite(a.gold) ? a.gold : null),
      ...mergeCausePreferHotter(a, b),
      hits: mergeHits(a.hits, b.hits),
    });
  }
  if (historyBuf.length % 2 === 1) merged.push(historyBuf[historyBuf.length - 1]);
  historyBuf = merged;
};

const sampleHistoryTick = () => {
  if (!benchState.running) syncAllMatterCaptureControl();
  retryHeatmapRestoreIfNeeded();
  if (gamePaused() || !rawTickSourceReady()) {
    if (benchState.running) cancelMetricBenchmark();
    lastHistorySample = null;
    return;
  }
  if (!monitoringEnabled() && !benchState.running) {
    lastHistorySample = null;
    return;
  }

  const atMs = performance.now();
  const tick = rawTick();
  const awake = rawAwakeChunks();
  const currBlocks = rawBallisticBlocks();
  const currMoves = rawBallisticMoves();
  const live = rawLiveElements();
  const simMs = rawSimTimeMs();
  const metricMask = activeMetricMask();
  const allBlocksActive = Boolean(metricMask & METRIC_ALL_BLOCKS);
  const allMovesActive = Boolean(metricMask & METRIC_ALL_MOVES);
  const currAllBlocks = rawAllMatterBlocks();
  const currAllMoves = rawAllMatterMoves();
  const currAllBlocksSettled = rawAllMatterBlocksSettled();
  const currAllBlocksActive = rawAllMatterBlocksActive();
  const phase = readPhaseSnapshot();
  const cause = causeFieldsFromPhase(phase);

  if (lastHistorySample) {
    const dtMs = atMs - lastHistorySample.atMs;
    const dTick = Math.max(0, tick - lastHistorySample.tick);
    const dBlocks = Math.max(0, currBlocks - (lastHistorySample.blocks || 0));
    const dMoves = Math.max(0, currMoves - (lastHistorySample.moves || 0));
    const dAllBlocks = allBlocksActive && lastHistorySample.allBlocks !== undefined
      ? Math.max(0, currAllBlocks - (lastHistorySample.allBlocks || 0))
      : null;
    const dAllMoves = allMovesActive && lastHistorySample.allMoves !== undefined
      ? Math.max(0, currAllMoves - (lastHistorySample.allMoves || 0))
      : null;
    const dAllBlocksSettled = allBlocksActive && lastHistorySample.allBlocksSettled !== undefined
      ? Math.max(0, currAllBlocksSettled - (lastHistorySample.allBlocksSettled || 0))
      : null;
    const dAllBlocksActive = allBlocksActive && lastHistorySample.allBlocksActive !== undefined
      ? Math.max(0, currAllBlocksActive - (lastHistorySample.allBlocksActive || 0))
      : null;

    if (dtMs > 0 && dTick >= 0) {
      const ups = (dTick / dtMs) * 1000;

      // DE: Die Diagnose-Achse folgt streng der Weltzeit (api.time.getTimeMs /
      // DE: store.meta.time), nicht der Speedrun-Uhr. Nach Laufende, Speichern
      // DE: und Laden laeuft sie genau dort weiter, wo die Welt steht.
      // EN: The diagnostic x-axis follows world time strictly (api.time.getTimeMs /
      // EN: store.meta.time), not the speedrun clock. After the goal, a save, and
      // EN: a reload it continues at the world's play-clock, not at finishedAt.
      const relMs = now();
      const goldSample = Math.floor(goldProgress());

      highResBuffer.push({
        timeMs: atMs,
        relMs,
        spanMs: Math.round(dtMs),
        ticks: dTick,
        ups: Math.round(ups * 10) / 10,
        min: Math.round(ups * 10) / 10,
        max: Math.round(ups * 10) / 10,
        avg: Math.round(ups * 10) / 10,
        blocks: dBlocks,
        moves: dMoves,
        allBlocks: dAllBlocks,
        allMoves: dAllMoves,
        allBlocksSettled: dAllBlocksSettled,
        allBlocksActive: dAllBlocksActive,
        awake,
        live,
        gold: goldSample,
        simMs,
        ...cause,
      });
      while (highResBuffer.length > HIGHRES_MAX_SAMPLES) highResBuffer.shift();
      const benchmarkWasRunning = benchState.running;
      tickMetricBenchmark(highResBuffer[highResBuffer.length - 1]);
      if (benchmarkWasRunning) {
        lastHistorySample = {
          tick,
          atMs,
          blocks: currBlocks,
          moves: currMoves,
          allBlocks: currAllBlocks,
          allMoves: currAllMoves,
          allBlocksSettled: currAllBlocksSettled,
          allBlocksActive: currAllBlocksActive,
        };
        return;
      }

      const wantSparkline = liveSparklineEnabled();
      if (wantSparkline) {
        if (!sparklineAccum) {
          sparklineAccum = { startMs: atMs, min: ups, max: ups, sum: ups, n: 1, blocks: dBlocks, moves: dMoves, awakeSum: awake, awakeMax: awake, liveSum: live, liveMax: live, simMsSum: simMs, simMsMax: simMs };
        } else {
          if (ups < sparklineAccum.min) sparklineAccum.min = ups;
          if (ups > sparklineAccum.max) sparklineAccum.max = ups;
          sparklineAccum.sum += ups;
          sparklineAccum.n += 1;
          sparklineAccum.blocks += dBlocks;
          sparklineAccum.moves += dMoves;
          sparklineAccum.awakeSum += awake;
          if (awake > (sparklineAccum.awakeMax || 0)) sparklineAccum.awakeMax = awake;
          sparklineAccum.liveSum += live;
          if (live > (sparklineAccum.liveMax || 0)) sparklineAccum.liveMax = live;
          sparklineAccum.simMsSum += simMs;
          if (simMs > (sparklineAccum.simMsMax || 0)) sparklineAccum.simMsMax = simMs;
        }
        if (atMs - sparklineAccum.startMs >= HISTORY_BUCKET_MS) {
          sparklineBuckets.push(finalizeSparklineBucket(sparklineAccum));
          sparklineAccum = null;
          while (sparklineBuckets.length > SPARKLINE_MAX_BUCKETS) sparklineBuckets.shift();
        }
      }

      // DE: 1-Hz-Verlauf immer sammeln, solange die Welt simuliert - auch nach dem Ziel.
      // EN: Always collect 1 Hz history while the world is simulating, including after the goal.
      if (!bucketAccum) {
        bucketAccum = {
          startMs: atMs,
          spanMs: dtMs,
          ticks: dTick,
          min: ups,
          max: ups,
          sum: ups,
          n: 1,
          blocks: dBlocks,
          moves: dMoves,
          hasAllMatter: dAllBlocks !== null,
          allBlocks: dAllBlocks || 0,
          allMoves: dAllMoves || 0,
          allBlocksSettled: dAllBlocksSettled || 0,
          allBlocksActive: dAllBlocksActive || 0,
          awakeSum: awake,
          awakeMax: awake,
          liveSum: live,
          liveMax: live,
          simMsSum: simMs,
          simMsMax: simMs,
          computeMs: cause.computeMs,
          waitMs: cause.waitMs,
          postMs: cause.postMs,
          slowestMs: cause.slowestMs,
          slowestX: cause.slowestX,
          slowestY: cause.slowestY,
          gold: goldSample,
        };
      } else {
        if (ups < bucketAccum.min) bucketAccum.min = ups;
        if (ups > bucketAccum.max) bucketAccum.max = ups;
        bucketAccum.sum += ups;
        bucketAccum.n += 1;
        bucketAccum.spanMs = (bucketAccum.spanMs || 0) + dtMs;
        bucketAccum.ticks = (bucketAccum.ticks || 0) + dTick;
        bucketAccum.blocks += dBlocks;
        bucketAccum.moves += dMoves;
        if (dAllBlocks !== null) {
          bucketAccum.hasAllMatter = true;
          bucketAccum.allBlocks = (bucketAccum.allBlocks || 0) + dAllBlocks;
          bucketAccum.allMoves = (bucketAccum.allMoves || 0) + (dAllMoves || 0);
          bucketAccum.allBlocksSettled = (bucketAccum.allBlocksSettled || 0) + (dAllBlocksSettled || 0);
          bucketAccum.allBlocksActive = (bucketAccum.allBlocksActive || 0) + (dAllBlocksActive || 0);
        }
        bucketAccum.awakeSum += awake;
        if (awake > (bucketAccum.awakeMax || 0)) bucketAccum.awakeMax = awake;
        bucketAccum.liveSum += live;
        if (live > (bucketAccum.liveMax || 0)) bucketAccum.liveMax = live;
        bucketAccum.simMsSum += simMs;
        if (simMs > (bucketAccum.simMsMax || 0)) bucketAccum.simMsMax = simMs;
        const hotter = mergeCausePreferHotter(bucketAccum, cause);
        bucketAccum.computeMs = hotter.computeMs;
        bucketAccum.waitMs = hotter.waitMs;
        bucketAccum.postMs = hotter.postMs;
        bucketAccum.slowestMs = hotter.slowestMs;
        bucketAccum.slowestX = hotter.slowestX;
        bucketAccum.slowestY = hotter.slowestY;
        bucketAccum.gold = goldSample;
      }
      if (atMs - bucketAccum.startMs >= HISTORY_BUCKET_MS) {
        const chunkHits = [];
        if (heatmapBuf) {
          for (let i = 0; i < HEATMAP_CELLS; i++) {
            const cur = heatmapBuf[HEATMAP_SUM_OFF + i] | 0;
            const prev = lastHistorySumGrid[i] | 0;
            if (cur > prev) {
              chunkHits.push([i, cur - prev]);
              lastHistorySumGrid[i] = cur;
            } else if (cur < prev) {
              lastHistorySumGrid[i] = cur;
            }
          }
        }
        historyBuf.push({
          relMs,
          spanMs: Math.round(bucketAccum.spanMs || (atMs - bucketAccum.startMs)),
          ticks: bucketAccum.ticks || 0,
          min: Math.round(bucketAccum.min * 10) / 10,
          max: Math.round(bucketAccum.max * 10) / 10,
          avg: Math.round((bucketAccum.sum / bucketAccum.n) * 10) / 10,
          blocks: bucketAccum.blocks || 0,
          moves: bucketAccum.moves || 0,
          allBlocks: bucketAccum.hasAllMatter ? (bucketAccum.allBlocks || 0) : null,
          allMoves: bucketAccum.hasAllMatter ? (bucketAccum.allMoves || 0) : null,
          allBlocksSettled: bucketAccum.hasAllMatter ? (bucketAccum.allBlocksSettled || 0) : null,
          allBlocksActive: bucketAccum.hasAllMatter ? (bucketAccum.allBlocksActive || 0) : null,
          awake: Math.round((bucketAccum.awakeMax !== undefined ? bucketAccum.awakeMax : (bucketAccum.awakeSum / bucketAccum.n)) * 10) / 10,
          live: Math.round(bucketAccum.liveMax !== undefined ? bucketAccum.liveMax : (bucketAccum.liveSum / bucketAccum.n)),
          simMs: Math.round((bucketAccum.simMsMax !== undefined ? bucketAccum.simMsMax : (bucketAccum.simMsSum / bucketAccum.n)) * 10) / 10,
          computeMs: roundMs2(bucketAccum.computeMs),
          waitMs: roundMs2(bucketAccum.waitMs),
          postMs: roundMs2(bucketAccum.postMs),
          slowestMs: roundMs2(bucketAccum.slowestMs),
          slowestX: bucketAccum.slowestX,
          slowestY: bucketAccum.slowestY,
          gold: Number.isFinite(bucketAccum.gold) ? bucketAccum.gold : null,
          hits: chunkHits.length > 0 ? chunkHits : null,
        });
        bucketAccum = null;
        if (historyBuf.length > HISTORY_MAX_BUCKETS) downsampleHistory();
      }
    }
  }
  lastHistorySample = {
    tick,
    atMs,
    blocks: currBlocks,
    moves: currMoves,
    allBlocks: currAllBlocks,
    allMoves: currAllMoves,
    allBlocksSettled: currAllBlocksSettled,
    allBlocksActive: currAllBlocksActive,
  };
};

setInterval(sampleHistoryTick, HISTORY_SAMPLE_MS);

let lastHistoryFlush = 0;
const maybeFlushHistory = () => {
  const stamp = Date.now();
  if (stamp - lastHistoryFlush < 1000) return;
  lastHistoryFlush = stamp;
  retryHeatmapRestoreIfNeeded();
  flushHistoryToSave();
};

// DE: Reduziert eine Punktreihe auf eine feste Spaltenzahl fuer die Grafik - jede
// DE: Spalte behaelt Minimum, Maximum und Mittel ihres Abschnitts, damit kurze
// DE: Ausreisser (Ruckler) nicht in einem Durchschnitt verschwinden.
// EN: Reduces a series of points to a fixed number of columns for the graph -
// EN: each column keeps the minimum, maximum and average of its segment, so
// EN: brief outliers (stutters) don't vanish inside an average.
const downsampleToColumns = (items, cols, toStats) => {
  if (!items || items.length === 0) return [];
  if (items.length <= cols) {
    return items.map(toStats);
  }
  const per = items.length / cols;
  const out = [];
  for (let c = 0; c < cols; c++) {
    const start = Math.floor(c * per);
    const end = Math.max(start + 1, Math.floor((c + 1) * per));
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    let blocksSum = 0, movesSum = 0, awakeSum = 0, liveSum = 0, simMsSum = 0;
    for (let i = start; i < end && i < items.length; i++) {
      const v = toStats(items[i]);
      if (v.min < min) min = v.min;
      if (v.max > max) max = v.max;
      sum += v.avg !== undefined ? v.avg : (v.ups !== undefined ? v.ups : 0);
      blocksSum += v.blocks || 0;
      movesSum += v.moves || 0;
      awakeSum += v.awake || 0;
      liveSum += v.live || 0;
      simMsSum += v.simMs || 0;
      n++;
    }
    if (n === 0) continue;
    const midItem = items[Math.floor((start + end) / 2)] || {};
    out.push({
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round((sum / n) * 10) / 10,
      ups: Math.round((sum / n) * 10) / 10,
      blocks: blocksSum,
      moves: movesSum,
      awake: Math.round((awakeSum / n) * 10) / 10,
      live: Math.round(liveSum / n),
      simMs: Math.round((simMsSum / n) * 10) / 10,
      relMs: midItem.relMs !== undefined ? midItem.relMs : 0,
    });
  }
  return out;
};

const bucketStats = b => ({
  min: b.min !== undefined ? b.min : (b.ups !== undefined ? b.ups : 0),
  max: b.max !== undefined ? b.max : (b.ups !== undefined ? b.ups : 0),
  avg: b.avg !== undefined ? b.avg : (b.ups !== undefined ? b.ups : 0),
  ups: b.ups !== undefined ? b.ups : (b.avg !== undefined ? b.avg : 0),
  blocks: b.blocks || 0,
  moves: b.moves || 0,
  awake: b.awake || 0,
  live: b.live || 0,
  simMs: b.simMs || 0,
  relMs: b.relMs || 0,
});

let metricsOverlayOpen = false;
const metricsListeners = new Set();
const notifyMetrics = () => {
  metricsListeners.forEach(fn => {
    try { fn(); } catch (e) {}
  });
  if (typeof notifyPanel === 'function') notifyPanel();
};

const setMetricsOverlayOpen = v => {
  metricsOverlayOpen = !!v;
  notifyMetrics();
};

// DE: Dynamischer Min/Max-Umschlag mit gestrichelter 60er-Referenzlinie. Divs
// DE: statt Canvas/SVG - genuegt fuer ein paar Dutzend bis anderthalbhundert
// DE: Spalten und braucht keine zusaetzliche Zeichenflaeche. Klick oeffnet Vollbild.
// EN: Dynamic min/max envelope with a dashed reference line at 60.
// EN: Divs instead of Canvas/SVG - good enough for a few dozen up to about a
// EN: hundred and fifty columns, and needs no extra drawing surface. Click opens fullscreen.
function UpsEnvelopeGraph({ columns, height }) {
  const H = height || 90;
  if (!columns || columns.length === 0) {
    return h('div', {
      style: {
        height: `${H}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.dim, fontSize: '11px', textAlign: 'center', padding: '0 12px',
        cursor: 'pointer',
      },
      title: t('mods|goldSpeedrun|metrics|openBtn'),
      onClick: e => {
        e.stopPropagation();
        setMetricsOverlayOpen(true);
      },
    }, t(trackHistoryEnabled()
      ? 'mods|goldSpeedrun|graph|emptyRun'
      : 'mods|goldSpeedrun|graph|empty'));
  }
  const UPS_GRAPH_MAX = 90;
  const clampUps = v => Math.max(0, Math.min(UPS_GRAPH_MAX, Number.isFinite(v) ? v : 0));
  const scaleMax = UPS_GRAPH_MAX;
  const refTop = Math.max(0, Math.min(100, 100 - (TICK_HZ / scaleMax) * 100));
  const wPct = 100 / columns.length;
  const bars = columns.map((c, i) => {
    const minPct = Math.max(0, Math.min(100, (clampUps(c.min) / scaleMax) * 100));
    const maxPct = Math.max(minPct + 0.6, Math.min(100, (clampUps(c.max) / scaleMax) * 100));
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
      cursor: 'pointer',
    },
    title: t('mods|goldSpeedrun|metrics|openBtn'),
    onClick: e => {
      e.stopPropagation();
      setMetricsOverlayOpen(true);
    },
  }, [
    ...bars,
    h('div', {
      key: 'ref',
      style: { position: 'absolute', left: 0, right: 0, top: `${refTop}%`, borderTop: `1px dashed ${COLORS.dim}`, opacity: 0.5 },
    }),
    h('div', {
      key: 'refLabel',
      style: { position: 'absolute', right: '3px', top: `calc(${refTop}% + 1px)`, fontSize: '9px', color: COLORS.dim },
    }, String(TICK_HZ)),
  ]);
}

// DE: Kleine Metrik-Zeile fuer den erweiterten Block: Beschriftung links, Wert
// DE: rechts, beides klein und gedaempft.
// EN: Small metric row for the advanced block: label on the left, value on
// EN: the right, both small and muted.
function MetricLine({ label, value, color, fontSize }) {
  return h('div', {
    style: {
      display: 'flex', justifyContent: 'space-between', gap: '10px',
      fontSize: fontSize || '11px', color: COLORS.dim,
    },
  }, [
    h('span', { key: 'l' }, label),
    h('span', { key: 'v', style: { color: color || COLORS.text, fontVariantNumeric: 'tabular-nums' } }, value),
  ]);
}

const RulesBadge = ({ rules, fontSize }) => {
  if (!rules) return null;
  const invalid = !rules.ok && !rules.broken;
  return h('span', {
    style: {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: fontSize || '10px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: rules.ok ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
      color: rules.ok ? '#4ade80' : '#f87171',
      fontWeight: invalid || rules.broken ? 800 : 700,
    },
    title: rules.ok
      ? t('mods|goldSpeedrun|rules|ok')
      : rules.broken
        ? t('mods|goldSpeedrun|rules|brokenDesc')
        : t('mods|goldSpeedrun|rules|bad')
  }, rules.ok
    ? `✓ ${t('mods|goldSpeedrun|rules|badge')}`
    : rules.broken
      ? t('mods|goldSpeedrun|rules|broken')
      : t('mods|goldSpeedrun|rules|invalid'));
};

const DeactivateDebugButton = ({ fontSize }) => h('button', {
  onClick: () => deactivateDisallowedEngineStates(),
  style: {
    marginTop: '6px',
    pointerEvents: 'auto',
    cursor: 'pointer',
    background: 'rgba(224, 82, 82, 0.28)',
    border: '1px solid rgba(224, 82, 82, 0.75)',
    color: '#ffd0d0',
    fontWeight: 700,
    fontSize: fontSize || '11px',
    padding: '3px 8px',
    borderRadius: '4px',
  },
}, t('mods|goldSpeedrun|btn|deactivateDebug'));

const InvalidRunBanner = ({ view, fontSize }) => {
  const engineOn = isDebugActive() || isCinematicActive();
  const showList = !!(view && !view.ok && !view.broken);
  if (!showList && !engineOn) return null;
  const items = showList && Array.isArray(view.items) ? view.items.filter(i => !i.ok) : [];
  return h('div', {
    style: showList ? {
      marginTop: '4px',
      padding: '4px 6px',
      borderRadius: '4px',
      background: 'rgba(224, 82, 82, 0.22)',
      border: '1px solid rgba(224, 82, 82, 0.55)',
      color: COLORS.red,
      fontSize: fontSize || '11px',
      fontWeight: 800,
      letterSpacing: '0.02em',
      lineHeight: 1.25,
    } : { marginTop: '4px' },
  }, [
    showList ? h('div', { key: 'h' }, t('mods|goldSpeedrun|rules|invalidBanner')) : null,
    ...items.map(i => h('div', {
      key: i.id,
      style: { fontWeight: 600, fontSize: '10px', color: '#ffc0c0', marginTop: '2px' },
    }, `${i.label} — ${t('mods|goldSpeedrun|rules|need', { value: i.value })}`)),
    engineOn ? h(DeactivateDebugButton, { key: 'deactivateDebug', fontSize }) : null,
  ]);
};

const ModsBadge = ({ extraCount, extra, fontSize }) => {
  const clean = !(extraCount > 0);
  const names = Array.isArray(extra) ? extra.join(', ') : '';
  return h('span', {
    style: {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: fontSize || '10px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: clean ? 'rgba(74, 222, 128, 0.2)' : 'rgba(240, 192, 64, 0.16)',
      color: clean ? '#4ade80' : COLORS.gold,
    },
    title: names || t('mods|goldSpeedrun|mods|clean'),
  }, clean
    ? `✓ ${t('mods|goldSpeedrun|mods|clean')}`
    : t('mods|goldSpeedrun|mods|count', { count: extraCount }));
};

const BlueprintBadge = ({ fontSize }) => {
  return h('span', {
    style: {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: fontSize || '10px',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: 'rgba(74, 158, 255, 0.2)',
      color: COLORS.blue,
      fontWeight: 700,
    },
    title: t('mods|goldSpeedrun|dash|bpUsed'),
  }, `[${t('mods|goldSpeedrun|category|blueprints').toUpperCase()}]`);
};

const goalLine = goal => {
  const cur = progressOfGoal(goal);
  const target = goalTargetOf(goal);
  const met = target > 0 && cur >= target;
  const prefix = met ? '✓ ' : '';
  if (goal.kind === 'artifacts') {
    return prefix + t('mods|goldSpeedrun|artifacts', {
      current: cur,
      target: target > 0 ? target : '?',
    });
  }
  if (goal.kind === 'factory') {
    return prefix + t('mods|goldSpeedrun|factory', { current: cur, target });
  }
  const unit = goal.kind === 'fluxite' ? ' Fluxite'
    : goal.kind === 'energy' ? ' Energy'
    : goal.kind === 'aura' ? ' Aura' : '';
  return prefix + `${formatGold(cur)} / ${formatGold(target)}${unit}`;
};

const GOAL_ACCENT_COLORS = {
  gold: '#f0c040',       // Gold
  fluxite: '#a855f7',    // Deep Purple
  energy: '#f59e0b',     // Amber
  aura: '#38bdf8',       // Light Blue
  factory: '#34d399',    // Emerald Green
  artifacts: '#f43f5e',  // Ruby Rose
};

const goalAccentColor = kind => GOAL_ACCENT_COLORS[kind] || COLORS.blue;

const goalProgressNodes = goals => {
  const parts = [];
  (goals || []).forEach((goal, i) => {
    if (i > 0) {
      parts.push(h('span', { key: 'sep' + i, style: { color: COLORS.dim, margin: '0 4px' } }, '·'));
    }
    const color = goalAccentColor(goal && goal.kind);
    parts.push(h('span', { key: 'g' + i, style: { color } }, goalLine(goal)));
  });
  return parts;
};

const goalBarNodes = (goals, doneFlag) => h('div', {
  key: 'bars',
  style: { marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' },
}, (goals || []).map((goal, i) => {
  const cur = progressOfGoal(goal);
  const target = goalTargetOf(goal);
  const pct = target > 0 ? Math.min(100, (cur / target) * 100) : 0;
  const met = target > 0 && cur >= target;
  const accent = goalAccentColor(goal && goal.kind);
  return h('div', {
    key: 'bar' + i,
    style: {
      height: '4px', borderRadius: '2px',
      background: 'rgba(255,255,255,0.14)', overflow: 'hidden',
    },
  }, h('div', {
    style: {
      width: `${pct}%`, height: '100%',
      background: accent,
      boxShadow: (doneFlag || met) ? `0 0 4px ${accent}` : undefined,
    },
  }));
}));

function SpeedrunHud() {
  const fmt = timeFormat();
  useTick(fmt);

  if (!modEnabled()) return null;
  if (api.settings.get('showOverlay') === false) return null;
  if (!resultDismissed) return null;

  const run = readRun();
  const waiting = typeof run.startedAt !== 'number';
  const done = typeof run.finishedAt === 'number';
  const horizontal = hudLayout() === 'horizontal';

  const cat = category();
  const goals = categoryGoals(cat);
  const cornerKey = api.settings.get('corner') || 'topCenter';
  const corner = CORNERS[cornerKey] || CORNERS.topCenter;
  const isBottomRight = cornerKey === 'bottomRight';
  const mode = clockMode();
  const rTime = elapsed();
  const simTime = elapsedSim();
  const playTime = elapsedPlay();
  const slowdown = slowdownPercent();
  const deficit = tickDeficit();
  const ready = tickSourceReady();
  const advanced = api.settings.get('showAdvancedMetrics') === true;
  const sparkline = liveSparklineEnabled();
  if (done) maybeAdoptFinishedAsBest();
  const best = readBest();
  const tainted = cheatsUsed();
  const rulesLive = rulesetView();
  const modsInfo = rulesetStatus();

  const allSplits = readSplits();
  const upcoming = done ? [] : upcomingSplits(cat, allSplits);
  const windowed = hudSplitWindow(allSplits, upcoming);
  const visible = windowed.rows;
  const firstVisible = windowed.hiddenPast;
  const showSplits = api.settings.get('showSplits') !== false && visible.length > 0;
  const pbSplits = readComparisonSplits();

  let progressText = goals.map(goalLine).join(' · ');

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

  const stateStr = rulesLive.broken ? '[RULES BROKEN]' : done ? '[Finished]' : waiting ? '[Waiting]' : '[Running]';
  const seedStr = getMapSeed();
  const pauseCount = readClock('pauseCount');
  const reloadCount = readClock('reloadCount');
  const jamLoadVal = jamLoadPerUpdate();
  const jamShareVal = jamSharePercent();
  const jamText = waiting || !ready ? '—' : `${jamLoadVal.toFixed(2)}/u (${jamShareVal.toFixed(1)}%)`;
  const jamColor = waiting || !ready ? COLORS.dim : jamShareVal >= 10 || jamLoadVal >= 1.0 ? COLORS.red : jamShareVal >= 2 || jamLoadVal >= 0.2 ? COLORS.gold : COLORS.green;
  const slowVal = waiting || !ready ? '—' : `${fmtSigned(slowdown, 2)}%`;
  const slowColor = waiting || !ready ? COLORS.dim : slowdown <= -5 ? COLORS.red : slowdown <= -1 ? COLORS.gold : COLORS.green;
  const defVal = waiting || !ready ? '—' : `${fmtSigned(Math.round(deficit), 0)} (${fmtSigned(deficit * TICK_MS / 1000, 1)} s)`;
  const defColor = waiting || !ready ? COLORS.dim : deficit >= 300 ? COLORS.red : deficit >= 60 ? COLORS.gold : COLORS.green;
  const pacing = goldPacingInfo(best, playTime, waiting, done, cat);
  const modsExtra = modsInfo.items && modsInfo.items.find(i => i.id === 'mods')
    ? modsInfo.items.find(i => i.id === 'mods').extra
    : [];

  const isStreamer = streamerModeOn();
  const splitPx = isStreamer ? spx('split') : 11;
  const metaPx = isStreamer ? npx('meta') : 11;
  const badgePx = (isStreamer ? npx('badge') : 10) + 'px';
  const footPx = (isStreamer ? npx('footer') : 11) + 'px';
  const defPx = (isStreamer ? npx('deficit') : 11) + 'px';

  // --- 1. Timing Block (Clock, Comparison, Metrics, Splits) ---
  const timingChildren = [];

  if (isStreamer) {
    const ahead = waiting ? null : totalAheadDelta(allSplits, upcoming, pbSplits);
    const aheadText = ahead === null
      ? '—'
      : (ahead >= 0 ? '+' : '-') + formatShort(Math.abs(ahead), fmt);
    const aheadColor = ahead === null ? COLORS.dim : ahead <= 0 ? COLORS.green : COLORS.red;
    const playText = waiting ? dashTime(fmt) : formatTime(playTime, fmt);

    timingChildren.push(
      h('div', {
        key: 'big',
        style: {
          font: sfont('bigTime', 700, 1.05),
          color: done ? COLORS.gold : waiting ? COLORS.dim : COLORS.text,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        },
      }, playText),
      h('div', {
        key: 'ahead',
        style: {
          marginTop: '2px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
          font: sfont('delta', 700, 1.1),
          color: aheadColor,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        },
      }, [
        h('span', { key: 'lbl', style: { font: nfont('meta', 600, 1.2), color: COLORS.dim } }, t('mods|goldSpeedrun|hud|totalAhead')),
        h('span', { key: 'val' }, aheadText),
      ]),
      h('div', {
        key: 'status',
        style: {
          marginTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          font: sfont('slowdown', 600, 1.2),
          fontVariantNumeric: 'tabular-nums',
        },
      }, [
        h('div', { key: 'row1', style: { display: 'flex', alignItems: 'baseline', gap: '6px' } }, [
          h('span', { key: 'slow', style: { color: slowColor } }, `${t('mods|goldSpeedrun|metric|slowdown')} ${slowVal}`),
          h('span', { key: 'sep', style: { color: COLORS.dim } }, '·'),
          h('span', { key: 'def', style: { color: defColor } }, `${t('mods|goldSpeedrun|metric|deficit')} ${defVal}`),
        ]),
        h('div', { key: 'row2' }, [
          h('span', { key: 'jam', style: { color: jamColor } }, `${t('mods|goldSpeedrun|metric|jamLoad')} ${jamText}`),
        ]),
        goldGoalOf(cat) ? h('div', { key: 'row3', style: { display: 'flex', alignItems: 'baseline', gap: '6px' } }, [
          h('span', { key: 'gps', style: { color: COLORS.gold } }, `${t('mods|goldSpeedrun|metric|goldPerSec')} ${waiting ? '—' : formatGoldPerSec()}`),
          pacing ? h('span', { key: 'req', style: { color: pacing.color, fontSize: '0.9em', fontWeight: 600 } }, pacing.text) : null,
        ]) : null,
      ])
    );
  } else {
    timingChildren.push(
      h('div', {
        key: 'big',
        style: {
          font: `700 ${fmt === 'seconds' ? 24 : 22}px/1.1 system-ui, sans-serif`,
          color: done ? COLORS.gold : waiting ? COLORS.dim : COLORS.text,
          fontVariantNumeric: 'tabular-nums',
        },
      }, headlineText),
      !waiting ? h('div', {
        key: 'others',
        style: {
          marginTop: '1px', display: 'flex', gap: '10px',
          font: '600 11px/1.2 system-ui, sans-serif', color: COLORS.dim,
          fontVariantNumeric: 'tabular-nums',
        },
      }, otherClocks.map(k => h('span', { key: k }, otherClock(k)))) : null,
      h('div', {
        key: 'status',
        style: {
          marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px',
          fontSize: '11px', fontVariantNumeric: 'tabular-nums',
        },
      }, [
        h(MetricLine, {
          key: 'slowDef',
          label: `${t('mods|goldSpeedrun|metric|slowdown')} · ${t('mods|goldSpeedrun|metric|deficit')}`,
          value: waiting || !ready ? '—' : `${slowVal} · ${defVal}`,
          color: slowColor,
        }),
        h(MetricLine, {
          key: 'jam',
          label: t('mods|goldSpeedrun|metric|jamLoad'),
          value: jamText,
          color: jamColor,
        }),
        goldGoalOf(cat) ? h(MetricLine, {
          key: 'gps',
          label: t('mods|goldSpeedrun|metric|goldPerSec'),
          value: [
            h('span', { key: 'gps', style: { color: COLORS.gold } }, waiting ? '—' : formatGoldPerSec()),
            pacing ? h('span', { key: 'req', style: { color: pacing.color, marginLeft: '6px', fontSize: '10px', fontWeight: 600 } }, pacing.text) : null,
          ],
        }) : null,
      ])
    );
  }

  if (showSplits) {
    timingChildren.push(
      h('div', {
        key: 'splits',
        style: {
          marginTop: '6px',
          paddingTop: '5px',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          minWidth: (splitPx * 16) + 'px',
        },
      }, [
        firstVisible > 0
          ? h('div', {
              key: 'more',
              style: { color: COLORS.dim, opacity: 0.7, paddingBottom: '2px', fontSize: metaPx + 'px' },
            }, `+${firstVisible} …`)
          : null,
        h(SplitTable, { key: 'tbl', splits: visible, fmt, wide: false, pbSplits, scalePx: isStreamer ? splitPx : undefined }),
      ])
    );
  }

  // --- 2. Goal Card (Category + PB, Progress, Bars) ---
  const goalCard = h('div', {
    key: 'goalCard',
    style: {
      padding: '4px 6px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px',
      marginTop: '4px',
    },
  }, [
    h('div', {
      key: 'head',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: footPx,
        opacity: 0.8,
        marginBottom: '3px',
      },
    }, [
      h('span', { key: 'cat', style: { fontWeight: 600, color: COLORS.gold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, categoryLabel()),
      best !== null && best > 0 ? h('span', { key: 'pb', style: { color: COLORS.dim, whiteSpace: 'nowrap' } }, `PB ${formatTime(best, fmt)}`) : null,
    ]),
    h('div', {
      key: 'prog',
      style: { fontSize: metaPx + 'px', fontWeight: 600, opacity: 0.9 },
    }, waiting ? t('mods|goldSpeedrun|waiting') : goalProgressNodes(goals)),
    goalBarNodes(goals, done),
  ]);

  // --- 3. Diagnostics & Telemetry Block ---
  const diagChildren = [
    h('div', {
      key: 'header',
      style: {
        fontSize: metaPx + 'px',
        color: COLORS.dim,
        fontVariantNumeric: 'tabular-nums',
        marginTop: '6px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      },
    }, [
      h('span', { key: 'state', style: { color: rulesLive.broken ? COLORS.red : done ? COLORS.gold : COLORS.text, fontWeight: 'bold' } }, stateStr),
      h('span', { key: 'seed' }, `Seed: ${seedStr}`),
      h('span', { key: 'pauses' }, `Pauses: ${pauseCount}`),
      h('span', { key: 'reloads' }, `Reloads: ${reloadCount}`),
    ]),
    isStreamer && !waiting ? h('div', {
      key: 'others',
      style: {
        marginTop: '2px', display: 'flex', gap: '10px',
        font: nfont('meta', 600, 1.2), color: COLORS.dim,
        fontVariantNumeric: 'tabular-nums',
      },
    }, ['real', 'sim'].map(k => h('span', { key: k }, otherClock(k)))) : null,
    h('div', {
      key: 'badges',
      style: { marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    }, [
      h(ModsBadge, { key: 'mods', fontSize: badgePx, extraCount: modsInfo.extraCount, extra: modsExtra }),
      (showRuleset() || !rulesLive.ok) ? h(RulesBadge, { key: 'rules', rules: rulesLive, fontSize: badgePx }) : null,
      runUsesBlueprints() ? h(BlueprintBadge, { key: 'bp', fontSize: badgePx }) : null,
    ]),
    h(InvalidRunBanner, { key: 'invalid', view: rulesLive, fontSize: badgePx }),
    advanced && !waiting ? h(MetricLine, {
      key: 'avg',
      fontSize: defPx,
      label: t('mods|goldSpeedrun|metric|avgUps'),
      value: ready ? avgUps().toFixed(1) : '—',
    }) : null,
  ];

  // --- 4. Sparkline Graph ---
  const graphBlock = sparkline && !waiting
    ? h('div', { key: 'spark', style: { marginTop: '6px', minWidth: '120px' } }, [
        h(UpsEnvelopeGraph, { key: 'g', columns: sparklineColumns(), height: 26 }),
      ])
    : null;

  // --- 5. Side-by-Side Action Buttons ---
  const btnStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${COLORS.dim}`,
    color: COLORS.text,
    padding: '3px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    pointerEvents: 'auto',
    fontSize: footPx,
    boxSizing: 'border-box',
    width: '100%',
  };

  const actionButtons = isBottomRight
    ? h('div', { key: 'actions', style: { marginTop: '6px' } }, [
        sparkline && !waiting ? h('button', {
          key: 'metricsBtn',
          style: { ...btnStyle, marginBottom: '4px', fontSize: '10px', padding: '2px 6px' },
          onClick: () => setMetricsOverlayOpen(true),
        }, t('mods|goldSpeedrun|metrics|openBtn')) : null,
        h('div', {
          key: 'f10hint',
          style: { fontSize: footPx, opacity: 0.6, textAlign: 'center', pointerEvents: 'none' },
        }, t('mods|goldSpeedrun|hud|openDashboard')),
      ])
    : h('div', {
        key: 'actions',
        style: { display: 'flex', gap: '6px', marginTop: '6px', width: '100%' },
      }, [
        sparkline && !waiting ? h('button', {
          key: 'f7btn',
          style: { ...btnStyle, flex: 1, marginTop: 0, padding: '2px 6px' },
          onClick: () => setMetricsOverlayOpen(true),
        }, t('mods|goldSpeedrun|metrics|openBtn')) : null,
        h('button', {
          key: 'f10btn',
          onClick: () => setResultDismissed(false),
          style: { ...btnStyle, flex: 1, marginTop: 0, padding: '2px 6px' },
        }, 'Dashboard (F10)'),
      ]);

  const taintedBlock = tainted
    ? h('div', {
        key: 'tainted',
        style: { marginTop: '4px', fontSize: footPx, color: COLORS.red, fontWeight: 700 },
      }, t('mods|goldSpeedrun|tainted'))
    : null;

  const box = {
    position: 'absolute',
    ...corner,
    width: 'fit-content',
    maxWidth: '96vw',
    minWidth: horizontal ? undefined : (isStreamer ? Math.max(220, spx('bigTime') * 7) + 'px' : (fmt === 'seconds' ? '210px' : '235px')),
    padding: horizontal ? '8px 10px' : '10px 12px',
    borderRadius: '6px',
    border: `1px solid ${tainted || !rulesLive.ok ? COLORS.red : done ? COLORS.gold : waiting ? COLORS.border : '#5a6472'}`,
    opacity: waiting ? 0.75 : 1,
    background: COLORS.box,
    color: COLORS.text,
    font: isStreamer ? nfont('meta', 500, 1.3) : '500 13px/1.35 system-ui, sans-serif',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: horizontal ? 'row' : 'column',
    alignItems: horizontal ? 'flex-start' : 'stretch',
    gap: horizontal ? '14px' : '6px',
    zIndex: 10010,
  };

  const secondaryCol = [
    goalCard,
    ...diagChildren,
    graphBlock,
    actionButtons,
    taintedBlock,
  ];

  if (horizontal) {
    return h('div', { style: box }, [
      col('timing', timingChildren, { minWidth: isStreamer ? (spx('bigTime') * 7) + 'px' : (fmt === 'seconds' ? '210px' : '220px') }),
      col('secondary', secondaryCol, { minWidth: '210px', maxWidth: '270px' }),
    ]);
  }

  return h('div', { style: box }, [
    ...timingChildren,
    ...secondaryCol,
  ]);
}

function SpeedrunHudSafe() {
  try {
    return SpeedrunHud();
  } catch (e) {
    return h('div', { style: { position: 'absolute', top: 0, left: 0, background: 'red', color: 'white', padding: '10px', zIndex: 99999 } }, 
      'SpeedrunHud Crashed: ' + String(e));
  }
}

api.ui.inject('hud', SpeedrunHudSafe);

// --- DE: Ergebnisfenster / EN: Result screen ---------------------------------
// DE: Erscheint, sobald ein Lauf endet, und zeigt die vollstaendige Tabelle mit
// DE: Abschnittszeiten und Goldstand. F10 holt es zurueck.
// EN: Appears as soon as a run ends, and shows the full table with segment
// EN: times and gold total. F10 brings it back.
const resultListeners = new Set();
const notifyResult = () => resultListeners.forEach(fn => {
  try { fn(); } catch (e) { /* DE: ignorieren / EN: ignore */ }
});

const setResultDismissed = v => {
  resultDismissed = !!v;
  if (!resultDismissed) {
    triggerPanelOpen = false;
    openedF3FromDashboard = false;
  }
  notifyResult();
  notifyPanel();
};

const csvEscape = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

const csvInt = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) : '';

const artifactIndexOf = split => {
  const fromId = String(split && split.id || '').match(/^artifact:(\d+)$/);
  if (fromId) return Number(fromId[1]);
  const fromLabel = String(split && split.label || '').match(/(\d+)\s*$/);
  if (fromLabel) return Number(fromLabel[1]);
  return null;
};

const artifactRecordedBase = list => {
  let min = Infinity;
  for (const s of list || []) {
    if (!s || s.kind !== 'artifact' || s.upcoming) continue;
    const n = artifactIndexOf(s);
    if (n !== null && n < min) min = n;
  }
  return Number.isFinite(min) ? min : 1;
};

const displaySplitLabel = (split, list) => {
  if (!split) return '';
  if (split.kind === 'tech') {
    const raw = String(split.label || '');
    if (/^\d+$/.test(raw)) {
      const id = (split.id && String(split.id).replace(/^tech:/, '')) || raw;
      return techName(id);
    }
    return split.label;
  }
  if (split.kind === 'artifact' && !split.upcoming) {
    const n = artifactIndexOf(split);
    if (n !== null && artifactRecordedBase(list) === 0) {
      return t('mods|goldSpeedrun|split|artifact', { index: n + 1 });
    }
  }
  return split.label;
};

const splitsToCsv = list => {
  const rows = ['kind,label,time_ms,sim_ms,play_ms,gold'];
  for (const s of list) {
    rows.push([
      s.kind,
      csvEscape(displaySplitLabel(s, list)),
      csvInt(s.t),
      csvInt(s.sim),
      csvInt(s.w),
      csvInt(s.gold),
    ].join(','));
  }
  return rows.join('\n');
};

const parseCsvLine = line => {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
};

const csvToSplits = text => {
  const out = [];
  let header = null;
  const idx = (names, fallback) => {
    if (!header) return fallback;
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return fallback;
  };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (!header && cols[0] === 'kind') {
      header = cols.map(c => String(c).trim().toLowerCase());
      continue;
    }
    const kindI = idx(['kind'], 0);
    const idI = idx(['id'], -1);
    const labelI = idx(['label'], idI >= 0 ? 2 : 1);
    const tI = idx(['time_ms', 't'], idI >= 0 ? 3 : 2);
    const simI = idx(['sim_ms', 'sim'], idI >= 0 ? 4 : 3);
    const wI = idx(['play_ms', 'w'], idI >= 0 ? 5 : 4);
    const goldI = idx(['gold'], idI >= 0 ? 6 : 5);
    const kind = cols[kindI];
    const id = idI >= 0 ? cols[idI] : '';
    const label = cols[labelI];
    const tv = parseFloat(cols[tI]);
    if (!kind || !label || !Number.isFinite(tv)) continue;
    const sim = parseFloat(cols[simI]);
    const w = parseFloat(cols[wI]);
    const gold = parseFloat(cols[goldI]);
    out.push({
      kind,
      id: id || `${kind}:${label}`,
      label,
      t: tv,
      sim: Number.isFinite(sim) ? sim : undefined,
      w: Number.isFinite(w) ? w : undefined,
      gold: Number.isFinite(gold) ? gold : undefined,
    });
  }
  return out;
};

const downloadTextFile = (content, filename) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return;
  downloadBlob(new Blob([content], { type: 'text/csv' }), filename);
};

const sanitizeFilename = name => String(name == null ? '' : name)
  .replace(/[:/\\?*"<>|]/g, '-')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80) || 'run';

const downloadBlob = (blob, filename) => {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  if (document.body) {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const copyPngToClipboard = blob => {
  if (!blob) return Promise.resolve(false);
  if (typeof ClipboardItem === 'undefined' || typeof navigator === 'undefined'
    || !navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
    return Promise.resolve(false);
  }
  try {
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      .then(() => true)
      .catch(() => false);
  } catch (e) {
    return Promise.resolve(false);
  }
};

// DE: PNG-Ergebniskarte fuer Social-Media. Zeichnet den Lauf-Tab auf Canvas 2D,
// DE: ohne UI-Leisten, mit undurchsichtigem Hintergrund, und laedt die Datei herunter.
// EN: PNG share card for social posts. Paints the Run tab onto Canvas 2D,
// EN: without UI chrome, on an opaque background, then downloads the file.
const canvasToPngBlob = canvas => new Promise(resolve => {
  const fromDataUrl = () => {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      resolve(new Blob([arr], { type: 'image/png' }));
    } catch (e) {
      resolve(null);
    }
  };
  if (typeof canvas.toBlob === 'function') {
    try {
      canvas.toBlob(blob => { blob ? resolve(blob) : fromDataUrl(); }, 'image/png');
      return;
    } catch (e) { /* fall through to data URL */ }
  }
  fromDataUrl();
});

const SHARE_CARD_W = 1120;
const SHARE_CARD_MIN_H = 760;
const SHARE_CARD_MAX_H = 4096;
const SHARE_CARD_DPR = 2;
const SHARE_CARD_BG = '#0f141c';
const SHARE_FONT = 'system-ui, "Segoe UI", sans-serif';

const fitText = (ctx, text, maxW) => {
  const s = String(text == null ? '' : text);
  if (!(maxW > 0)) return '';
  if (ctx.measureText(s).width <= maxW) return s;
  const ell = '…';
  let i = s.length;
  while (i > 0 && ctx.measureText(s.slice(0, i) + ell).width > maxW) i--;
  return i > 0 ? s.slice(0, i) + ell : ell;
};

const roundRectPath = (ctx, x, y, w, h, r) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const fillRoundRect = (ctx, x, y, w, h, r, fill) => {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
};

const strokeRoundRect = (ctx, x, y, w, h, r, stroke, lw) => {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw || 1;
  ctx.stroke();
};

const shareChipPalette = (tone, isLive, isBroken, isDone) => {
  if (tone === 'green') return { bg: 'rgba(74, 222, 128, 0.12)', fg: COLORS.green, bd: 'rgba(74, 222, 128, 0.4)' };
  if (tone === 'red') return { bg: 'rgba(224, 82, 82, 0.12)', fg: COLORS.red, bd: 'rgba(224, 82, 82, 0.4)' };
  if (tone === 'blue') return { bg: 'rgba(74, 158, 255, 0.12)', fg: COLORS.blue, bd: 'rgba(74, 158, 255, 0.4)' };
  if (isLive) {
    return {
      bg: 'rgba(240, 192, 64, 0.12)',
      fg: isBroken ? COLORS.red : isDone ? COLORS.gold : COLORS.green,
      bd: isBroken ? 'rgba(224, 82, 82, 0.4)' : isDone ? 'rgba(240, 192, 64, 0.4)' : 'rgba(74, 222, 128, 0.4)',
    };
  }
  return { bg: 'rgba(255, 255, 255, 0.045)', fg: COLORS.dim, bd: 'rgba(255, 255, 255, 0.18)' };
};

const shareCardData = () => {
  const run = readRun();
  const fmt = timeFormat();
  const total = elapsed();
  const totalSim = elapsedSim();
  const totalPlay = elapsedPlay();
  const slowdown = slowdownPercent();
  const deficit = tickDeficit();
  const ready = tickSourceReady();
  const splits = readSplits();
  const compared = readResultComparison();
  const best = compared.time;
  const tainted = cheatsUsed();
  const delta = best !== null ? totalPlay - best : null;
  const rulesLive = rulesetView();
  const modsInfo = rulesetStatus();
  const isBroken = !!rulesLive.broken;
  const isWait = typeof run.startedAt !== 'number';
  const isDone = typeof run.finishedAt === 'number';
  const stStr = isBroken ? 'RULES BROKEN' : (isWait ? 'Waiting' : (isDone ? 'Finished' : 'Running'));
  const pbSplits = compared.splits;
  const columns = downsampleToColumns(historyBuf, 120, bucketStats);
  const deltaText = best !== null ? (delta <= 0 ? '-' : '+') + formatShort(Math.abs(delta), fmt) : '—';
  const deltaColor = best === null ? COLORS.dim : delta <= 0 ? COLORS.green : COLORS.red;

  const chips = [
    { text: stStr, tone: null, isLive: true },
    { text: `Seed: ${getMapSeed()}`, tone: null, isLive: false },
    {
      text: modsInfo.extraCount > 0
        ? t('mods|goldSpeedrun|mods|count', { count: modsInfo.extraCount })
        : t('mods|goldSpeedrun|mods|clean'),
      tone: modsInfo.extraCount > 0 ? null : 'green',
      isLive: false,
    },
    {
      text: runUsesBlueprints()
        ? t('mods|goldSpeedrun|dash|bpUsed')
        : t('mods|goldSpeedrun|dash|noBp'),
      tone: runUsesBlueprints() ? 'blue' : 'green',
      isLive: runUsesBlueprints(),
    },
  ];
  if (showRuleset() || !rulesLive.ok) {
    chips.push({
      text: rulesLive.ok
        ? t('mods|goldSpeedrun|rules|badge')
        : rulesLive.broken
          ? t('mods|goldSpeedrun|rules|broken')
          : t('mods|goldSpeedrun|rules|invalid'),
      tone: rulesLive.ok ? 'green' : 'red',
      isLive: true,
    });
  }
  chips.push(
    { text: `Pauses: ${readClock('pauseCount')}`, tone: null, isLive: false },
    { text: `Reloads: ${readClock('reloadCount')}`, tone: null, isLive: false },
  );

  const splitRows = splits.map((s, i) => {
    const previous = i > 0 ? splits[i - 1] : null;
    const liveMs = splitMs(s);
    const live = Number.isFinite(liveMs);
    const prevMs = previous ? splitMs(previous) : 0;
    const prevOk = Number.isFinite(prevMs) ? prevMs : 0;
    const segment = live ? liveMs - prevOk : 0;
    const pb = findPbSplit(s, pbSplits);
    const routeMs = pb ? splitMs(pb) : NaN;
    const routeOk = Number.isFinite(routeMs);
    const dlt = live && routeOk ? liveMs - routeMs : null;
    return {
      kind: s.kind,
      label: displaySplitLabel(s, splits),
      upcoming: s.upcoming === true,
      segment: live && segment >= 0 ? formatShort(segment, fmt) : '—',
      time: live ? formatTime(liveMs, fmt) : (routeOk ? formatTime(routeMs, fmt) : '—'),
      delta: dlt !== null ? (dlt >= 0 ? '+' : '-') + formatShort(Math.abs(dlt), fmt) : '—',
      deltaColor: dlt === null ? COLORS.dim : dlt <= 0 ? COLORS.green : COLORS.red,
      gold: live ? formatGold(s.gold) : '',
      color: s.upcoming ? COLORS.dim : (KIND_COLOR[s.kind] || COLORS.text),
    };
  });

  return {
    category: categoryLabel(),
    fmt,
    tainted,
    isBroken,
    invalid: !rulesLive.ok,
    isWait,
    isDone,
    chips,
    columns,
    graphEmpty: t(trackHistoryEnabled()
      ? 'mods|goldSpeedrun|graph|emptyRun'
      : 'mods|goldSpeedrun|graph|empty'),
    hero: [
      {
        title: t('mods|goldSpeedrun|result|total'),
        value: isWait ? dashTime(fmt) : formatTime(totalPlay, fmt),
        valueColor: isDone ? '#ffd56a' : '#ffffff',
        sub: isDone ? 'in-game time (W) · official' : 'in-game time (W)',
        subColor: COLORS.dim,
        fr: 1.15,
      },
      {
        title: t('mods|goldSpeedrun|result|best'),
        value: best === null ? t('mods|goldSpeedrun|result|noBest') : formatTime(best, fmt),
        valueColor: '#ffffff',
        sub: best !== null ? `${deltaText} vs PB/Target` : '—',
        subColor: deltaColor,
        fr: 1,
      },
      {
        title: t('mods|goldSpeedrun|metric|slowdown'),
        value: ready ? `${fmtSigned(slowdown, 2)}%` : '—',
        valueColor: !ready ? COLORS.dim : slowdown <= -5 ? '#ff8b8b' : slowdown <= -1 ? COLORS.gold : COLORS.green,
        sub: ready
          ? `${t('mods|goldSpeedrun|metric|deficit')}: ${fmtSigned(Math.round(deficit), 0)} (${fmtSigned(deficit * TICK_MS / 1000, 1)} s) · ${t('mods|goldSpeedrun|metric|jamLoad')}: ${jamLoadPerUpdate().toFixed(2)}/u (${jamSharePercent().toFixed(1)}%)`
          : '—',
        subColor: !ready ? COLORS.dim : deficit >= 300 ? COLORS.red : deficit >= 60 ? COLORS.gold : COLORS.green,
        fr: 0.9,
      },
    ],
    stats: [
      [t('mods|goldSpeedrun|result|sim'), ready ? formatTime(totalSim, fmt) : '—'],
      [t('mods|goldSpeedrun|result|real'), formatTime(total, fmt)],
      [t('mods|goldSpeedrun|result|play'), formatTime(totalPlay, fmt)],
      [t('mods|goldSpeedrun|metric|ticks'), ready ? api.i18n.formatNumber(Math.round(totalSim / TICK_MS)) : '—'],
      [t('mods|goldSpeedrun|metric|avgUps'), ready && total > 0 ? ((totalSim / TICK_MS) / (total / 1000)).toFixed(1) : '—'],
      [t('mods|goldSpeedrun|metric|idealTicks'), api.i18n.formatNumber(Math.round((total / 1000) * TICK_HZ))],
      [t('mods|goldSpeedrun|metric|jamLoad'), ready ? `${jamLoadPerUpdate().toFixed(2)}/u (${jamSharePercent().toFixed(1)}%)` : '—'],
      [t('mods|goldSpeedrun|metric|thinkMult'), ready && totalSim > 0 ? `${(total / totalSim).toFixed(2)}×` : '—'],
      [t('mods|goldSpeedrun|metric|wrProbe'), `${fmtSigned(totalPlay - total, 0)} ms`],
    ],
    splits: splitRows,
    totalPlay,
    exportedAt: new Date().toLocaleString(),
    versionLine: exportVersionLine(),
    wallStart: formatWallClock(wallClockSummary().startedAtWall),
    wallEnd: formatWallClock(wallClockSummary().finishedAtWall || (isDone ? null : Date.now())),
    wallSpan: wallClockSummary().span !== null ? formatTime(wallClockSummary().span, 'seconds') : '—',
  };
};

const layoutShareChips = (ctx, chips, x, maxX, y, chipH) => {
  ctx.font = `800 12px ${SHARE_FONT}`;
  let cx = x;
  let cy = y;
  const placed = [];
  for (const chip of chips) {
    const tw = Math.ceil(ctx.measureText(chip.text).width) + 18;
    if (cx + tw > maxX && cx > x) {
      cx = x;
      cy += chipH + 6;
    }
    placed.push({ ...chip, x: cx, y: cy, w: tw, h: chipH });
    cx += tw + 8;
  }
  return { chips: placed, bottom: cy + chipH };
};

const layoutShareCard = (ctx, data, w) => {
  const padX = 24;
  const innerL = padX;
  const innerR = w - padX;
  const innerW = innerR - innerL;
  const titleBottom = 18 + 24;
  const chips = layoutShareChips(ctx, data.chips, innerL, innerR, titleBottom + 12, 22);
  const headerBottom = chips.bottom + 16;
  const heroH = 96;
  const heroTop = headerBottom;
  const bodyTop = heroTop + heroH + 10;
  const gap = 16;
  const leftW = 380;
  const rightW = Math.max(240, innerW - leftW - gap);
  const leftX = innerL;
  const rightX = innerL + leftW + gap;
  let splitRowH = 32;
  const splitHeadH = 28;
  const leftMin = 12 + 20 + 8 + data.stats.length * 26 + 12 + 14 + 88 + 14;
  const footerH = 28;
  const chromeAfterBody = 10 + footerH + 12;
  const maxBody = SHARE_CARD_MAX_H - bodyTop - chromeAfterBody;
  const splitsHFor = rowH => 16 + 20 + 12 + splitHeadH + Math.max(data.splits.length, 1) * rowH + 16;
  let bodyH = Math.max(leftMin, splitsHFor(splitRowH), 360);
  if (bodyH > maxBody) {
    const tableBudget = maxBody - (16 + 20 + 12 + splitHeadH + 16);
    splitRowH = Math.max(16, tableBudget / Math.max(data.splits.length, 1));
    bodyH = maxBody;
  }
  let bodyBottom = bodyTop + bodyH;
  let footerTop = bodyBottom + 10;
  const contentH = footerTop + footerH + 12;
  const h = Math.max(SHARE_CARD_MIN_H, Math.min(SHARE_CARD_MAX_H, contentH));
  const extra = h - contentH;
  bodyH += extra;
  bodyBottom += extra;
  footerTop += extra;
  return {
    padX, innerL, innerR, innerW, chips, headerBottom, heroTop, heroH,
    bodyTop, bodyH, bodyBottom, leftX, leftW, rightX, rightW, footerTop, footerH,
    h, splitRowH, splitHeadH,
  };
};

const paintShareCard = (ctx, data, w, h, layout) => {
  const L = layout;
  ctx.fillStyle = SHARE_CARD_BG;
  ctx.fillRect(0, 0, w, h);
  strokeRoundRect(ctx, 0.5, 0.5, w - 1, h - 1, 12, data.tainted || data.invalid ? COLORS.red : '#4a5564', 1);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `800 22px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('Speedrun Dashboard', L.innerL, 18 + 20);
  const titleW = ctx.measureText('Speedrun Dashboard').width;

  ctx.font = `700 14px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.blue;
  const catX = L.innerL + titleW + 16;
  ctx.fillText(fitText(ctx, data.category, L.innerR - catX), catX, 18 + 20);

  for (const chip of L.chips.chips) {
    const pal = shareChipPalette(chip.tone, chip.isLive, data.isBroken, data.isDone);
    fillRoundRect(ctx, chip.x, chip.y, chip.w, chip.h, 6, pal.bg);
    strokeRoundRect(ctx, chip.x + 0.5, chip.y + 0.5, chip.w - 1, chip.h - 1, 6, pal.bd, 1);
    ctx.font = `800 12px ${SHARE_FONT}`;
    ctx.fillStyle = pal.fg;
    ctx.textAlign = 'left';
    ctx.fillText(chip.text, chip.x + 9, chip.y + 15);
  }

  const heroGap = 10;
  const frSum = data.hero.reduce((s, c) => s + c.fr, 0);
  const heroUsable = L.innerW - heroGap * (data.hero.length - 1);
  let hx = L.innerL;
  for (const card of data.hero) {
    const cw = heroUsable * (card.fr / frSum);
    fillRoundRect(ctx, hx, L.heroTop, cw, L.heroH, 10, 'rgba(0, 0, 0, 0.25)');
    strokeRoundRect(ctx, hx + 0.5, L.heroTop + 0.5, cw - 1, L.heroH - 1, 10, 'rgba(255, 255, 255, 0.04)', 1);
    ctx.textAlign = 'left';
    ctx.font = `800 12px ${SHARE_FONT}`;
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(fitText(ctx, String(card.title).toUpperCase(), cw - 32), hx + 16, L.heroTop + 22);
    ctx.font = `800 30px ${SHARE_FONT}`;
    ctx.fillStyle = card.valueColor || '#ffffff';
    ctx.fillText(fitText(ctx, card.value, cw - 32), hx + 16, L.heroTop + 58);
    ctx.font = `700 12px ${SHARE_FONT}`;
    ctx.fillStyle = card.subColor || COLORS.dim;
    ctx.fillText(fitText(ctx, card.sub, cw - 32), hx + 16, L.heroTop + 80);
    hx += cw + heroGap;
  }

  const cardBg = 'rgba(0, 0, 0, 0.25)';
  const cardBd = 'rgba(255, 255, 255, 0.04)';
  fillRoundRect(ctx, L.leftX, L.bodyTop, L.leftW, L.bodyH, 10, cardBg);
  strokeRoundRect(ctx, L.leftX + 0.5, L.bodyTop + 0.5, L.leftW - 1, L.bodyH - 1, 10, cardBd, 1);
  fillRoundRect(ctx, L.rightX, L.bodyTop, L.rightW, L.bodyH, 10, cardBg);
  strokeRoundRect(ctx, L.rightX + 0.5, L.bodyTop + 0.5, L.rightW - 1, L.bodyH - 1, 10, cardBd, 1);

  ctx.textAlign = 'left';
  ctx.font = `800 14px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(t('mods|goldSpeedrun|result|expand').toUpperCase(), L.leftX + 16, L.bodyTop + 28);

  const statTop = L.bodyTop + 42;
  data.stats.forEach((row, i) => {
    const y = statTop + i * 26;
    ctx.beginPath();
    ctx.moveTo(L.leftX + 16, y + 18);
    ctx.lineTo(L.leftX + L.leftW - 16, y + 18);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `600 13px ${SHARE_FONT}`;
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'left';
    ctx.fillText(fitText(ctx, row[0], L.leftW - 140), L.leftX + 16, y + 12);
    ctx.font = `700 14px ${SHARE_FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'right';
    ctx.fillText(fitText(ctx, row[1], 110), L.leftX + L.leftW - 16, y + 12);
  });

  const graphH = 88;
  const graphCaptionY = L.bodyBottom - 14 - graphH - 18;
  const graphY = L.bodyBottom - 14 - graphH;
  const graphX = L.leftX + 16;
  const graphW = L.leftW - 32;
  ctx.textAlign = 'left';
  ctx.font = `700 12px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(t('mods|goldSpeedrun|graph|title').toUpperCase(), graphX, graphCaptionY + 12);
  fillRoundRect(ctx, graphX, graphY, graphW, graphH, 6, 'rgba(0, 0, 0, 0.32)');
  ctx.save();
  roundRectPath(ctx, graphX, graphY, graphW, graphH, 6);
  ctx.clip();
  const cols = data.columns || [];
  if (!cols.length) {
    ctx.font = `600 11px ${SHARE_FONT}`;
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapCanvasText(ctx, data.graphEmpty, graphX + graphW / 2, graphY + graphH / 2, graphW - 24, 14);
  } else {
    const UPS_GRAPH_MAX = 90;
    const clampUps = v => Math.max(0, Math.min(UPS_GRAPH_MAX, Number.isFinite(v) ? v : 0));
    const scaleMax = UPS_GRAPH_MAX;
    const refTop = Math.max(0, Math.min(100, 100 - (TICK_HZ / scaleMax) * 100));
    const wPct = graphW / cols.length;
    cols.forEach((c, i) => {
      const minPct = Math.max(0, Math.min(100, (clampUps(c.min) / scaleMax) * 100));
      const maxPct = Math.max(minPct + 0.6, Math.min(100, (clampUps(c.max) / scaleMax) * 100));
      const color = c.avg >= TICK_HZ - 1 ? COLORS.green : c.avg >= TICK_HZ * 0.85 ? COLORS.gold : COLORS.red;
      const bh = graphH * (maxPct - minPct) / 100;
      const by = graphY + graphH - graphH * maxPct / 100;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(graphX + i * wPct, by, Math.max(wPct, 0.6), bh);
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH * refTop / 100);
    ctx.lineTo(graphX + graphW, graphY + graphH * refTop / 100);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.font = `600 9px ${SHARE_FONT}`;
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(TICK_HZ), graphX + graphW - 4, graphY + graphH * refTop / 100 + 2);
  }
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `800 14px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`SPLITS (${data.splits.length})`, L.rightX + 18, L.bodyTop + 28);

  const tableX = L.rightX + 18;
  const tableW = L.rightW - 36;
  const numW = [110, 110, 110, 92];
  const labelW = Math.max(80, tableW - numW.reduce((s, n) => s + n, 0));
  const colX = [
    tableX,
    tableX + labelW + numW[0],
    tableX + labelW + numW[0] + numW[1],
    tableX + labelW + numW[0] + numW[1] + numW[2],
    tableX + labelW + numW[0] + numW[1] + numW[2] + numW[3],
  ];
  const headY = L.bodyTop + 48;
  ctx.font = `800 12px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.dim;
  ctx.textAlign = 'left';
  ctx.fillText(fitText(ctx, t('mods|goldSpeedrun|result|colSplit').toUpperCase(), labelW - 8), colX[0], headY);
  ctx.textAlign = 'right';
  ctx.fillText(fitText(ctx, t('mods|goldSpeedrun|result|colSegment').toUpperCase(), numW[0] - 8), colX[1], headY);
  ctx.fillText(fitText(ctx, t('mods|goldSpeedrun|result|colTime').toUpperCase(), numW[1] - 8), colX[2], headY);
  ctx.fillText(fitText(ctx, t('mods|goldSpeedrun|result|colDelta').toUpperCase(), numW[2] - 8), colX[3], headY);
  ctx.fillText(fitText(ctx, t('mods|goldSpeedrun|result|colGold').toUpperCase(), numW[3] - 8), colX[4], headY);
  ctx.beginPath();
  ctx.moveTo(tableX, headY + 8);
  ctx.lineTo(tableX + tableW, headY + 8);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.stroke();

  if (data.splits.length === 0) {
    ctx.font = `600 13px ${SHARE_FONT}`;
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'center';
    ctx.fillText(t('mods|goldSpeedrun|result|noSplits'), L.rightX + L.rightW / 2, headY + 40);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.rightX + 8, headY + 10, L.rightW - 16, Math.max(0, L.bodyBottom - 8 - (headY + 10)));
    ctx.clip();
    data.splits.forEach((row, i) => {
      const y = headY + 12 + i * L.splitRowH + 18;
      ctx.beginPath();
      ctx.moveTo(tableX, y + 10);
      ctx.lineTo(tableX + tableW, y + 10);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.stroke();
      ctx.font = `600 15px ${SHARE_FONT}`;
      ctx.fillStyle = row.color;
      ctx.textAlign = 'left';
      ctx.fillText(fitText(ctx, row.label, labelW - 8), colX[0], y);
      ctx.font = `600 14px ${SHARE_FONT}`;
      ctx.fillStyle = COLORS.dim;
      ctx.textAlign = 'right';
      ctx.fillText(row.segment, colX[1], y);
      ctx.fillStyle = row.upcoming ? COLORS.dim : '#ffffff';
      ctx.fillText(row.time, colX[2], y);
      ctx.font = `700 14px ${SHARE_FONT}`;
      ctx.fillStyle = row.deltaColor;
      ctx.fillText(row.delta, colX[3], y);
      ctx.font = `600 14px ${SHARE_FONT}`;
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(row.gold, colX[4], y);
    });
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.font = `600 12px ${SHARE_FONT}`;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(fitText(ctx, data.versionLine || `Sandustry Gold Speedrun Challenge v${MOD_VERSION}`, L.innerW * 0.52), L.innerL, L.footerTop + 16);
  ctx.textAlign = 'right';
  const wallEndStr = (data.wallEnd && data.wallEnd !== '—') ? data.wallEnd : (data.exportedAt || '');
  const wallLine = (data.wallStart && data.wallStart !== '—')
    ? `${data.wallStart} → ${wallEndStr}${data.wallSpan && data.wallSpan !== '—' ? ` · ${data.wallSpan}` : ''}`
    : (data.exportedAt || '');
  ctx.fillText(fitText(ctx, wallLine, L.innerW * 0.46), L.innerR, L.footerTop + 16);
  ctx.textAlign = 'left';
};

const wrapCanvasText = (ctx, text, cx, cy, maxW, lineH) => {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? cur + ' ' + word : word;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  const top = cy - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineH));
};

const exportDashboardPng = () => {
  try {
    if (typeof document === 'undefined') return;
    const measure = document.createElement('canvas').getContext('2d');
    if (!measure) return;
    const data = shareCardData();
    const layout = layoutShareCard(measure, data, SHARE_CARD_W);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(SHARE_CARD_W * SHARE_CARD_DPR);
    canvas.height = Math.round(layout.h * SHARE_CARD_DPR);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(SHARE_CARD_DPR, SHARE_CARD_DPR);
    paintShareCard(ctx, data, SHARE_CARD_W, layout.h, layout);
    const timePart = formatTime(Number.isFinite(data.totalPlay) ? data.totalPlay : 0, 'millis');
    const filename = `sandustry-speedrun-${sanitizeFilename(data.category)}-${sanitizeFilename(timePart)}.png`;
    canvasToPngBlob(canvas).then(blob => {
      if (!blob) return;
      downloadBlob(blob, filename);
      copyPngToClipboard(blob).then(copied => {
        try {
          api.ui.toast({ key: copied ? 'mods|goldSpeedrun|toast|pngCopied' : 'mods|goldSpeedrun|toast|pngSaved' });
        } catch (e) { /* toast optional */ }
      });
    });
  } catch (e) {
    log('PNG export failed: ' + e);
  }
};

const pickCsvFile = onText => {
  if (typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onText(String(ev.target.result || ''), file.name || '');
    reader.readAsText(file);
  };
  input.click();
};

let dashboardTab = 'run';
let selectedCatId = null;
let catDraft = {
  name: '',
  kind: 'gold',
  target: '100000',
  goldMode: 'balance',
  goals: {
    factory: { on: true, target: '6' },
    gold: { on: true, target: '100000' },
    fluxite: { on: false, target: '1000' },
    energy: { on: false, target: '1000' },
    aura: { on: false, target: '10000' },
    artifacts: { on: false, target: '0' },
  },
};

const freshCatDraft = () => ({
  name: '',
  kind: 'gold',
  target: '100000',
  goldMode: 'balance',
  goals: {
    factory: { on: true, target: '6' },
    gold: { on: true, target: '100000' },
    fluxite: { on: false, target: '1000' },
    energy: { on: false, target: '1000' },
    aura: { on: false, target: '10000' },
    artifacts: { on: false, target: '0' },
  },
});
let routeAddDraft = { splitKey: '', time: '', picked: null };
let editingTarget = null;
let pbHistoryOpen = false;
let pbEditSnapshotted = false;

const buildRouteSplitChoices = cat => {
  const groups = [];
  const ranks = rankIds();
  if (ranks.length) {
    groups.push({
      key: 'rank',
      label: t('mods|goldSpeedrun|trg|rank'),
      items: ranks.map(lvl => ({
        value: `rank:${lvl}`,
        kind: 'rank',
        id: `rank:${lvl}`,
        label: t('mods|goldSpeedrun|split|rank', { level: lvl }),
      })),
    });
  }
  const marks = currentGoldMarks(cat || category());
  if (marks.length) {
    groups.push({
      key: 'gold',
      label: t('mods|goldSpeedrun|trg|gold'),
      items: marks.map(m => ({
        value: `gold:${m.value}`,
        kind: 'gold',
        id: `gold:${m.value}`,
        label: `${m.label}  ·  ${formatGold(m.value)}`,
      })),
    });
  }
  let artN = 0;
  try { artN = cat && cat.kind === 'artifacts' && cat.target > 0 ? cat.target : artifactTotal(); } catch (e) { artN = 0; }
  if (artN > 0) {
    const items = [];
    for (let n = 1; n <= artN; n++) {
      items.push({
        value: `artifact:${n}`,
        kind: 'artifact',
        id: `artifact:${n}`,
        label: t('mods|goldSpeedrun|split|artifact', { index: n }),
      });
    }
    groups.push({ key: 'art', label: t('mods|goldSpeedrun|trg|other'), items });
  }
  const techs = allTechIds()
    .map(id => ({
      value: `tech:${id}`,
      kind: 'tech',
      id: `tech:${id}`,
      label: techName(id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (techs.length) {
    groups.push({ key: 'tech', label: t('mods|goldSpeedrun|trg|tech'), items: techs });
  }
  groups.push({
    key: 'goal',
    label: t('mods|goldSpeedrun|split|goal'),
    items: [{ value: 'goal', kind: 'goal', id: 'goal', label: t('mods|goldSpeedrun|split|goal') }],
  });
  return groups;
};

const PRESET_LABEL_KEY = {
  '100000': 'mods|goldSpeedrun|cfg|preset|100k',
  '500000': 'mods|goldSpeedrun|cfg|preset|500k',
  '1000000': 'mods|goldSpeedrun|cfg|preset|1m',
  artifacts: 'mods|goldSpeedrun|cfg|preset|artifacts',
  factory6: 'mods|goldSpeedrun|cfg|preset|factory6',
  factory7: 'mods|goldSpeedrun|cfg|preset|factory7',
  custom: 'mods|goldSpeedrun|cfg|preset|custom',
};

const managedCategories = () => {
  const presets = Object.keys(CATEGORIES).map(id => ({
    ...presetCategoryFromId(id),
    name: t(PRESET_LABEL_KEY[id] || 'mods|goldSpeedrun|cfg|preset|custom'),
    preset: true,
  }));
  const customs = readCustomCategories().map(c => ({ ...categoryFromCustom(c), preset: false }));
  return presets.concat(customs);
};

const activateManagedCategory = id => {
  setActiveCategoryId(id);
  if (CATEGORIES[id]) {
    lastSeenPreset = id;
    writeSetting('goalPreset', id);
    refreshSettingsUi();
  }
  notifyResult();
  notifyPanel();
};

const parseTimeInput = s => {
  const raw = String(s || '').trim();
  if (!raw) return NaN;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const m = raw.match(/^(?:(\d+):)?(\d+):(\d+)(?:[.,](\d+))?$/);
  if (!m) return NaN;
  const hh = m[1] ? Number(m[1]) : 0;
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  let ms = 0;
  if (m[4]) ms = Number(m[4].padEnd(3, '0').slice(0, 3));
  return ((hh * 60 + mm) * 60 + ss) * 1000 + ms;
};

const splitTriggerValue = split => {
  if (!split) return '';
  if (split.id) return String(split.id);
  if (split.kind && split.label) return `${split.kind}:${split.label}`;
  return String(split.label || '');
};

const flattenChoices = groups => (groups || []).reduce((acc, g) => acc.concat(g.items || []), []);

const matchSplitChoice = (split, groups) => {
  const flat = flattenChoices(groups);
  if (!split) return null;
  const value = splitTriggerValue(split);
  const byVal = flat.find(it => it.value === value || (split.id && it.id === split.id));
  if (byVal) return byVal;
  const want = normLabel(split.label);
  return want ? (flat.find(it => normLabel(it.label) === want) || null) : null;
};

const choicesWithCurrent = (groups, split) => {
  if (!split) return groups || [];
  if (matchSplitChoice(split, groups)) return groups || [];
  const value = splitTriggerValue(split);
  if (!value) return groups || [];
  return (groups || []).concat([{
    key: 'custom',
    label: t('mods|goldSpeedrun|route|customGroup'),
    items: [{
      value,
      kind: split.kind || 'tech',
      id: split.id || value,
      label: t('mods|goldSpeedrun|route|customTrigger', { label: split.label || split.id || value }),
    }],
  }]);
};

const formatHistoryWhen = ts => {
  if (!Number.isFinite(ts)) return '';
  try {
    const d = new Date(ts);
    const p = n => (n < 10 ? '0' : '') + n;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch (e) {
    return '';
  }
};

const historySourceLabel = entry => {
  const src = entry && entry.source;
  if (src === 'in_game') return t('mods|goldSpeedrun|pb|sourceInGame');
  if (src === 'route_promote') return t('mods|goldSpeedrun|pb|sourcePromote', { name: entry.sourceName || '' });
  if (src === 'import_pb') return t('mods|goldSpeedrun|pb|sourceImport');
  if (src === 'clear') return t('mods|goldSpeedrun|pb|sourceClear');
  if (src === 'restore') return t('mods|goldSpeedrun|pb|sourceRestore');
  if (src === 'edit') return t('mods|goldSpeedrun|pb|sourceEdit');
  return src || '';
};

const routeNameFromFile = filename => {
  const base = String(filename || '').replace(/^.*[\\/]/, '').replace(/\.csv$/i, '').trim();
  return base || t('mods|goldSpeedrun|csv|importedName');
};

function TriggerCombobox({ value, kind, label, choices, onChange, placeholder }) {
  const [query, setQuery] = react.useState('');
  const [open, setOpen] = react.useState(false);
  const [highlight, setHighlight] = react.useState(0);
  const root = react.useRef ? react.useRef(null) : react.useState({ current: null })[0];

  react.useEffect(() => {
    if (!open) return undefined;
    const onDoc = ev => {
      const node = root.current;
      if (node && ev.target && typeof node.contains === 'function' && node.contains(ev.target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = (choices || []).map(g => ({
    ...g,
    items: (g.items || []).filter(it => {
      if (!q) return true;
      return String(it.label || '').toLowerCase().includes(q)
        || String(it.id || '').toLowerCase().includes(q)
        || String(it.kind || '').toLowerCase().includes(q)
        || String(it.value || '').toLowerCase().includes(q);
    }),
  })).filter(g => g.items.length > 0);
  const flat = flattenChoices(filtered);
  const hi = flat.length === 0 ? 0 : Math.min(highlight, flat.length - 1);

  const pick = item => {
    if (!item) return;
    onChange(item);
    setOpen(false);
    setQuery('');
    setHighlight(0);
  };

  const color = KIND_COLOR[kind] || COLORS.text;

  return h('div', {
    ref: el => { root.current = el; },
    style: { position: 'relative', minWidth: 0 },
  }, [
    h('input', {
      key: 'q',
      value: open ? query : (label || ''),
      placeholder: placeholder || '',
      onFocus: () => { setOpen(true); setQuery(''); setHighlight(0); },
      onChange: e => { setQuery(e.target.value); setOpen(true); setHighlight(0); },
      onKeyDown: e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          setHighlight(n => Math.min((n || 0) + 1, Math.max(0, flat.length - 1)));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight(n => Math.max((n || 0) - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && flat[hi]) pick(flat[hi]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
          setQuery('');
        }
      },
      style: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '4px 6px',
        borderRadius: '4px',
        border: `1px solid ${open ? COLORS.gold : COLORS.border}`,
        background: '#000',
        color,
        fontWeight: kind === 'goal' ? 800 : 500,
      },
    }),
    open ? h('div', {
      key: 'menu',
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '100%',
        marginTop: '2px',
        maxHeight: '220px',
        overflowY: 'auto',
        background: '#0c1016',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        zIndex: 10050,
        boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
      },
    }, flat.length === 0
      ? h('div', { key: 'empty', style: { padding: '8px 10px', color: COLORS.dim, fontSize: '12px' } },
          t('mods|goldSpeedrun|route|noMatch'))
      : filtered.map(g => h('div', { key: g.key }, [
          h('div', {
            key: 'h',
            style: {
              padding: '6px 10px 3px',
              font: '800 10px/1 system-ui, sans-serif',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: COLORS.dim,
            },
          }, g.label),
          ...g.items.map(it => {
            const idx = flat.indexOf(it);
            const active = idx === hi;
            const selected = it.value === value;
            return h('div', {
              key: it.value,
              onMouseDown: ev => { ev.preventDefault(); pick(it); },
              onMouseEnter: () => setHighlight(idx),
              style: {
                padding: '5px 10px',
                cursor: 'pointer',
                background: active ? 'rgba(240,192,64,0.16)' : (selected ? 'rgba(255,255,255,0.04)' : 'transparent'),
                color: KIND_COLOR[it.kind] || COLORS.text,
                fontWeight: it.kind === 'goal' || selected ? 800 : 500,
              },
            }, it.label);
          }),
        ])))
    : null,
  ]);
}

const dashBtn = (key, label, onClick, danger) => h('button', {
  key,
  onClick,
  style: {
    cursor: 'pointer', padding: '5px 10px', borderRadius: '4px',
    border: `1px solid ${danger ? COLORS.red : COLORS.border}`,
    background: danger ? 'rgba(224,82,82,0.12)' : 'rgba(0,0,0,0.25)',
    color: danger ? COLORS.red : COLORS.text,
    font: '700 11px/1 system-ui, sans-serif',
  },
}, label);

function SplitEditor({ getSplits, setSplits, choiceGroups, fmt }) {
  const splits = getSplits() || [];
  return h('div', { key: 'editor', style: { marginTop: '6px' } }, [
    splits.length === 0
      ? h('div', { key: 'empty', style: { color: COLORS.dim, padding: '8px 0' } }, t('mods|goldSpeedrun|route|empty'))
      : splits.map((s, i) => {
          const matched = matchSplitChoice(s, choiceGroups);
          const shown = matched || s;
          return h('div', {
            key: (s.id || i) + '-' + i,
            style: { display: 'grid', gridTemplateColumns: '1fr 150px 56px 56px 70px', gap: '8px', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
          }, [
            h(TriggerCombobox, {
              key: 'c',
              value: matched ? matched.value : splitTriggerValue(s),
              kind: shown.kind,
              label: shown.label,
              choices: choicesWithCurrent(choiceGroups, s),
              placeholder: t('mods|goldSpeedrun|route|searchTrigger'),
              onChange: picked => {
                setSplits(splits.map((x, j) => j === i
                  ? { ...x, kind: picked.kind, id: picked.id, label: picked.label }
                  : x));
              },
            }),
            h('input', {
              key: 't',
              defaultValue: Number.isFinite(splitMs(s)) ? formatTime(splitMs(s), fmt) : '',
              onBlur: e => {
                const ms = parseTimeInput(e.target.value);
                if (!Number.isFinite(ms)) return;
                setSplits(splits.map((x, j) => j === i
                  ? { ...x, w: ms, t: Number.isFinite(x.t) ? x.t : ms }
                  : x));
              },
              style: { padding: '4px 6px', borderRadius: '4px', border: `1px solid ${COLORS.border}`, background: '#000', color: COLORS.text, fontVariantNumeric: 'tabular-nums' },
            }),
            dashBtn('up' + i, t('mods|goldSpeedrun|route|up'), () => {
              if (i === 0) return;
              const next = splits.slice();
              const tmp = next[i - 1]; next[i - 1] = next[i]; next[i] = tmp;
              setSplits(next);
            }),
            dashBtn('dn' + i, t('mods|goldSpeedrun|route|down'), () => {
              if (i >= splits.length - 1) return;
              const next = splits.slice();
              const tmp = next[i + 1]; next[i + 1] = next[i]; next[i] = tmp;
              setSplits(next);
            }),
            dashBtn('rm' + i, t('mods|goldSpeedrun|route|remove'), () => {
              setSplits(splits.filter((_, j) => j !== i));
            }, true),
          ]);
        }),
    h('div', {
      key: 'add',
      style: { display: 'grid', gridTemplateColumns: '1fr 150px 70px', gap: '8px', alignItems: 'center', padding: '10px 0 2px' },
    }, [
      h(TriggerCombobox, {
        key: 'nl',
        value: routeAddDraft.splitKey,
        kind: routeAddDraft.picked && routeAddDraft.picked.kind,
        label: routeAddDraft.picked && routeAddDraft.picked.label,
        choices: choiceGroups,
        placeholder: t('mods|goldSpeedrun|route|addLabel'),
        onChange: picked => {
          routeAddDraft = { ...routeAddDraft, splitKey: picked.value, picked };
          notifyResult();
        },
      }),
      h('input', {
        key: 'nt',
        value: routeAddDraft.time,
        placeholder: t('mods|goldSpeedrun|route|addTime'),
        onChange: e => { routeAddDraft = { ...routeAddDraft, time: e.target.value }; notifyResult(); },
        style: { padding: '6px 8px', borderRadius: '4px', border: `1px solid ${COLORS.border}`, background: '#000', color: COLORS.text, fontVariantNumeric: 'tabular-nums' },
      }),
      dashBtn('add', t('mods|goldSpeedrun|route|add'), () => {
        const ms = parseTimeInput(routeAddDraft.time);
        const picked = routeAddDraft.picked;
        if (!picked || !Number.isFinite(ms)) {
          api.ui.toast({ key: 'mods|goldSpeedrun|route|invalidTime' });
          return;
        }
        setSplits(splits.concat([{ kind: picked.kind, id: picked.id, label: picked.label, w: ms, t: ms }]));
        routeAddDraft = { splitKey: '', time: '', picked: null };
      }),
    ]),
  ]);
}

function CategoriesPanel({ fmt }) {
  migrateKeyStability();
  const list = managedCategories();
  const activeId = getActiveCategoryId() || category().id;
  const selected = list.find(c => c.id === (selectedCatId || activeId)) || list[0];
  const selectedKey = selected ? bestKeyFor(selected) : bestKey();
  const selectedBest = selected ? readBestAt(selectedKey) : readBest();
  const selectedPbSplits = selected ? readBestSplitsAt(selectedKey) : readBestSplits();
  const routes = readRoutesStore(selectedKey);
  const customRoutes = routes.routes;
  const history = selected ? readPbHistory(selected) : [];
  const choiceGroups = buildRouteSplitChoices(selected);

  const field = (key, label, value, onChange, extra) => h('label', {
    key,
    style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: COLORS.dim, minWidth: '120px' },
  }, [
    h('span', { key: 'l' }, label),
    h('input', {
      key: 'i',
      value,
      onChange,
      style: {
        padding: '6px 8px', borderRadius: '4px', border: `1px solid ${COLORS.border}`,
        background: '#000', color: COLORS.text, font: '500 13px/1.2 system-ui, sans-serif',
      },
      ...extra,
    }),
  ]);

  const saveRoutes = next => {
    writeRoutesStore(next, selectedKey);
    notifyResult();
  };

  const setPbSplits = nextSplits => {
    if (!selected) return;
    if (!pbEditSnapshotted) {
      backupCurrentPb(selected, 'edit', '');
      pbEditSnapshotted = true;
    }
    const key = selectedKey;
    if (nextSplits.length > 0) writeBestSplitsAt(key, nextSplits);
    else {
      try { api.storage.local.set(key + '.splits', null); } catch (e) { /* ignore */ }
      if (key === bestKey()) api.storage.set(NS, 'pbSplits', null);
    }
    const last = nextSplits[nextSplits.length - 1];
    const ms = splitMs(last);
    if (ms >= MIN_PB_MS) writeBestTimeAt(key, ms);
    notifyResult();
  };

  const setCustomSplits = (routeId, nextSplits) => {
    saveRoutes({
      ...routes,
      routes: customRoutes.map(r => r.id === routeId ? { ...r, splits: nextSplits } : r),
    });
  };

  const pbRun = {
    id: PB_RUN_ID,
    name: t('mods|goldSpeedrun|run|pb'),
    isPb: true,
    splits: selectedPbSplits,
    finalMs: selectedBest,
  };

  const runs = [pbRun].concat(customRoutes.map(r => ({
    id: r.id,
    name: r.name,
    isPb: false,
    splits: r.splits || [],
    finalMs: splitMs((r.splits || [])[(r.splits || []).length - 1]),
  })));

  const comparedId = routes.activeRouteId || PB_RUN_ID;

  return h('div', {
    style: { display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '18px', padding: '16px 24px 8px', minHeight: 0, flex: 1, overflow: 'hidden' },
  }, [
    h('div', {
      key: 'list',
      style: { overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
    }, [
      ...list.map(c => h('div', {
        key: c.id,
        onClick: () => { selectedCatId = c.id; pbHistoryOpen = false; notifyResult(); },
        style: {
          padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
          border: `1px solid ${c.id === selected.id ? COLORS.gold : 'rgba(255,255,255,0.06)'}`,
          background: c.id === activeId ? 'rgba(74, 158, 255, 0.12)' : 'rgba(0,0,0,0.2)',
        },
      }, [
        h('div', { key: 'n', style: { fontWeight: 700, color: COLORS.text } }, c.name),
        h('div', { key: 'm', style: { fontSize: '11px', color: COLORS.dim, marginTop: '2px' } }, [
          c.preset ? t('mods|goldSpeedrun|cat|preset') : t('mods|goldSpeedrun|cat|custom'),
          ' · ',
          readBestAt(bestKeyFor(c)) !== null
            ? formatTime(readBestAt(bestKeyFor(c)), fmt)
            : t('mods|goldSpeedrun|cat|noPb'),
        ].join('')),
      ])),
      h('div', {
        key: 'new',
        style: { marginTop: '10px', padding: '10px', border: `1px solid ${COLORS.border}`, borderRadius: '8px' },
      }, [
        h('div', { key: 't', style: { font: '800 12px/1 system-ui, sans-serif', color: COLORS.gold, marginBottom: '8px' } },
          t('mods|goldSpeedrun|cat|new')),
        field('name', t('mods|goldSpeedrun|cat|name'), catDraft.name, e => { catDraft = { ...catDraft, name: e.target.value }; notifyResult(); }),
        h('label', { key: 'kind', style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: COLORS.dim, marginTop: '6px' } }, [
          h('span', { key: 'l' }, t('mods|goldSpeedrun|cat|kind')),
          h('select', {
            key: 's',
            value: catDraft.kind,
            onChange: e => { catDraft = { ...catDraft, kind: e.target.value }; notifyResult(); },
            style: { padding: '6px 8px', borderRadius: '4px', background: '#000', color: COLORS.text, border: `1px solid ${COLORS.border}` },
          }, [
            h('option', { key: 'g', value: 'gold' }, t('mods|goldSpeedrun|cat|kind|gold')),
            h('option', { key: 'a', value: 'artifacts' }, t('mods|goldSpeedrun|cat|kind|artifacts')),
            h('option', { key: 'f', value: 'factory' }, t('mods|goldSpeedrun|cat|kind|factory')),
            h('option', { key: 'fx', value: 'fluxite' }, t('mods|goldSpeedrun|cat|kind|fluxite')),
            h('option', { key: 'en', value: 'energy' }, t('mods|goldSpeedrun|cat|kind|energy')),
            h('option', { key: 'au', value: 'aura' }, t('mods|goldSpeedrun|cat|kind|aura')),
            h('option', { key: 'c', value: 'combined' }, t('mods|goldSpeedrun|cat|kind|combined')),
          ]),
        ]),
        catDraft.kind === 'combined'
          ? h('div', { key: 'combo', style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' } }, [
              dashBtn('tpl', t('mods|goldSpeedrun|cat|templateFactoryGold'), () => {
                const goals = freshCatDraft().goals;
                goals.factory.on = true;
                goals.gold.on = true;
                goals.fluxite.on = false;
                goals.aura.on = false;
                goals.artifacts.on = false;
                const auto = t('mods|goldSpeedrun|cat|templateFactoryGold');
                catDraft = { ...catDraft, kind: 'combined', goals, name: catDraft.name || auto };
                notifyResult();
              }),
              ['factory', 'gold', 'fluxite', 'energy', 'aura', 'artifacts'].map(kind => {
                const row = catDraft.goals[kind];
                return h('div', {
                  key: kind,
                  style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: COLORS.text },
                }, [
                  h('input', {
                    key: 'ck',
                    type: 'checkbox',
                    checked: row.on === true,
                    onChange: e => {
                      catDraft = { ...catDraft, goals: { ...catDraft.goals, [kind]: { ...row, on: e.target.checked } } };
                      notifyResult();
                    },
                  }),
                  h('span', { key: 'lb', style: { minWidth: '96px', flexShrink: 0 } }, t('mods|goldSpeedrun|cat|kind|' + kind)),
                  h('input', {
                    key: 'tg',
                    value: row.target,
                    onChange: e => {
                      catDraft = { ...catDraft, goals: { ...catDraft.goals, [kind]: { ...row, target: e.target.value } } };
                      notifyResult();
                    },
                    style: { width: '90px', padding: '4px 6px', borderRadius: '4px', background: '#000', color: COLORS.text, border: `1px solid ${COLORS.border}` },
                  }),
                ]);
              }),
            ])
          : field('target', t('mods|goldSpeedrun|cat|target'), catDraft.target, e => { catDraft = { ...catDraft, target: e.target.value }; notifyResult(); }),
        h('div', { key: 'go', style: { marginTop: '8px' } }, dashBtn('create', t('mods|goldSpeedrun|cat|create'), () => {
          let name = (catDraft.name || '').trim();
          let custom;
          if (catDraft.kind === 'combined') {
            const goals = ['factory', 'gold', 'fluxite', 'energy', 'aura', 'artifacts'].filter(k => catDraft.goals[k] && catDraft.goals[k].on).map(k => {
              const row = catDraft.goals[k];
              return { kind: k, target: Number(row.target) };
            });
            if (goals.length === 0) return;
            if (!name) {
              name = goals.map(g => goalPartLabel({ ...g, target: g.target > 0 ? g.target : (g.kind === 'factory' ? 6 : g.kind === 'aura' ? 10000 : g.kind === 'artifacts' ? 0 : 1000) })).join(' + ');
            }
            custom = { id: newCustomId(), name, kind: 'combined', goals };
          } else {
            if (!name) return;
            const target = Number(catDraft.target);
            const fallback = catDraft.kind === 'factory' ? 6
              : catDraft.kind === 'aura' ? 10000
              : catDraft.kind === 'fluxite' || catDraft.kind === 'energy' ? 1000
              : 100000;
            custom = {
              id: newCustomId(),
              name,
              kind: catDraft.kind,
              target: Number.isFinite(target) && target > 0 ? target : (catDraft.kind === 'artifacts' ? 0 : fallback),
            };
          }
          writeCustomCategories(readCustomCategories().concat([custom]));
          selectedCatId = custom.id;
          activateManagedCategory(custom.id);
          catDraft = freshCatDraft();
        })),
      ]),
    ]),
    h('div', {
      key: 'detail',
      style: { overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
    }, selected ? [
      h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
        h('div', { key: 'n', style: { flex: 1, font: '800 18px/1 system-ui, sans-serif', color: COLORS.gold } }, selected.name),
        selected.id === activeId
          ? h('span', { key: 'act', style: { color: COLORS.green, fontWeight: 700 } }, t('mods|goldSpeedrun|cat|active'))
          : dashBtn('activate', t('mods|goldSpeedrun|cat|activate'), () => activateManagedCategory(selected.id)),
        !selected.preset ? dashBtn('ren', t('mods|goldSpeedrun|cat|rename'), () => {
          const next = (typeof window !== 'undefined' && window.prompt) ? window.prompt(t('mods|goldSpeedrun|cat|name'), selected.name) : null;
          if (!next || !next.trim()) return;
          writeCustomCategories(readCustomCategories().map(c => c.id === selected.id ? { ...c, name: next.trim() } : c));
          notifyResult();
        }) : null,
        !selected.preset ? dashBtn('del', t('mods|goldSpeedrun|cat|delete'), () => {
          writeCustomCategories(readCustomCategories().filter(c => c.id !== selected.id));
          if (getActiveCategoryId() === selected.id) activateManagedCategory('100000');
          selectedCatId = '100000';
          notifyResult();
        }, true) : null,
        dashBtn('f3', t('mods|goldSpeedrun|cat|openTriggers'), () => {
          activateManagedCategory(selected.id);
          setTriggerPanelOpen(true);
        }),
      ]),
      h('div', { key: 'goalsum', style: { fontSize: '12px', color: COLORS.dim } }, categoryGoals(selected).map(goalLine).join(' · ')),
      h('div', { key: 'runs', style: { background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        h('div', { key: 'rh', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
          h('div', { key: 't', style: { flex: 1, font: '800 13px/1 system-ui, sans-serif', color: COLORS.gold, letterSpacing: '0.04em' } },
            t('mods|goldSpeedrun|run|title')),
          dashBtn('newr', t('mods|goldSpeedrun|run|new'), () => {
            const route = { id: newRouteId(), name: t('mods|goldSpeedrun|run|new'), splits: [] };
            editingTarget = route.id;
            routeAddDraft = { splitKey: '', time: '', picked: null };
            saveRoutes({ ...routes, routes: customRoutes.concat([route]) });
          }),
          dashBtn('impr', t('mods|goldSpeedrun|route|import'), () => {
            pickCsvFile((text, filename) => {
              const imported = csvToSplits(text);
              if (imported.length === 0) {
                api.ui.toast({ key: 'mods|goldSpeedrun|csv|importEmpty' });
                return;
              }
              const route = { id: newRouteId(), name: routeNameFromFile(filename), splits: imported };
              editingTarget = route.id;
              routeAddDraft = { splitKey: '', time: '', picked: null };
              saveRoutes({ ...routes, routes: customRoutes.concat([route]) });
              api.ui.toast({ key: 'mods|goldSpeedrun|csv|imported', params: { count: imported.length, name: route.name } });
            });
          }),
        ]),
        ...runs.map(run => {
          const customIndex = run.isPb ? -1 : customRoutes.findIndex(r => r.id === run.id);
          const isEditing = editingTarget === run.id;
          const timeLabel = Number.isFinite(run.finalMs) ? formatTime(run.finalMs, fmt) : t('mods|goldSpeedrun|cat|noPb');
          const summary = [run.name, timeLabel, t('mods|goldSpeedrun|route|splitsCount', { count: (run.splits || []).length })].join(' · ');
          return h('div', {
            key: run.id,
            style: {
              padding: '8px 0',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            },
          }, [
            h('label', {
              key: 'row',
              style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexWrap: 'wrap' },
            }, [
              h('input', {
                key: 'rad',
                type: 'radio',
                checked: comparedId === run.id,
                onChange: () => saveRoutes({ ...routes, activeRouteId: run.isPb ? null : run.id }),
                title: t('mods|goldSpeedrun|run|compareThis'),
              }),
              h('span', { key: 'n', style: { flex: 1, fontWeight: 700, minWidth: '120px' } }, [
                summary,
                run.isPb
                  ? h('span', {
                      key: 'badge',
                      style: {
                        marginLeft: '8px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        font: '700 10px/1.2 system-ui, sans-serif',
                        whiteSpace: 'nowrap',
                        background: 'rgba(240,192,64,0.16)',
                        color: COLORS.gold,
                      },
                    }, t('mods|goldSpeedrun|run|badgePb'))
                  : null,
              ]),
            ]),
            h('div', { key: 'acts', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
              dashBtn('edit' + run.id, isEditing ? t('mods|goldSpeedrun|route|doneEdit') : t('mods|goldSpeedrun|run|edit'), () => {
                editingTarget = isEditing ? null : run.id;
                routeAddDraft = { splitKey: '', time: '', picked: null };
                if (run.isPb && !isEditing) pbEditSnapshotted = false;
                notifyResult();
              }),
              !run.isPb ? dashBtn('ren' + run.id, t('mods|goldSpeedrun|route|rename'), () => {
                const next = (typeof window !== 'undefined' && window.prompt) ? window.prompt(t('mods|goldSpeedrun|route|rename'), run.name) : null;
                if (!next || !next.trim()) return;
                saveRoutes({ ...routes, routes: customRoutes.map(x => x.id === run.id ? { ...x, name: next.trim() } : x) });
              }) : null,
              dashBtn('dup' + run.id, t('mods|goldSpeedrun|route|duplicate'), () => {
                const copy = { id: newRouteId(), name: run.name + ' copy', splits: (run.splits || []).map(s => ({ ...s })) };
                saveRoutes({ ...routes, routes: customRoutes.concat([copy]) });
              }),
              dashBtn('exp' + run.id, t('mods|goldSpeedrun|route|export'), () => {
                downloadTextFile(splitsToCsv(run.splits || []), 'sandustry-run-' + (run.name || run.id) + '.csv');
              }),
              !run.isPb ? dashBtn('setpb' + run.id, t('mods|goldSpeedrun|run|markPb'), () => {
                const last = (run.splits || [])[(run.splits || []).length - 1];
                const ms = splitMs(last);
                if (!(ms >= MIN_PB_MS)) {
                  api.ui.toast({ key: 'mods|goldSpeedrun|route|setPbFail' });
                  return;
                }
                commitBestFor(selected, ms, run.splits || [], 'route_promote', run.name);
                notifyResult();
                api.ui.toast({ key: 'mods|goldSpeedrun|route|setPbDone', params: { time: formatTime(ms, fmt) } });
              }) : null,
              run.isPb ? dashBtn('hist' + run.id, t('mods|goldSpeedrun|run|history', { count: history.length }), () => {
                pbHistoryOpen = !pbHistoryOpen;
                notifyResult();
              }) : null,
              !run.isPb && customIndex > 0 ? dashBtn('upr' + run.id, t('mods|goldSpeedrun|route|up'), () => {
                const next = customRoutes.slice();
                const tmp = next[customIndex - 1]; next[customIndex - 1] = next[customIndex]; next[customIndex] = tmp;
                saveRoutes({ ...routes, routes: next });
              }) : null,
              !run.isPb && customIndex >= 0 && customIndex < customRoutes.length - 1 ? dashBtn('dnr' + run.id, t('mods|goldSpeedrun|route|down'), () => {
                const next = customRoutes.slice();
                const tmp = next[customIndex + 1]; next[customIndex + 1] = next[customIndex]; next[customIndex] = tmp;
                saveRoutes({ ...routes, routes: next });
              }) : null,
              dashBtn('del' + run.id, t('mods|goldSpeedrun|route|delete'), () => {
                if (run.isPb) {
                  const ok = typeof window === 'undefined' || !window.confirm || window.confirm(t('mods|goldSpeedrun|run|deletePbConfirm'));
                  if (!ok) return;
                  clearBest(selected);
                  if (editingTarget === PB_RUN_ID) editingTarget = null;
                  notifyResult();
                  return;
                }
                const nextRoutes = customRoutes.filter(x => x.id !== run.id);
                if (editingTarget === run.id) editingTarget = null;
                saveRoutes({
                  activeRouteId: routes.activeRouteId === run.id ? null : routes.activeRouteId,
                  routes: nextRoutes,
                });
              }, true),
            ]),
            run.isPb && pbHistoryOpen ? h('div', {
              key: 'histlist',
              style: { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' },
            }, history.length === 0
              ? h('div', { key: 'empty', style: { color: COLORS.dim, fontSize: '12px' } }, t('mods|goldSpeedrun|pb|historyEmpty'))
              : history.map((entry, i) => h('div', {
                  key: 'h' + i,
                  style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', flexWrap: 'wrap' },
                }, [
                  h('span', { key: 't', style: { fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: '110px' } },
                    Number.isFinite(entry.time) ? formatTime(entry.time, fmt) : '—'),
                  h('span', { key: 'd', style: { color: COLORS.dim, fontSize: '11px', flex: 1 } },
                    [formatHistoryWhen(entry.timestamp), historySourceLabel(entry)].filter(Boolean).join(' · ')),
                  dashBtn('rst' + i, t('mods|goldSpeedrun|pb|restore'), () => {
                    const restored = restorePbFromHistory(selected, i);
                    pbHistoryOpen = false;
                    notifyResult();
                    if (restored && Number.isFinite(restored.time)) {
                      api.ui.toast({ key: 'mods|goldSpeedrun|pb|restored', params: { time: formatTime(restored.time, fmt) } });
                    }
                  }),
                ])))
            : null,
            isEditing ? h(SplitEditor, {
              key: 'ed',
              getSplits: () => run.isPb ? readBestSplitsAt(selectedKey) : ((customRoutes.find(r => r.id === run.id) || {}).splits || []),
              setSplits: next => run.isPb ? setPbSplits(next) : setCustomSplits(run.id, next),
              choiceGroups,
              fmt,
            }) : null,
          ]);
        }),
      ]),
    ] : null),
  ]);
}

function ResultScreen() {
  try {
    const [, bump] = react.useState(0);

    react.useEffect(() => {
      const fn = () => bump(n => (n + 1) % 100000);
      resultListeners.add(fn);
      const id = setInterval(fn, 300);
      return () => { resultListeners.delete(fn); clearInterval(id); };
    }, []);

    if (!modEnabled()) return null;
    if (resultDismissed) return null;

    const run = readRun();
    const fmt = timeFormat();
    const total = elapsed();
    const totalSim = elapsedSim();
    const totalPlay = elapsedPlay();
    const slowdown = slowdownPercent();
    const deficit = tickDeficit();
    const ready = tickSourceReady();
    const splits = readSplits();
    const compared = readResultComparison();
    const best = compared.time;
    const tainted = cheatsUsed();
    const delta = best !== null ? totalPlay - best : null;
    const rulesLive = rulesetView();
    const modsInfo = rulesetStatus();

    const isBroken = !!rulesLive.broken;
    const isWait = typeof run.startedAt !== 'number';
    const isDone = typeof run.finishedAt === 'number';
    const stStr = isBroken ? 'RULES BROKEN' : (isWait ? 'Waiting' : (isDone ? 'Finished' : 'Running'));

    const chip = (key, text, isLive, tone) => {
      const palette = tone === 'green'
        ? { bg: 'rgba(74, 222, 128, 0.12)', fg: COLORS.green, bd: 'rgba(74, 222, 128, 0.4)' }
        : tone === 'red'
          ? { bg: 'rgba(224, 82, 82, 0.12)', fg: COLORS.red, bd: 'rgba(224, 82, 82, 0.4)' }
          : tone === 'blue'
            ? { bg: 'rgba(74, 158, 255, 0.12)', fg: COLORS.blue, bd: 'rgba(74, 158, 255, 0.4)' }
          : isLive
            ? {
              bg: 'rgba(240, 192, 64, 0.12)',
              fg: isBroken ? COLORS.red : isDone ? COLORS.gold : COLORS.green,
              bd: isBroken ? 'rgba(224, 82, 82, 0.4)' : isDone ? 'rgba(240, 192, 64, 0.4)' : 'rgba(74, 222, 128, 0.4)',
            }
            : { bg: 'rgba(255, 255, 255, 0.045)', fg: COLORS.dim, bd: 'rgba(255, 255, 255, 0.04)' };
      return h('span', {
        key,
        style: {
          padding: '5px 9px',
          borderRadius: '6px',
          background: palette.bg,
          font: `${isLive || tone ? '800' : '600'} 12px/1 system-ui, sans-serif`,
          color: palette.fg,
          border: `1px solid ${palette.bd}`,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }
      }, text);
    };

    const heroCard = (key, lbl, val, valColor, sub, subColor) => h('div', {
      key,
      style: {
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        padding: '10px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }
    }, [
      h('div', {
        key: 'lbl',
        style: {
          font: '800 12px/1 system-ui, sans-serif',
          color: COLORS.gold,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }
      }, lbl),
      h('div', {
        key: 'val',
        style: {
          marginTop: '6px',
          font: '800 32px/1 system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color: valColor || '#ffffff',
          textShadow: '0 2px 10px rgba(0,0,0,0.65)',
        }
      }, val),
      h('div', {
        key: 'sub',
        style: {
          marginTop: '6px',
          font: '700 12px/1.2 system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          color: subColor || COLORS.dim,
        }
      }, sub),
    ]);

    const statRow = (label, value) => h('div', {
      key: label,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '12px',
        padding: '4px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }
    }, [
      h('span', { key: 'k', style: { color: COLORS.dim, font: '600 13px/1.2 system-ui, sans-serif' } }, label),
      h('span', { key: 'v', style: { font: '700 14px/1.2 system-ui, sans-serif', fontVariantNumeric: 'tabular-nums', color: COLORS.text } }, value),
    ]);

    const actionBtn = (key, hotkey, label, onClick) => h('button', {
      key,
      onClick,
      style: {
        font: '700 13px/1.2 system-ui, sans-serif',
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${COLORS.border}`,
        background: 'rgba(0, 0, 0, 0.2)',
        color: '#d7dee6',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }
    }, [
      hotkey ? h('span', { key: 'k', style: { color: COLORS.gold, fontSize: '11px', fontWeight: 800 } }, hotkey) : null,
      h('span', { key: 'l' }, label),
    ]);

    const deltaText = best !== null ? (delta <= 0 ? '-' : '+') + formatShort(Math.abs(delta), fmt) : '—';
    const deltaColor = best === null ? COLORS.dim : delta <= 0 ? COLORS.green : COLORS.red;

    const heroBlock = h('div', {
      key: 'hero',
      style: {
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr 0.9fr',
        gap: '10px',
        padding: '10px 24px 6px',
        flexShrink: 0,
      }
    }, [
      heroCard(
        'total',
        t('mods|goldSpeedrun|result|total'),
        isWait ? dashTime(fmt) : formatTime(totalPlay, fmt),
        isDone ? '#ffd56a' : '#ffffff',
        isDone ? 'in-game time (W) · official' : 'in-game time (W)',
        COLORS.dim
      ),
      heroCard(
        'best',
        t('mods|goldSpeedrun|result|best'),
        best === null ? t('mods|goldSpeedrun|result|noBest') : formatTime(best, fmt),
        '#ffffff',
        best !== null ? `${deltaText} vs PB/Target` : '—',
        deltaColor
      ),
      heroCard(
        'slow',
        t('mods|goldSpeedrun|metric|slowdown'),
        ready ? `${fmtSigned(slowdown, 2)}%` : '—',
        !ready ? COLORS.dim : slowdown <= -5 ? '#ff8b8b' : slowdown <= -1 ? COLORS.gold : COLORS.green,
        ready ? `${t('mods|goldSpeedrun|metric|deficit')}: ${fmtSigned(Math.round(deficit), 0)} (${fmtSigned(deficit * TICK_MS / 1000, 1)} s) · ${t('mods|goldSpeedrun|metric|jamLoad')}: ${jamLoadPerUpdate().toFixed(2)}/u (${jamSharePercent().toFixed(1)}%)` : '—',
        !ready ? COLORS.dim : deficit >= 300 ? COLORS.red : deficit >= 60 ? COLORS.gold : COLORS.green
      ),
    ]);

    const leftStatsCard = h('div', {
      key: 'stats-col',
      style: {
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        padding: '12px 16px 10px',
        minHeight: 0,
        overflow: 'hidden',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }
    }, [
      h('h2', {
        key: 'title',
        style: {
          margin: '0 0 8px',
          font: '800 14px/1 system-ui, sans-serif',
          color: COLORS.gold,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }
      }, t('mods|goldSpeedrun|result|expand')),
      h('div', { key: 'metrics-list', style: { display: 'flex', flexDirection: 'column', flexShrink: 1, minHeight: 0 } }, [
        statRow(t('mods|goldSpeedrun|result|sim'), ready ? formatTime(totalSim, fmt) : '—'),
        statRow(t('mods|goldSpeedrun|result|real'), formatTime(total, fmt)),
        statRow(t('mods|goldSpeedrun|result|play'), formatTime(totalPlay, fmt)),
        statRow(t('mods|goldSpeedrun|metric|ticks'), ready ? api.i18n.formatNumber(Math.round(totalSim / TICK_MS)) : '—'),
        statRow(t('mods|goldSpeedrun|metric|avgUps'), ready && total > 0 ? ((totalSim / TICK_MS) / (total / 1000)).toFixed(1) : '—'),
        statRow(t('mods|goldSpeedrun|metric|idealTicks'), api.i18n.formatNumber(Math.round((total / 1000) * TICK_HZ))),
        statRow(t('mods|goldSpeedrun|metric|jamLoad'), ready ? `${jamLoadPerUpdate().toFixed(2)}/u (${jamSharePercent().toFixed(1)}%)` : '—'),
        statRow(t('mods|goldSpeedrun|metric|thinkMult'), ready && totalSim > 0 ? `${(total / totalSim).toFixed(2)}×` : '—'),
        statRow(t('mods|goldSpeedrun|metric|wrProbe'), `${fmtSigned(totalPlay - total, 0)} ms`),
      ]),
      h('div', {
        key: 'graph-wrap',
        style: { marginTop: 'auto', paddingTop: '12px', flexShrink: 0 }
      }, [
        h('div', {
          key: 'gcap',
          style: {
            font: '700 12px/1 system-ui, sans-serif',
            color: COLORS.dim,
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }
        }, t('mods|goldSpeedrun|graph|title')),
        h('div', {
          key: 'graph-box',
          style: {
            position: 'relative',
            padding: '6px 4px 0',
            background: 'rgba(0, 0, 0, 0.32)',
            borderRadius: '6px',
            overflow: 'hidden',
          }
        }, h(UpsEnvelopeGraph, { columns: downsampleToColumns(historyBuf, 120, bucketStats), height: 88 }))
      ])
    ]);

    const rightSplitsCard = h('div', {
      key: 'splits-col',
      style: {
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        padding: '16px 18px 14px',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }
    }, [
      h('div', {
        key: 'title-row',
        style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 14px' },
      }, [
        h('h2', {
          key: 'title',
          style: {
            margin: 0,
            flex: 1,
            font: '800 14px/1 system-ui, sans-serif',
            color: COLORS.gold,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }
        }, `SPLITS (${splits.length})`),
        actionBtn('btn-export-run', 'CSV', t('mods|goldSpeedrun|csv|exportRun'), () => {
          downloadTextFile(splitsToCsv(splits), 'sandustry-speedrun-splits.csv');
        }),
      ]),
      h('div', {
        key: 'split-head',
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 110px 110px 110px 92px',
          gap: '12px',
          alignItems: 'baseline',
          padding: '0 8px 10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
          font: '800 12px/1 system-ui, sans-serif',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: COLORS.dim,
        }
      }, [
        h('span', { key: 'a' }, t('mods|goldSpeedrun|result|colSplit')),
        h('span', { key: 'b', style: { textAlign: 'right' } }, t('mods|goldSpeedrun|result|colSegment')),
        h('span', { key: 'c', style: { textAlign: 'right' } }, t('mods|goldSpeedrun|result|colTime')),
        h('span', { key: 'd', style: { textAlign: 'right' } }, t('mods|goldSpeedrun|result|colDelta')),
        h('span', { key: 'e', style: { textAlign: 'right' } }, t('mods|goldSpeedrun|result|colGold')),
      ]),
      h('div', {
        key: 'split-list',
        style: {
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          paddingRight: '6px',
          marginTop: '4px',
        }
      }, splits.length > 0
        ? h(SplitTable, { splits, fmt, wide: true, pbSplits: compared.splits })
        : h('div', { style: { color: COLORS.dim, padding: '20px 0', textAlign: 'center' } },
            t('mods|goldSpeedrun|result|noSplits')))
    ]);

    const bodyGrid = h('div', {
      key: 'body',
      style: {
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
        gap: '16px',
        padding: '10px 24px 0',
        minHeight: 0,
        flex: 1,
      }
    }, [leftStatsCard, rightSplitsCard]);

    const footer = h('footer', {
      key: 'foot',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 24px 16px',
        flexShrink: 0,
      }
    }, [
      h('div', { key: 'actions', style: { display: 'flex', gap: '10px' } }, [
        actionBtn('btn-summary', null, 'Copy summary', () => {
          const cat = categoryLabel();
          const time = formatTime(totalPlay, 'millis');
          const seed = getMapSeed();
          const pauses = readClock('pauseCount');
          const reloads = readClock('reloadCount');
          const lines = [
            `Run Summary: ${cat}`,
            `Final Time: ${time}`,
            `Seed: ${seed}`,
            `Pauses: ${pauses}  |  Reloads: ${reloads}`,
            `Wall: ${wallClockSummary().startedAtWall ? `${formatWallClock(wallClockSummary().startedAtWall)} → ${formatWallClock(wallClockSummary().finishedAtWall || Date.now())} (${wallClockSummary().span !== null ? formatTime(wallClockSummary().span, 'seconds') : '—'})` : '—'}`,
            '',
            `Splits:`
          ];
          const padLabel = str => (str + '               ').slice(0, 15);
          splits.forEach(s => {
            let lbl = displaySplitLabel(s, splits);
            if (s.kind === 'goal') lbl = 'GOAL';
            lines.push(`  ${padLabel(lbl)}${formatTime(Number.isFinite(s.w) ? s.w : s.t, 'millis')}`);
          });
          navigator.clipboard.writeText(lines.join('\n')).catch(()=>{});
        }),
        dashboardTab !== 'categories'
          ? actionBtn('btn-png', 'PNG', t('mods|goldSpeedrun|dash|exportPng'), () => { exportDashboardPng(); })
          : null,
        actionBtn('btn-f7', 'F7', t('mods|goldSpeedrun|metrics|openBtn'), () => { setMetricsOverlayOpen(true); }),
      ]),
      h('div', {
        key: 'hint',
        style: { color: COLORS.dim, font: '600 12px/1.35 system-ui, sans-serif', textAlign: 'center', minWidth: 0 },
      }, [
        h('div', { key: 'wall' }, (() => {
          const wall = wallClockSummary();
          const startTxt = formatWallClock(wall.startedAtWall);
          const endTxt = wall.finishedAtWall ? formatWallClock(wall.finishedAtWall) : (wall.startedAtWall ? t('mods|goldSpeedrun|result|wallNow') : '—');
          const spanTxt = wall.span !== null ? formatTime(wall.span, 'seconds') : '—';
          return `${t('mods|goldSpeedrun|result|wallStart')}: ${startTxt}  →  ${t('mods|goldSpeedrun|result|wallEnd')}: ${endTxt}  ·  ${t('mods|goldSpeedrun|result|wallSpan')}: ${spanTxt}`;
        })()),
        h('div', { key: 'f10', style: { marginTop: '2px', fontSize: '11px' } }, t('mods|goldSpeedrun|result|hint')),
      ]),
      h('button', {
        key: 'close',
        onClick: () => setResultDismissed(true),
        style: {
          font: '800 14px/1 system-ui, sans-serif',
          padding: '12px 20px',
          borderRadius: '8px',
          border: `1px solid ${COLORS.gold}`,
          background: 'rgba(240, 192, 64, 0.14)',
          color: '#ffd56a',
          cursor: 'pointer',
        }
      }, t('mods|goldSpeedrun|result|close')),
    ]);

    return h('div', {
      key: 'scrim-and-dash',
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.45)',
        pointerEvents: 'auto',
        zIndex: 10020,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      onClick: e => {
        if (e.target === e.currentTarget) setResultDismissed(true);
      }
    }, [
      h('div', {
        key: 'dash-window',
        style: {
          position: 'relative',
          width: 'min(1120px, 94vw)',
          height: 'min(760px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          border: `1px solid ${tainted || !rulesLive.ok ? COLORS.red : '#4a5564'}`,
          background: COLORS.box,
          boxShadow: '0 24px 70px rgba(0,0,0,0.65)',
          color: COLORS.text,
          font: '500 14px/1.4 system-ui, sans-serif',
          overflow: 'hidden',
          pointerEvents: 'auto',
        },
        onClick: e => e.stopPropagation(),
      }, [
        h('header', {
          key: 'head',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '18px 24px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }
        }, [
          h('h1', {
            key: 'title',
            style: {
              margin: 0,
              flex: '0 1 auto',
              font: '800 22px/1 system-ui, sans-serif',
              color: COLORS.gold,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }
          }, 'Speedrun Dashboard'),
          h('div', {
            key: 'tabs',
            style: { display: 'flex', gap: '6px' },
          }, [
            ['run', t('mods|goldSpeedrun|dash|run')],
            ['categories', t('mods|goldSpeedrun|dash|categories')],
          ].map(([id, label]) => h('button', {
            key: id,
            onClick: () => { dashboardTab = id; notifyResult(); },
            style: {
              cursor: 'pointer', padding: '6px 10px', borderRadius: '6px',
              border: `1px solid ${dashboardTab === id ? COLORS.gold : COLORS.border}`,
              background: dashboardTab === id ? 'rgba(240,192,64,0.16)' : 'transparent',
              color: dashboardTab === id ? COLORS.gold : COLORS.dim,
              font: '700 12px/1 system-ui, sans-serif',
            },
          }, label))),
          h('span', {
            key: 'cat',
            style: {
              font: '700 14px/1 system-ui, sans-serif',
              color: COLORS.blue,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '280px',
            }
          }, categoryLabel()),
          h('div', {
            key: 'chips',
            style: { display: 'flex', gap: '8px', flexWrap: 'wrap' }
          }, [
            chip('st', stStr, true),
            chip('sd', `Seed: ${getMapSeed()}`, false),
            chip(
              'mods',
              modsInfo.extraCount > 0
                ? t('mods|goldSpeedrun|mods|count', { count: modsInfo.extraCount })
                : t('mods|goldSpeedrun|mods|clean'),
              false,
              modsInfo.extraCount > 0 ? null : 'green'
            ),
            chip(
              'bp',
              runUsesBlueprints()
                ? t('mods|goldSpeedrun|dash|bpUsed')
                : t('mods|goldSpeedrun|dash|noBp'),
              runUsesBlueprints(),
              runUsesBlueprints() ? 'blue' : 'green'
            ),
            (showRuleset() || !rulesLive.ok) ? chip(
              'rules',
              rulesLive.ok
                ? t('mods|goldSpeedrun|rules|badge')
                : rulesLive.broken
                  ? t('mods|goldSpeedrun|rules|broken')
                  : t('mods|goldSpeedrun|rules|invalid'),
              true,
              rulesLive.ok ? 'green' : 'red'
            ) : null,
            chip('ps', `Pauses: ${readClock('pauseCount')}`, false),
            chip('rl', `Reloads: ${readClock('reloadCount')}`, false),
          ])
        ]),
        h('div', {
          key: 'invalidWrap',
          style: { padding: '0 24px', flexShrink: 0 },
        }, h(InvalidRunBanner, { view: rulesLive, fontSize: '13px' })),
        dashboardTab === 'categories'
          ? h(CategoriesPanel, { key: 'cats', fmt })
          : h('div', { key: 'run', style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '4px' } }, [heroBlock, bodyGrid]),
        footer,
      ])
    ]);
  } catch (e) {
    log('[DEBUG] ResultScreen crashed during render: ' + e);
    return null;
  }
}

function ResultScreenSafe() {
  try {
    return h(ResultScreen, null);
  } catch (e) {
    log('[DEBUG] ResultScreen crashed: ' + e);
    return h('div', { style: { position: 'absolute', top: 0, left: 0, background: 'red', color: 'white', padding: '10px', zIndex: 99999 } }, 'ResultScreen Crashed: ' + String(e));
  }
}


// --- DE: Ausloeser-Fenster / EN: Triggers window ----------------------------
// DE: Ein Schalter je Forschung, je Fabrikrang und je Gold-Marke. Damit stellt
// DE: sich jeder seinen Lauf selbst zusammen, ohne dass die Mod-Einstellungen mit
// DE: Dutzenden Feldern zugestellt werden.
// EN: A switch for every research, every factory rank and every gold mark.
// EN: This lets everyone put their own run together, without cluttering the
// EN: mod settings with dozens of fields.
let techFilter = '';

const panelListeners = new Set();
const notifyPanel = () => panelListeners.forEach(fn => {
  try { fn(); } catch (e) { /* DE: ignorieren / EN: ignore */ }
});

const setTriggerPanelOpen = v => {
  const next = !!v;
  if (next && !triggerPanelOpen) openedF3FromDashboard = !resultDismissed;
  triggerPanelOpen = next;
  if (triggerPanelOpen) resultDismissed = true;
  if (!triggerPanelOpen && openedF3FromDashboard) {
    openedF3FromDashboard = false;
    resultDismissed = false;
  }
  notifyResult();
  notifyPanel();
};

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
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.45)',
      pointerEvents: 'auto',
      zIndex: 10030,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    onClick: e => {
      if (e.target === e.currentTarget) setTriggerPanelOpen(false);
    },
  }, [
    h('div', {
      key: 'panel',
      style: {
        position: 'relative',
        width: '520px', maxWidth: '94vw', height: '78vh',
        display: 'flex', flexDirection: 'column',
        padding: '16px 18px',
        borderRadius: '8px',
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panel,
        boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
        color: COLORS.text,
        font: '500 13px/1.4 system-ui, sans-serif',
      },
      onClick: e => e.stopPropagation(),
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
    ]),
  ]);
}

const METRIC_MOVES_COLOR = '#2dd4bf';
const METRIC_JAM_SHARE_COLOR = '#e879f9';
const METRIC_JAM_LOAD_COLOR = '#f97316';
const METRIC_SETTLED_COLOR = '#fbbf24';
const METRIC_ACTIVE_COLOR = '#fb7185';
const METRIC_DEFICIT_COLOR = '#f43f5e';

function DualAxisChart({ data, enabledLayers, onHover, hoverIdx, rangeType, scaleMode = 'linear', smoothMode = 'off', lookback = 0, eventScope = 'ballistic', pinnedRelMs = null }) {
  const svgRef = react.useRef(null);
  const wrapRef = react.useRef(null);
  const [size, setSize] = react.useState({ w: 1000, h: 420 });
  const src = data || [];
  const padCount = Math.max(0, Math.min(lookback || 0, src.length));
  const visible = src.length > padCount ? src.slice(padCount) : src;
  const isEmptyChart = visible.length < 2;
  react.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const apply = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(400, Math.round(r.width));
      const h = Math.max(180, Math.round(r.height));
      setSize(prev => (Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2) ? prev : { w, h });
    };
    apply();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEmptyChart]);
  const jamWanted = enabledLayers.jamLoad || enabledLayers.jamIntensity;
  const deficitWanted = Boolean(enabledLayers.deficit);
  const fallbackMs = rangeType === 'full' ? 1000 : 100;
  const eventOf = (c, kind) => sampleEventCount(c, kind, eventScope);
  const deficit = annotateDeficitSeries(src);

  if (visible.length < 2) {
    return h('div', {
      ref: wrapRef,
      style: {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.dim, fontSize: '14px', textAlign: 'center', padding: '16px',
      },
    }, t(trackHistoryEnabled() ? 'mods|goldSpeedrun|graph|emptyRun' : 'mods|goldSpeedrun|graph|empty'));
  }

  try {
  const W = size.w;
  const H = size.h;
  const padLeft = 55;
  const padTop = 32;
  const padBottom = 35;

  const formatCount = n => {
    if (!Number.isFinite(n)) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (Math.abs(n) >= 10) return String(Math.round(n));
    return String(Math.round(n * 100) / 100);
  };

  const isLog = scaleMode === 'log';
  const niceMax = (raw, floor) => {
    const v = Math.max(floor || 10, raw || 0);
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    if (norm <= 1) return mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  };

  // 1. Particle Counts Scale (Moves & Collisions) — visible range only
  let maxParticles = 0;
  for (let i = 0; i < visible.length; i++) {
    const c = visible[i];
    let sum = 0;
    const mv = eventOf(c, 'moves');
    const bl = eventOf(c, 'blocks');
    if (enabledLayers.moves && mv !== null) sum += mv;
    if (enabledLayers.blocks && bl !== null) sum += bl;
    if (sum > maxParticles) maxParticles = sum;
  }
  maxParticles = niceMax(maxParticles, 10);

  const logMaxP = Math.log10(Math.max(10, maxParticles) + 1);

  // 2. Awake Chunks Scale
  let maxAwake = 0;
  if (visible.length > 0) {
    const nonZeroAwake = visible.map(c => c.awake || 0).filter(v => v > 0).sort((a, b) => a - b);
    if (nonZeroAwake.length > 0) {
      const p98Idx = Math.floor(nonZeroAwake.length * 0.98);
      const p98 = nonZeroAwake[Math.min(p98Idx, nonZeroAwake.length - 1)];
      const rawMax = nonZeroAwake[nonZeroAwake.length - 1];
      if (rawMax > p98 * 2.5 && p98 >= 10) {
        maxAwake = Math.ceil(p98 * 1.35);
      } else {
        maxAwake = rawMax;
      }
    }
  }
  maxAwake = Math.max(10, Math.ceil((maxAwake || 10) / 20) * 20);

  // 3. Jam Load Scale (blocked attempts per simulation update) — rolling 5s sums
  let maxJamLoad = 0;
  if (jamWanted) {
    for (let i = 0; i < visible.length; i++) {
      const win = trailingJamWindow(src, padCount + i, eventScope, fallbackMs, JAM_WINDOW_MS);
      const inst = sampleJamInstant(visible[i], eventScope, fallbackMs);
      const v = win ? win.jamLoad : (inst ? inst.jamLoad : 0);
      if (Number.isFinite(v) && v > maxJamLoad) maxJamLoad = v;
    }
  }
  maxJamLoad = niceMax(Math.max(maxJamLoad, 0.1), 0.1);

  // 4. Live Elements Scale
  let maxLive = 0;
  if (enabledLayers.live) {
    for (let i = 0; i < visible.length; i++) {
      if ((visible[i].live || 0) > maxLive) maxLive = visible[i].live;
    }
  }
  maxLive = niceMax(maxLive, 1000);

  // 5. UPS Scale — keep 60 as a reference, but retain catch-up phases above it.
  let maxUps = TICK_HZ;
  if (enabledLayers.ups) {
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      const candidate = Math.max(
        Number.isFinite(c.max) ? c.max : 0,
        Number.isFinite(c.avg) ? c.avg : 0,
        Number.isFinite(c.ups) ? c.ups : 0
      );
      if (candidate > maxUps) maxUps = candidate;
    }
  }
  if (maxUps > TICK_HZ) {
    const step = maxUps <= 120 ? 15 : (maxUps <= 240 ? 30 : Math.max(50, niceMax(maxUps / 4, 50)));
    maxUps = Math.ceil(maxUps / step) * step;
  }

  // 6. Signed lost-time scale (seconds) — always includes 0; may go negative (over-run).
  let minDeficitSec = 0;
  let maxDeficitSec = 0;
  if (deficitWanted && deficit.d.length > 0) {
    for (let i = padCount; i < deficit.d.length; i++) {
      const a = deficit.d[i] / TICK_HZ;
      const b = deficit.dPerm[i] / TICK_HZ;
      if (Number.isFinite(a)) {
        if (a < minDeficitSec) minDeficitSec = a;
        if (a > maxDeficitSec) maxDeficitSec = a;
      }
      if (Number.isFinite(b)) {
        if (b < minDeficitSec) minDeficitSec = b;
        if (b > maxDeficitSec) maxDeficitSec = b;
      }
    }
  }
  if (minDeficitSec === 0 && maxDeficitSec === 0) {
    maxDeficitSec = 1;
  } else {
    const pad = Math.max(0.05, (maxDeficitSec - minDeficitSec) * 0.08);
    minDeficitSec -= pad;
    maxDeficitSec += pad;
  }

  // 7. Gold level (saved on each history bucket). Absent on old saves.
  let maxGold = 0;
  if (enabledLayers.gold) {
    for (let i = 0; i < visible.length; i++) {
      const g = visible[i].gold;
      if (Number.isFinite(g) && g > maxGold) maxGold = g;
    }
  }
  const goldWanted = Boolean(enabledLayers.gold) && maxGold > 0;
  if (goldWanted) maxGold = niceMax(maxGold, 10);

  const rightRails = [];
  if (enabledLayers.moves || enabledLayers.blocks) rightRails.push('counts');
  if (enabledLayers.awake) rightRails.push('awake');
  if (enabledLayers.live) rightRails.push('live');
  if (jamWanted) rightRails.push('jamLoad');
  if (enabledLayers.jamRate) rightRails.push('jamShare');
  if (deficitWanted) rightRails.push('deficit');
  if (goldWanted) rightRails.push('gold');
  const padRight = 12 + rightRails.length * 52;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const yBottom = padTop + plotH;

  const getYForParticle = v => {
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    if (n <= 0) return yBottom;
    if (isLog) {
      const ratio = Math.log10(n + 1) / logMaxP;
      return yBottom - Math.max(0, Math.min(1, ratio)) * plotH;
    }
    return yBottom - (Math.min(maxParticles, n) / maxParticles) * plotH;
  };
  const getYForAwake = v => yBottom - (Math.max(0, Math.min(maxAwake, v)) / maxAwake) * plotH;
  const getYForLive = v => yBottom - (Math.max(0, Math.min(maxLive, v)) / maxLive) * plotH;
  const getYForGold = v => {
    const n = Number(v);
    if (!Number.isFinite(n) || !(maxGold > 0)) return NaN;
    return yBottom - (Math.max(0, Math.min(maxGold, n)) / maxGold) * plotH;
  };
  const getYForJamLoad = v => yBottom - (Math.max(0, Math.min(maxJamLoad, v)) / maxJamLoad) * plotH;
  const getYForJamShare = v => yBottom - Math.max(0, Math.min(1, v)) * plotH;
  const deficitRange = maxDeficitSec - minDeficitSec;
  const getYForDeficit = v => {
    const n = Number(v);
    if (!Number.isFinite(n) || !(deficitRange > 0)) return yBottom - plotH / 2;
    return yBottom - ((n - minDeficitSec) / deficitRange) * plotH;
  };

  const colW = plotW / Math.max(1, visible.length);
  const barW = Math.max(1, colW * 0.88);

  // 5-second causal window (50 samples at 10 Hz, 5 buckets at 1 Hz)
  const windowSamples = rangeType === 'full' ? 5 : 50;
  const groupDelay = Math.floor((windowSamples - 1) / 2);

  // Causal trailing stats on the full src (includes off-screen lookback)
  const computeCausalStats = (getVal, getMin, getMax) => {
    const len = src.length;
    const avg = new Array(len);
    const min = new Array(len);
    const max = new Array(len);
    const raw = new Array(len);
    if (len === 0) return { raw, avg, min, max };

    for (let i = 0; i < len; i++) {
      raw[i] = getVal(src[i]);
      let sum = 0;
      let mn = Infinity;
      let mx = -Infinity;
      let count = 0;
      const start = Math.max(0, i - windowSamples + 1);
      for (let j = start; j <= i; j++) {
        const item = src[j];
        const v = getVal(item);
        const vMin = getMin ? getMin(item) : v;
        const vMax = getMax ? getMax(item) : v;
        if (Number.isFinite(v)) {
          sum += v;
          count++;
        }
        if (Number.isFinite(vMin) && vMin < mn) mn = vMin;
        if (Number.isFinite(vMax) && vMax > mx) mx = vMax;
      }
      avg[i] = count > 0 ? sum / count : raw[i];
      min[i] = mn !== Infinity ? mn : avg[i];
      max[i] = mx !== -Infinity ? mx : avg[i];
    }
    return { raw, avg, min, max };
  };

  const makeRawPoints = (vals, getY) => {
    const pts = [];
    for (let i = padCount; i < vals.length; i++) {
      const y = getY(vals[i]);
      if (!Number.isFinite(y)) continue;
      const visIdx = i - padCount;
      const x = padLeft + (visIdx + 0.5) * colW;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts;
  };

  // Group-delay aligned smooth: at visible x[k] draw avg[pad + k + delay]
  // so the left edge has a full window from off-screen samples and does not jump.
  const makeAlignedSmoothPoints = (vals, getY) => {
    const pts = [];
    for (let k = 0; k < visible.length; k++) {
      const srcIdx = padCount + k + groupDelay;
      if (srcIdx >= vals.length) break;
      const y = getY(vals[srcIdx]);
      if (!Number.isFinite(y)) continue;
      const x = padLeft + (k + 0.5) * colW;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts;
  };

  const makeAlignedEnvelopePath = (minVals, maxVals, getY) => {
    if (!minVals || !maxVals || visible.length < 2) return null;
    const topPts = [];
    const btmPts = [];
    for (let k = 0; k < visible.length; k++) {
      const srcIdx = padCount + k + groupDelay;
      if (srcIdx >= minVals.length) break;
      const yMaxVal = getY(maxVals[srcIdx]);
      const yMinVal = getY(minVals[srcIdx]);
      if (!Number.isFinite(yMaxVal) || !Number.isFinite(yMinVal)) continue;
      const x = (padLeft + (k + 0.5) * colW).toFixed(1);
      topPts.push(`${x},${yMaxVal.toFixed(1)}`);
      btmPts.push(`${x},${yMinVal.toFixed(1)}`);
    }
    if (topPts.length < 2) return null;
    return `M ${topPts.join(' L ')} L ${btmPts.reverse().join(' L ')} Z`;
  };

  const makeEnvelopePath = (minVals, maxVals, getY) => {
    if (!minVals || !maxVals || minVals.length < padCount + 2) return null;
    const topPts = [];
    const btmPts = [];
    for (let i = padCount; i < minVals.length; i++) {
      const yMaxVal = getY(maxVals[i]);
      const yMinVal = getY(minVals[i]);
      if (!Number.isFinite(yMaxVal) || !Number.isFinite(yMinVal)) continue;
      const visIdx = i - padCount;
      const x = (padLeft + (visIdx + 0.5) * colW).toFixed(1);
      topPts.push(`${x},${yMaxVal.toFixed(1)}`);
      btmPts.push(`${x},${yMinVal.toFixed(1)}`);
    }
    if (topPts.length < 2) return null;
    return `M ${topPts.join(' L ')} L ${btmPts.reverse().join(' L ')} Z`;
  };

  const makeGappedRawPoints = (vals, getY) => {
    const segs = [];
    let cur = [];
    for (let i = padCount; i < vals.length; i++) {
      const v = vals[i];
      const y = Number.isFinite(v) ? getY(v) : NaN;
      if (!Number.isFinite(y)) {
        if (cur.length > 1) segs.push(cur);
        cur = [];
        continue;
      }
      const visIdx = i - padCount;
      const x = padLeft + (visIdx + 0.5) * colW;
      cur.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    if (cur.length > 1) segs.push(cur);
    return segs;
  };

  const pushPolylines = (target, keyPrefix, segments, attrs) => {
    segments.forEach((pts, i) => {
      if (pts.length > 1) target.push(h('polyline', { key: `${keyPrefix}-${i}`, points: pts.join(' '), fill: 'none', ...attrs }));
    });
  };

  // Particle Elements (Moves & Blocks)
  const particleElements = [];
  if (enabledLayers.moves || enabledLayers.blocks) {
    const getY = getYForParticle;
    const movesStats = enabledLayers.moves ? computeCausalStats(c => {
      const v = eventOf(c, 'moves');
      return v === null ? NaN : v;
    }) : null;
    const blocksStats = enabledLayers.blocks ? computeCausalStats(c => {
      const v = eventOf(c, 'blocks');
      return v === null ? NaN : v;
    }) : null;

    if (smoothMode === 'off') {
      if (rangeType === '60s' && visible.length <= 600) {
        // Discrete stacked bars for 60s
        visible.forEach((c, i) => {
          const x = padLeft + i * colW + (colW - barW) / 2;
          const movesVal = enabledLayers.moves ? (eventOf(c, 'moves') || 0) : 0;
          const blocksVal = enabledLayers.blocks ? (eventOf(c, 'blocks') || 0) : 0;
          const yMoves = getY(movesVal);
          const yTotal = getY(movesVal + blocksVal);
          if (movesVal > 0) {
            const bh = Math.max(0.5, yBottom - yMoves);
            particleElements.push(h('rect', {
              key: `moves-${i}`,
              x, y: yBottom - bh, width: barW, height: bh,
              fill: METRIC_MOVES_COLOR, opacity: 0.85,
            }));
          }
          if (blocksVal > 0) {
            const baseH = yBottom - yMoves;
            const totalH = yBottom - yTotal;
            const bh = Math.max(0.5, totalH - baseH);
            particleElements.push(h('rect', {
              key: `blocks-${i}`,
              x, y: yMoves - bh, width: barW, height: bh,
              fill: '#f87171', opacity: 0.95,
            }));
          }
        });
      } else {
        if (movesStats) {
          const pts = makeRawPoints(movesStats.raw, getY);
          if (pts.length > 1) {
            particleElements.push(h('polyline', { key: 'moves-raw', points: pts.join(' '), fill: 'none', stroke: METRIC_MOVES_COLOR, strokeWidth: 1.0 }));
          }
        }
        if (blocksStats) {
          const pts = makeRawPoints(blocksStats.raw, getY);
          if (pts.length > 1) {
            particleElements.push(h('polyline', { key: 'blocks-raw', points: pts.join(' '), fill: 'none', stroke: '#f87171', strokeWidth: 1.0 }));
          }
        }
      }
    } else if (smoothMode === 'rolling') {
      if (movesStats) {
        const rawPts = makeRawPoints(movesStats.raw, getY);
        const avgPts = makeAlignedSmoothPoints(movesStats.avg, getY);
        if (rawPts.length > 1) {
          particleElements.push(h('polyline', { key: 'moves-raw', points: rawPts.join(' '), fill: 'none', stroke: METRIC_MOVES_COLOR, strokeWidth: 1.0, opacity: 0.28 }));
        }
        if (avgPts.length > 1) {
          particleElements.push(h('polyline', { key: 'moves-avg', points: avgPts.join(' '), fill: 'none', stroke: METRIC_MOVES_COLOR, strokeWidth: 1.0 }));
        }
      }
      if (blocksStats) {
        const rawPts = makeRawPoints(blocksStats.raw, getY);
        const avgPts = makeAlignedSmoothPoints(blocksStats.avg, getY);
        if (rawPts.length > 1) {
          particleElements.push(h('polyline', { key: 'blocks-raw', points: rawPts.join(' '), fill: 'none', stroke: '#f87171', strokeWidth: 1.0, opacity: 0.28 }));
        }
        if (avgPts.length > 1) {
          particleElements.push(h('polyline', { key: 'blocks-avg', points: avgPts.join(' '), fill: 'none', stroke: '#f87171', strokeWidth: 1.0 }));
        }
      }
    } else if (smoothMode === 'bands') {
      if (movesStats) {
        const envPath = makeAlignedEnvelopePath(movesStats.min, movesStats.max, getY);
        const avgPts = makeAlignedSmoothPoints(movesStats.avg, getY);
        if (envPath) particleElements.push(h('path', { key: 'moves-band', d: envPath, fill: METRIC_MOVES_COLOR, opacity: 0.14 }));
        if (avgPts.length > 1) particleElements.push(h('polyline', { key: 'moves-avg', points: avgPts.join(' '), fill: 'none', stroke: METRIC_MOVES_COLOR, strokeWidth: 1.0 }));
      }
      if (blocksStats) {
        const envPath = makeAlignedEnvelopePath(blocksStats.min, blocksStats.max, getY);
        const avgPts = makeAlignedSmoothPoints(blocksStats.avg, getY);
        if (envPath) particleElements.push(h('path', { key: 'blocks-band', d: envPath, fill: '#f87171', opacity: 0.20 }));
        if (avgPts.length > 1) particleElements.push(h('polyline', { key: 'blocks-avg', points: avgPts.join(' '), fill: 'none', stroke: '#f87171', strokeWidth: 1.0 }));
      }
    }
  }

  const splitElements = [];
  if (eventScope === 'allMatter') {
    const addSplitSeries = (key, color, kind, enabled) => {
      if (!enabled) return;
      const stats = computeCausalStats(c => {
        const v = eventOf(c, kind);
        return v === null ? NaN : v;
      });
      if (!stats) return;
      const getY = getYForParticle;
      const rawPts = makeRawPoints(stats.raw, getY);
      const avgPts = makeAlignedSmoothPoints(stats.avg, getY);
      if (smoothMode === 'rolling') {
        if (rawPts.length > 1) splitElements.push(h('polyline', { key: `${key}-raw`, points: rawPts.join(' '), fill: 'none', stroke: color, strokeWidth: 1.0, opacity: 0.28, strokeDasharray: '4 3' }));
        if (avgPts.length > 1) splitElements.push(h('polyline', { key: `${key}-avg`, points: avgPts.join(' '), fill: 'none', stroke: color, strokeWidth: 1.2, strokeDasharray: '4 3' }));
      } else if (rawPts.length > 1) {
        splitElements.push(h('polyline', { key: `${key}-raw`, points: rawPts.join(' '), fill: 'none', stroke: color, strokeWidth: 1.0, strokeDasharray: '4 3' }));
      }
    };
    addSplitSeries('settled', METRIC_SETTLED_COLOR, 'settled', enabledLayers.blocksSettled);
    addSplitSeries('active', METRIC_ACTIVE_COLOR, 'active', enabledLayers.blocksActive);
  }

  // Jam Share (%) — rolling sum(blocks)/sum(blocks+moves)
  const jamElements = [];
  if (enabledLayers.jamRate && src.length > 0) {
    const getY = getYForJamShare;
    const raw = new Array(src.length);
    const avg = new Array(src.length);
    const min = new Array(src.length);
    const max = new Array(src.length);
    for (let i = 0; i < src.length; i++) {
      const inst = sampleJamInstant(src[i], eventScope, fallbackMs);
      const win = trailingJamWindow(src, i, eventScope, fallbackMs, JAM_WINDOW_MS);
      raw[i] = inst ? inst.jamShare : NaN;
      avg[i] = win ? win.jamShare : NaN;
      min[i] = win ? win.minShare : NaN;
      max[i] = win ? win.maxShare : NaN;
    }
    const rawPts = makeRawPoints(raw, getY);
    const avgPts = makeAlignedSmoothPoints(avg, getY);
    if (smoothMode === 'off') {
      if (rawPts.length > 1) jamElements.push(h('polyline', { key: 'jam-line', points: rawPts.join(' '), fill: 'none', stroke: METRIC_JAM_SHARE_COLOR, strokeWidth: 1.0 }));
    } else if (smoothMode === 'rolling') {
      if (rawPts.length > 1) jamElements.push(h('polyline', { key: 'jam-raw', points: rawPts.join(' '), fill: 'none', stroke: METRIC_JAM_SHARE_COLOR, strokeWidth: 1.0, opacity: 0.28 }));
      if (avgPts.length > 1) jamElements.push(h('polyline', { key: 'jam-avg', points: avgPts.join(' '), fill: 'none', stroke: METRIC_JAM_SHARE_COLOR, strokeWidth: 1.0 }));
    } else if (smoothMode === 'bands') {
      const envPath = makeAlignedEnvelopePath(min, max, getY);
      if (envPath) jamElements.push(h('path', { key: 'jam-band', d: envPath, fill: METRIC_JAM_SHARE_COLOR, opacity: 0.15 }));
      if (avgPts.length > 1) jamElements.push(h('polyline', { key: 'jam-avg', points: avgPts.join(' '), fill: 'none', stroke: METRIC_JAM_SHARE_COLOR, strokeWidth: 1.0 }));
    }
  }

  // Jam Load (blocked attempts per simulation update)
  const jamIntElements = [];
  if (jamWanted && src.length > 0) {
    const getY = getYForJamLoad;
    const raw = new Array(src.length);
    const avg = new Array(src.length);
    const min = new Array(src.length);
    const max = new Array(src.length);
    for (let i = 0; i < src.length; i++) {
      const inst = sampleJamInstant(src[i], eventScope, fallbackMs);
      const win = trailingJamWindow(src, i, eventScope, fallbackMs, JAM_WINDOW_MS);
      raw[i] = inst ? inst.jamLoad : NaN;
      avg[i] = win ? win.jamLoad : NaN;
      min[i] = win ? win.minLoad : NaN;
      max[i] = win ? win.maxLoad : NaN;
    }
    const rawSegs = makeGappedRawPoints(raw, getY);
    const avgPts = makeAlignedSmoothPoints(avg, getY);
    if (smoothMode === 'off') {
      pushPolylines(jamIntElements, 'jam-load', rawSegs, { stroke: METRIC_JAM_LOAD_COLOR, strokeWidth: 1.0 });
    } else if (smoothMode === 'rolling') {
      pushPolylines(jamIntElements, 'jam-load-raw', rawSegs, { stroke: METRIC_JAM_LOAD_COLOR, strokeWidth: 1.0, opacity: 0.28 });
      if (avgPts.length > 1) jamIntElements.push(h('polyline', { key: 'jam-load-avg', points: avgPts.join(' '), fill: 'none', stroke: METRIC_JAM_LOAD_COLOR, strokeWidth: 1.0 }));
    } else if (smoothMode === 'bands') {
      const envPath = makeAlignedEnvelopePath(min, max, getY);
      if (envPath) jamIntElements.push(h('path', { key: 'jam-load-band', d: envPath, fill: METRIC_JAM_LOAD_COLOR, opacity: 0.15 }));
      if (avgPts.length > 1) jamIntElements.push(h('polyline', { key: 'jam-load-avg', points: avgPts.join(' '), fill: 'none', stroke: METRIC_JAM_LOAD_COLOR, strokeWidth: 1.0 }));
    }
  }

  // Awake Chunks Series (Cyan #38bdf8)
  const awakeElements = [];
  if (enabledLayers.awake && data.length > 0) {
    const getY = getYForAwake;
    const stats = computeCausalStats(c => Math.max(0, Math.min(maxAwake, c.awake || 0)));
    const rawPts = makeRawPoints(stats.raw, getY);
    const avgPts = makeAlignedSmoothPoints(stats.avg, getY);
    if (smoothMode === 'off') {
      if (rawPts.length > 1) {
        const firstX = (padLeft + 0.5 * colW).toFixed(1);
        const lastX = (padLeft + (visible.length - 0.5) * colW).toFixed(1);
        const areaPath = `M ${firstX},${yBottom} L ${rawPts.join(' L ')} L ${lastX},${yBottom} Z`;
        awakeElements.push(h('path', { key: 'awake-area', d: areaPath, fill: '#38bdf8', opacity: 0.08 }));
        awakeElements.push(h('polyline', { key: 'awake-line', points: rawPts.join(' '), fill: 'none', stroke: '#38bdf8', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'rolling') {
      if (rawPts.length > 1) {
        awakeElements.push(h('polyline', { key: 'awake-raw', points: rawPts.join(' '), fill: 'none', stroke: '#38bdf8', strokeWidth: 1.0, opacity: 0.28 }));
      }
      if (avgPts.length > 1) {
        awakeElements.push(h('polyline', { key: 'awake-avg', points: avgPts.join(' '), fill: 'none', stroke: '#38bdf8', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'bands') {
      const envPath = makeAlignedEnvelopePath(stats.min, stats.max, getY);
      if (envPath) awakeElements.push(h('path', { key: 'awake-band', d: envPath, fill: '#38bdf8', opacity: 0.12 }));
      if (avgPts.length > 1) {
        awakeElements.push(h('polyline', { key: 'awake-avg', points: avgPts.join(' '), fill: 'none', stroke: '#38bdf8', strokeWidth: 1.0 }));
      }
    }
  }

  // Live Elements (Dynamic) Series (Slate #94a3b8 - Solid line, no dash crawl)
  const liveElements = [];
  if (enabledLayers.live && data.length > 0) {
    const getY = getYForLive;
    const stats = computeCausalStats(c => Math.max(0, Math.min(maxLive, c.live || 0)));
    const rawPts = makeRawPoints(stats.raw, getY);
    const avgPts = makeAlignedSmoothPoints(stats.avg, getY);
    if (smoothMode === 'off') {
      if (rawPts.length > 1) {
        liveElements.push(h('polyline', { key: 'live-line', points: rawPts.join(' '), fill: 'none', stroke: '#94a3b8', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'rolling') {
      if (rawPts.length > 1) {
        liveElements.push(h('polyline', { key: 'live-raw', points: rawPts.join(' '), fill: 'none', stroke: '#94a3b8', strokeWidth: 1.0, opacity: 0.28 }));
      }
      if (avgPts.length > 1) {
        liveElements.push(h('polyline', { key: 'live-avg', points: avgPts.join(' '), fill: 'none', stroke: '#94a3b8', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'bands') {
      const envPath = makeAlignedEnvelopePath(stats.min, stats.max, getY);
      if (envPath) liveElements.push(h('path', { key: 'live-band', d: envPath, fill: '#94a3b8', opacity: 0.12 }));
      if (avgPts.length > 1) {
        liveElements.push(h('polyline', { key: 'live-avg', points: avgPts.join(' '), fill: 'none', stroke: '#94a3b8', strokeWidth: 1.0 }));
      }
    }
  }

  // Sim Compute Time Series (Purple #c084fc - Solid line, no dash crawl)
  const simElements = [];
  if (enabledLayers.simTime && data.length > 0) {
    const getY = v => yBottom - (Math.max(0, Math.min(33.3, v)) / 33.3) * plotH;
    const stats = computeCausalStats(c => Math.max(0, Math.min(33.3, c.simMs || 0)));
    const rawPts = makeRawPoints(stats.raw, getY);
    const avgPts = makeAlignedSmoothPoints(stats.avg, getY);
    if (smoothMode === 'off') {
      if (rawPts.length > 1) {
        simElements.push(h('polyline', { key: 'sim-line', points: rawPts.join(' '), fill: 'none', stroke: '#c084fc', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'rolling') {
      if (rawPts.length > 1) {
        simElements.push(h('polyline', { key: 'sim-raw', points: rawPts.join(' '), fill: 'none', stroke: '#c084fc', strokeWidth: 1.0, opacity: 0.28 }));
      }
      if (avgPts.length > 1) {
        simElements.push(h('polyline', { key: 'sim-avg', points: avgPts.join(' '), fill: 'none', stroke: '#c084fc', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'bands') {
      const envPath = makeAlignedEnvelopePath(stats.min, stats.max, getY);
      if (envPath) simElements.push(h('path', { key: 'sim-band', d: envPath, fill: '#c084fc', opacity: 0.15 }));
      if (avgPts.length > 1) {
        simElements.push(h('polyline', { key: 'sim-avg', points: avgPts.join(' '), fill: 'none', stroke: '#c084fc', strokeWidth: 1.0 }));
      }
    }
  }

  // UPS Series (Green #4ade80)
  const upsElements = [];
  if (enabledLayers.ups && data.length > 0) {
    const getY = v => yBottom - (Math.max(0, Math.min(maxUps, v)) / maxUps) * plotH;
    const stats = computeCausalStats(
      c => c.avg !== undefined ? c.avg : (c.ups !== undefined ? c.ups : 0),
      c => c.min !== undefined ? c.min : (c.avg !== undefined ? c.avg : (c.ups !== undefined ? c.ups : 0)),
      c => c.max !== undefined ? c.max : (c.avg !== undefined ? c.avg : (c.ups !== undefined ? c.ups : 0))
    );
    const rawPts = makeRawPoints(stats.raw, getY);
    const avgPts = makeAlignedSmoothPoints(stats.avg, getY);
    if (smoothMode === 'off') {
      const hasPerBucketMinMax = src.some(c => c.min !== undefined && c.max !== undefined && c.min !== c.max);
      if (hasPerBucketMinMax) {
        const minVals = src.map(c => c.min !== undefined ? c.min : (c.avg !== undefined ? c.avg : c.ups));
        const maxVals = src.map(c => c.max !== undefined ? c.max : (c.avg !== undefined ? c.avg : c.ups));
        const envPath = makeEnvelopePath(minVals, maxVals, getY);
        if (envPath) upsElements.push(h('path', { key: 'ups-env', d: envPath, fill: '#4ade80', opacity: 0.18 }));
      }
      if (rawPts.length > 1) {
        upsElements.push(h('polyline', { key: 'ups-line', points: rawPts.join(' '), fill: 'none', stroke: '#4ade80', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'rolling') {
      if (rawPts.length > 1) {
        upsElements.push(h('polyline', { key: 'ups-raw', points: rawPts.join(' '), fill: 'none', stroke: '#4ade80', strokeWidth: 1.0, opacity: 0.28 }));
      }
      if (avgPts.length > 1) {
        upsElements.push(h('polyline', { key: 'ups-avg', points: avgPts.join(' '), fill: 'none', stroke: '#4ade80', strokeWidth: 1.0 }));
      }
    } else if (smoothMode === 'bands') {
      const envPath = makeAlignedEnvelopePath(stats.min, stats.max, getY);
      if (envPath) upsElements.push(h('path', { key: 'ups-band', d: envPath, fill: '#4ade80', opacity: 0.18 }));
      if (avgPts.length > 1) {
        upsElements.push(h('polyline', { key: 'ups-avg', points: avgPts.join(' '), fill: 'none', stroke: '#4ade80', strokeWidth: 1.0 }));
      }
    }
  }

  const goldElements = [];
  if (goldWanted && data.length > 0) {
    const getY = getYForGold;
    const stats = computeCausalStats(c => (Number.isFinite(c.gold) ? c.gold : NaN));
    const rawPts = makeRawPoints(stats.raw, getY);
    const avgPts = makeAlignedSmoothPoints(stats.avg, getY);
    if (smoothMode === 'off' || smoothMode === 'bands') {
      if (rawPts.length > 1) {
        goldElements.push(h('polyline', { key: 'gold-line', points: rawPts.join(' '), fill: 'none', stroke: COLORS.gold, strokeWidth: 1.5 }));
      }
    } else if (smoothMode === 'rolling') {
      if (rawPts.length > 1) {
        goldElements.push(h('polyline', { key: 'gold-raw', points: rawPts.join(' '), fill: 'none', stroke: COLORS.gold, strokeWidth: 1.0, opacity: 0.28 }));
      }
      if (avgPts.length > 1) {
        goldElements.push(h('polyline', { key: 'gold-avg', points: avgPts.join(' '), fill: 'none', stroke: COLORS.gold, strokeWidth: 1.5 }));
      }
    }
  }

  // Grid lines (Solid lines, no dashed shimmer)
  const gridLines = [];
  const upsTickStep = maxUps <= 120 ? 15 : (maxUps <= 240 ? 30 : Math.max(50, niceMax(maxUps / 4, 50)));
  const leftTickSet = new Set([0, TICK_HZ, maxUps]);
  for (let val = upsTickStep; val < maxUps; val += upsTickStep) leftTickSet.add(val);
  const leftTicks = Array.from(leftTickSet).sort((a, b) => a - b);
  leftTicks.forEach(val => {
    const y = yBottom - (val / maxUps) * plotH;
    gridLines.push(h('line', {
      key: `grid-${val}`,
      x1: padLeft, y1: y, x2: padLeft + plotW, y2: y,
      stroke: val === TICK_HZ ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255,255,255,0.08)',
      strokeWidth: val === TICK_HZ ? 1.5 : 1,
    }));
    gridLines.push(h('text', {
      key: `lbl-left-${val}`,
      x: padLeft - 8, y: y + 4,
      fill: val === TICK_HZ ? '#4ade80' : COLORS.dim,
      fontSize: '11px', textAnchor: 'end', fontFamily: 'ui-monospace, monospace',
      fontWeight: val === TICK_HZ ? 'bold' : 'normal',
    }, String(val)));
  });

  const railDefs = {
    counts: {
      color: METRIC_MOVES_COLOR,
      title: isLog ? 'Counts (Log)' : 'Counts',
      ticks: isLog
        ? (() => {
          const powers = [1, 10, 100, 1000, 10000, 100000, 1000000].filter(p => p <= maxParticles);
          if (powers.length === 0 || powers[0] !== 0) powers.unshift(0);
          if (maxParticles > powers[powers.length - 1] * 2) powers.push(maxParticles);
          return powers;
        })()
        : [0, Math.round(maxParticles / 2), maxParticles],
      getY: getYForParticle,
      fmt: formatCount,
    },
    awake: {
      color: '#38bdf8',
      title: 'Chunks',
      ticks: [0, Math.round(maxAwake / 2), maxAwake],
      getY: getYForAwake,
      fmt: formatCount,
    },
    live: {
      color: '#94a3b8',
      title: 'Live pop',
      ticks: [0, Math.round(maxLive / 2), maxLive],
      getY: getYForLive,
      fmt: formatCount,
    },
    jamLoad: {
      color: METRIC_JAM_LOAD_COLOR,
      title: 'Jam load',
      ticks: [0, maxJamLoad / 2, maxJamLoad],
      getY: getYForJamLoad,
      fmt: v => (v >= 10 ? formatCount(v) : (Math.round(v * 100) / 100).toFixed(2)),
    },
    jamShare: {
      color: METRIC_JAM_SHARE_COLOR,
      title: 'Jam %',
      ticks: [0, 0.25, 0.5, 0.75, 1],
      getY: getYForJamShare,
      fmt: v => `${Math.round(v * 100)}%`,
    },
    deficit: {
      color: METRIC_DEFICIT_COLOR,
      title: 'Lost s',
      ticks: (() => {
        const ticks = [minDeficitSec, maxDeficitSec];
        if (minDeficitSec < 0 && maxDeficitSec > 0) ticks.splice(1, 0, 0);
        return ticks;
      })(),
      getY: getYForDeficit,
      fmt: v => formatSecSigned(v).replace(' s', ''),
    },
    gold: {
      color: COLORS.gold,
      title: 'Gold',
      ticks: [0, Math.round(maxGold / 2), maxGold],
      getY: getYForGold,
      fmt: v => formatGold(v),
    },
  };

  rightRails.forEach((id, railIdx) => {
    const rail = railDefs[id];
    if (!rail) return;
    const xRail = padLeft + plotW + 8 + railIdx * 52;
    gridLines.push(h('line', {
      key: `rail-${id}`,
      x1: xRail, y1: padTop, x2: xRail, y2: yBottom,
      stroke: rail.color, strokeWidth: 1.5, opacity: 0.55,
    }));
    rail.ticks.forEach(val => {
      const y = rail.getY(val);
      gridLines.push(h('text', {
        key: `lbl-rail-${id}-${val}`,
        x: xRail + 4, y: y + 4,
        fill: rail.color,
        fontSize: '10px', textAnchor: 'start', fontFamily: 'ui-monospace, monospace',
      }, rail.fmt(val)));
    });
    const titleY = padTop + (yBottom - padTop) / 2;
    const titleX = xRail - 3;
    gridLines.push(h('text', {
      key: `title-rail-${id}`,
      x: titleX,
      y: titleY,
      fill: rail.color, fontSize: '10px', textAnchor: 'middle', fontWeight: 'bold',
      fontFamily: 'ui-monospace, monospace',
      transform: `rotate(-90 ${titleX} ${titleY})`,
    }, rail.title));
  });

  if (enabledLayers.jamRate) {
    [0.25, 0.5, 0.75].forEach(frac => {
      const y = getYForJamShare(frac);
      gridLines.push(h('line', {
        key: `jam-guide-${frac}`,
        x1: padLeft, y1: y, x2: padLeft + plotW, y2: y,
        stroke: 'rgba(232, 121, 249, 0.18)', strokeWidth: 1,
      }));
    });
  }

  // 16.6 ms sim compute budget reference line
  if (enabledLayers.simTime) {
    const y16 = yBottom - (16.66 / 33.3) * plotH;
    gridLines.push(h('line', {
      key: 'sim-budget',
      x1: padLeft, y1: y16, x2: padLeft + plotW, y2: y16,
      stroke: 'rgba(192, 132, 252, 0.35)', strokeWidth: 1,
    }));
    gridLines.push(h('text', {
      key: 'lbl-sim-budget',
      x: padLeft + plotW - 4, y: y16 - 4,
      fill: '#c084fc', fontSize: '10px', textAnchor: 'end', fontFamily: 'system-ui, sans-serif',
    }, '16.6ms (60 UPS Step Budget)'));
  }

  if (deficitWanted && minDeficitSec < 0 && maxDeficitSec > 0) {
    const y0 = getYForDeficit(0);
    gridLines.push(h('line', {
      key: 'deficit-zero',
      x1: padLeft, y1: y0, x2: padLeft + plotW, y2: y0,
      stroke: 'rgba(244, 63, 94, 0.35)', strokeWidth: 1,
    }));
  }

  // Slowdown phase bands (always, even if the deficit curve is off)
  const slowdownBandEls = [];
  if (deficit.phases && deficit.phases.length > 0 && visible.length > 0) {
    for (let p = 0; p < deficit.phases.length; p++) {
      const ph = deficit.phases[p];
      const visStart = Math.max(0, ph.startIdx - padCount);
      const visEnd = Math.min(visible.length - 1, ph.endIdx - padCount);
      if (visEnd < visStart) continue;
      if (ph.endIdx < padCount || ph.startIdx >= src.length) continue;
      const x = padLeft + visStart * colW;
      const w = Math.max(1, (visEnd - visStart + 1) * colW);
      slowdownBandEls.push(h('rect', {
        key: `sd-band-${ph.startIdx}-${ph.endIdx}`,
        x, y: padTop, width: w, height: plotH,
        fill: 'rgba(239, 68, 68, 0.12)',
      }));
    }
  }

  // Lost-time series (signed seconds). D faint, D_perm solid.
  const deficitElements = [];
  if (deficitWanted && deficit.d.length > 0) {
    const getY = getYForDeficit;
    const rawSec = deficit.d.map(v => v / TICK_HZ);
    const permSec = deficit.dPerm.map(v => v / TICK_HZ);
    const rawPts = makeRawPoints(rawSec, getY);
    const permPts = makeRawPoints(permSec, getY);
    if (rawPts.length > 1) {
      deficitElements.push(h('polyline', {
        key: 'deficit-d', points: rawPts.join(' '), fill: 'none',
        stroke: METRIC_DEFICIT_COLOR, strokeWidth: 1.0, opacity: 0.28,
      }));
    }
    if (permPts.length > 1) {
      deficitElements.push(h('polyline', {
        key: 'deficit-perm', points: permPts.join(' '), fill: 'none',
        stroke: METRIC_DEFICIT_COLOR, strokeWidth: 1.5,
      }));
    }
  }

  // X Axis time labels: evenly spaced with -m:ss format
  const xLabels = [];
  const labelCount = 5;
  for (let s = 0; s < labelCount; s++) {
    const frac = s / (labelCount - 1);
    const idx = Math.min(visible.length - 1, Math.floor(frac * (visible.length - 1)));
    const x = padLeft + frac * plotW;
    let label = '';
    if (rangeType === '60s') {
      const sec = Math.round((1 - frac) * 60);
      label = sec === 0 ? 'Now' : `-${sec}s`;
    } else if (rangeType === '180s') {
      const sec = Math.round((1 - frac) * 180);
      if (sec === 0) {
        label = 'Now';
      } else {
        const m = Math.floor(sec / 60);
        const remS = sec % 60;
        label = `-${m}:${String(remS).padStart(2, '0')}`;
      }
    } else {
      const curWorldTime = now();
      const d = visible[idx];
      let rel = (d && Number.isFinite(d.relMs) && d.relMs > 0) ? d.relMs : 0;
      if (!(rel > 0) && curWorldTime > 0) {
        rel = (idx / Math.max(1, visible.length - 1)) * curWorldTime;
      }
      label = rel > 0 ? formatShort(rel, 'seconds') : String(idx + 1);
    }
    xLabels.push(h('text', {
      key: `lbl-x-${s}`,
      x, y: H - 12,
      fill: COLORS.dim, fontSize: '11px', textAnchor: s === 0 ? 'start' : s === labelCount - 1 ? 'end' : 'middle',
      fontFamily: 'system-ui, sans-serif',
    }, label));
  }

  // Mouse move handler
  const handleMouseMove = e => {
    if (!svgRef.current || visible.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseSvgX = ((e.clientX - rect.left) / rect.width) * W;
    if (mouseSvgX < padLeft || mouseSvgX > padLeft + plotW) {
      if (onHover) onHover(null);
      return;
    }
    const idx = Math.min(visible.length - 1, Math.max(0, Math.floor((mouseSvgX - padLeft) / colW)));
    if (onHover) onHover({ index: idx, item: visible[idx], clientX: e.clientX, clientY: e.clientY });
  };

  const handleMouseLeave = () => {
    if (onHover) onHover(null);
  };

  // Crosshair (Solid 45% white line for hover, or dashed gold line for pinned scrub)
  let crosshair = null;
  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < visible.length) {
    const crossX = padLeft + (hoverIdx + 0.5) * colW;
    crosshair = h('g', { key: 'crosshair' }, [
      h('line', {
        x1: crossX, y1: padTop, x2: crossX, y2: yBottom,
        stroke: 'rgba(255, 255, 255, 0.45)', strokeWidth: 1.5,
      }),
    ]);
  } else if (pinnedRelMs !== null && visible.length > 0) {
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < visible.length; i++) {
      const r = visible[i].relMs || 0;
      const d = Math.abs(r - pinnedRelMs);
      if (d < minDiff) { minDiff = d; closestIdx = i; }
    }
    const crossX = padLeft + (closestIdx + 0.5) * colW;
    crosshair = h('g', { key: 'pinned-crosshair' }, [
      h('line', {
        x1: crossX, y1: padTop, x2: crossX, y2: yBottom,
        stroke: '#fbbf24', strokeWidth: 1.5, strokeDasharray: '4 3',
      }),
    ]);
  }

  return h('div', {
    ref: wrapRef,
    style: { position: 'relative', width: '100%', height: '100%' },
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  }, [
    h('svg', {
      ref: svgRef,
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: 'none',
      style: { width: '100%', height: '100%', display: 'block', overflow: 'visible' },
    }, [
      // Axes & grid
      ...gridLines,
      ...slowdownBandEls,
      // Left axis title
      h('text', {
        key: 'axis-title-left',
        x: padLeft - 20, y: padTop - 12,
        fill: '#4ade80', fontSize: '11px', textAnchor: 'middle', fontWeight: 'bold',
        fontFamily: 'ui-monospace, monospace',
      }, 'UPS'),

      // Particle series (Stacked bars, Lines, or Bands)
      ...particleElements,
      ...splitElements,

      // Jam Rate series
      ...jamElements,

      // Jam Load series
      ...jamIntElements,

      // Awake Chunks series
      ...awakeElements,

      // Dynamic elements series
      ...liveElements,

      // Sim Time series
      ...simElements,

      // UPS series
      ...upsElements,

      // Gold level (own right rail)
      ...goldElements,

      // Lost-time series
      ...deficitElements,

      // X labels
      ...xLabels,
      // Hover crosshair
      crosshair,
    ]),
  ]);
  } catch (err) {
    log('[DEBUG] DualAxisChart crashed: ' + err);
    return h('div', {
      style: {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.dim, fontSize: '14px', textAlign: 'center', padding: '16px',
      },
    }, 'Graph failed to render. Switch range or close with F7 / ESC.');
  }
}

const CAUSE_COMPUTE_COLOR = '#c084fc';
const CAUSE_WAIT_COLOR = '#fbbf24';
const CAUSE_POST_COLOR = '#64748b';

function formatSlowestRegion(x, y) {
  if (!Number.isFinite(x) || x < 0) return '—';
  const xi = Math.round(x);
  if (!Number.isFinite(y) || y < 0) return t('mods|goldSpeedrun|metrics|causeColumn', { x: xi });
  return t('mods|goldSpeedrun|metrics|causeChunk', { x: xi, y: Math.round(y) });
}

function heatMsColor(t) {
  const u = Math.max(0, Math.min(1, t));
  if (u <= 0.25) {
    const k = u / 0.25;
    return [
      Math.round(8 + (30 - 8) * k),
      Math.round(12 + (41 - 12) * k),
      Math.round(22 + (59 - 22) * k),
    ];
  }
  if (u <= 0.5) {
    const k = (u - 0.25) / 0.25;
    return [
      Math.round(30 + (245 - 30) * k),
      Math.round(41 + (158 - 41) * k),
      Math.round(59 + (11 - 59) * k),
    ];
  }
  if (u <= 0.75) {
    const k = (u - 0.5) / 0.25;
    return [
      Math.round(245 + (239 - 245) * k),
      Math.round(158 + (68 - 158) * k),
      Math.round(11 + (68 - 11) * k),
    ];
  }
  const k = (u - 0.75) / 0.25;
  return [
    Math.round(239 + (254 - 239) * k),
    Math.round(68 + (240 - 68) * k),
    Math.round(68 + (138 - 68) * k),
  ];
}

function ChunkHeatmap({ mode = 'sum', onMode, scrubRelMs = null, onScrub, maxRelMs = 0, slowestX = -1, slowestY = -1, rangeType = '60s' }) {
  const wrapperRef = react.useRef(null);
  const canvasRef = react.useRef(null);
  const [zoom, setZoom] = react.useState(1);
  const [pan, setPan] = react.useState({ x: 0, y: 0 });
  const [hoverCell, setHoverCell] = react.useState(null);
  const [decayFloor, setDecayFloor] = react.useState(0.06);
  const [decayHalfLife, setDecayHalfLife] = react.useState(30000);
  const [linearWindow, setLinearWindow] = react.useState(60000);
  const dragRef = react.useRef({ isDragging: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  const boundSample = causeBoundOfSample(sampleAtRelMs(scrubRelMs));
  const boundTone = !boundSample ? COLORS.dim
    : boundSample.bound === 'wait' ? CAUSE_WAIT_COLOR
    : CAUSE_COMPUTE_COLOR;
  const boundText = !boundSample
    ? t('mods|goldSpeedrun|metrics|heatmapBoundEmpty')
    : boundSample.bound === 'wait'
      ? t('mods|goldSpeedrun|metrics|heatmapBoundWait')
      : t('mods|goldSpeedrun|metrics|heatmapBoundCompute');
  const boundDetail = boundSample
    ? `  ${roundMs2(boundSample.computeMs)} ms ${t('mods|goldSpeedrun|metrics|causeCompute')} / ${roundMs2(boundSample.waitMs)} ms ${t('mods|goldSpeedrun|metrics|causeWait')}`
    : '';
  const data = getHeatmapData(mode, scrubRelMs, rangeType, maxRelMs, decayFloor, decayHalfLife, linearWindow);
  const meta = data && data.meta;
  const cells = data && data.cells;
  const isMs100 = Boolean(data && data.isMs100);
  const viewPeak = data ? data.maxVal : 0;
  const scaleMs = isMs100 ? (viewPeak / 100) : viewPeak;

  const world = worldCellSize();
  const gridW = meta ? meta.gridW : HEATMAP_MAX;
  const gridH = meta ? meta.gridH : HEATMAP_MAX;
  const aspectW = world.width > 0 ? world.width : (meta ? meta.chunkWidth : 1);
  const aspectH = world.height > 0 ? world.height : (meta ? meta.chunkHeight : 1);

  // Wheel zoom centered on cursor
  react.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      setZoom(currZoom => {
        const nextZoom = Math.max(1, Math.min(16, currZoom * factor));
        if (nextZoom === currZoom) return currZoom;
        if (nextZoom === 1) {
          setPan({ x: 0, y: 0 });
          return 1;
        }
        const scaleChange = nextZoom / currZoom;
        setPan(currPan => ({
          x: mouseX - (mouseX - currPan.x) * scaleChange,
          y: mouseY - (mouseY - currPan.y) * scaleChange,
        }));
        return nextZoom;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = e => {
    if (e.button !== 0) return;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  };

  const onMouseMove = e => {
    if (dragRef.current.isDragging) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({
        x: dragRef.current.initialPanX + dx,
        y: dragRef.current.initialPanY + dy,
      });
    }
    if (!wrapperRef.current || !meta) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - pan.x) / zoom;
    const canvasY = (e.clientY - rect.top - pan.y) / zoom;
    const gx = Math.floor((canvasX / rect.width) * gridW);
    const gy = Math.floor((canvasY / rect.height) * gridH);
    if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
      const gi = gy * HEATMAP_MAX + gx;
      const rawVal = cells ? (cells[gi] | 0) : 0;
      const cellMs = isMs100 ? (rawVal / 100) : rawVal;
      const cx = Math.min(meta.chunkWidth - 1, Math.floor((gx * meta.chunkWidth) / gridW));
      const cy = Math.min(meta.chunkHeight - 1, Math.floor((gy * meta.chunkHeight) / gridH));
      const recentMs = (data && data.recentHeat) ? (data.recentHeat[gi] || 0) : null;
      const cumulMs = (data && data.cumulSource) ? (data.cumulSource[gi] | 0) : null;
      setHoverCell({ x: cx, y: cy, gx, gy, ms: cellMs, recentMs, cumulMs });
    } else {
      setHoverCell(null);
    }
  };

  const onMouseUp = () => {
    dragRef.current.isDragging = false;
  };

  const onDoubleClick = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  react.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;

    const off = document.createElement('canvas');
    off.width = Math.max(1, gridW);
    off.height = Math.max(1, gridH);
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.fillStyle = '#080c16';
    octx.fillRect(0, 0, off.width, off.height);
    if (cells) {
      const img = octx.createImageData(gridW, gridH);
      const dataImg = img.data;
      const peak = Math.max(1, viewPeak);
      for (let gy = 0; gy < gridH; gy++) {
        const srcRow = gy * HEATMAP_MAX;
        for (let gx = 0; gx < gridW; gx++) {
          const v = cells[srcRow + gx] | 0;
          const o = (gy * gridW + gx) * 4;
          if (v <= 0) {
            dataImg[o] = 8;
            dataImg[o + 1] = 12;
            dataImg[o + 2] = 22;
            dataImg[o + 3] = 255;
            continue;
          }
          const rgb = heatMsColor(Math.sqrt(v / peak));
          dataImg[o] = rgb[0];
          dataImg[o + 1] = rgb[1];
          dataImg[o + 2] = rgb[2];
          dataImg[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);

      if (mode === 'live' && scrubRelMs === null && meta && Number.isFinite(slowestX) && slowestX >= 0) {
        const px = Math.floor(((slowestX + 0.5) / meta.chunkWidth) * gridW);
        octx.strokeStyle = '#f8fafc';
        octx.lineWidth = 1;
        if (!Number.isFinite(slowestY) || slowestY < 0) {
          octx.beginPath();
          octx.moveTo(px + 0.5, 0);
          octx.lineTo(px + 0.5, gridH);
          octx.stroke();
        } else {
          const py = Math.floor(((slowestY + 0.5) / meta.chunkHeight) * gridH);
          octx.strokeRect(px - 1.5, py - 1.5, 3, 3);
        }
      }

      if (hoverCell) {
        octx.strokeStyle = '#38bdf8';
        octx.lineWidth = 1;
        octx.strokeRect(hoverCell.gx - 0.5, hoverCell.gy - 0.5, 2, 2);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#080c16';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, pan.x * dpr, pan.y * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cssW, cssH);
  });

  const btn = (id, label) => h('button', {
    key: id,
    onClick: () => onMode(id),
    style: {
      background: mode === id ? COLORS.blue : 'transparent',
      border: 'none', color: COLORS.text, borderRadius: '3px',
      padding: '2px 8px', cursor: 'pointer', fontSize: '10px',
      fontWeight: mode === id ? 'bold' : 'normal',
    },
  }, label);

  const legend = h('div', {
    key: 'hm-legend',
    style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: COLORS.dim },
  }, [
    h('span', {}, '0 ms'),
    h('div', {
      style: {
        flex: 1, height: '8px', borderRadius: '4px',
        background: 'linear-gradient(90deg, #080c16 0%, #1e293b 25%, #f59e0b 50%, #ef4444 75%, #fef08a 100%)',
      },
    }),
    h('span', { style: { color: '#fbbf24', fontWeight: 'bold' } }, formatMsOrSec(scaleMs)),
  ]);

  const timelineBar = onScrub ? h('div', {
    key: 'hm-timeline',
    style: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px',
      background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.06)', fontSize: '11px',
    },
  }, [
    h('span', { style: { color: COLORS.dim, whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '10px' } },
      t('mods|goldSpeedrun|metrics|heatmapTimeline') + ':'),
    h('span', { style: { color: scrubRelMs !== null ? '#fbbf24' : '#4ade80', fontWeight: 'bold', minWidth: '38px', fontSize: '10px' } },
      scrubRelMs !== null ? formatShort(scrubRelMs, 'seconds') : t('mods|goldSpeedrun|metrics|heatmapLiveBtn')),
    h('input', {
      type: 'range',
      min: 0,
      max: Math.max(1, Math.round(maxRelMs / 1000)),
      value: scrubRelMs !== null ? Math.round(scrubRelMs / 1000) : Math.max(1, Math.round(maxRelMs / 1000)),
      onChange: e => onScrub(Number(e.target.value) * 1000),
      style: { flex: 1, accentColor: scrubRelMs !== null ? '#fbbf24' : '#4ade80', cursor: 'pointer' },
    }),
    h('span', { style: { color: COLORS.dim, fontSize: '10px', minWidth: '38px', textAlign: 'right' } },
      formatShort(maxRelMs, 'seconds')),
    h('button', {
      onClick: () => onScrub(null),
      style: {
        background: scrubRelMs === null ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${scrubRelMs === null ? '#4ade80' : COLORS.border}`,
        color: scrubRelMs === null ? '#4ade80' : COLORS.dim,
        borderRadius: '3px', padding: '2px 8px', cursor: 'pointer',
        fontSize: '10px', fontWeight: scrubRelMs === null ? 'bold' : 'normal',
        display: 'flex', alignItems: 'center', gap: '4px',
      },
    }, [
      h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: scrubRelMs === null ? '#4ade80' : COLORS.dim } }),
      t('mods|goldSpeedrun|metrics|heatmapLiveBtn'),
    ]),
  ]) : null;

  return h('div', {
    style: {
      width: '100%', height: '100%', minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: '8px',
      background: 'rgba(0,0,0,0.25)', border: `1px solid ${COLORS.border}`,
      borderRadius: '6px', padding: '10px 12px',
    },
  }, [
    h('div', {
      key: 'hm-head',
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
    }, [
      h('span', { style: { fontSize: '13px', fontWeight: 'bold', color: COLORS.text } }, t('mods|goldSpeedrun|metrics|heatmapTitle')),
      h('span', {
        style: {
          flex: 1, minWidth: '160px', fontSize: '10px', lineHeight: 1.35, color: boundTone,
          background: !boundSample
            ? 'rgba(255,255,255,0.04)'
            : boundSample.bound === 'wait' ? 'rgba(251, 191, 36, 0.10)' : 'rgba(192, 132, 252, 0.08)',
          border: `1px solid ${!boundSample
            ? COLORS.border
            : boundSample.bound === 'wait' ? 'rgba(251, 191, 36, 0.35)' : 'rgba(192, 132, 252, 0.25)'}`,
          borderRadius: '4px', padding: '3px 8px',
        },
      }, boundText + boundDetail),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
        // Zoom controls
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)',
            borderRadius: '4px', padding: '2px', border: `1px solid ${COLORS.border}`, gap: '2px',
          },
        }, [
          h('button', {
            onClick: () => setZoom(z => Math.min(16, z * 1.35)),
            title: 'Zoom In (+)',
            style: {
              background: 'transparent', border: 'none', color: COLORS.text,
              padding: '2px 6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
            },
          }, '+'),
          h('button', {
            onClick: () => setZoom(z => { const next = Math.max(1, z / 1.35); if (next === 1) setPan({ x: 0, y: 0 }); return next; }),
            title: 'Zoom Out (-)',
            style: {
              background: 'transparent', border: 'none', color: COLORS.text,
              padding: '2px 6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
            },
          }, '-'),
          h('button', {
            onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }); },
            title: 'Reset Zoom (Double click map)',
            style: {
              background: zoom > 1 ? COLORS.blue : 'transparent', border: 'none',
              color: COLORS.text, padding: '2px 6px', cursor: 'pointer',
              fontSize: '10px', borderRadius: '2px',
            },
          }, zoom > 1 ? `${zoom.toFixed(1)}x` : t('mods|goldSpeedrun|metrics|heatmapZoomReset')),
        ]),
        // Mode buttons
        h('div', {
          style: {
            display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '4px',
            padding: '2px', border: `1px solid ${COLORS.border}`, gap: '2px',
          },
        }, [
          btn('sum', t('mods|goldSpeedrun|metrics|heatmapSum')),
          btn('exp', t('mods|goldSpeedrun|metrics|heatmapExp')),
          btn('linear', t('mods|goldSpeedrun|metrics|heatmapLinear')),
          btn('peak', t('mods|goldSpeedrun|metrics|heatmapPeak')),
          btn('live', t('mods|goldSpeedrun|metrics|heatmapLive')),
        ]),
      ]),
    ]),
    (mode === 'exp' || mode === 'linear') ? h('div', {
      key: 'hm-sub-bar',
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '3px 8px',
        border: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', gap: '8px', flexWrap: 'wrap',
      },
    }, [
      // Floor selector
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '3px' } }, [
        h('span', { style: { color: COLORS.dim, marginRight: '3px', fontWeight: 'bold' } },
          t('mods|goldSpeedrun|metrics|heatmapFloor') + ':'),
        [0.00, 0.03, 0.06, 0.12].map(fl => h('button', {
          key: fl,
          onClick: () => setDecayFloor(fl),
          style: {
            background: decayFloor === fl ? COLORS.blue : 'rgba(255,255,255,0.04)',
            border: `1px solid ${decayFloor === fl ? COLORS.blue : 'rgba(255,255,255,0.08)'}`,
            color: decayFloor === fl ? '#ffffff' : COLORS.dim,
            borderRadius: '2px', padding: '1px 5px', cursor: 'pointer', fontSize: '9px',
            fontWeight: decayFloor === fl ? 'bold' : 'normal',
          },
        }, fl === 0 ? '0% (flat)' : `${Math.round(fl * 100)}%`)),
      ]),
      // Speed / Window selector
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '3px' } }, [
        h('span', { style: { color: COLORS.dim, marginRight: '3px', fontWeight: 'bold' } },
          mode === 'exp' ? (t('mods|goldSpeedrun|metrics|heatmapHalfLife') + ':') : (t('mods|goldSpeedrun|metrics|heatmapWindow') + ':')),
        (mode === 'exp' ? [15000, 30000, 60000] : [30000, 60000, 120000]).map(dur => h('button', {
          key: dur,
          onClick: () => mode === 'exp' ? setDecayHalfLife(dur) : setLinearWindow(dur),
          style: {
            background: (mode === 'exp' ? decayHalfLife === dur : linearWindow === dur) ? COLORS.blue : 'rgba(255,255,255,0.04)',
            border: `1px solid ${(mode === 'exp' ? decayHalfLife === dur : linearWindow === dur) ? COLORS.blue : 'rgba(255,255,255,0.08)'}`,
            color: (mode === 'exp' ? decayHalfLife === dur : linearWindow === dur) ? '#ffffff' : COLORS.dim,
            borderRadius: '2px', padding: '1px 5px', cursor: 'pointer', fontSize: '9px',
            fontWeight: (mode === 'exp' ? decayHalfLife === dur : linearWindow === dur) ? 'bold' : 'normal',
          },
        }, `${dur / 1000}s`)),
      ]),
    ]) : null,
    h('div', {
      key: 'hm-map',
      style: {
        flex: 1, minHeight: 0, width: '100%',
        background: '#040711', borderRadius: '4px', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      },
    }, data
      ? h('div', {
        ref: wrapperRef,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave: () => {
          dragRef.current.isDragging = false;
          setHoverCell(null);
        },
        onDoubleClick,
        style: {
          maxHeight: '100%',
          maxWidth: '100%',
          height: '100%',
          aspectRatio: `${aspectW} / ${aspectH}`,
          position: 'relative',
          overflow: 'hidden',
          cursor: zoom > 1 ? (dragRef.current.isDragging ? 'grabbing' : 'grab') : 'crosshair',
        },
      }, [
        h('canvas', {
          ref: canvasRef,
          style: {
            width: '100%',
            height: '100%',
            display: 'block',
            pointerEvents: 'none',
          },
        }),
      ])
      : h('div', {
        style: {
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: COLORS.dim, fontSize: '12px', padding: '8px',
          textAlign: 'center',
        },
      }, t('mods|goldSpeedrun|metrics|heatmapEmpty'))),
    hoverCell
      ? h('div', {
        key: 'hm-hover',
        style: { fontSize: '11px', color: COLORS.text, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      }, [
        h('span', { style: { color: '#38bdf8' } }, `chunk (${hoverCell.x}, ${hoverCell.y})`),
        h('span', { style: { color: COLORS.dim } }, '·'),
        h('span', { style: { color: '#fbbf24' } },
          (mode === 'exp' || mode === 'linear')
            ? `Heat: ${formatMsOrSec(hoverCell.recentMs || 0)}`
            : mode === 'peak' ? `Peak: ${formatMsOrSec(hoverCell.ms)}`
            : mode === 'live' ? `This tick: ${formatMsOrSec(hoverCell.ms)}`
            : `Total: ${formatMsOrSec(hoverCell.ms)}`),
        (mode === 'exp' || mode === 'linear') && hoverCell.cumulMs !== null && hoverCell.cumulMs !== undefined
          ? h('span', { style: { color: COLORS.dim, fontSize: '10px' } }, `(Total: ${formatMsOrSec(hoverCell.cumulMs)})`)
          : null,
        scrubRelMs !== null
          ? h('span', { style: { color: COLORS.dim, fontSize: '10px', marginLeft: 'auto' } }, `(at ${formatShort(scrubRelMs, 'seconds')})`)
          : null,
      ])
      : legend,
    timelineBar,
    h('div', {
      key: 'hm-hint',
      style: { fontSize: '10px', color: COLORS.dim, lineHeight: 1.35 },
    }, t('mods|goldSpeedrun|metrics|heatmapHint')),
    h('div', {
      key: 'hm-disclaimer',
      style: {
        fontSize: '10px', color: '#fbbf24', lineHeight: 1.4,
        background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.22)',
        borderRadius: '4px', padding: '6px 8px',
      },
    }, t('mods|goldSpeedrun|metrics|heatmapDisclaimer')),
  ]);
}

function MetricsOverlayModal() {
  const [, bump] = react.useState(0);
  const [range, setRange] = react.useState('full'); // '60s' | '180s' | 'full'
  const [scaleMode, setScaleMode] = react.useState('linear'); // 'linear' | 'log'
  const [smoothMode, setSmoothMode] = react.useState('rolling'); // 'off' | 'rolling' | 'bands'
  const [layers, setLayers] = react.useState({
    ups: true,
    blocks: true,
    moves: true,
    jamRate: false,
    jamLoad: true,
    jamIntensity: false,
    awake: true,
    simTime: false,
    live: false,
    blocksSettled: false,
    blocksActive: true,
    deficit: true,
    gold: true,
  });
  const [hoverInfo, setHoverInfo] = react.useState(null);
  const [benchCopied, setBenchCopied] = react.useState(false);
  const [heatmapMode, setHeatmapMode] = react.useState('exp');
  const [scrubRelMs, setScrubRelMs] = react.useState(null);
  const [benchConfirmOpen, setBenchConfirmOpen] = react.useState(false);
  const benchConfirmOpenRef = react.useRef(false);
  react.useEffect(() => { benchConfirmOpenRef.current = benchConfirmOpen; }, [benchConfirmOpen]);

  react.useEffect(() => {
    const fn = () => bump(n => (n + 1) % 100000);
    panelListeners.add(fn);
    metricsListeners.add(fn);
    return () => {
      panelListeners.delete(fn);
      metricsListeners.delete(fn);
    };
  }, []);

  // Continuous refresh while modal is open
  react.useEffect(() => {
    if (!metricsOverlayOpen) return;
    const timer = setInterval(() => bump(n => (n + 1) % 100000), 100);
    return () => clearInterval(timer);
  }, [metricsOverlayOpen]);

  // Escape closes locally. F7 is handled only by the debounced global binding.
  react.useEffect(() => {
    if (!metricsOverlayOpen) return;
    const onKey = e => {
      if (e.key === 'Escape') {
        if (benchConfirmOpenRef.current) {
          e.preventDefault();
          setBenchConfirmOpen(false);
          return;
        }
        setMetricsOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [metricsOverlayOpen]);

  if (!modEnabled() || !metricsOverlayOpen) return null;

  try {
  // Process data for the selected range - smooth rolling without compacting flicker
  let chartData = [];
  let chartLookback = 0;
  try {
    const clean = arr => arr.filter(c => c && typeof c === 'object' && (Number.isFinite(c.avg) || Number.isFinite(c.ups)));
    // 5s window + 5s extra off-screen pad at 10 Hz so the left edge has a full average
    const lookback10Hz = 100;
    if (range === '60s') {
      const src = clean(highResBuffer);
      const visibleLen = Math.min(src.length, 600);
      chartLookback = Math.min(Math.max(0, src.length - visibleLen), lookback10Hz);
      chartData = src.slice(src.length - visibleLen - chartLookback);
    } else if (range === '180s') {
      const src = clean(highResBuffer);
      const visibleLen = Math.min(src.length, 1800);
      chartLookback = Math.min(Math.max(0, src.length - visibleLen), lookback10Hz);
      chartData = src.slice(src.length - visibleLen - chartLookback);
    } else {
      chartLookback = 0;
      chartData = historyBuf.length > 0 ? clean(historyBuf) : clean(highResBuffer);
    }
  } catch (e) {
    log('[DEBUG] MetricsOverlay chartData failed: ' + e);
    chartData = [];
    chartLookback = 0;
  }

  const eventScope = allMatterCaptureWanted() ? 'allMatter' : 'ballistic';
  const benchProgress = benchmarkProgress();
  const fallbackMs = range === 'full' ? 1000 : 100;
  const latest = highResBuffer.length > 0
    ? highResBuffer[highResBuffer.length - 1]
    : { ups: rawTickSourceReady() ? 60 : 0, blocks: 0, moves: 0, ticks: 0, awake: rawAwakeChunks(), live: rawLiveElements(), simMs: rawSimTimeMs(), allBlocks: null, allMoves: null };

  const latestWin = trailingJamWindow(highResBuffer, highResBuffer.length - 1, eventScope, 100, JAM_WINDOW_MS)
    || sampleJamInstant(latest, eventScope, 100);
  const jamShareTxt = latestWin ? `${(latestWin.jamShare * 100).toFixed(1)}%` : '—';
  const jamLoadTxt = latestWin ? `${latestWin.jamLoad.toFixed(2)}/u` : '—';
  const flightTxt = latestWin ? latestWin.flight.toFixed(2) : '—';

  const toggleLayer = key => {
    setLayers(prev => {
      if (key === 'jamLoad') return { ...prev, jamLoad: !prev.jamLoad, jamIntensity: !prev.jamLoad };
      return { ...prev, [key]: !prev[key] };
    });
  };

  const toggleCaptureScope = () => {
    if (benchState.running) return;
    const next = !allMatterCaptureWanted();
    allMatterRuntimeOverride = next;
    writeSetting('monitoringMode', next ? 'full' : 'standard');
    applyMonitoringMask();
    refreshSettingsUi();
    notifyMetrics();
  };

  const enableStandardMonitoring = () => {
    allMatterRuntimeOverride = null;
    writeSetting('monitoringMode', 'standard');
    applyMonitoringMask();
    refreshSettingsUi();
    notifyMetrics();
  };

  const enabledLayers = {
    ...layers,
    jamLoad: layers.jamLoad || layers.jamIntensity,
  };
  const deficitInfo = annotateDeficitSeries(chartData);

  const activeHoverItem = hoverInfo ? hoverInfo.item : null;
  const hoverWin = activeHoverItem
    ? (sampleJamInstant(activeHoverItem, eventScope, fallbackMs))
    : null;
  const hoverScopeMissing = eventScope === 'allMatter' && activeHoverItem && (
    activeHoverItem.allBlocks === null || activeHoverItem.allBlocks === undefined
  );

  return h('div', {
    style: {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(10, 12, 18, 0.88)',
      backdropFilter: 'blur(6px)',
      pointerEvents: 'auto',
      zIndex: 10035,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    onClick: e => {
      if (e.target === e.currentTarget) setMetricsOverlayOpen(false);
    },
  }, [
    h('div', {
      key: 'modal-body',
      style: {
        position: 'relative',
        width: '98vw', maxWidth: '1760px', height: '92vh',
        display: 'flex', flexDirection: 'column',
        padding: '18px 24px',
        borderRadius: '10px',
        border: `1px solid ${COLORS.border}`,
        background: 'rgba(17, 21, 28, 0.98)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        color: COLORS.text,
        font: '500 13px/1.4 system-ui, sans-serif',
      },
      onClick: e => e.stopPropagation(),
    }, [
      // Top header
      h('div', {
        key: 'header',
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: '12px', borderBottom: `1px solid ${COLORS.border}`, gap: '16px', flexWrap: 'wrap',
        },
      }, [
        h('div', { key: 'title-block', style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
          h('span', { style: { fontSize: '18px', fontWeight: 'bold', color: COLORS.text } }, t('mods|goldSpeedrun|metrics|title')),
          h('span', { style: { fontSize: '12px', color: COLORS.dim } }, `(F7 / ESC)`),
        ]),
        // Real-time stat badges
        h('div', { key: 'stats-strip', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|curUps')}:`),
            h('span', { style: { color: latest.ups >= 55 ? COLORS.green : latest.ups >= 45 ? COLORS.gold : COLORS.red, fontWeight: 'bold' } }, `${latest.ups || 0}`),
          ]),
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|activeChunks')}:`),
            h('span', { style: { color: '#38bdf8', fontWeight: 'bold' } }, `${latest.awake || 0}`),
          ]),
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|jamShare')}:`),
            h('span', { style: { color: METRIC_JAM_SHARE_COLOR, fontWeight: 'bold' } }, jamShareTxt),
          ]),
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|flightActivity')}:`),
            h('span', { style: { color: '#38bdf8', fontWeight: 'bold' } }, flightTxt),
          ]),
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|jamLoad')}:`),
            h('span', { style: { color: METRIC_JAM_LOAD_COLOR, fontWeight: 'bold' } }, jamLoadTxt),
          ]),
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|simStep')}:`),
            h('span', { style: { color: latest.simMs > 16.6 ? '#f87171' : '#c084fc', fontWeight: 'bold' } }, `${latest.simMs || 0} ms`),
          ]),
          h('div', {
            style: {
              background: deficitInfo.unrecoveredTicks > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255,255,255,0.05)',
              padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${deficitInfo.unrecoveredTicks > 0 ? METRIC_DEFICIT_COLOR : COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|slowdownIn')}:`),
            h('span', { style: { color: METRIC_DEFICIT_COLOR, fontWeight: 'bold' } },
              deficitInfo.slowdownMs > 0 ? formatShort(deficitInfo.slowdownMs, 'seconds') : t('mods|goldSpeedrun|metrics|slowdownNone')),
          ]),
          h('div', {
            style: {
              background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px',
              fontSize: '11px', border: `1px solid ${COLORS.border}`,
            },
          }, [
            h('span', { style: { color: COLORS.dim, marginRight: '4px' } }, `${t('mods|goldSpeedrun|metrics|unrecovered')}:`),
            h('span', { style: { color: METRIC_DEFICIT_COLOR, fontWeight: 'bold' } },
              `${formatSecSigned(deficitInfo.unrecoveredSec)} (${fmtSigned(Math.round(deficitInfo.unrecoveredTicks), 0)})`),
          ]),
        ]),
        // Range toggles & close
        h('div', { key: 'actions', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          h('div', {
            style: { display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', padding: '2px', border: `1px solid ${COLORS.border}` },
          }, [
            h('button', {
              onClick: () => setRange('60s'),
              style: {
                background: range === '60s' ? COLORS.blue : 'transparent', border: 'none',
                color: COLORS.text, padding: '4px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px',
              },
            }, t('mods|goldSpeedrun|metrics|range60s')),
            h('button', {
              onClick: () => setRange('180s'),
              style: {
                background: range === '180s' ? COLORS.blue : 'transparent', border: 'none',
                color: COLORS.text, padding: '4px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px',
              },
            }, t('mods|goldSpeedrun|metrics|range180s')),
            h('button', {
              onClick: () => setRange('full'),
              style: {
                background: range === 'full' ? COLORS.blue : 'transparent', border: 'none',
                color: COLORS.text, padding: '4px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px',
              },
            }, t('mods|goldSpeedrun|metrics|rangeFull')),
          ]),
          h('button', {
            onClick: () => setMetricsOverlayOpen(false),
            style: {
              cursor: 'pointer', padding: '6px 14px', borderRadius: '4px',
              border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.06)', color: COLORS.text,
              fontSize: '12px', fontWeight: 'bold',
            },
          }, t('mods|goldSpeedrun|metrics|close')),
        ]),
      ]),

      !monitoringEnabled() ? h('div', {
        key: 'mon-off',
        style: {
          marginTop: '10px', padding: '10px 12px', borderRadius: '6px',
          background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.35)',
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        },
      }, [
        h('div', { style: { flex: 1, minWidth: '240px' } }, [
          h('div', { style: { color: '#fbbf24', fontWeight: 'bold', marginBottom: '2px' } }, t('mods|goldSpeedrun|metrics|monitoringOffTitle')),
          h('div', { style: { color: COLORS.dim, lineHeight: 1.4, fontSize: '11px' } }, t('mods|goldSpeedrun|metrics|monitoringOffBody')),
        ]),
        h('button', {
          onClick: enableStandardMonitoring,
          style: {
            cursor: 'pointer', padding: '6px 12px', borderRadius: '4px',
            border: '1px solid #fbbf24', background: 'rgba(251, 191, 36, 0.18)',
            color: '#fbbf24', fontSize: '12px', fontWeight: 'bold',
          },
        }, t('mods|goldSpeedrun|metrics|monitoringOffEnable')),
      ]) : null,

      // Channel Toggles Toolbar + Scale Mode
      h('div', {
        key: 'toolbar',
        style: {
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      }, [
        h('span', { style: { color: COLORS.dim, fontSize: '12px', fontWeight: 'bold' } }, 'Channels:'),
        // UPS Line toggle
        h('button', {
          onClick: () => toggleLayer('ups'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.ups ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.ups ? '#4ade80' : COLORS.border}`,
            color: layers.ups ? '#4ade80' : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' } }),
          t('mods|goldSpeedrun|metrics|layerUps'),
        ]),
        h('button', {
          onClick: () => toggleLayer('gold'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.gold ? 'rgba(240, 192, 64, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.gold ? COLORS.gold : COLORS.border}`,
            color: layers.gold ? COLORS.gold : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: COLORS.gold } }),
          t('mods|goldSpeedrun|metrics|layerGold'),
        ]),
        // Collisions toggle
        h('button', {
          onClick: () => toggleLayer('blocks'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.blocks ? 'rgba(248, 113, 113, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.blocks ? '#f87171' : COLORS.border}`,
            color: layers.blocks ? '#f87171' : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' } }),
          t('mods|goldSpeedrun|metrics|layerBlocks'),
        ]),
        eventScope === 'allMatter' ? h('button', {
          onClick: () => toggleLayer('blocksSettled'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.blocksSettled ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.blocksSettled ? METRIC_SETTLED_COLOR : COLORS.border}`,
            color: layers.blocksSettled ? METRIC_SETTLED_COLOR : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: METRIC_SETTLED_COLOR } }),
          t('mods|goldSpeedrun|metrics|layerBlocksSettled'),
        ]) : null,
        eventScope === 'allMatter' ? h('button', {
          onClick: () => toggleLayer('blocksActive'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.blocksActive ? 'rgba(251, 113, 133, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.blocksActive ? METRIC_ACTIVE_COLOR : COLORS.border}`,
            color: layers.blocksActive ? METRIC_ACTIVE_COLOR : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: METRIC_ACTIVE_COLOR } }),
          t('mods|goldSpeedrun|metrics|layerBlocksActive'),
        ]) : null,
        // Moves toggle
        h('button', {
          onClick: () => toggleLayer('moves'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.moves ? 'rgba(45, 212, 191, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.moves ? METRIC_MOVES_COLOR : COLORS.border}`,
            color: layers.moves ? METRIC_MOVES_COLOR : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: METRIC_MOVES_COLOR } }),
          t('mods|goldSpeedrun|metrics|layerMoves'),
        ]),
        // Jam Share (%) toggle
        h('button', {
          onClick: () => toggleLayer('jamRate'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.jamRate ? 'rgba(232, 121, 249, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.jamRate ? METRIC_JAM_SHARE_COLOR : COLORS.border}`,
            color: layers.jamRate ? METRIC_JAM_SHARE_COLOR : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: METRIC_JAM_SHARE_COLOR } }),
          t('mods|goldSpeedrun|metrics|layerJamShare'),
        ]),
        // Jam Load toggle
        h('button', {
          onClick: () => toggleLayer('jamLoad'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: enabledLayers.jamLoad ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${enabledLayers.jamLoad ? METRIC_JAM_LOAD_COLOR : COLORS.border}`,
            color: enabledLayers.jamLoad ? METRIC_JAM_LOAD_COLOR : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: METRIC_JAM_LOAD_COLOR } }),
          t('mods|goldSpeedrun|metrics|layerJamLoad'),
        ]),
        // Awake Chunks toggle
        h('button', {
          onClick: () => toggleLayer('awake'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.awake ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.awake ? '#38bdf8' : COLORS.border}`,
            color: layers.awake ? '#38bdf8' : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' } }),
          t('mods|goldSpeedrun|metrics|layerAwake'),
        ]),
        // Sim Compute Time toggle
        h('button', {
          onClick: () => toggleLayer('simTime'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.simTime ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.simTime ? '#c084fc' : COLORS.border}`,
            color: layers.simTime ? '#c084fc' : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' } }),
          t('mods|goldSpeedrun|metrics|layerSimTime'),
        ]),
        // Live Elements toggle
        h('button', {
          onClick: () => toggleLayer('live'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.live ? 'rgba(148, 163, 184, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.live ? '#94a3b8' : COLORS.border}`,
            color: layers.live ? '#94a3b8' : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' } }),
          t('mods|goldSpeedrun|metrics|layerLive'),
        ]),
        h('button', {
          onClick: () => toggleLayer('deficit'),
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            background: layers.deficit ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${layers.deficit ? METRIC_DEFICIT_COLOR : COLORS.border}`,
            color: layers.deficit ? METRIC_DEFICIT_COLOR : COLORS.dim,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, [
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: METRIC_DEFICIT_COLOR } }),
          t('mods|goldSpeedrun|metrics|layerDeficit'),
        ]),

        // Smoothing Mode Toggle (Off / Rolling / Bands)
        h('div', {
          style: {
            display: 'flex', alignItems: 'center', marginLeft: 'auto',
            background: 'rgba(0,0,0,0.4)', borderRadius: '4px', padding: '2px',
            border: `1px solid ${COLORS.border}`, gap: '2px',
          },
        }, [
          h('span', { style: { color: COLORS.dim, fontSize: '11px', padding: '0 6px' } }, t('mods|goldSpeedrun|metrics|smooth')),
          h('button', {
            onClick: () => setSmoothMode('off'),
            style: {
              background: smoothMode === 'off' ? COLORS.blue : 'transparent',
              border: 'none', color: COLORS.text, padding: '3px 8px', borderRadius: '3px',
              cursor: 'pointer', fontSize: '11px', fontWeight: smoothMode === 'off' ? 'bold' : 'normal',
            },
          }, t('mods|goldSpeedrun|metrics|smoothOff')),
          h('button', {
            onClick: () => setSmoothMode('rolling'),
            style: {
              background: smoothMode === 'rolling' ? COLORS.blue : 'transparent',
              border: 'none', color: COLORS.text, padding: '3px 8px', borderRadius: '3px',
              cursor: 'pointer', fontSize: '11px', fontWeight: smoothMode === 'rolling' ? 'bold' : 'normal',
            },
          }, t('mods|goldSpeedrun|metrics|smoothRolling')),
          h('button', {
            onClick: () => setSmoothMode('bands'),
            style: {
              background: smoothMode === 'bands' ? COLORS.blue : 'transparent',
              border: 'none', color: COLORS.text, padding: '3px 8px', borderRadius: '3px',
              cursor: 'pointer', fontSize: '11px', fontWeight: smoothMode === 'bands' ? 'bold' : 'normal',
            },
          }, t('mods|goldSpeedrun|metrics|smoothBands')),
        ]),

        // Scale Toggle (Linear / Logarithmic)
        h('div', {
          style: {
            display: 'flex', alignItems: 'center',
            background: 'rgba(0,0,0,0.4)', borderRadius: '4px', padding: '2px',
            border: `1px solid ${COLORS.border}`, gap: '2px',
          },
        }, [
          h('span', { style: { color: COLORS.dim, fontSize: '11px', padding: '0 6px' } }, t('mods|goldSpeedrun|metrics|scaleMode')),
          h('button', {
            onClick: () => setScaleMode('linear'),
            style: {
              background: scaleMode === 'linear' ? COLORS.blue : 'transparent',
              border: 'none', color: COLORS.text, padding: '3px 8px', borderRadius: '3px',
              cursor: 'pointer', fontSize: '11px', fontWeight: scaleMode === 'linear' ? 'bold' : 'normal',
            },
          }, t('mods|goldSpeedrun|metrics|scaleLinear')),
          h('button', {
            onClick: () => setScaleMode('log'),
            style: {
              background: scaleMode === 'log' ? COLORS.blue : 'transparent',
              border: 'none', color: COLORS.text, padding: '3px 8px', borderRadius: '3px',
              cursor: 'pointer', fontSize: '11px', fontWeight: scaleMode === 'log' ? 'bold' : 'normal',
            },
          }, t('mods|goldSpeedrun|metrics|scaleLog')),
        ]),
      ]),

      h('div', {
        key: 'capture-bar',
        style: {
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '11px',
        },
      }, [
        h('span', { style: { color: COLORS.dim, fontWeight: 'bold' } }, t('mods|goldSpeedrun|metrics|scopeSwitch')),
        h('button', {
          onClick: toggleCaptureScope,
          disabled: benchState.running,
          style: {
            background: eventScope === 'allMatter' ? 'rgba(248, 113, 113, 0.18)' : 'rgba(74, 222, 128, 0.12)',
            border: `1px solid ${eventScope === 'allMatter' ? '#f87171' : '#4ade80'}`,
            color: eventScope === 'allMatter' ? '#f87171' : '#4ade80',
            borderRadius: '4px', padding: '3px 8px', cursor: benchState.running ? 'not-allowed' : 'pointer', fontSize: '11px',
          },
        }, eventScope === 'allMatter' ? t('mods|goldSpeedrun|metrics|scopeAllMatter') : t('mods|goldSpeedrun|metrics|scopeBallistic')),
        isAllMatterCaptureActive()
          ? h('span', { style: { color: '#f87171', maxWidth: '520px' } }, t('mods|goldSpeedrun|metrics|scopeWarn'))
          : h('span', { style: { color: COLORS.dim } }, t('mods|goldSpeedrun|metrics|scopeBallistic')),
        h('button', {
          onClick: () => setBenchConfirmOpen(true),
          disabled: benchState.running || isRunning() || gamePaused() || !rawTickSourceReady(),
          style: {
            marginLeft: 'auto',
            background: benchState.running ? 'rgba(251, 191, 36, 0.18)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text, borderRadius: '4px', padding: '3px 8px',
            cursor: benchState.running ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 'bold',
          },
        }, benchState.running
          ? t('mods|goldSpeedrun|metrics|benchRunning', {
            phase: benchProgress ? benchProgress.package : '',
            totalPhase: benchProgress ? benchProgress.repeat : '',
            mode: benchProgress ? `${benchProgress.phase} ${benchProgress.seconds}` : '',
          })
          : t('mods|goldSpeedrun|metrics|benchBtn')),
        benchState.running ? h('button', {
          onClick: cancelMetricBenchmark,
          style: {
            background: 'rgba(248, 113, 113, 0.14)', border: '1px solid #f87171',
            color: '#f87171', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, t('mods|goldSpeedrun|metrics|benchCancel')) : null,
        benchState.result ? h('button', {
          onClick: () => {
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(benchState.result.report);
              }
            } catch (e) {}
            benchState.copiedAt = Date.now();
            setBenchCopied(true);
            setTimeout(() => setBenchCopied(false), 1500);
          },
          style: {
            background: 'rgba(74, 158, 255, 0.15)', border: `1px solid ${COLORS.blue}`,
            color: COLORS.blue, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px',
          },
        }, benchCopied ? t('mods|goldSpeedrun|metrics|benchCopied') : t('mods|goldSpeedrun|metrics|benchCopy')) : null,
      ]),
      benchState.result ? h('div', {
        key: 'bench-report',
        style: {
          background: 'rgba(0,0,0,0.35)', border: `1px solid ${COLORS.border}`, borderRadius: '6px',
          padding: '8px 12px', fontSize: '11px', color: COLORS.dim, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace',
          maxHeight: '140px', overflowY: 'auto',
        },
      }, [
        h('div', { style: { color: COLORS.gold, fontWeight: 'bold', marginBottom: '4px' } }, t('mods|goldSpeedrun|metrics|benchTitle')),
        h('div', {}, benchState.result.preview),
      ]) : null,

      // Map left, graph right
      h('div', {
        key: 'main-split',
        style: {
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row',
          gap: '12px', marginTop: '10px', alignItems: 'stretch',
        },
      }, [
        h('div', {
          key: 'map-col',
          style: {
            flex: '1 1 48%', minWidth: '460px', maxWidth: '850px',
            minHeight: 0, display: 'flex',
          },
        }, [
          h(ChunkHeatmap, {
            mode: heatmapMode,
            onMode: setHeatmapMode,
            scrubRelMs: (hoverInfo && hoverInfo.item && Number.isFinite(hoverInfo.item.relMs)) ? hoverInfo.item.relMs : scrubRelMs,
            onScrub: setScrubRelMs,
            maxRelMs: Math.max(now(), historyBuf.length > 0 ? (historyBuf[historyBuf.length - 1].relMs || 0) : 0),
            rangeType: range,
            slowestX: (heatmapMode === 'live' && scrubRelMs === null && !(hoverInfo && hoverInfo.item && Number.isFinite(hoverInfo.item.relMs)))
              ? (latest && Number.isFinite(latest.slowestX) ? latest.slowestX : -1)
              : -1,
            slowestY: (heatmapMode === 'live' && scrubRelMs === null && !(hoverInfo && hoverInfo.item && Number.isFinite(hoverInfo.item.relMs)))
              ? (latest && Number.isFinite(latest.slowestY) ? latest.slowestY : -1)
              : -1,
          }),
        ]),
      // Chart area with floating hover tooltip
      h('div', {
        key: 'chart-container',
        style: {
          flex: '1 1 52%', minWidth: '480px', minHeight: 0, position: 'relative',
          background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '10px',
          border: '1px solid rgba(255,255,255,0.04)',
        },
      }, [
        h(DualAxisChart, {
          data: chartData,
          lookback: chartLookback,
          enabledLayers,
          eventScope,
          rangeType: range,
          scaleMode,
          smoothMode,
          hoverIdx: hoverInfo ? hoverInfo.index : null,
          pinnedRelMs: scrubRelMs,
          onHover: setHoverInfo,
        }),
        // Floating tooltip card with colored bullets and full metrics
        activeHoverItem ? h('div', {
          key: 'hover-tooltip',
          style: {
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '6px',
            padding: '10px 14px',
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            minWidth: '200px',
            zIndex: 20,
          },
        }, [
          h('div', { style: { fontWeight: 'bold', color: COLORS.text, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '4px' } },
            `${t('mods|goldSpeedrun|metrics|samplePoint')} (${activeHoverItem.relMs !== undefined ? formatTime(activeHoverItem.relMs, 'seconds') : ''})`),
          // UPS
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#4ade80' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' } }),
              t('mods|goldSpeedrun|metrics|ttUps'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#4ade80' } }, `${activeHoverItem.avg !== undefined ? activeHoverItem.avg : activeHoverItem.ups} (min ${activeHoverItem.min !== undefined ? activeHoverItem.min : activeHoverItem.ups}, max ${activeHoverItem.max !== undefined ? activeHoverItem.max : activeHoverItem.ups})`),
          ]),
          Number.isFinite(activeHoverItem.gold) ? h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.gold } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: COLORS.gold } }),
              t('mods|goldSpeedrun|metrics|ttGold'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: COLORS.gold } }, formatGold(activeHoverItem.gold)),
          ]) : null,
          ...(() => {
            const srcIdx = hoverInfo && Number.isFinite(hoverInfo.index) ? chartLookback + hoverInfo.index : -1;
            const dTicks = srcIdx >= 0 && srcIdx < deficitInfo.d.length ? deficitInfo.d[srcIdx] : NaN;
            const pTicks = srcIdx >= 0 && srcIdx < deficitInfo.dPerm.length ? deficitInfo.dPerm[srcIdx] : NaN;
            const inPhase = srcIdx >= 0 && deficitInfo.phaseMask[srcIdx];
            return [
              h('div', { key: 'tt-d', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_DEFICIT_COLOR } }, [
                  h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_DEFICIT_COLOR } }),
                  t('mods|goldSpeedrun|metrics|ttDeficit'),
                ]),
                h('span', { style: { fontWeight: 'bold', color: METRIC_DEFICIT_COLOR } }, formatSecSigned(dTicks / TICK_HZ)),
              ]),
              h('div', { key: 'tt-dp', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_DEFICIT_COLOR } }, [
                  h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_DEFICIT_COLOR, opacity: 0.55 } }),
                  t('mods|goldSpeedrun|metrics|ttDeficitPerm'),
                ]),
                h('span', { style: { fontWeight: 'bold', color: METRIC_DEFICIT_COLOR } },
                  formatSecSigned(pTicks / TICK_HZ) + (inPhase ? ' · ' + t('mods|goldSpeedrun|metrics|slowdownIn') : '')),
              ]),
            ];
          })(),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.dim } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: eventScope === 'allMatter' ? '#f87171' : '#4ade80' } }),
              t('mods|goldSpeedrun|metrics|ttScope'),
            ]),
            h('span', { style: { fontWeight: 'bold' } }, hoverScopeMissing ? '—' : t(eventScope === 'allMatter' ? 'mods|goldSpeedrun|metrics|scopeAllMatter' : 'mods|goldSpeedrun|metrics|scopeBallistic')),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#f87171' } }),
              t('mods|goldSpeedrun|metrics|ttCollisions'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#f87171' } }, hoverWin ? hoverWin.blocks.toLocaleString() : '—'),
          ]),
          eventScope === 'allMatter' ? h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_SETTLED_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_SETTLED_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttSettled'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: METRIC_SETTLED_COLOR } }, (() => {
              const v = sampleEventCount(activeHoverItem, 'settled', eventScope);
              return v === null ? '—' : v.toLocaleString();
            })()),
          ]) : null,
          eventScope === 'allMatter' ? h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_ACTIVE_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_ACTIVE_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttActive'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: METRIC_ACTIVE_COLOR } }, (() => {
              const v = sampleEventCount(activeHoverItem, 'active', eventScope);
              return v === null ? '—' : v.toLocaleString();
            })()),
          ]) : null,
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_MOVES_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_MOVES_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttMoves'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: METRIC_MOVES_COLOR } }, hoverWin ? hoverWin.moves.toLocaleString() : '—'),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.dim } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: COLORS.dim } }),
              t('mods|goldSpeedrun|metrics|ttSimUpdates'),
            ]),
            h('span', { style: { fontWeight: 'bold' } }, hoverWin ? Math.round(hoverWin.ticks).toLocaleString() : String(Math.round(sampleTicksOf(activeHoverItem, fallbackMs)))),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_JAM_SHARE_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_JAM_SHARE_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttJamShare'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: METRIC_JAM_SHARE_COLOR } }, hoverWin ? `${(hoverWin.jamShare * 100).toFixed(1)}%` : '—'),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' } }),
              t('mods|goldSpeedrun|metrics|ttFlightActivity'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#38bdf8' } }, hoverWin ? `${hoverWin.flight.toFixed(2)}/u` : '—'),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: METRIC_JAM_LOAD_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: METRIC_JAM_LOAD_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttJamLoad'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: METRIC_JAM_LOAD_COLOR } }, hoverWin ? `${hoverWin.jamLoad.toFixed(2)}/u` : '—'),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' } }),
              t('mods|goldSpeedrun|metrics|ttDynamic'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#94a3b8' } }, (activeHoverItem.live || 0).toLocaleString()),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' } }),
              t('mods|goldSpeedrun|metrics|ttAwake'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#38bdf8' } }, (activeHoverItem.awake || 0).toLocaleString()),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#c084fc' } }),
              t('mods|goldSpeedrun|metrics|ttSimCompute'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#c084fc' } }, `${activeHoverItem.simMs || 0} ms`),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: CAUSE_COMPUTE_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: CAUSE_COMPUTE_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttCompute'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: CAUSE_COMPUTE_COLOR } }, `${roundMs2(activeHoverItem.computeMs)} ms`),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: CAUSE_WAIT_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: CAUSE_WAIT_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttWait'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: CAUSE_WAIT_COLOR } }, `${roundMs2(activeHoverItem.waitMs)} ms`),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: CAUSE_POST_COLOR } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: CAUSE_POST_COLOR } }),
              t('mods|goldSpeedrun|metrics|ttPost'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: CAUSE_POST_COLOR } }, `${roundMs2(activeHoverItem.postMs)} ms`),
          ]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' } }, [
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e' } }),
              t('mods|goldSpeedrun|metrics|ttSlowest'),
            ]),
            h('span', { style: { fontWeight: 'bold', color: '#f43f5e' } }, formatSlowestRegion(activeHoverItem.slowestX, activeHoverItem.slowestY)),
          ]),
        ]) : null,
      ]),
      ]),

      // Bottom Diagnostic Guidance Bar
      h('div', {
        key: 'footer-guidance',
        style: {
          marginTop: '12px', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '8px',
          paddingTop: '10px', borderTop: `1px solid ${COLORS.border}`, fontSize: '11px',
          maxHeight: '170px', overflowY: 'auto',
        },
      }, [
        ...[
          ['ups', '#4ade80', 'rgba(74, 222, 128, 0.08)', 'rgba(74, 222, 128, 0.25)', 'cardUpsTitle', 'cardUps'],
          ['blocks', '#f87171', 'rgba(248, 113, 113, 0.08)', 'rgba(248, 113, 113, 0.25)', 'cardBlocksTitle', 'cardBlocks'],
          ...(eventScope === 'allMatter' ? [
            ['settled', METRIC_SETTLED_COLOR, 'rgba(251, 191, 36, 0.08)', 'rgba(251, 191, 36, 0.25)', 'cardSettledTitle', 'cardSettled'],
            ['active', METRIC_ACTIVE_COLOR, 'rgba(251, 113, 133, 0.08)', 'rgba(251, 113, 133, 0.25)', 'cardActiveTitle', 'cardActive'],
          ] : []),
          ['moves', METRIC_MOVES_COLOR, 'rgba(45, 212, 191, 0.08)', 'rgba(45, 212, 191, 0.25)', 'cardMovesTitle', 'cardMoves'],
          ['jamShare', METRIC_JAM_SHARE_COLOR, 'rgba(232, 121, 249, 0.08)', 'rgba(232, 121, 249, 0.25)', 'cardJamShareTitle', 'cardJamShare'],
          ['jamLoad', METRIC_JAM_LOAD_COLOR, 'rgba(249, 115, 22, 0.08)', 'rgba(249, 115, 22, 0.25)', 'cardJamLoadTitle', 'cardJamLoad'],
          ['awake', '#38bdf8', 'rgba(56, 189, 248, 0.08)', 'rgba(56, 189, 248, 0.25)', 'cardAwakeTitle', 'cardAwake'],
          ['simTime', '#c084fc', 'rgba(192, 132, 252, 0.08)', 'rgba(192, 132, 252, 0.25)', 'cardSimTimeTitle', 'cardSimTime'],
          ['live', '#94a3b8', 'rgba(148, 163, 184, 0.08)', 'rgba(148, 163, 184, 0.25)', 'cardLiveTitle', 'cardLive'],
          ['deficit', METRIC_DEFICIT_COLOR, 'rgba(244, 63, 94, 0.08)', 'rgba(244, 63, 94, 0.25)', 'cardDeficitTitle', 'cardDeficit'],
        ].map(([id, color, bg, bd, titleKey, bodyKey]) => h('div', {
          key: id,
          style: {
            background: bg, border: `1px solid ${bd}`, borderRadius: '6px', padding: '8px 10px',
          },
        }, [
          h('div', { style: { color, fontWeight: 'bold', marginBottom: '2px' } }, t(`mods|goldSpeedrun|metrics|${titleKey}`)),
          h('div', { style: { color: COLORS.dim, lineHeight: 1.4 } }, t(`mods|goldSpeedrun|metrics|${bodyKey}`)),
        ])),
      ]),
      benchConfirmOpen ? h('div', {
        key: 'bench-confirm',
        style: {
          position: 'absolute', inset: 0, background: 'rgba(8, 10, 16, 0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 5, padding: '24px',
        },
        onClick: e => { if (e.target === e.currentTarget) setBenchConfirmOpen(false); },
      }, [
        h('div', {
          style: {
            maxWidth: '640px', width: '100%', background: 'rgba(17, 21, 28, 0.98)',
            border: `1px solid ${COLORS.gold}`, borderRadius: '10px', padding: '20px 22px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          },
          onClick: e => e.stopPropagation(),
        }, [
          h('div', { style: { color: COLORS.gold, fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' } }, t('mods|goldSpeedrun|metrics|benchConfirmTitle')),
          h('div', { style: { color: COLORS.text, marginBottom: '8px', lineHeight: 1.45 } }, t('mods|goldSpeedrun|metrics|benchConfirmLead')),
          h('div', { style: { color: COLORS.dim, marginBottom: '8px', lineHeight: 1.45, fontSize: '12px' } }, t('mods|goldSpeedrun|metrics|benchConfirmHow')),
          h('div', { style: { color: COLORS.dim, marginBottom: '8px', lineHeight: 1.45, fontSize: '12px' } }, t('mods|goldSpeedrun|metrics|benchConfirmInterp')),
          h('div', { style: { color: '#fbbf24', marginBottom: '16px', lineHeight: 1.45, fontSize: '12px' } }, t('mods|goldSpeedrun|metrics|benchConfirmForce')),
          h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' } }, [
            h('button', {
              onClick: () => setBenchConfirmOpen(false),
              style: {
                cursor: 'pointer', padding: '8px 14px', borderRadius: '6px',
                border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.06)',
                color: COLORS.text, fontSize: '12px',
              },
            }, t('mods|goldSpeedrun|metrics|benchConfirmCancel')),
            h('button', {
              onClick: () => {
                setBenchConfirmOpen(false);
                startMetricBenchmark();
              },
              style: {
                cursor: 'pointer', padding: '8px 14px', borderRadius: '6px',
                border: `1px solid ${COLORS.gold}`, background: 'rgba(255, 213, 106, 0.16)',
                color: COLORS.gold, fontSize: '12px', fontWeight: 'bold',
              },
            }, t('mods|goldSpeedrun|metrics|benchConfirmStart')),
          ]),
        ]),
      ]) : null,
    ]),
  ]);
  } catch (err) {
    log('[DEBUG] MetricsOverlayModal crashed: ' + err);
    return h('div', {
      style: {
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(10, 12, 18, 0.88)',
        pointerEvents: 'auto', zIndex: 10035,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
      onClick: () => setMetricsOverlayOpen(false),
    }, [
      h('div', {
        style: {
          background: 'rgba(17, 21, 28, 0.98)', border: `1px solid ${COLORS.border}`,
          borderRadius: '10px', padding: '20px 24px', color: COLORS.text,
          font: '500 13px/1.4 system-ui, sans-serif', maxWidth: '420px',
        },
        onClick: e => e.stopPropagation(),
      }, [
        h('div', { style: { marginBottom: '12px' } }, 'Diagnostics overlay failed to render. Close and try another range.'),
        h('button', {
          onClick: () => setMetricsOverlayOpen(false),
          style: {
            cursor: 'pointer', padding: '6px 14px', borderRadius: '4px',
            border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.06)', color: COLORS.text,
            fontSize: '12px', fontWeight: 'bold',
          },
        }, t('mods|goldSpeedrun|metrics|close')),
      ]),
    ]);
  }
}

function PanelOverlay() {
  const [, bump] = react.useState(0);

  react.useEffect(() => {
    const fn = () => bump(n => (n + 1) % 100000);
    panelListeners.add(fn);
    resultListeners.add(fn);
    metricsListeners.add(fn);
    return () => {
      panelListeners.delete(fn);
      resultListeners.delete(fn);
      metricsListeners.delete(fn);
    };
  }, []);

  if (!modEnabled()) return null;

  const hasModal = !resultDismissed || triggerPanelOpen || metricsOverlayOpen;
  return h('div', {
    style: {
      position: 'fixed',
      pointerEvents: hasModal ? 'auto' : 'none',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 10020,
    }
  }, [
    h(ResultScreenSafe, { key: 'result' }),
    h(TriggerPanel, { key: 'trigger' }),
    h(MetricsOverlayModal, { key: 'metrics' })
  ]);
}
api.ui.inject('panel', PanelOverlay);

// --- DE: Tastenkuerzel / EN: Keyboard shortcuts ------------------------------
// DE: F10 ist in den Standardbelegungen frei (belegt sind F2, F4, F5, F9).
// EN: F10 is free in the default bindings (F2, F4, F5, F9 are taken).
let lastResultToggle = 0;
api.input.registerBinding('GoldSpeedrunResult', ['F10'], {
  displayNameKey: 'mods|goldSpeedrun|resultKey',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => {
      log(`[DEBUG] F10 Key Pressed! resultDismissed was: ${resultDismissed}`);
      if (Date.now() - lastResultToggle < 400) {
        log(`[DEBUG] F10 Key debounce blocked.`);
        return;
      }
      lastResultToggle = Date.now();
      setResultDismissed(!resultDismissed);
    },
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

let lastMetricsToggle = 0;
let metricsKeyHeld = false;
// DE: F7 fuer Simulations- und Leistungsdiagnose
// EN: F7 for simulation and performance diagnostics
api.input.registerBinding('GoldSpeedrunMetrics', ['F7'], {
  displayNameKey: 'mods|goldSpeedrun|metrics|key',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => {
      if (metricsKeyHeld) return;
      if (Date.now() - lastMetricsToggle < 250) return;
      metricsKeyHeld = true;
      lastMetricsToggle = Date.now();
      setMetricsOverlayOpen(!metricsOverlayOpen);
    },
    released: () => {
      metricsKeyHeld = false;
    },
  },
});
try {
  window.addEventListener('keyup', e => {
    if (e.key === 'F7') metricsKeyHeld = false;
  });
  window.addEventListener('blur', () => {
    metricsKeyHeld = false;
  });
} catch (e) {}

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

// DE: Eigener Takt in Echtzeit: die Boxen kommen verzoegert und auch mitten im
// DE: Lauf, das Spiel-Update ist dafuer der falsche Aufhaenger.
// EN: Its own real-time interval: the boxes arrive with a delay, and also
// EN: mid-run, so the game update is the wrong thing to hook this to.
setInterval(() => {
  if (!modEnabled()) return;
  if (!skipStoryEnabled()) return;
  try { dismissStoryNotifications(); } catch (e) { /* DE: naechster Takt / EN: try again next tick */ }
}, 500);

// DE: Nur der Intro-Bildschirm ist wirklich modal: dort ist keine Spielhandlung
// DE: moeglich. Story-Boxen und Dialoge blockieren den Start nicht mehr - ein
// DE: echter Klick im Feld (action:intercept mit payload.action) ist Beweis
// DE: genug, dass gespielt wird. Wegklicken einer Box startet den Timer
// DE: weiterhin nicht, weil es keinen action-Payload hat.
// EN: Only the intro screen is truly modal: no in-game action is possible
// EN: there. Story boxes and dialogs no longer block the start - a real
// EN: click in the field (action:intercept with payload.action) is proof
// EN: enough that the player is playing. Dismissing a box still does not
// EN: start the timer, because it has no action payload.
const uiBlocksStart = () => {
  try {
    const intro = sandkit.state.session && sandkit.state.session.ui && sandkit.state.session.ui.introScreen;
    return !!(intro && intro.visible);
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
    log('Intro-Skip abgelehnt - die Einstellung steht auf aus');
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
  // DE: Schalter auf aus, wird nichts uebersprungen. Der Waechter prueft das
  // DE: schon, aber diese Funktion beendet das Tutorial unwiderruflich; ein
  // DE: zweiter Riegel kostet nichts.
  // EN: One last gate before the door: no matter who walks in here, if the
  // EN: switch is off, nothing gets skipped. The guard already checks this, but
  // EN: this function ends the tutorial irreversibly; a second gate costs
  // EN: nothing.
  if (!skipTutorialEnabled()) {
    log('Tutorial-Skip abgelehnt - die Einstellung steht auf aus');
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
    syncActiveFromPresetSetting();
    applyMonitoringMask();
    syncDebugSetting();
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
  if (benchState.running) cancelMetricBenchmark();
  resumeClocks();
  loadHistoryFromSave();
  syncAllMatterCaptureControl();
  restoreHeatmapFromSave();
  maybeAdoptFinishedAsBest();
  sanitizeLoadedRun();
  installBlueprintHooks();

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

  // DE: Einmalig auf die gültigen Speedrun-Vorgaben umstellen.
  // EN: Switch once to the valid speedrun defaults.
  if (enforceValidDefaults()) refreshSettingsUi();
  flagSaveForDisallowedEngine();
  syncDebugSetting();
  migrateKeyStability();
  purgeFromPbRoutes();
  syncActiveFromPresetSetting();

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
