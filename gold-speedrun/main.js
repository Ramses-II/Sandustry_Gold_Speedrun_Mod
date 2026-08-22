// Gold Speedrun Challenge
// Die Uhr startet mit der ersten echten Spielhandlung - Bewegung, Graben,
// Bauen, Forschen - und stoppt, sobald das Ziel der Kategorie erreicht ist.
// Vorher steht sie gedimmt auf 00:00:00.
//
// Kategorien: Gold (100k/500k/1M/eigenes), Alle Artefakte, Fabrikrang 6/7.
// Unterwegs setzen frei waehlbare Ausloeser Zwischenzeiten - jede Forschung,
// jeder Fabrikrang, jedes Artefakt, Gold-Marken. Jede Zwischenzeit landet in
// der Split-Tabelle im Spiel und im Ergebnisfenster am Ende.

const { api, enums, react } = sandkit;
const h = react.createElement;

const MOD_ID = 'gold-speedrun';
const NS = 'goldSpeedrun';          // Namespace im Savegame
const BEST_PREFIX = 'goldSpeedrun.best'; // localStorage, savegame-uebergreifend
const LEGACY_BEST_KEY = 'goldSpeedrun.best'; // Bestzeit aus Version <= 1.4

const MOD_VERSION = '2.7.0';
const log = (...a) => console.log(`[${MOD_ID} v${MOD_VERSION}]`, ...a);

// --- Schalter der Mod-Verwaltung ------------------------------------------
// Traegt sich bei der Mod-Verwaltung ein und fragt deren Schalter ab.
// Fehlt die Verwaltung, ist der Mod schlicht immer aktiv.
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
  } catch (e) { /* kein localStorage */ }
};

const modEnabled = () => {
  try {
    return api.storage.local.get(`sandkitManager.enabled.${MOD_ID}`) !== false;
  } catch (e) {
    return true;
  }
};

registerWithManager('Gold Speedrun');

// --- Uebersetzungen -------------------------------------------------------
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

  // Ausloeser und Ergebnis
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
  'mods|goldSpeedrun|result|simEstimated': 'Simulation time estimated - the simulation did not report its step counter, so this run is not stored as a simulation best.',
  'mods|goldSpeedrun|result|simLegacy': 'Run carried over from an older version - the simulation time before the update is not measured, only assumed.',
  'mods|goldSpeedrun|clock|simShort': 'sim',
  'mods|goldSpeedrun|result|colSplit': 'Trigger',
  'mods|goldSpeedrun|result|colTime': 'Time',
  'mods|goldSpeedrun|result|colSegment': 'Segment',
  'mods|goldSpeedrun|result|colGold': 'Gold',
  'mods|goldSpeedrun|result|noSplits': 'No triggers fired - enable some under Splits.',
  'mods|goldSpeedrun|result|close': 'Close',
  'mods|goldSpeedrun|result|hint': 'F10 shows this again',

  // Ausloeser-Fenster
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

  // Einstellungen
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
  'mods|goldSpeedrun|cfg|clockMode': 'Which clock is shown',
  'mods|goldSpeedrun|cfg|clockMode|desc': 'Both times are always measured and always recorded in the result screen - this only decides what stands large on the timer. Real time is the official one: it is the number a stopwatch next to the screen shows, and the only one a verifier can check against a video. Simulation time counts the simulation steps the world actually ran, so a run on a machine that cannot hold 60 UPS stays comparable with one that can.',
  'mods|goldSpeedrun|cfg|clockMode|both': 'Real time, simulation time below',
  'mods|goldSpeedrun|cfg|clockMode|rta': 'Real time only',
  'mods|goldSpeedrun|cfg|clockMode|sim': 'Simulation time only',
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
  'mods|goldSpeedrun|cfg|showSplits|desc': 'Lists the last triggers under the timer with time and gold. The full table appears on the result screen when the run ends.',
  'mods|goldSpeedrun|cfg|corner': 'Timer position',
  'mods|goldSpeedrun|cfg|corner|topCenter': 'Top centre',
  'mods|goldSpeedrun|cfg|corner|topLeft': 'Top left',
  'mods|goldSpeedrun|cfg|corner|topRight': 'Top right',
  'mods|goldSpeedrun|cfg|corner|bottomLeft': 'Bottom left',
  'mods|goldSpeedrun|cfg|corner|bottomRight': 'Bottom right',

  // Ausloeser
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

  // Offizielles Regelwerk
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
  'mods|goldSpeedrun|reset': 'Timer zurueckgesetzt - die naechste Aktion startet neu',
  'mods|goldSpeedrun|resetKey': 'Speedrun-Timer zuruecksetzen',
  'mods|goldSpeedrun|resultKey': 'Letztes Ergebnis zeigen',
  'mods|goldSpeedrun|tutorialSkipped': 'Tutorial automatisch uebersprungen',
  'mods|goldSpeedrun|artifacts': '{current} / {target} Artefakte',
  'mods|goldSpeedrun|factory': 'Rang {current} / {target}',
  'mods|goldSpeedrun|tainted': 'CHEATS BENUTZT - Lauf zaehlt nicht',
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
  'mods|goldSpeedrun|result|simEstimated': 'Simulationszeit geschaetzt - die Simulation hat ihren Schrittzaehler nicht gemeldet. Dieser Lauf wird nicht als Simulations-Bestzeit abgelegt.',
  'mods|goldSpeedrun|result|simLegacy': 'Lauf aus einer aelteren Version uebernommen - die Simulationszeit vor dem Update ist nicht gemessen, sondern angenommen.',
  'mods|goldSpeedrun|clock|simShort': 'sim',
  'mods|goldSpeedrun|result|colSplit': 'Ausloeser',
  'mods|goldSpeedrun|result|colTime': 'Zeit',
  'mods|goldSpeedrun|result|colSegment': 'Abschnitt',
  'mods|goldSpeedrun|result|colGold': 'Gold',
  'mods|goldSpeedrun|result|noSplits': 'Kein Ausloeser gefeuert - unter Splits welche einschalten.',
  'mods|goldSpeedrun|result|close': 'Schliessen',
  'mods|goldSpeedrun|result|hint': 'F10 zeigt das nochmal',

  'mods|goldSpeedrun|trg|title': 'Split-Ausloeser',
  'mods|goldSpeedrun|trg|key': 'Split-Ausloeser oeffnen',
  'mods|goldSpeedrun|trg|groups': 'Gruppen',
  'mods|goldSpeedrun|trg|tech': 'Forschungen',
  'mods|goldSpeedrun|trg|rank': 'Fabrikraenge',
  'mods|goldSpeedrun|trg|gold': 'Gold-Marken',
  'mods|goldSpeedrun|trg|other': 'Weitere',
  'mods|goldSpeedrun|trg|artifactAll': 'Jedes Artefakt',
  'mods|goldSpeedrun|trg|upgradeAll': 'Jede Aufwertung',
  'mods|goldSpeedrun|trg|allOn': 'Alle an',
  'mods|goldSpeedrun|trg|allOff': 'Alle aus',
  'mods|goldSpeedrun|trg|default': 'Standard',
  'mods|goldSpeedrun|trg|count': '{on} von {total}',
  'mods|goldSpeedrun|trg|filter': 'Filter',
  'mods|goldSpeedrun|trg|hint': 'Jeder Schalter zaehlt fuer sich. Die Gruppen in den Mod-Einstellungen sind nur der Ausgangspunkt - was du hier waehlst, gilt.',
  'mods|goldSpeedrun|trg|locked': 'Ein Lauf laeuft gerade - Aenderungen greifen beim naechsten Lauf.',
  'mods|goldSpeedrun|trg|noGoldMarks': 'Keine Gold-Marken - in den Mod-Einstellungen unter Gold-Marken einen Abstand waehlen.',

  'mods|goldSpeedrun|cfg|goalGold': 'Eigenes Gold-Ziel',
  'mods|goldSpeedrun|cfg|goalGold|desc': 'Wird nur benutzt, wenn die Kategorie auf Eigenes Gold steht. Jede ganze Zahl ab 1 - praktisch fuer schnelle Tests.',
  'mods|goldSpeedrun|cfg|artifactTarget': 'Artefakt-Ziel',
  'mods|goldSpeedrun|cfg|artifactTarget|desc': 'Gilt nur fuer die Artefakt-Kategorie. 0 zaehlt alle Artefakte, die auf der aktuellen Karte liegen.',
  'mods|goldSpeedrun|cfg|mode': 'Gold-Regelwerk',
  'mods|goldSpeedrun|cfg|mode|desc': 'Normal zaehlt jedes eingenommene Gold, Ausgeben kostet also keinen Fortschritt. Hard Mode geht nach dem aktuellen Kontostand: Forschen wirft zurueck. Offizielles Regelwerk ist Hard Mode samt den uebrigen offiziellen Vorgaben - der Timer startet dann bei jeder Aktion inklusive Bewegung, und der automatische Tutorial-Skip bleibt aus, egal was in diesen beiden Optionen steht.',
  'mods|goldSpeedrun|cfg|mode|earned': 'Normal',
  'mods|goldSpeedrun|cfg|mode|balance': 'Hard Mode',
  'mods|goldSpeedrun|cfg|mode|official': 'Offizielles Regelwerk (Hard Mode)',
  'mods|goldSpeedrun|modeNormal': 'Normal',
  'mods|goldSpeedrun|modeHard': 'Hard Mode',
  'mods|goldSpeedrun|rules|forced': 'gesetzt durch "Offizielles Regelwerk"',
  'mods|goldSpeedrun|cfg|preset': 'Kategorie',
  'mods|goldSpeedrun|cfg|preset|desc': 'Ein gaengiges Ziel waehlen, oder Eigenes Gold und den Wert unten selbst setzen.',
  'mods|goldSpeedrun|cfg|preset|100k': '100k Gold %',
  'mods|goldSpeedrun|cfg|preset|500k': '500k Gold %',
  'mods|goldSpeedrun|cfg|preset|1m': '1M Gold %',
  'mods|goldSpeedrun|cfg|preset|artifacts': 'Alle Artefakte %',
  'mods|goldSpeedrun|cfg|preset|factory6': 'Fabrikrang 6',
  'mods|goldSpeedrun|cfg|preset|factory7': 'Fabrikrang 7 (max)',
  'mods|goldSpeedrun|cfg|preset|custom': 'Eigenes Gold',
  'mods|goldSpeedrun|cfg|startMode': 'Was den Timer startet',
  'mods|goldSpeedrun|cfg|startMode|desc': 'Mausdruck ist die Speedrun-Einstellung: die Uhr startet in dem Moment, in dem du graebst, greifst, baust oder forschst. Herumlaufen ist frei, und was ohne deinen Klick weiterlaeuft - eine Grabdrohne, ein Foerderband - startet sie ebenfalls nicht.',
  'mods|goldSpeedrun|cfg|startMode|mouse': 'Nur Mausdruck',
  'mods|goldSpeedrun|cfg|startMode|click': 'Mausdruck oder jeder Fortschritt',
  'mods|goldSpeedrun|cfg|startMode|any': 'Jede Aktion, auch Bewegung',
  'mods|goldSpeedrun|cfg|startMode|move': 'Nur Bewegung',
  'mods|goldSpeedrun|cfg|clockMode': 'Welche Uhr im Bild steht',
  'mods|goldSpeedrun|cfg|clockMode|desc': 'Beide Zeiten werden immer gemessen und stehen immer im Ergebnisfenster - das hier entscheidet nur, welche gross auf dem Timer steht. Die Echtzeit ist die offizielle: sie ist die Zahl, die auch eine Stoppuhr neben dem Bildschirm zeigt, und die einzige, die sich an einem Video nachpruefen laesst. Die Simulationszeit zaehlt die Schritte, die die Welt tatsaechlich gelaufen ist - damit bleibt ein Lauf auf einem Rechner, der keine 60 UPS haelt, mit einem vergleichbar, der sie haelt.',
  'mods|goldSpeedrun|cfg|clockMode|both': 'Echtzeit, Simulationszeit darunter',
  'mods|goldSpeedrun|cfg|clockMode|rta': 'Nur Echtzeit',
  'mods|goldSpeedrun|cfg|clockMode|sim': 'Nur Simulationszeit',
  'mods|goldSpeedrun|cfg|timeFormat': 'Genauigkeit der Uhr',
  'mods|goldSpeedrun|cfg|timeFormat|seconds': 'Sekunden (00:00:00)',
  'mods|goldSpeedrun|cfg|timeFormat|centis': 'Hundertstel (00:00:00.00)',
  'mods|goldSpeedrun|cfg|timeFormat|millis': 'Millisekunden (00:00:00.000)',
  'mods|goldSpeedrun|cfg|skipIntro': 'Intro und Landeanflug ueberspringen',
  'mods|goldSpeedrun|cfg|skipIntro|desc': 'Springt bei einem neuen Spiel direkt in die Welt, genau wie der Knopf "Skip Intro" im Spiel. Die Uhr bleibt unberuehrt: der uebersprungene Landeanflug kann sie nicht starten.',
  'mods|goldSpeedrun|cfg|skipStory': 'Story-Textboxen wegblenden',
  'mods|goldSpeedrun|cfg|skipStory|desc': 'Schliesst die Story-Einblendungen, sobald sie auftauchen - dasselbe wie Wegklicken, die Story zaehlt sie also weiter als gesehen. Solange eine im Bild ist, kann der Timer nicht starten.',
  'mods|goldSpeedrun|cfg|skipTutorial': 'Tutorial automatisch ueberspringen',
  'mods|goldSpeedrun|cfg|skipTutorial|desc': 'Beendet das Tutorial beim Laden eines Spielstands, genau wie der Knopf im Spiel. Passiert nur, solange der Timer noch wartet - nie mitten im Lauf.',
  'mods|goldSpeedrun|cfg|showOverlay': 'Timer einblenden',
  'mods|goldSpeedrun|cfg|showSplits': 'Split-Tabelle zeigen',
  'mods|goldSpeedrun|cfg|showSplits|desc': 'Listet die letzten Ausloeser unter der Uhr mit Zeit und Gold. Die vollstaendige Tabelle erscheint am Ende im Ergebnisfenster.',
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

  // Offizielles Regelwerk
  'mods|goldSpeedrun|rules|badge': 'OFFIZIELLES REGELWERK',
  'mods|goldSpeedrun|rules|custom': 'Eigene Regeln',
  'mods|goldSpeedrun|rules|title': 'Offizielles Speedrun-Regelwerk',
  'mods|goldSpeedrun|rules|ok': 'Alle Einstellungen entsprechen dem offiziellen Regelwerk.',
  'mods|goldSpeedrun|rules|bad': 'Diese Einstellungen weichen vom offiziellen Regelwerk ab:',
  'mods|goldSpeedrun|rules|need': 'noetig: {value}',
  'mods|goldSpeedrun|rules|broken': 'REGELWERK VERSTELLT',
  'mods|goldSpeedrun|rules|brokenDesc': 'Waehrend des laufenden Laufs wurde eine Einstellung des offiziellen Regelwerks geaendert. Der Lauf gilt nicht mehr als offiziell und wird nicht als Bestzeit gespeichert.',
  'mods|goldSpeedrun|rules|locked': 'festgehalten beim Start des Laufs',
  'mods|goldSpeedrun|rules|mods': 'Andere Mods aktiv',
  'mods|goldSpeedrun|rules|modsNone': 'keine',
  'mods|goldSpeedrun|cfg|showRuleset': 'Regelwerk-Abzeichen zeigen',
  'mods|goldSpeedrun|cfg|showRuleset|desc': 'Zeigt am Timer und im Ergebnisfenster, ob die Einstellungen dem offiziellen Regelwerk entsprechen: Start durch jede Aktion inklusive Bewegung, Gold-Regelwerk Hard Mode, Tutorial-Skip aus, und kein anderer Mod aktiv.',

});

const t = (key, params) => api.i18n.t(key, params);

// --- Kategorien -----------------------------------------------------------
// kind bestimmt, was gemessen wird; target ist das feste Ziel der Kategorie.
// Kategorien ohne target holen ihn aus den Einstellungen bzw. aus der Karte.
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

// 100000 -> "100k", 1000000 -> "1M"
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

// Die Zahl der Artefakte haengt an der Karte: die meisten liegen in Prefabs,
// der Rest steckt als Sensor im Gelaende. Beide Quellen liefert das Spiel erst
// nach dem Laden, deshalb wird der Wert einmal pro Spielstand gemerkt.
let artifactTotalCache = null;

const detectArtifactTotal = () => {
  let total = 0;

  try {
    const pd = sandkit.engine && sandkit.engine.api && sandkit.engine.api.prefabData;
    if (pd && typeof pd.getArtifactLocations === 'function') {
      const list = pd.getArtifactLocations();
      if (Array.isArray(list)) total += list.length;
    }
  } catch (e) { /* Karte ohne Prefab-Daten */ }

  try {
    const sensors = sandkit.state.store.world.sensors;
    if (Array.isArray(sensors)) total += sensors.length;
  } catch (e) { /* keine Sensoren im Spielstand */ }

  return total;
};

const artifactTotal = () => {
  const override = api.settings.get('artifactTarget');
  if (Number.isFinite(override) && override > 0) return Math.floor(override);
  if (artifactTotalCache === null) artifactTotalCache = detectArtifactTotal();
  // Liefert die Karte nichts, waere 0 sofort "geschafft" - dann lieber warten,
  // bis der Wert von Hand gesetzt ist, und den Zaehler offen lassen.
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

// --- Messwerte ------------------------------------------------------------
const getGold = () => {
  const st = sandkit.state;
  const g = st && st.store && st.store.resources ? st.store.resources.gold : 0;
  return Number.isFinite(g) ? g : 0;
};

const getArtifactsFound = () => {
  try {
    const a = sandkit.state.store.resources.artifacts;
    if (Number.isFinite(a)) return a;             // sehr alte Spielstaende
    return Number.isFinite(a && a.found) ? a.found : 0;
  } catch (e) {
    return 0;
  }
};

// Der wirksame Rang - die Story kann ihn zeitweise deckeln.
const getFactoryLevel = () => {
  try {
    const lvl = sandkit.engine.api.factory.getLevel(sandkit.state);
    if (Number.isFinite(lvl)) return lvl;
  } catch (e) { /* interne API nicht verfuegbar */ }
  try {
    const v = sandkit.state.store.viability;
    return Number.isFinite(v && v.level) ? v.level : 1;
  } catch (e) {
    return 1;
  }
};

// --- Verdientes Gold ------------------------------------------------------
// Zwei Messweisen sind moeglich:
//   'balance' - der aktuelle Kontostand. Ausgeben setzt den Fortschritt zurueck.
//   'earned'  - alles, was seit Laufbeginn eingenommen wurde. Ausgeben kostet
//               keinen Fortschritt.
//
// Fuer 'earned' fuehrt der Mod selbst Buch: er vergleicht den Goldstand mit dem
// vorigen Wert und addiert nur die Zugewinne. Bewusst nicht ueber das interne
// viability.goldSpent des Spiels - das wird beim Laden aus Tech-Kosten
// rekonstruiert und ist keine verlaessliche Laufzeit-Summe.
let earnedTotal = null;   // Laufsumme im Speicher
let lastBalance = null;

// Die dritte Wahl beim Gold-Regelwerk stellt den ganzen offiziellen Lauf ein,
// nicht nur das Gold: sie zieht auch den Startmodus und den Tutorial-Skip auf
// die Vorgabe. Die beiden Optionen bleiben stehen, wie sie sind - sie werden
// nur nicht mehr gefragt, solange die offizielle Wahl aktiv ist.
const officialMode = () => api.settings.get('goldMode') === 'official';

const goldMode = () => {
  const v = api.settings.get('goldMode');
  return v === 'balance' || v === 'official' ? 'balance' : 'earned';
};

// Ueberall statt api.settings.get('skipTutorial') benutzen: im offiziellen
// Regelwerk laeuft das Tutorial mit, auch wenn der Schalter an ist.
const skipTutorialEnabled = () =>
  !officialMode() && api.settings.get('skipTutorial') === true;

// Was das offizielle Regelwerk den uebrigen Optionen vorschreibt. Die drei
// Vorgaben der Kategorieregeln stehen oben; Intro und Story kommen dazu,
// damit der Spielanfang ablaeuft wie ohne Mod - sonst faengt der Lauf mit
// einer uebersprungenen Sequenz an, die alle anderen mitspielen.
const OFFICIAL_FORCED = {
  startMode: 'any',
  skipTutorial: false,
  skipIntro: false,
  skipStory: false,
};

// Die Werte, die vor dem Umschalten galten - damit das Zurueckschalten die
// eigenen Einstellungen nicht dauerhaft verbrannt hat.
const OFFICIAL_BACKUP = 'goldSpeedrun.beforeOfficial';

// api.settings kann nur lesen. Geschrieben wird deshalb direkt in den Topf,
// aus dem es liest: state.session.settings.externalModSettings[<mod>]. Das
// Spiel prueft die Werte beim naechsten Lesen gegen configSchema, ungueltiges
// kaeme also gar nicht erst an.
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

// Schreibt einen Wert und meldet, ob er auch angekommen ist. Faellt der
// Weg irgendwann weg, bleibt es bei den Ueberschreibungen beim Lesen - der
// Lauf ist also auch dann korrekt, nur die Anzeige haengt hinterher.
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

// Haelt die Anzeige der Einstellungen mit dem tatsaechlichen Zustand gleich:
// solange das offizielle Regelwerk gewaehlt ist, stehen die beiden anderen
// Optionen auf der Vorgabe und springen sofort zurueck, wenn jemand sie
// verstellt. Beim Verlassen kommen die alten Werte zurueck.
const syncOfficialSettings = () => {
  let changed = false;
  const backup = api.storage.local.get(OFFICIAL_BACKUP);
  const hasBackup = backup && typeof backup === 'object';

  if (officialMode()) {
    // Fehlt die Sicherung ganz, oder kamen dem Regelwerk seit dem letzten
    // Umschalten Schluessel dazu, wird sie erst vervollstaendigt - danach
    // erst wird ueberschrieben, sonst sichert man den erzwungenen Wert.
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

// Jeden Frame aufgerufen: nur ein Zahlenvergleich, kein Schreibzugriff.
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

// Der Goldwert, der in der Split-Tabelle steht - dieselbe Messweise wie das Ziel.
const goldProgress = () => (goldMode() === 'balance' ? getGold() : sampleEarned());

// Der Wert, gegen den das Ziel der Kategorie geprueft wird.
const progressOf = cat => {
  if (cat.kind === 'gold') return goldProgress();
  if (cat.kind === 'artifacts') return getArtifactsFound();
  return getFactoryLevel();
};

// Kategoriename fuer HUD und Stream, z.B. "100k Gold % · Hard Mode · Ohne Tutorial".
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

// Schluessel der Bestzeit: pro Kategorie und Regelwerk getrennt, sonst
// stehen 1M-Zeiten neben 100k-Zeiten.
const bestKey = metric => {
  const cat = category();
  const bits = [cat.id, cat.kind === 'gold' ? goldMode() : 'x'];
  if (cat.id === 'custom') bits.push(String(cat.target));
  if (skipTutorialEnabled()) bits.push('notut');
  // Die Echtzeit behaelt den Schluessel aus 2.6.0 - sonst waeren mit dem
  // Update alle bisherigen Bestzeiten weg. Die Simulationszeit bekommt einen
  // eigenen, die beiden Zahlen duerfen sich nicht ueberschreiben.
  if (metric === 'sim') bits.push('sim');
  return `${BEST_PREFIX}.${bits.join('.')}`;
};

const readBest = metric => {
  const v = api.storage.local.get(bestKey(metric));
  if (Number.isFinite(v)) return v;
  if (metric === 'sim') return null;
  // Bestzeit aus Version <= 1.4: galt immer fuer 100k im Normal-Regelwerk.
  const cat = category();
  if (cat.id === '100000' && goldMode() === 'earned' && !skipTutorialEnabled()) {
    const legacy = api.storage.local.get(LEGACY_BEST_KEY);
    if (Number.isFinite(legacy)) return legacy;
  }
  return null;
};

// --- Zeitformat -----------------------------------------------------------
// In-Game-Zeit in ms; laeuft nur waehrend das Spiel laeuft und wandert mit ins
// Savegame. Der Wert ist eine Fliesskomma-Summe der Frame-Deltas, also auch
// unterhalb einer Millisekunde genau.
const now = () => api.time.getTimeMs() || 0;

// Welche der beiden Uhren gross im Bild steht. Auf die Wertung hat das keinen
// Einfluss - beide Zeiten werden immer gemessen und immer festgehalten.
const clockMode = () => {
  const v = api.settings.get('clockMode');
  return v === 'rta' || v === 'sim' || v === 'both' ? v : 'both';
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

// Kurzform fuer die Tabelle - Stunden nur, wenn es welche gibt.
const formatShort = (ms, fmt) => {
  const full = formatTime(ms, fmt);
  return full.startsWith('00:') ? full.slice(3) : full;
};

const formatGold = n => api.i18n.formatNumber(Math.floor(n));

// --- Laufzustand (im Savegame) -------------------------------------------
// { startedAt: number|null, finishedAt: number|null, splits: Split[] }
// Split = { t: ms seit Start, kind, label, gold }
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
  // Laeufe aus 2.0.0 haben nur Zahlen gespeichert; die sind ohne Beschriftung
  // wertlos und werden verworfen, statt die Tabelle kaputt anzuzeigen.
  return v.filter(e => e && typeof e === 'object' && Number.isFinite(e.t));
};

// Der Lauf hat drei Zustaende:
//   startedAt == null                  -> scharf, wartet auf die erste Aktion
//   startedAt gesetzt, finishedAt null -> laeuft
//   finishedAt gesetzt                 -> beendet
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

// --- Die beiden Uhren -----------------------------------------------------
// api.time.getTimeMs() liefert trotz des Namens keine In-Game-Zeit, sondern
// Echtzeit: das Spiel summiert in seiner Renderschleife die Frame-Abstaende,
// deckelt sie aber bei 50 ms.
//
//     let r = t - session.timestep.lastTime;
//     r > 50 && (r = 50);
//     store.meta.time += r;
//
// Dauert ein Frame laenger - also unterhalb von 20 FPS - verfaellt alles ueber
// 50 ms, und die Uhr bleibt hinter einer Stoppuhr zurueck. Getroffen hat das
// genau die Rechner, die die Bildrate nicht halten: dort misst der Timer eine
// andere Groesse als auf schneller Hardware, und keine der beiden sagt, wie
// schnell der Lauf wirklich war. Deshalb misst der Mod seit 2.7.0 selbst - und
// zwar zwei verschiedene Groessen:
//
//   RTA  Echtzeit aus performance.now(), ohne Deckel. Das ist die Zahl, die
//        auch eine Stoppuhr neben dem Bildschirm zeigt, und sie bleibt die
//        offizielle Wertung: nur sie laesst sich an einem Video nachpruefen.
//
//   SIM  Simulationszeit: ausgefuehrte Simulationsschritte mal 1/60 s. Die
//        Welt laeuft mit festem Zeitschritt (be = 1/60). Schafft der Rechner
//        keine 60 Schritte pro Sekunde, verstreicht Echtzeit, ohne dass die
//        Fabrik vorankommt. SIM zaehlt nur den Fortschritt und haengt damit
//        nicht an der Hardware - das ist die Zahl, nach der ein Lauf auf einem
//        langsamen Rechner mit einem auf einem schnellen vergleichbar wird.
//
// Beide halten an, wenn das Spiel anhaelt. SIM kann nie groesser werden als
// RTA: der Akkumulator der Simulation bekommt nur echte Zeit gutgeschrieben.

const SIM_STEP_MS = 1000 / 60;
const SHARED_KEY = 'simClock';
const SHARED_NAME = `external:${MOD_ID}:${SHARED_KEY}`;

const numberOr = (v, fallback) => (Number.isFinite(v) ? v : fallback);

const gamePaused = () => {
  try {
    return sandkit.state.session.paused === true;
  } catch (e) {
    return false;
  }
};

// Der exakte Weg: ein Ausloeser im Simulations-Thread schreibt dessen
// Schrittzaehler in einen gemeinsamen Speicher, den dieser Thread mitliest.
let simBuf = null;        // Float64Array: [0] = Schrittzaehler, [1] = Lebenszeichen
let simLastTick = null;   // Stand beim letzten Auslesen
let simExactSeen = false; // hat der Ausloeser jemals geschrieben?

const setupSimClock = () => {
  try {
    simBuf = api.shared.buffers.create(SHARED_KEY, { type: 'float64', length: 2 });
  } catch (e) {
    simBuf = null;
    log('Simulationsuhr: kein gemeinsamer Speicher -', (e && e.message) || e);
    return;
  }

  // Der Ausloeser laeuft im Simulations-Thread. Das Spiel schickt ihn dorthin,
  // indem es den Quelltext der Funktion verschickt und ihn drueben mit
  // new Function neu baut - die Funktion darf deshalb nichts aus diesem Modul
  // benutzen. Der Name des Puffers wird als Literal eingesetzt, alles andere
  // kommt ueber die Argumente.
  //
  // Geschrieben wird der absolute Stand von store.meta.tick, kein eigener
  // Zaehler: laeuft der Ausloeser einmal zu oft oder faellt einer aus, steht
  // trotzdem die richtige Zahl im Puffer.
  //
  // Der ganze Rumpf liegt in try/catch. Das Spiel ruft Ausloeser in Se() ohne
  // eigene Absicherung auf; eine Ausnahme von hier landet in der Schleife des
  // Simulations-Threads und liesse die Simulation stehen.
  const body =
    'try {' +
    '  var b = state && state.shared && state.shared.mods' +
    '    && state.shared.mods[' + JSON.stringify(SHARED_NAME) + '];' +
    '  if (b) { b[0] = state.store.meta.tick || 0; b[1] = b[1] + 1; }' +
    '} catch (e) { /* die Simulation darf daran nicht haengen bleiben */ }';

  // Nicht api.triggers.register: dessen Wrapper ist
  //   function(e,t,i){ return r.callback(t,i) }
  // und nimmt die Closure-Variable r mit in den verschickten Quelltext. Im
  // Simulations-Thread gibt es kein r, der Aufruf wirft dort ReferenceError -
  // und weil Se() nicht absichert, bliebe die Simulation stehen. Der Weg ueber
  // engine.api schickt genau die Funktion, die hier steht.
  try {
    sandkit.engine.api.triggers.register(
      sandkit.engine.state,
      `${MOD_ID}:${SHARED_KEY}`,
      { interval: SIM_STEP_MS, callback: new Function('state', 'trigger', 'dtMs', body) },
    );
  } catch (e) {
    log('Simulationsuhr: Ausloeser abgelehnt -', (e && e.message) || e);
  }
};

// Zuwachs an Simulationszeit seit dem letzten Aufruf, oder null, wenn der
// exakte Weg (noch) nicht steht. Muss auch dann gerufen werden, wenn gerade
// kein Lauf laeuft, damit der Bezugswert mitwandert.
const simDeltaExact = () => {
  if (!simBuf) return null;
  if (!(simBuf[1] > 0)) return null;
  simExactSeen = true;

  const tick = simBuf[0];
  if (!Number.isFinite(tick)) return null;

  // Erster Aufruf, oder der Zaehler faengt von vorn an (neue Karte, Neustart
  // des Simulations-Threads): neu einnorden statt Unsinn zu addieren.
  if (simLastTick === null || tick < simLastTick) {
    simLastTick = tick;
    return 0;
  }

  const steps = tick - simLastTick;
  simLastTick = tick;
  return steps * SIM_STEP_MS;
};

// Der Rueckfallweg, falls der Ausloeser nicht ankommt: managerPerformance[1]
// ist der reale Abstand zwischen zwei Simulationsschritten - dieselbe Zahl,
// aus der die Anzeige im Spiel ihre UPS rechnet. Das ist eine Schaetzung: sie
// stimmt bei gleichmaessiger Last gut und wird bei Rucklern ungenau.
const simDeltaEstimate = dtMs => {
  let perf = 0;
  try {
    perf = sandkit.state.shared.managerPerformance[1];
  } catch (e) {
    perf = 0;
  }
  if (!Number.isFinite(perf) || perf <= 0) return dtMs;
  return dtMs * Math.max(0, Math.min(1, SIM_STEP_MS / perf));
};

// Beide Uhren stehen im Spielstand, nicht im Speicher: api.storage.set ist
// eine Zuweisung an ein Objekt in store.mods, kostet also nichts und wandert
// beim Speichern von allein mit. Ein Lauf uebersteht damit Speichern und Laden
// ohne Verlust.
const readClock = key => Math.max(0, numberOr(api.storage.get(NS, key), 0));

let lastPerf = null;

const advanceClocks = () => {
  const stamp = performance.now();
  const prev = lastPerf;
  lastPerf = stamp;

  // Immer auslesen, damit der Bezugswert der Simulationsuhr auch dann
  // mitlaeuft, wenn gerade nichts gezaehlt wird.
  const exact = simDeltaExact();

  if (prev === null) return;
  if (gamePaused()) return;
  if (!isRunning()) return;

  const dt = stamp - prev;
  if (!(dt > 0) || dt > 3600000) return;

  let simDt;
  if (exact === null) {
    simDt = simDeltaEstimate(dt);
    if (api.storage.get(NS, 'clockExact') !== false) api.storage.set(NS, 'clockExact', false);
  } else {
    simDt = exact;
  }
  if (!(simDt >= 0)) simDt = 0;
  const simMax = dt + 250;
  if (simDt > simMax) simDt = simMax;

  api.storage.set(NS, 'rtaMs', readClock('rtaMs') + dt);
  api.storage.set(NS, 'simMs', readClock('simMs') + simDt);
};

// Ein Lauf aus einer aelteren Version hat die beiden Summen noch nicht. Statt
// ihn zu verwerfen, wird der bisherige Stand aus meta.time uebernommen - das
// ist die Zahl, die bis dahin die offizielle war.
const migrateClocks = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return;
  if (Number.isFinite(api.storage.get(NS, 'rtaMs'))) return;

  const end = typeof run.finishedAt === 'number' ? run.finishedAt : now();
  const legacy = Math.max(0, end - run.startedAt);
  api.storage.set(NS, 'rtaMs', legacy);
  api.storage.set(NS, 'simMs', legacy);
  api.storage.set(NS, 'clockLegacy', true);
  log('Laufender Lauf aus einer aelteren Version uebernommen:', formatTime(legacy, 'millis'));
};

const startClocks = () => {
  lastPerf = performance.now();
  api.storage.set(NS, 'rtaMs', 0);
  api.storage.set(NS, 'simMs', 0);
  api.storage.set(NS, 'clockExact', true);
  api.storage.set(NS, 'clockLegacy', false);
};

// Echtzeit des Laufs - die offizielle Wertung.
const elapsed = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  return readClock('rtaMs');
};

// Simulationszeit des Laufs - hardwareunabhaengig, aber nicht am Video pruefbar.
const elapsedSim = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return 0;
  return readClock('simMs');
};

// Wieviel Prozent der Echtzeit die Simulation nicht mitgekommen ist. 0 heisst
// durchgehend 60 UPS, 50 heisst: die Haelfte der Zeit lief die Welt nicht.
const simDeficit = () => {
  const rta = elapsed();
  if (rta <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - elapsedSim() / rta) * 100));
};

// Wie verlaesslich die Simulationsuhr dieses Laufs ist.
const clockQuality = () => ({
  exact: api.storage.get(NS, 'clockExact') !== false,
  legacy: api.storage.get(NS, 'clockLegacy') === true,
});

// Wurde im Spielstand jemals ein Cheat benutzt, ist der Lauf wertlos. Das Flag
// setzt das Spiel selbst und nimmt es nie zurueck.
const cheatsUsed = () => {
  try {
    return sandkit.state.store.integrity.cheatsUsed === true;
  } catch (e) {
    return false;
  }
};

// --- Namen fuer die Split-Tabelle -----------------------------------------
// Forschungen tragen nicht alle einen eigenen Namensschluessel. Fehlt er,
// benennt das Spiel sie ueber das, was sie freischaltet - z.B. heisst
// "shaker" im Baum nach der Struktur "structures|shaker|name".
const prettifyId = id => String(id)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, c => c.toUpperCase());

const translateIfPresent = key => {
  if (typeof key !== 'string' || key.length === 0) return null;
  try {
    if (api.i18n.hasTranslation && !api.i18n.hasTranslation(key)) return null;
  } catch (e) { /* ohne Pruefung einfach versuchen */ }
  const value = t(key);
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value === key || value.startsWith('[MISSING') || value.startsWith('[NO KEY]')) return null;
  return value;
};

const techName = techId => {
  if (!techId) return '?';

  let def = null;
  try { def = api.tech.getDefinitionById(techId); } catch (e) { /* unbekannt */ }

  const direct = translateIfPresent(def && def.nameKey) || translateIfPresent(`tech|${techId}|name`);
  if (direct) return direct;

  const unlocks = (def || {}).unlocks || {};
  if (Array.isArray(unlocks.structures)) {
    for (const type of unlocks.structures) {
      let sdef = null;
      try { sdef = api.structures.getDefinitionByType(type); } catch (e) { /* unbekannt */ }
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

// --- Zwischenzeiten -------------------------------------------------------
// Jeder eingeschaltete Ausloeser haengt hier einen Eintrag an: Beschriftung,
// Zeit seit Laufbeginn und der Goldstand in dem Moment.
const addSplit = (kind, label) => {
  const run = readRun();
  if (typeof run.startedAt !== 'number' || typeof run.finishedAt === 'number') return;

  const splits = readSplits();
  splits.push({
    t: elapsed(),
    sim: elapsedSim(),
    kind,
    label,
    gold: Math.floor(goldProgress()),
  });
  api.storage.set(NS, 'splits', splits);

};

// Die Gruppen-Einstellung aus den Mod-Optionen ist nur der Ausgangswert.
const splitOn = key => api.settings.get(key) === true;

// --- Einzelne Ausloeser ---------------------------------------------------
// Fuer jede Forschung, jeden Rang und jede Gold-Marke ein eigener Schalter.
// Das passt nicht in die modinfo.json - die erlaubt hoechstens 64 Felder, und
// allein die Forschungen sind rund 57. Deshalb ein eigenes Fenster im Spiel
// und ein Objekt im localStorage, savegame-uebergreifend.
//
//   {}                        -> alles folgt der Gruppen-Einstellung
//   { "tech:shaker": false }  -> dieser eine Ausloeser ist abgewaehlt
const TRIGGER_KEY = 'goldSpeedrun.triggers';

const readOverrides = () => {
  const v = api.storage.local.get(TRIGGER_KEY);
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

const writeOverrides = map => {
  // Leere Eintraege gar nicht erst speichern, damit spaetere Aenderungen an den
  // Gruppen-Einstellungen weiter durchschlagen.
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

// Setzt eine ganze Gruppe; null loescht die Einzelschalter wieder, dann gilt
// erneut die Gruppen-Einstellung.
const setGroup = (kind, ids, value) => {
  const map = readOverrides();
  for (const id of ids) {
    const k = triggerKey(kind, id);
    if (value === null) delete map[k];
    else map[k] = !!value;
  }
  writeOverrides(map);
};

// Alle Forschungs-IDs. Das Tech-Enum deckt nur einen Teil ab - von den
// Definitionen des Spiels sind rund 22 als reine String-IDs hinterlegt und
// tauchen im Enum nicht auf.
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
  } catch (e) { /* noch kein Spielstand */ }
  techIdCache = [...ids];
  return techIdCache;
};

const rankIds = () => {
  const out = [];
  for (let lvl = 2; lvl <= MAX_FACTORY_LEVEL; lvl++) out.push(lvl);
  return out;
};

// Gold-Marken: entweder ein Anteil des Kategorieziels oder ein fester Schritt.
const goldMarks = cat => {
  const mode = api.settings.get('splitGold');
  if (!mode || mode === 'off') return [];

  if (mode === '10k' || mode === '100k') {
    const step = mode === '10k' ? 10000 : 100000;
    const out = [];
    // Die Marke auf dem Ziel selbst faellt weg - dort endet der Lauf ohnehin.
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

// Die Marken aendern sich nur, wenn Kategorie oder Einstellung wechseln.
let markCache = { key: null, list: [] };

const currentGoldMarks = cat => {
  const key = `${cat.id}|${cat.target}|${api.settings.get('splitGold')}`;
  if (markCache.key !== key) markCache = { key, list: goldMarks(cat) };
  return markCache.list;
};

// --- Start durch die erste Aktion -----------------------------------------
// Standard ist "jede Aktion": Bewegung, Graben, Bauen, Forschen, Aufsammeln.
// Damit laesst sich kein Fortschritt an der Zeitnahme vorbei erarbeiten.

// Waehrend eigener Eingriffe - vor allem des Tutorial-Skips - ist der Start
// gesperrt. Als Echtzeit-Frist, damit auch verzoegerte Folgeereignisse (Story,
// Freischaltungen) nicht durchrutschen und ein haengender Schalter sich von
// selbst loest.
let suppressUntil = 0;

// Sperren nur verlaengern, nie verkuerzen - sonst hebt ein spaeterer, kurzer
// Eingriff die laengere Sperre eines frueheren wieder auf.
const suppressFor = ms => {
  suppressUntil = Math.max(suppressUntil, Date.now() + ms);
};

// Kurze Schonfrist nach dem Laden. Sie gilt nur fuer die Ereignis-Ausloeser:
// waehrend die Welt anlaeuft, kann die Simulation von sich aus Gelaende
// aufloesen oder Material einsammeln. Direkte Eingaben - Taste, Klick, Bauen,
// Forschen - starten auch in dieser Zeit sofort.
let eventGraceUntil = 0;

const graceFor = ms => {
  eventGraceUntil = Math.max(eventGraceUntil, Date.now() + ms);
};

// Drei Regelwerke:
//   'mouse' - nur ein Druck der Maustaste startet: Graben, Greifen, Bauen,
//             Forschen. Laufen ist frei, und was ohne Klick weiterlaeuft -
//             etwa eine grabende Drohne - startet ebenfalls nichts.
//   'click' - zusaetzlich alles, was Fortschritt bedeutet, auch ohne Klick.
//   'any'   - zusaetzlich schon die erste Bewegung.
//   'move'  - nur Bewegung, wie in Version 1.x.
const startMode = () => {
  if (officialMode()) return 'any';
  const v = api.settings.get('startMode');
  return v === 'click' || v === 'any' || v === 'move' ? v : 'mouse';
};

const startsOnMovement = () => {
  const m = startMode();
  return m === 'any' || m === 'move';
};

// Der Druck der Maustaste: Werkzeug- oder Waffenaktion im Spielfeld, Bauen,
// Forschen. Gilt in jedem Regelwerk ausser "nur Bewegung".
const startsOnMouse = () => startMode() !== 'move';

// Fortschritt ohne eigenen Klick - Drohnen, Foerderbaender, Aufsammeln.
const startsOnEvent = () => {
  const m = startMode();
  return m === 'click' || m === 'any';
};

// --- Offizielles Regelwerk ------------------------------------------------
// Die Vorgabe der offiziellen Speedrun-Kategorien: ausser diesem Mod ist
// nichts aktiv, jede Aktion startet die Uhr, Gold zaehlt nach Kontostand, und
// das Tutorial wird nicht automatisch uebersprungen. Nur wenn alles vier
// stimmt, traegt der Lauf das Abzeichen.
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
    // "Aus" - dieselbe Beschriftung wie bei den Gold-Marken.
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

// Die Mod-Verwaltung selbst greift nicht ins Spiel ein - sie ist das Werkzeug,
// mit dem die anderen Mods abgeschaltet werden, und zaehlt deshalb nicht mit.
const RULES_MOD_EXEMPT = [MOD_ID, 'mod-manager'];

// Ladereihenfolge, die das Spiel beim Start ablegt. Sie ist die Wahrheit
// darueber, was ueberhaupt geladen wurde - der Eintrag in der Mod-Verwaltung
// bleibt auch stehen, wenn ein Mod-Ordner laengst wieder verschwunden ist.
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

// Fremde Mods, die geladen sind und in der Mod-Verwaltung nicht abgeschaltet
// wurden. Mods ohne eigenen Schalter zaehlen als aktiv - sie laufen ja.
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

// Das HUD zeichnet bei Millisekunden jeden Frame. Die Pruefung liest
// Einstellungen und localStorage, deshalb haelt sie ihr Ergebnis kurz fest.
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

// Der Lauf haelt beim Start fest, ob er offiziell begonnen hat. Wird danach
// etwas daran verstellt, faellt das Kennzeichen und kommt nicht zurueck -
// sonst liesse sich ein Lauf unter offiziellen Regeln beginnen und mitten
// drin auf die bequeme Einstellung wechseln.
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

// Was HUD und Ergebnisfenster anzeigen: vor dem Lauf die aktuellen
// Einstellungen, waehrend und nach dem Lauf das, womit er begonnen hat.
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

// Bewegung: Standard ist W/A/S/D. Hat der Spieler die Bewegung umgelegt,
// gelten seine Tasten ebenfalls - daher werden die Belegungen zur Laufzeit
// abgefragt.
const MOVEMENT_BINDINGS = [
  enums.KeyBinding.Boost,    // hoch / Jetpack (W)
  enums.KeyBinding.Left,     // (A)
  enums.KeyBinding.Descend,  // runter (S)
  enums.KeyBinding.Right,    // (D)
];

const FALLBACK_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

// "Control+KeyC" -> "KeyC"; nur die eigentliche Taste ist relevant.
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

// input:keydown ist ein Interceptor - hier wird nur mitgelesen, nie abgebrochen.
api.hooks.intercept('input:keydown', payload => {
  if (!startsOnMovement()) return;
  if (!isArmed()) return;

  const code = payload && (payload.code || payload.key);
  if (!code) return;
  if (!movementCodes().has(code)) return;

  startRun('Bewegung');
});

// Jede Werkzeug-, Waffen- oder Bauaktion im Spielfeld. Feuert beim Klick,
// bevor die Aktion ausgefuehrt wird - fruehestmoeglicher fairer Startpunkt.
api.hooks.intercept('action:intercept', payload => {
  if (!startsOnMouse()) return;
  if (!isArmed()) return;
  if (!payload || !payload.action) return;   // Klick ohne aktives Werkzeug
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

// Alles, was Fortschritt bedeutet, aber ohne eigenen Klick auslaufen kann -
// etwa eine Drohne, die weitergraebt, oder ein eingesammeltes Artefakt.
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

// --- Ausloeser fuer Zwischenzeiten ----------------------------------------
// Bewusst getrennt von den Start-Ausloesern: das Ereignis, das den Lauf erst
// startet, soll keine Zwischenzeit bei 00:00 erzeugen. Deshalb werden die
// Split-Ausloeser ZUERST registriert - sie sehen den Lauf dann noch als nicht
// gestartet und halten sich raus, und erst danach startet ihn der Listener
// weiter unten.
// build() liefert den Eintrag oder null - die Entscheidung, ob dieser eine
// Ausloeser eingeschaltet ist, faellt dort, weil sie von der ID abhaengt.
const trigger = (eventName, build) => {
  try {
    api.events.on(eventName, payload => {
      if (!modEnabled()) return;
      if (!isRunning()) return;
      let entry;
      try {
        entry = build(payload);
      } catch (e) {
        // Nicht stillschweigend schlucken: ein kaputter Ausloeser wuerde sonst
        // einfach nie feuern, ohne dass es jemand merkt.
        log(`Ausloeser "${eventName}" fehlgeschlagen:`, e);
        return;
      }
      if (entry) addSplit(entry.kind, entry.label);
    });
  } catch (e) {
    log('Ausloeser nicht verfuegbar, uebersprungen:', eventName);
  }
};

trigger('tech:unlocked', payload => {
  const techId = payload && payload.techId;
  if (!techId) return null;
  if (!triggerEnabled('tech', techId, splitOn('splitTech'))) return null;
  return { kind: 'tech', label: techName(techId) };
});

trigger('factory:levelUp', payload => {
  const level = (payload && payload.newLevel) || getFactoryLevel();
  if (!triggerEnabled('rank', level, splitOn('splitRank'))) return null;
  return { kind: 'rank', label: t('mods|goldSpeedrun|split|rank', { level }) };
});

// Artifact ist 1; der Enum-Zugriff bleibt trotzdem der Normalweg, damit eine
// spaetere Umnummerierung im Spiel mitgenommen wird.
const ARTIFACT_TYPE = (enums.WorldItemType && enums.WorldItemType.Artifact) !== undefined
  ? enums.WorldItemType.Artifact
  : 1;

trigger('worldItem:pickedUp', payload => {
  if (!payload || payload.type !== ARTIFACT_TYPE) return null;
  if (!triggerEnabled('artifact', 'any', splitOn('splitArtifact'))) return null;
  return {
    kind: 'artifact',
    label: t('mods|goldSpeedrun|split|artifact', { index: getArtifactsFound() }),
  };
});

trigger('upgrade:purchased', payload => {
  if (!triggerEnabled('upgrade', 'any', splitOn('splitUpgrade'))) return null;
  return {
    kind: 'upgrade',
    label: t('mods|goldSpeedrun|split|upgrade', {
      name: upgradeName(payload && payload.itemId, payload && payload.upgradeId),
    }),
  };
});

// Erst jetzt die Start-Ausloeser: siehe Reihenfolge-Hinweis oben.
for (const name of START_EVENTS) {
  try {
    api.events.on(name, () => startFromEvent(name));
  } catch (e) {
    log('Ereignis nicht verfuegbar, uebersprungen:', name);
  }
}

// --- Zielpruefung ---------------------------------------------------------
let lastWrite = -1;

// Wird gesetzt, sobald ein Lauf endet, und vom Ergebnisfenster gelesen.
let resultDismissed = false;

const finishRun = cat => {
  // Beide Uhren werden im selben Moment abgelesen, bevor der Lauf als beendet
  // markiert wird - danach zaehlt advanceClocks() nicht mehr weiter.
  const time = elapsed();
  const simTime = elapsedSim();
  const deficit = simDeficit();
  const quality = clockQuality();

  // Das Ziel selbst ist die letzte Zwischenzeit - so steht es auch in der Tabelle.
  const splits = readSplits();
  splits.push({
    kind: 'goal',
    label: t('mods|goldSpeedrun|split|goal'),
    t: time,
    sim: simTime,
    gold: Math.floor(goldProgress()),
  });
  api.storage.set(NS, 'splits', splits);
  api.storage.set(NS, 'finishedAt', now());


  const fmt = timeFormat();
  api.ui.toast({ key: 'mods|goldSpeedrun|done', params: { time: formatTime(time, fmt) } });

  if (cheatsUsed()) {
    log('Lauf beendet in', formatTime(time, 'millis'),
      '- ACHTUNG: Cheats wurden in diesem Spielstand benutzt, keine Bestzeit gespeichert.');
  } else if (runRulesBroken()) {
    // Wer mitten im Lauf am Regelwerk dreht, misst nicht mehr dasselbe wie
    // alle anderen unter diesem Schluessel. Die Zeit bleibt sichtbar, sie
    // wird nur nicht abgelegt.
    log('Lauf beendet in', formatTime(time, 'millis'),
      '- ACHTUNG: Regelwerk waehrend des Laufs verstellt, keine Bestzeit gespeichert.');
  } else {
    const best = readBest();
    if (best === null || time < best) {
      api.storage.local.set(bestKey(), time);
      api.ui.toast({ key: 'mods|goldSpeedrun|newBest', params: { time: formatTime(time, fmt) } });
    }

    // Die Simulationszeit wird getrennt gefuehrt. Auf schwacher Hardware ist
    // sie die einzige Zahl, mit der zwei Laeufe vergleichbar sind - eine
    // geschaetzte oder aus einer alten Version uebernommene zaehlt aber nicht.
    if (quality.exact && !quality.legacy) {
      const bestSim = readBest('sim');
      if (bestSim === null || simTime < bestSim) {
        api.storage.local.set(bestKey('sim'), simTime);
      }
    }
  }

  resultDismissed = false;

  // Fuer Nachweis und Stream-Overlay: Kategorie, Endzeit, Splits und die
  // Mod-Liste des Spielstands in einem Block im Log.
  let mods = [];
  try {
    const entry = sandkit.state.store.mods['__sandkitExternalRuntimeV1'];
    if (entry && Array.isArray(entry.order)) mods = entry.order.map(m => `${m.id}@${m.version}`);
  } catch (e) { /* keine Mod-Liste im Spielstand */ }

  log('Lauf beendet', {
    category: categoryLabel(),
    time: formatTime(time, 'millis'),
    timeMs: time,
    simTime: formatTime(simTime, 'millis'),
    simTimeMs: simTime,
    // Wieviel Prozent der Echtzeit die Simulation nicht mitgekommen ist.
    simDeficitPercent: Math.round(deficit * 10) / 10,
    // exact: aus dem Schrittzaehler der Simulation. Sonst geschaetzt und
    // damit nicht als Bestzeit verwertbar.
    simClock: quality.legacy ? 'legacy' : quality.exact ? 'exact' : 'estimated',
    splits: splits.map(s =>
      `${formatTime(s.t, 'millis')}  (sim ${formatTime(Number.isFinite(s.sim) ? s.sim : s.t, 'millis')})  ${s.label}  ${s.gold} Gold`),
    cheatsUsed: cheatsUsed(),
    mods,
  });
};

const checkGoal = () => {
  const run = readRun();
  if (typeof run.startedAt !== 'number') return;
  if (typeof run.finishedAt === 'number') return; // schon durch

  const cat = category();
  if (cat.target <= 0) return;                    // Ziel noch unbekannt

  const current = progressOf(cat);

  // Gold-Marken unterwegs.
  const marks = currentGoldMarks(cat);
  if (marks.length > 0) {
    let index = api.storage.get(NS, 'goldMarkIndex');
    if (!Number.isFinite(index)) index = 0;
    const gold = goldProgress();
    let moved = false;
    while (index < marks.length && gold >= marks[index].value) {
      // Abgewaehlte Marken werden nur uebersprungen, nicht neu geprueft.
      if (triggerEnabled('gold', marks[index].value, true)) {
        addSplit('gold', marks[index].label);
      }
      index++;
      moved = true;
    }
    if (moved) api.storage.set(NS, 'goldMarkIndex', index);
  }

  if (current >= cat.target) finishRun(cat);
};

api.events.on('frame:render', () => {
  // Vor allem anderen und vor der Pruefung auf den Schalter der Mod-Verwaltung:
  // advanceClocks() rechnet mit dem Abstand zum letzten Aufruf, ein
  // uebersprungener Frame wuerde diesen Abstand aufblaehen.
  advanceClocks();

  if (!modEnabled()) return;

  // Jeden Frame messen, damit kurz aufeinander folgendes Einnehmen und Ausgeben
  // nicht durch das Raster faellt. Kostet nur einen Zahlenvergleich.
  if (goldMode() === 'earned') sampleEarned();

  const stamp = now();

  // Jeden Frame pruefen: nur so stimmt die Endzeit auf die Millisekunde.
  checkGoal();

  // Solange der Lauf laeuft, darf sich am Regelwerk nichts mehr aendern.
  // rulesetStatus() haelt sein Ergebnis kurz fest, das kostet also nichts.
  if (isRunning() && runIsOfficial() && !rulesetStatus().ok) dropOfficial();

  // Laufsumme gedrosselt in den Spielstand schreiben.
  if (stamp - lastWrite < 500) return;
  lastWrite = stamp;

  // Doppelter Boden fuer den Fall, dass eine Aenderung ohne onChange kommt.
  if (syncOfficialSettings()) refreshSettingsUi();

  if (earnedTotal !== null) api.storage.set(NS, 'earned', earnedTotal);
});

// Die Uhren haengen nicht am Bild. requestAnimationFrame steht still, sobald
// das Fenster in den Hintergrund geht - eine Stoppuhr tut das nicht, und ein
// Lauf soll sich nicht durch Alt+Tab anhalten lassen. Ein eigener Takt haelt
// sie deshalb auch dann in Gang; angehalten wird nur, wenn das Spiel selbst
// pausiert. Doppelt gerufen zu werden macht advanceClocks() nichts aus, es
// rechnet immer mit dem Abstand zum letzten Aufruf.
setInterval(advanceClocks, 50);

// --- Farben ---------------------------------------------------------------
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

// --- HUD ------------------------------------------------------------------
// Oben rechts sitzt die Missionsziel-/Fabrikrang-Leiste des Spiels, oben links
// der Goldzaehler. Standard ist deshalb oben mittig - dort ist Platz.
const CORNERS = {
  topCenter: { top: '14px', left: '50%', transform: 'translateX(-50%)' },
  topLeft: { top: '96px', left: '16px' },
  topRight: { top: '210px', right: '16px' },
  bottomLeft: { bottom: '96px', left: '16px' },
  bottomRight: { bottom: '96px', right: '16px' },
};

// Millisekunden brauchen jeden Frame, Sekunden nicht. Der Takt richtet sich
// deshalb nach dem gewaehlten Format.
const HUD_INTERVAL = { seconds: 250, centis: 50, millis: 16 };

const HUD_SPLIT_ROWS = 6;

const useTick = fmt => {
  const [, bump] = react.useState(0);
  react.useEffect(() => {
    const id = setInterval(() => bump(n => (n + 1) % 1000), HUD_INTERVAL[fmt] || 50);
    return () => clearInterval(id);
  }, [fmt]);
};

// Eine Zeile der Split-Tabelle. Im HUD schmal, im Ergebnisfenster mit
// Abschnittszeit und Goldzuwachs.
function SplitRow({ split, previous, fmt, wide }) {
  const segment = split.t - (previous ? previous.t : 0);
  const goldGain = split.gold - (previous ? previous.gold : 0);

  const cell = (key, value, style) => h('span', { key, style }, value);

  return h('div', {
    style: {
      display: 'flex', gap: '8px', alignItems: 'baseline',
      padding: wide ? '3px 0' : '1px 0',
      borderBottom: wide ? '1px solid rgba(255,255,255,0.05)' : 'none',
      fontVariantNumeric: 'tabular-nums',
    },
  }, [
    cell('label', split.label, {
      flex: 1, minWidth: 0,
      color: KIND_COLOR[split.kind] || COLORS.text,
      fontWeight: split.kind === 'goal' ? 700 : 500,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }),
    wide
      ? cell('seg', segment > 0 ? '+' + formatShort(segment, fmt) : '-', {
          color: COLORS.dim, minWidth: '72px', textAlign: 'right',
        })
      : null,
    // Absolute Zeit immer vollstaendig: Stunden, Minuten, Sekunden,
    // Millisekunden. Nur die Abschnittsdauer daneben wird gekuerzt, dort ist
    // ein fuehrendes "00:" nur Rauschen.
    cell('time', formatTime(split.t, fmt), {
      minWidth: wide ? '104px' : '92px', textAlign: 'right',
    }),
    cell('gold', wide
      ? formatGold(split.gold)
      : (goldGain > 0 ? '+' + shortGold(goldGain) : ''), {
      color: COLORS.gold, minWidth: wide ? '76px' : '52px', textAlign: 'right',
    }),
  ]);
}

function SplitTable({ splits, fmt, wide }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column' } },
    splits.map((s, i) => h(SplitRow, {
      key: i,
      split: s,
      previous: i > 0 ? splits[i - 1] : null,
      fmt,
      wide,
    })));
}

function SpeedrunHud() {
  const fmt = timeFormat();
  useTick(fmt);

  if (!modEnabled()) return null;
  if (api.settings.get('showOverlay') === false) return null;

  const run = readRun();
  const waiting = typeof run.startedAt !== 'number';
  const done = typeof run.finishedAt === 'number';

  const cat = category();
  const current = progressOf(cat);
  const target = cat.target;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const corner = CORNERS[api.settings.get('corner')] || CORNERS.topCenter;
  const mode = clockMode();
  const rtaTime = elapsed();
  const simTime = elapsedSim();
  const deficit = simDeficit();
  // Die Bestzeit gehoert zu der Uhr, die gross im Bild steht.
  const best = readBest(mode === 'sim' ? 'sim' : undefined);
  const tainted = cheatsUsed();
  const rules = showRuleset() ? rulesetView() : null;

  const allSplits = readSplits();
  const showSplits = api.settings.get('showSplits') !== false && allSplits.length > 0;
  // Im laufenden Betrieb nur die letzten Zeilen - sonst waechst der Kasten
  // ueber den halben Bildschirm. Die ganze Tabelle steht im Ergebnisfenster.
  const visible = allSplits.slice(-HUD_SPLIT_ROWS);
  const firstVisible = allSplits.length - visible.length;

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

  const box = {
    position: 'absolute',
    ...corner,
    minWidth: fmt === 'seconds' ? '210px' : '235px',
    maxWidth: '300px',
    padding: '8px 10px',
    borderRadius: '6px',
    border: `1px solid ${tainted ? COLORS.red : done ? COLORS.gold : waiting ? COLORS.border : '#5a6472'}`,
    opacity: waiting ? 0.75 : 1,
    background: COLORS.box,
    color: COLORS.text,
    font: '500 13px/1.35 system-ui, sans-serif',
    pointerEvents: 'none',
    // Ueber der Tutorial-Box (die liegt auf 10006) - sonst verdeckt sie den
    // Timer genau dort, wo er standardmaessig sitzt.
    zIndex: 10010,
  };

  return h('div', { style: box }, [
    h('div', {
      key: 'time',
      style: {
        font: `700 ${fmt === 'seconds' ? 24 : 22}px/1.1 system-ui, sans-serif`,
        color: done ? COLORS.gold : waiting ? COLORS.dim : COLORS.text,
        fontVariantNumeric: 'tabular-nums',
      },
    }, formatTime(mode === 'sim' ? simTime : rtaTime, fmt)),

    // Die zweite Uhr, klein darunter. Bei 60 UPS steht dieselbe Zahl da wie
    // oben; faellt die Simulation zurueck, zeigt der Prozentsatz, wieviel der
    // Echtzeit ohne Fortschritt in der Welt verstrichen ist.
    mode === 'both' && !waiting
      ? h('div', {
          key: 'sim',
          style: {
            marginTop: '1px',
            font: '600 12px/1.2 system-ui, sans-serif',
            color: deficit >= 5 ? COLORS.gold : COLORS.dim,
            fontVariantNumeric: 'tabular-nums',
          },
        }, `${t('mods|goldSpeedrun|clock|simShort')} ${formatTime(simTime, fmt)}`
           + (deficit >= 1 ? `  -${deficit.toFixed(0)}%` : ''))
      : null,

    h('div', { key: 'goal', style: { marginTop: '4px', opacity: 0.85 } },
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
          h(SplitTable, { key: 'tbl', splits: visible, fmt, wide: false }),
        ])
      : null,

    // Fusszeile: welche Kategorie gilt (wichtig fuer Zuschauer), die Bestzeit
    // und die Bestzeit.
    h('div', {
      key: 'foot',
      style: {
        marginTop: '5px', fontSize: '11px', opacity: 0.6,
        display: 'flex', gap: '10px', justifyContent: 'space-between',
      },
    }, [
      h('span', { key: 'mode' }, categoryLabel()),
      best !== null ? h('span', { key: 'pb' }, `PB ${formatTime(best, fmt)}`) : null,
    ]),

    // Regelwerk-Abzeichen: gruen, sobald alle vier Vorgaben der offiziellen
    // Kategorien stimmen - sonst der dezente Hinweis, dass eigene Regeln
    // gelten. Damit sieht auch ein Zuschauer sofort, woran er ist.
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
  ]);
}

api.ui.inject('hud', SpeedrunHud);

// --- Ergebnisfenster ------------------------------------------------------
// Erscheint, sobald ein Lauf endet, und zeigt die vollstaendige Tabelle mit
// Abschnittszeiten und Goldstand. F10 holt es zurueck.
const resultListeners = new Set();
const notifyResult = () => resultListeners.forEach(fn => {
  try { fn(); } catch (e) { /* ignorieren */ }
});

const setResultDismissed = v => { resultDismissed = !!v; notifyResult(); };

function ResultScreen() {
  const [, bump] = react.useState(0);

  react.useEffect(() => {
    const fn = () => bump(n => (n + 1) % 100000);
    resultListeners.add(fn);
    // Der Lauf kann jederzeit enden, ohne dass jemand klickt - also nachsehen.
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
  const deficit = simDeficit();
  const quality = clockQuality();
  const splits = readSplits();
  const best = readBest();
  const bestSim = readBest('sim');
  const tainted = cheatsUsed();
  const delta = best !== null ? total - best : null;
  const deltaSim = bestSim !== null ? totalSim - bestSim : null;
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
      width: '460px', maxWidth: '92vw', maxHeight: '82vh',
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

      // Die Simulationszeit steht immer mit im Ergebnis, auch wenn im Bild
      // nur die Echtzeit lief - sie ist die Zahl, mit der sich der Lauf mit
      // einem auf anderer Hardware vergleichen laesst.
      h('div', { key: 'sim' },
        line(
          t('mods|goldSpeedrun|result|sim'),
          `${formatTime(totalSim, fmt)}`
            + (deficit >= 1 ? `  (-${deficit.toFixed(1)}%)` : '')
            + (deltaSim !== null
                ? `  ${deltaSim <= 0 ? '-' : '+'}${formatShort(Math.abs(deltaSim), fmt)}`
                : ''),
          COLORS.text,
        )),

      // Wo die Simulationszeit nicht aus dem Schrittzaehler kommt, darf sie
      // nicht wie eine gemessene Zahl gelesen werden.
      quality.legacy || !quality.exact
        ? h('div', {
            key: 'simNote',
            style: { fontSize: '11px', color: COLORS.dim, marginTop: '2px' },
          }, t(quality.legacy
              ? 'mods|goldSpeedrun|result|simLegacy'
              : 'mods|goldSpeedrun|result|simEstimated'))
        : null,
    ]),

    // Regelwerk: bestaetigt den Lauf, oder benennt genau die Einstellungen,
    // die von den offiziellen Kategorien abweichen.
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

// --- Ausloeser-Fenster ----------------------------------------------------
// Ein Schalter je Forschung, je Fabrikrang und je Gold-Marke. Damit stellt
// sich jeder seinen Lauf selbst zusammen, ohne dass die Mod-Einstellungen mit
// Dutzenden Feldern zugestellt werden.
let triggerPanelOpen = false;
let techFilter = '';

const panelListeners = new Set();
const notifyPanel = () => panelListeners.forEach(fn => {
  try { fn(); } catch (e) { /* ignorieren */ }
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
  }, label || (on ? 'AN' : 'AUS'));
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
    // Ein Punkt markiert, was vom Gruppen-Standard abweicht.
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

  // Forschungen, nach angezeigtem Namen sortiert - die IDs sagen wenig.
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

// --- Tastenkuerzel --------------------------------------------------------
// F8 und F10 sind in den Standardbelegungen frei (belegt sind F2, F4, F5, F9).
api.input.registerBinding('GoldSpeedrunReset', ['F8'], {
  displayNameKey: 'mods|goldSpeedrun|resetKey',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => {
      api.storage.set(NS, 'startedAt', null);
      api.storage.set(NS, 'finishedAt', null);
      api.storage.set(NS, 'splits', []);
      api.storage.set(NS, 'goldMarkIndex', 0);
      api.storage.set(NS, 'official', false);
      api.storage.set(NS, 'officialBroken', false);
      startClocks();
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

// F3 ist in den Standardbelegungen frei (belegt sind F2, F4, F5, F9).
api.input.registerBinding('GoldSpeedrunTriggers', ['F3'], {
  displayNameKey: 'mods|goldSpeedrun|trg|key',
  category: 'mods|goldSpeedrun|name',
  handlers: {
    pressed: () => setTriggerPanelOpen(!triggerPanelOpen),
  },
});

// --- Tutorial ueberspringen -----------------------------------------------
// Beendet das Tutorial genau wie der Knopf im Spiel: die Simulations-Threads
// werden informiert und die normalen Freischaltungen (Shaker) vergeben.
// Waehrenddessen ist der Start gesperrt, sonst wuerde das dabei ausgeloeste
// "tech:unlocked" den Timer starten.
// Intro und Landeanflug ueberspringen. Genau das, was der Knopf
// "Skip Intro" im Spiel tut: Intro-Bildschirm zu, Musik aus, und die interne
// game.start(..., {skip:true}), die direkt in die Spielszene springt.
//
// Wichtig fuer die Zeitnahme: der uebersprungene Landeanflug setzt die
// Szenen-Trigger und laesst die Kapsel aufschlagen. Das kann Gelaende
// zerstoeren - ohne Sperre wuerde das den Timer starten.
const activeScene = () => {
  try { return sandkit.state.store.scene.active; } catch (e) { return null; }
};

const introVisible = () => {
  try { return sandkit.state.session.ui.introScreen.visible === true; } catch (e) { return false; }
};

// --- Story-Textboxen ------------------------------------------------------
// Das Spiel schiebt sie unter anderem beim Beenden des Tutorials nach - mit
// Verzoegerung, deshalb tauchen sie erst nach dem Skip auf.
//
// Weggeklickt werden sie im Spiel so: aus session.notifications.story
// entfernen und "story:notificationDismissed" feuern. Das zweite ist wichtig -
// erst dadurch merkt sich die Story, dass der Schritt gezeigt wurde. Ein
// blosses Leeren der Liste liesse sie spaeter wiederkommen.
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
    } catch (e) { /* Story-System nicht aktiv */ }
  }
  for (const id of ['StoryNotifications', 'Notifications', 'Objectives']) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* Komponente inaktiv */ }
  }

  log(`${pending.length} Story-Textbox(en) weggeblendet`);
  return pending.length;
};

// Wie bei skipTutorialEnabled: im offiziellen Regelwerk laeuft der Anfang ab,
// egal was in den Schaltern steht.
const skipStoryEnabled = () => !officialMode() && api.settings.get('skipStory') !== false;

const skipIntroEnabled = () => !officialMode() && api.settings.get('skipIntro') !== false;

// Eigener Takt in Echtzeit: die Boxen kommen verzoegert und auch mitten im
// Lauf, das Spiel-Update ist dafuer der falsche Aufhaenger.
setInterval(() => {
  if (!modEnabled()) return;
  if (!skipStoryEnabled()) return;
  try { dismissStoryNotifications(); } catch (e) { /* naechster Takt */ }
}, 500);

// Solange eine Textbox oder der Intro-Bildschirm im Weg steht, spielt niemand -
// ein Klick oder Tastendruck dagegen darf den Timer nicht anwerfen. Bei
// eingeschaltetem Wegblenden sind die Boxen binnen einer halben Sekunde weg,
// es blockiert also nichts dauerhaft.
const uiBlocksStart = () => {
  try {
    const session = sandkit.state.session;
    if (session.ui && session.ui.introScreen && session.ui.introScreen.visible) return true;
    if (Array.isArray(session.ui && session.ui.dialogs) && session.ui.dialogs.length > 0) return true;
    // Auch ohne Wegblenden: solange eine Box im Bild steht, spielt niemand,
    // und der Klick, der sie wegmacht, ist keine Spielhandlung.
    const list = storyNotifications();
    if (list && list.length > 0) return true;
  } catch (e) { /* Sitzung noch nicht vollstaendig */ }
  return false;
};

const closeIntroScreen = () => {
  try { sandkit.state.session.ui.introScreen.visible = false; } catch (e) { return; }
  for (const id of ['IntroScreen', 'Root']) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* Komponente inaktiv */ }
  }
};

const skipIntro = () => {
  // Gleicher Riegel wie beim Tutorial: die Einstellung entscheidet, nicht
  // der Aufrufer.
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
  try { state.session.music.engine.stop(); } catch (e) { /* keine Musik */ }

  start(state, { skip: true });
  log('Intro uebersprungen');
  return true;
};

// Nach einem Schreibvorgang muss das Menue neu zeichnen, sonst steht dort
// weiter der Wert, den der Spieler gerade angeklickt hat.
const SETTINGS_UI = ['ModsScreen', 'Options', 'Menu', 'Root'];

const refreshSettingsUi = () => {
  for (const id of SETTINGS_UI) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* Komponente inaktiv */ }
  }
};

const TUTORIAL_UI = ['Tutorial', 'Objectives', 'ShortcutHelper', 'Root'];

const refreshTutorialUi = () => {
  for (const id of TUTORIAL_UI) {
    try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* Komponente inaktiv */ }
  }
};

// Was der Knopf im Spiel ueber grantNormalUnlocks() mitgibt: die
// Shaker-Forschung. Bricht der regulaere Weg vorher ab, fehlt sie - und der
// Lauf startet mit weniger als bei jedem anderen.
const grantTutorialUnlocks = () => {
  try {
    const player = sandkit.state.store.player;
    if (!player.tech) player.tech = {};
    const shaker = (enums.Tech && enums.Tech.Shaker) || 'shaker';
    if (player.tech[shaker]) return;

    player.tech[shaker] = true;
    try {
      api.player.buildings.unlockByType(enums.StructureType.ShakerRight);
    } catch (e) { /* Struktur unbekannt */ }
    for (const id of ['Hotbar', 'TechTree', 'Management', 'Resources']) {
      try { api.ui.update(enums.ComponentId[id]); } catch (e) { /* inaktiv */ }
    }
    log('Shaker-Freischaltung nachgezogen - der Knopf im Spiel vergibt sie ebenfalls');
  } catch (e) {
    log('Shaker-Freischaltung fehlgeschlagen:', e);
  }
};

const skipTutorial = () => {
  // Letzter Riegel vor der Tuer: egal, wer hier hereinkommt - steht der
  // Schalter auf aus oder gilt das offizielle Regelwerk, wird nichts
  // uebersprungen. Der Waechter prueft das schon, aber diese Funktion
  // beendet das Tutorial unwiderruflich; ein zweiter Riegel kostet nichts.
  if (!skipTutorialEnabled()) {
    log('Tutorial-Skip abgelehnt - die Einstellung steht auf aus'
      + (officialMode() ? ' (offizielles Regelwerk)' : ''));
    return false;
  }

  const store = sandkit.state.store;
  if (!store.tutorial || !store.tutorial.active) return false;
  log('Tutorial wird uebersprungen');

  suppressFor(1000);

  // Das Spiel setzt in progression.complete das Flag als ERSTES und frischt
  // das Bild als LETZTES auf. Bricht etwas dazwischen ab - etwa der
  // postAll an die Simulations-Threads -, gilt das Tutorial intern als
  // beendet, die Box steht aber weiter im Bild, die Shaker-Forschung fehlt
  // und "tutorial:completed" ist nie gefeuert worden.
  let clean = false;
  try {
    // Identisch zum Knopf "Tutorial ueberspringen" im Spiel.
    clean = api.progression.complete({ domain: 'tutorial', grantNormalUnlocks: true }) !== false;
  } catch (e) {
    log('Tutorial regulaer beenden abgebrochen:', e);
  }

  // Ab hier immer nachziehen. Doppelt schadet nicht, fehlend schon.
  store.tutorial.active = false;
  if (!store.tutorial.data) store.tutorial.data = {};
  refreshTutorialUi();

  if (!clean) {
    log('Regulaerer Weg unvollstaendig - Freischaltung und Ereignis werden nachgeholt');
    grantTutorialUnlocks();
    try {
      api.events.emit('tutorial:completed', { skipped: true });
    } catch (e) { /* Empfaenger nicht aktiv */ }
  }

  api.ui.toast({ key: 'mods|goldSpeedrun|tutorialSkipped' });
  return true;
};

// --- Tutorial-Waechter ----------------------------------------------------
// Bewusst ohne Szenen- und Ablaufbedingungen, und in Echtzeit statt im
// Boot-Takt: der Skip hatte zu viele Voraussetzungen, von denen jede einzelne
// ihn lautlos ausfallen liess. Hier zaehlt nur noch: Einstellung an, Tutorial
// aktiv - dann weg damit.
//
// Der Vorbehalt "nicht mitten im Lauf" gilt weiter, aber nicht in den ersten
// Sekunden nach dem Laden. Sonst genuegt ein Klick beim Startvorgang, um den
// Skip dauerhaft zu verhindern - und genau dann bleibt die Box stehen.
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

// Der Waechter ist das Sicherheitsnetz; angestossen wird er zusaetzlich direkt
// bei game:ready und in jedem Boot-Takt, damit die Box nicht erst nach einer
// halben Sekunde verschwindet.
setInterval(tutorialWatchTick, 500);

// --- Einstellungen im Blick behalten --------------------------------------
// Feuert, sobald jemand im Mod-Menue etwas umstellt. Das Zurueckschreiben
// geht am Setter des Spiels vorbei und loest deshalb keinen zweiten Aufruf
// aus - eine Schleife ist nicht moeglich.
try {
  api.settings.onChange(() => {
    if (!modEnabled()) return;
    if (syncOfficialSettings()) refreshSettingsUi();
  });
} catch (e) { log('Einstellungen nicht beobachtbar:', e); }

// --- Start ----------------------------------------------------------------
// Handle des Boot-Takts ausserhalb des Handlers: kommt game:ready ein zweites
// Mal, wuerden sich sonst zwei Takte gegenseitig in die Quere kommen - der
// eine macht den Intro-Bildschirm zu, den der andere noch sehen will.
let bootTimer = null;

api.events.on('game:ready', () => {
  if (!modEnabled()) return;
  if (bootTimer !== null) {
    clearInterval(bootTimer);
    bootTimer = null;
  }

  // Erst hier, nicht beim Laden des Mods: der Ausloeser geht an den
  // Simulations-Thread, und den gibt es vor der Karte noch nicht. Beides ist
  // gefahrlos wiederholbar - der gemeinsame Speicher wird beim zweiten Aufruf
  // wiederverwendet, der Ausloeser unter derselben Kennung ersetzt.
  setupSimClock();
  simLastTick = null;   // neue Karte, der Schrittzaehler faengt von vorn an
  lastPerf = null;
  migrateClocks();

  artifactTotalCache = null;
  markCache = { key: null, list: [] };
  techIdCache = null;   // andere Karte, evtl. andere Mods, andere Forschungen
  eventGraceUntil = 0;
  graceFor(1500);
  bootPhaseUntil = Date.now() + 20000;

  // Eine Zeile mit dem tatsaechlichen Zustand. Wenn Intro oder Tutorial doch
  // nicht verschwinden, steht hier, woran es lag - statt dass man raten muss.
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

  // Vor allem anderen: steht das offizielle Regelwerk, gelten seine Werte.
  // Das muss vor dem Tutorial-Waechter passieren, der liest den Schalter.
  syncOfficialSettings();

  // Sofort versuchen, nicht erst beim naechsten Waechter-Takt.
  tutorialWatchTick();
  // Ein beim Laden bereits beendeter Lauf soll nicht sofort ins Gesicht
  // springen - F10 holt das Ergebnis bei Bedarf zurueck.
  resultDismissed = true;
  armRun();

  // Intro und Tutorial laufen ueber einen eigenen Takt statt ueber
  // schedule.nextTick. Grund: nextTick haengt am Spiel-Update, und beim
  // Startvorgang ist noch nicht gesagt, dass das schon laeuft. Ein echter
  // Timer ist davon unabhaengig.
  //
  // Der Ablauf beim Start ist:
  //   emit "game:ready"        <- Szene steht schon auf Intro
  //   emit "game:started", await ...
  //   introScreen.visible = true   <- erst hier stehen die Textboxen
  //
  // Deshalb wird gewartet, bis der Intro-Bildschirm wirklich sichtbar ist,
  // und erst dann gesprungen - sonst blendet der Startvorgang ihn nach dem
  // Sprung noch einmal ein.
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
      // Sicherheitsnetz: taucht der Bildschirm nach dem Sprung wieder auf,
      // wird er zugemacht.
      if (introDone && introVisible()) closeIntroScreen();

      if (!introDone) {
        if (scene === enums.Scene.Deploy) {
          // Landeanflug laeuft schon - direkt durchspringen.
          try { introDone = skipIntro(); } catch (e) { log('Intro-Skip fehlgeschlagen:', e); introDone = true; }
        } else if (scene === enums.Scene.Intro && introVisible()) {
          // Genau der Zustand, in dem auch der Knopf im Spiel arbeitet.
          try { introDone = skipIntro(); } catch (e) { log('Intro-Skip fehlgeschlagen:', e); introDone = true; }
        } else if (scene !== enums.Scene.Intro && scene !== enums.Scene.Deploy) {
          // Geladener Spielstand: es gibt gar kein Intro.
          introDone = true;
        }
      }
    }

    // Das Tutorial macht der Waechter oben - hier wird nur noch abgewartet,
    // bis er fertig ist. Frueher standen an dieser Stelle Bedingungen
    // (Szene, isArmed), die den Skip lautlos ausfallen lassen konnten.
    if (!tutorialDone) {
      if (!wantTutorial) {
        tutorialDone = true;
      } else {
        tutorialWatchTick();
        try { tutorialDone = sandkit.state.store.tutorial.active !== true; } catch (e) { /* noch nicht da */ }
        if (tutorialDone) refreshTicks = 5;
      }
    }

    // Nach dem Skip noch ein paar Takte das Bild auffrischen: die
    // Tutorial-Box wird beim Startvorgang mehrfach gezeichnet, und eine
    // Auffrischung zum falschen Zeitpunkt verpufft.
    if (refreshTicks > 0) {
      refreshTicks--;
      refreshTutorialUi();
    }

    if (introDone && tutorialDone) announce();

    // Auch wenn alles erledigt ist, laeuft der Takt noch rund drei Sekunden
    // weiter: der Startvorgang kann den Intro-Bildschirm nach dem Sprung
    // erneut einblenden, und dann muss ihn noch jemand zumachen.
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

  // Falls der Takt haengen bleibt, soll die Kategorie trotzdem gemeldet werden.
  setTimeout(announce, 16000);
});

log('geladen - der Timer startet mit der ersten Aktion (Graben, Bauen, Forschen, Aufsammeln)');
