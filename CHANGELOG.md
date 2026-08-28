# Changelog

## 3.0.0 — play-clock scoring, categories, unified Runs

Community release of everything built after 2.8.1. Scoring, comparison, and
the dashboard are a new contract: play-clock (W) is the official metric,
each category has its own PB and triggers, and Personal Best is just another
run in the same list.

### Changed

* **Play-clock (W) is the official / community metric.** Personal bests and
  split comparisons are stored and judged in W. Real time (R) and
  simulation time (T) are still measured and still written to the CSV, the
  log, and the dashboard stats. The headline clock default is W. Old
  R-valued bests are not migrated; the first legitimate W finish will
  replace them (W is always ≤ R).
* **Clipboard summary** uses W for the final time and each split line.
* **HUD and dashboard deltas follow LiveSplit.** Completed rows show the
  split delta versus the comparison run's split time (whole-run context).
  The current HUD row counts a live running delta up through and past that
  time. The dashboard lists both **segment duration** (`t[i] − t[i−1]`) and
  **Δ vs PB**, so the duration column can no longer be read as a delta.
* **One Runs list.** Personal Best and imported/custom targets live in the
  same list. Every run has the same toolbar: compare (radio), Edit splits,
  Duplicate, Export, Delete. Custom runs also get Rename, Mark as PB, and
  Up/Down. The separate PB card and comparison-target section are gone.
* **PB splits are editable.** Edit on Personal Best opens the same
  searchable trigger combobox, time fields, reorder, add, and remove as
  any other run. The PB time follows the last split. The previous PB is
  snapshotted to Previous PBs first.
* **Comparison is the radio on the run.** Choosing Personal Best uses the
  official PB; choosing another run races that run. Importing a CSV
  never writes the PB.
* **Split rows use a searchable trigger combobox.** Type a substring
  (`ilt` finds Filter, `ran` finds Factory rank). Imported rows can be
  rebound to a real trigger in one click. The add-split form uses the same
  picker.
* **PB storage keys no longer include the tutorial-skip flag.** Toggling
  skip-tutorial or Official ruleset cannot hide a PB. Existing `...notut`
  keys are copied onto the stable key once.
* **Gold ruleset default stays Normal (`earned`).** An earlier attempt to
  switch installs to Hard Mode hid existing PBs (they live under a key that
  includes the gold ruleset). That one-time switch is undone: if you were
  moved to Hard Mode only by the update, you go back to Normal and the old
  PB key is visible again. Official ruleset still forces Hard Mode when you
  pick it.
* **Run tab fits without scrolling the left column.** Hero cards and metric
  rows are denser so the UPS envelope graph stays visible by default.

### Added

* **Category manager** (F10 → Categories): presets plus local custom
  categories (name, goal, gold ruleset). Each category has its own PB key
  and its own trigger set (F3). The previous global trigger map is the
  fallback so existing selections still apply.
* **Runs** per category: named, ordered comparison split lists with
  editable W times. The selected run drives HUD upcoming order and all
  deltas.
* **1:00 PB floor.** A finish under 60 seconds of play-clock is shown and
  logged, but never stored as a best. Existing stored bests below that
  threshold are ignored and cleared when read. Use *Clear PB* on the
  Categories tab to drop any leftover.
* **PB History (last 5).** Clearing a PB, importing one, marking a run as
  PB, or beating a run snapshots the previous PB. Restore it from the
  Categories tab in one click.
* **Two badges.** *No additional mods* is always on the HUD and dashboard
  (green at zero, amber with a count otherwise — never a red X). The
  official-ruleset badge is unchanged and still optional.

### Fixed

* Loading an already-beaten or non-speedrun save no longer records or
  displays a finished run. A finish under the 1:00 floor, or a goal that
  is already met in the first two seconds, is discarded and the run
  resets to the waiting state. Stored bogus runs from earlier versions
  are cleared on load. Personal bests are not touched.
* A comparison run's authored splits stay visible even if that trigger is
  off in F3. The live comparison is the union of the run and F3, with
  the run winning.
* Synthetic `fromPb` routes are ignored, no longer written, and removed
  from storage so they cannot be confused with a real comparison run.
* **Dashboard and F3 no longer overlap.** Opening the split-triggers panel
  closes the dashboard, and opening the dashboard closes F3. F3 still opens
  on its own (no dashboard required). Clicking outside F3 closes it.
  Opening F3 from the dashboard and closing F3 returns to the dashboard.
* **Import and export are contextual.** The Run tab exports the finished
  run. Each comparison run has its own Export; Import CSV creates a new
  run and never silently overwrites the current one or the PB.
* HUD badges and dashboard chips no longer wrap mid-word.
* Dashboard body cards scroll when the header grows, so the UPS graph
  no longer clips the footer. Empty UPS text distinguishes “setting off”
  from “setting on, no run yet”.
* CSV import maps columns by header name, so `play_ms` stays the official
  column even if a sheet reorders fields. The export schema is unchanged
  (`kind,label,time_ms,sim_ms,play_ms,gold`).

## 2.8.1 — resume, compact HUD, stable graph

### Added

* **CSV export/import on the result screen.** Export writes the splits you
  see in the table (`kind`, label, real/sim/play time in whole milliseconds,
  gold). Import reads the same format back into the current run. The old
  export pulled an empty per-category "targets" store, so the file was
  header-only even after a finished run with a full split list.
* **Copy summary** on the result screen, plus seed, pause count and reload
  count on the timer and in the dashboard.

### Fixed

* **CSV times are whole milliseconds.** Float leftovers from
  `performance.now()` and `U * (1000/60)` are rounded on export.
* **Unnamed research in F3 and in splits (5, 6, 22, 59, …).** Those IDs are
  numeric Tech-enum values (Flamethrower, Gun, Rocket, Cryoblaster, …). The
  game titles them from the unlocked item; the mod now does the same via
  `enums.Tech` / `enums.ItemId` and the i18n keys, instead of showing the
  raw number. F3 no longer lists a second row for the numeric save key.
* **Artifacts counted from 0.** The pickup split fired before the store
  incremented, so the first artifact was "Artifact 0". New splits start at
  1; an already-finished run remaps 0-based labels on the result table and
  on export.
* **Simulation time (+63%) and jump on reload:** The internal architecture for U (simulation ticks) and W (play-time) has been completely rewritten. They are now pure additive counters exactly like R (real-time). This permanently fixes a bug where reloading a save would calculate a massive negative baseline from a cold buffer and inflate the simulation time by adding the saved elapsed time on top of the world tick.
* **Hot-reload stability:** Loading a save mid-game (without quitting to the main menu) now correctly detects the jump in time, resets the polling cursors, and perfectly resumes the elapsed run without adding backward jumps to the simulation clock.
* **Split triggers menu (F3) flicker:** Pressing and holding F3 no longer causes the menu to rapidly toggle open and closed due to key repetition.
* **Translation error on buttons:** The ON/OFF switches in the split menu now properly show "ON" and "OFF" on the English client, instead of being hardcoded to the German "AN" and "AUS".
* **Save/reload continues all three clocks.** Real time and simulation time
  were restarting at 0 after a load while the play-clock kept the old value.
  Elapsed R, T and W now travel with the save; after load they are restored
  and re-anchored against the live world. The HUD no longer waits for
  `game:ready` alone - if a run is in progress and memory still shows 0, the
  clocks heal themselves on the next tick.
* **Live UPS bars no longer flicker** when the 60-second window slides. Each
  finished second is a locked bucket; only the current incomplete second
  updates. A bar that has gone green, yellow or red stays that colour until
  it drops off the left.

### Changed

* **Horizontal timer layout is now the default.** Splits and progress sit on
  the left, clocks plus slowdown and tick deficit in the middle, the UPS
  graph (at double height) and the footer on the right. The old vertical
  stack remains as *Timer layout → Vertical*.
* **HUD split column shows the LiveSplit delta** versus the personal best
  (green ahead, red behind) instead of gold gained. Existing PBs have no
  stored splits, so the column stays empty until the next best is set. The
  result screen still lists gold.
* **The split list now shows upcoming milestones**, not only ones that have
  already fired: remaining gold marks, factory ranks, artifacts, the goal,
  and leftover PB research/upgrades. Completed rows stay visible at the
  top; the rest look ahead. How many rows fit is set under *Splits visible
  on the timer* (default 6). Upcoming rows are dimmed and show the PB time
  when one exists.
* The overlay uses `pointer-events: none` on every HUD wrapper and sizes
  itself to its content, so it should not intercept clicks.
* **PB split times are stored as JSON** (localStorage plus the save file).
  The previous array write often never came back, so the delta column stayed
  empty even after a best. Existing PBs are backfilled from a finished save
  that matches the stored time. Until a PB exists, the column shows segment
  time so the list is not dead.
* **Slowdown, tick deficit and the live UPS graph survive a reload.** The
  last computed slowdown/deficit plus the sparkline buckets travel with the save.
* **A stored PB of 00:00:00 no longer blocks every real best.** That zero
  came from a bad write; it is ignored, and a finished run on the save is
  adopted as the PB if none exists.

## 2.8.0 — three clocks, tick-accurate

The timing core from 2.7.0 was already right in principle - real time as the
official clock, a hardware-independent second clock alongside it - but it
leaned on an in-game trigger for the exact simulation clock and fell back to
an estimate when that trigger did not fire. This version replaces the whole
thing with a single source of truth: the executed tick counter, published
straight out of the simulation thread.

### The tick counter, not a trigger

* Removed the `api.triggers.register` workaround and the `managerPerformance`
  estimate it fell back to. In its place, a dedicated `worker.js` runs in the
  simulation thread itself and copies `store.meta.tick` into a shared buffer
  after every step - the mechanism the sandkit API is built for, no
  string-built function bodies, no fallback path needed.
* This raw tick count, `U`, is exact by construction: it cannot skip a step
  or double-count one, because it is always the absolute counter, never a
  delta.

### Three clocks, not two

* **Real time (R)** stays the official scoring, unchanged in meaning:
  `performance.now()`, uncapped, paused only when the game pauses.
* **Simulation time (T)** is now `U / 60` - derived directly from the exact
  tick count instead of an in-game trigger's own accumulation. At a steady
  60 UPS it equals real time; behind that, it is smaller.
* **Play-clock (W)** joins as a third, separate number: the game's own
  `store.meta.time`, the exact value written to the save file's playtime.
  It is not a scoring metric - its 50 ms-per-frame cap (see 2.7.0's notes)
  makes it drift below 20 FPS - but it lets a run be cross-checked against
  its own save file and gives the community a shared reference point.
* Any of the three can be the large headline clock (*Headline clock* option,
  replacing *Which clock is shown*); the other two always sit underneath.

### Always visible: how much the hardware cost this run

* **Slowdown %** (`(T/R − 1) × 100`) and **Tick deficit** (`60·R − U`, shown
  as both a tick count and the equivalent lost seconds) are now permanent,
  not behind a percentage threshold like 2.7.0's deficit line. Both sit near
  0 and jitter in either direction - the engine can briefly run *more* than
  60 ticks a second to claw back a backlog, so a small positive reading is
  normal; a sustained negative one is the signal to look at.
* A new **advanced metrics** toggle (off by default) adds the raw tick
  count, average UPS, the ticks an ideal 60-UPS machine would have reached
  by now, the thinking multiplier (`R/T`, the reciprocal of Slowdown %), and
  a `W − R` probe that shows exactly how far the play-clock's frame cap
  pulled it from real time.

### UPS over time

* Two new graphs, both off by default and both sampled purely on the main
  thread from the tick counter - no simulation cost either way.
  * **UPS history**: a once-per-second min/max/average bucket of the whole
    run, shown in the result screen as a min/max envelope against a 60 UPS
    reference line. However long the run, every stutter stays visible - long
    runs merge old buckets in pairs instead of losing resolution up front.
  * **Live sparkline**: the same idea over a rolling 60 seconds, drawn under
    the HUD timer.
* The result screen keeps its automatic summary on finish and adds a
  click-to-expand section with the full metric set and the full-run graph -
  nothing pops up uninvited.

### Added

* **A "Mod enabled" switch in the mod's own settings.** Turns the whole mod
  off - timer, overlay, splits, auto-skips, everything - without having to
  uninstall it or dig through the separate mod manager screen. Same switch
  the mod manager already had, just reachable directly. A run already in
  progress keeps its official real-time clock running in the background
  while this is off, exactly like disabling the mod through the manager
  always has - so it cannot be used to pause a run mid-attempt.

### Fixed

* **The timer no longer hangs at 0 after loading a save.** The raw tick,
  play-clock and real-time baselines now travel with the save and are
  restored on load - a save/reload, including restarting an attempt from an
  earlier save, resumes exactly instead of freezing. A defensive check also
  re-syncs the baselines mid-run if a save loads without the usual signal.
* **Removed the artificial ~400 ms start delay** carried over from the
  proof-of-concept this was built from - the run and all its metrics now
  begin on the exact frame of the first action, same as before.
* **The timer could start on its own during a new game's loading sequence.**
  The start triggers stay armed from the moment the mod loads, and the
  intro/landing/tutorial-skip sequence on a new game can take several
  seconds - long enough for a setup event (world generation, the automatic
  intro or tutorial skip) to slip past the short post-load grace window and
  get mistaken for the player's first action. The run can now only start
  once the actual game scene is live, since no real action is possible
  before that point anyway.

### Changed

* Splits are measured in real time (R), same as the personal best, and
  additionally record simulation time and play-clock for later analysis.
* Personal best is tracked on real time only; the separate simulation-time
  best from 2.7.0 is gone along with the estimate path it protected against.

## 2.7.0 — two clocks

The timer no longer takes the game's word for how much time has passed. It
measures itself, and it measures two different things.

### Why

`api.time.getTimeMs()` is not in-game time despite the name. The game adds up
the gaps between rendered frames — but caps each one at 50 ms:

```
let r = t - session.timestep.lastTime;
r > 50 && (r = 50);
store.meta.time += r;
```

Below 20 FPS everything past 50 ms per frame is simply dropped, and the clock
falls behind a stopwatch: at 12 FPS a 60-second stretch was recorded as roughly
36. That is where it hurts most, because a machine that cannot hold the
framerate is exactly the machine whose runs got measured wrong — the timer was
quietly reporting a different quantity on weak hardware than on strong.

### Real time

* The run clock is now built from `performance.now()`, without a cap. It is the
  number a stopwatch next to the screen shows, and it stays the official
  scoring: it is the only one a verifier can check against a video.
* It still stops when the game pauses. It no longer stops when the window goes
  to the background — a run cannot be parked with Alt+Tab any more.
* Both clocks live in the savegame and are written every frame, so saving and
  loading mid-run costs nothing.

### Simulation time

* New second time, the one the report asked for. The world runs on a fixed
  step of 1/60 s. If the machine cannot manage 60 steps per second, real time
  passes without the factory getting anywhere — and the run is punished for the
  hardware, not for the route.
* Simulation time counts the steps the world actually ran, times 1/60 s. At a
  steady 60 UPS it is identical to real time; at 20 UPS it is a third of it.
  That makes a run on a weak machine comparable with one on a strong machine.
* It is read straight out of the simulation thread: a trigger there writes its
  step counter into shared memory that the main thread reads. Exact, not
  sampled.
* If that trigger does not come up, the mod falls back to estimating from
  `managerPerformance[1]` — the same number the in-game display derives its UPS
  from. An estimated run says so on the result screen and is never stored as a
  simulation best.
* Personal bests are kept separately for the two times. The real-time bests
  from 2.6.0 keep their key and stay where they are.

### In the game

* New option *Which clock is shown*: real time with simulation time small
  underneath (default), or either one on its own. It only changes the display —
  both times are always measured, always split, always in the result screen and
  always in the log block.
* Under the clock the deficit is shown as a percentage as soon as it passes 1%:
  how much of the real time the world did not move. At 0% you held 60 UPS.
* Splits record both times.

### Note on `api.triggers.register`

The mod does not use it. The wrapper the game builds around a mod callback
keeps a closure variable in the source it ships to the simulation thread:

```
callback: function(e,t,i){ return r.callback(t,i) }
```

There is no `r` over there, so the call throws `ReferenceError` — and `Se()`
does not guard, so the exception lands in the manager loop and the simulation
stops. The step counter is registered through `sandkit.engine.api` with a
self-contained callback whose whole body sits in a `try`/`catch` instead.

## 2.6.0 — official ruleset badge

* The timer now shows whether your settings match the **official speedrun
  ruleset**: only Gold Speedrun Challenge enabled, *What starts the timer* set
  to *Any action, movement included*, *Gold ruleset* on *Hard Mode*, and *Skip
  the tutorial automatically* off.
* All four match: a green **✓ OFFICIAL RULESET** under the clock and on the
  result screen. Anything off: a quiet *Custom rules* instead, and the result
  screen names each setting that differs together with the value it needs.
* Other mods are counted from what the game actually loaded, not from the mod
  manager's list — an entry left behind by a deleted mod folder no longer
  counts against you. The mod manager itself is exempt: it does not touch the
  game and is the tool that switches the others off.
* New option *Show ruleset badge* (on by default) hides the whole thing.

### Setting it up, and keeping it that way

* *Gold ruleset* has a third choice next to Normal and Hard Mode: **Official
  ruleset (Hard Mode)**. It sets up the whole run, not just the gold: *What
  starts the timer* moves to *Any action, movement included*, and *Skip the
  tutorial automatically*, *Skip intro and landing* and *Dismiss story text
  boxes* all go off — visibly, in the options themselves, so the opening
  plays out the way it does without the mod.
* None of those four can be moved while the official ruleset is picked.
  Change one and it snaps straight back. The values they had before are
  restored when you switch back to Normal or Hard Mode.
* Story pop-ups now block the start of the run whenever one is on screen,
  not only when auto-dismiss is on — the click that closes a box is not a
  game action and must not start the clock.
* The intro and tutorial skips check the setting themselves before acting,
  instead of trusting the caller. Ending the tutorial cannot be undone.
* The run locks its ruleset in at the start and stores it in the save. From
  then on it is re-checked every frame: change the gold ruleset, the start
  mode, the tutorial skip or the enabled mods mid-run and the badge drops
  immediately — and does not come back, not even if the setting is put back.
* A run whose ruleset was changed shows a red **RULESET CHANGED** instead of
  the badge and is not stored as a best time, the same treatment a save with
  cheats gets. The clock itself keeps running and the time stays visible.
* `F8` clears the mark along with the rest of the run.

## 2.5.0 — the speedrun update

Everything below changed since **1.4.0**, the version currently on the Workshop.

### Timing

* Millisecond precision: `HH:MM:SS.mmm`. Switchable to hundredths or whole seconds.
* The goal is now checked every frame instead of twice a second, so the final
  time is exact to the millisecond instead of up to half a second late.
* Still in-game time: the clock pauses with the game, so a stutter or a pause
  costs you nothing.
* The timer draws above the tutorial box instead of behind it.

### What starts the clock

* The run starts on your **first mouse action** — digging, grabbing, building,
  researching — not on W/A/S/D as before. Walking around is free, but no
  progress happens off the timer.
* Four rulesets to choose from: mouse press only, mouse press or any progress
  (drones, belts, pickups), any action including movement, or movement only
  (the old 1.4 behaviour).
* While a story pop-up, a dialog or the intro screen is on screen, nothing
  starts. Clicking those away does not count as playing.
* Rebound movement keys are respected.

### Categories

* **All Artifacts %** — the target is read from the loaded map: prefab
  artifacts plus the ones hidden in the terrain as sensors. Can be overridden
  by hand.
* **Factory Rank 6** and **Factory Rank 7**, using the effective rank, so the
  story's rank cap is taken into account.
* **Custom gold target** for testing.
* Personal bests are now kept per category and ruleset. The old 1.4 best time
  is still read for 100k / Normal.

### Splits

* Triggers: every research, every factory rank, every artifact, every upgrade,
  and gold marks (25/50/75 % of the goal, every 10 %, or every 10k / 100k).
* **Every trigger is switchable on its own** — `F3` opens the list with a
  filter and all-on / all-off per section. Build exactly the run you want.
* A split table under the timer shows the last entries with time and gold.
* A **result screen** appears at the end with the full table: trigger, segment
  time, total time, gold, plus the comparison against your best. `F10` brings
  it back.

### Start of a session

* **Skip intro and landing** (on by default) — the same as the in-game
  *Skip Intro* button.
* **Dismiss story text boxes** (on by default) — the same as clicking them
  away, so the story still counts them as seen.
* **Skip the tutorial** (off by default). If the game's own skip aborts halfway
  — which leaves the tutorial box on screen and the Shaker research ungranted —
  the mod now repairs both.
* None of these start the clock: the start is locked while they run, so neither
  the landing pod's impact nor the tutorial unlock can trigger it.

### Integrity

* If cheats were ever used in a save, the HUD says so and the time is never
  stored as a best.
* Finishing writes category, final time, all splits and the save's mod list to
  the console, so a run can be checked afterwards.

### Removed

* The LiveSplit connection and its bridge script are gone. The mod no longer
  opens any network connection and needs nothing running outside the game.

---

## 2.5.0 — das Speedrun-Update

Alles Folgende hat sich seit **1.4.0** geaendert, der Fassung, die derzeit im
Workshop liegt.

### Zeitnahme

* Millisekunden: `HH:MM:SS.mmm`. Umstellbar auf Hundertstel oder ganze Sekunden.
* Das Ziel wird jetzt in jedem Frame geprueft statt zweimal pro Sekunde. Die
  Endzeit stimmt damit auf die Millisekunde statt bis zu einer halben Sekunde
  daneben zu liegen.
* Weiterhin In-Game-Zeit: die Uhr haelt mit dem Spiel an, ein Ruckler oder eine
  Pause kostet dich nichts.
* Der Timer wird ueber der Tutorial-Box gezeichnet statt dahinter.

### Was die Uhr startet

* Der Lauf startet mit dem **ersten Mausdruck** — Graben, Greifen, Bauen,
  Forschen — nicht mehr mit W/A/S/D. Herumlaufen ist frei, aber es entsteht
  kein Fortschritt an der Zeitnahme vorbei.
* Vier Regelwerke zur Wahl: nur Mausdruck, Mausdruck oder jeder Fortschritt
  (Drohnen, Baender, Aufsammeln), jede Aktion inklusive Bewegung, oder nur
  Bewegung (das alte Verhalten aus 1.4).
* Solange eine Story-Einblendung, ein Dialog oder der Intro-Bildschirm im Bild
  steht, startet nichts. Wegklicken zaehlt nicht als Spielen.
* Umgelegte Bewegungstasten werden beruecksichtigt.

### Kategorien

* **Alle Artefakte %** — das Ziel wird aus der geladenen Karte gelesen:
  Prefab-Artefakte plus die, die als Sensor im Gelaende stecken. Von Hand
  ueberschreibbar.
* **Fabrikrang 6** und **Fabrikrang 7**, ueber den wirksamen Rang, damit der
  Story-Deckel beruecksichtigt wird.
* **Eigenes Gold-Ziel** zum Testen.
* Bestzeiten liegen jetzt getrennt nach Kategorie und Regelwerk. Die alte
  1.4-Bestzeit wird fuer 100k / Normal weiter gelesen.

### Splits

* Ausloeser: jede Forschung, jeder Fabrikrang, jedes Artefakt, jede Aufwertung
  und Gold-Marken (25/50/75 % des Ziels, alle 10 %, oder alle 10k / 100k).
* **Jeder Ausloeser ist einzeln schaltbar** — `F3` oeffnet die Liste mit
  Filterfeld und Alle-an / Alle-aus je Abschnitt. Damit stellst du dir genau
  den Lauf zusammen, den du willst.
* Eine Split-Tabelle unter der Uhr zeigt die letzten Eintraege mit Zeit und
  Goldstand.
* Am Ende erscheint ein **Ergebnisfenster** mit der vollstaendigen Tabelle:
  Ausloeser, Abschnittszeit, Gesamtzeit, Gold, dazu der Vergleich mit deiner
  Bestzeit. `F10` holt es zurueck.

### Beim Start einer Sitzung

* **Intro und Landeanflug ueberspringen** (Standard an) — dasselbe wie der
  Knopf *Skip Intro* im Spiel.
* **Story-Textboxen wegblenden** (Standard an) — dasselbe wie Wegklicken, die
  Story zaehlt sie also weiter als gesehen.
* **Tutorial ueberspringen** (Standard aus). Bricht der spieleigene Skip auf
  halbem Weg ab — dann bleibt die Tutorial-Box stehen und die Shaker-Forschung
  fehlt — zieht der Mod jetzt beides nach.
* Nichts davon startet die Uhr: waehrend dieser Schritte ist der Start
  gesperrt, damit weder der Aufschlag der Landekapsel noch die
  Tutorial-Freischaltung sie anwirft.

### Integritaet

* Wurden in einem Spielstand jemals Cheats benutzt, sagt das HUD es und die
  Zeit wird nie als Bestzeit gespeichert.
* Am Ende landen Kategorie, Endzeit, alle Splits und die Mod-Liste des
  Spielstands in der Konsole, damit ein Lauf nachpruefbar ist.

### Entfernt

* Die LiveSplit-Anbindung und ihr Bruecken-Skript sind weg. Der Mod oeffnet
  keine Netzwerkverbindung mehr und braucht nichts, was ausserhalb des Spiels
  laeuft.
