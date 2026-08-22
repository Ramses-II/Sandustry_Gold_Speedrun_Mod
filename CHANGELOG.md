# Changelog

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
