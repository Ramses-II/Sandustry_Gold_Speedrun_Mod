# Gold Speedrun Challenge

Aktuelle Version: **3.11.0**. Vollstaendige Aenderungshistorie: [CHANGELOG.md](CHANGELOG.md).

Speedrun-Timer fuer Sandustry. Die Uhr startet mit der ersten Aktion und stoppt,
sobald das Ziel der gewaehlten Kategorie erreicht ist.

## Kategorien

| Kategorie | Ziel |
| --- | --- |
| 100k / 500k / 1M Gold % | Gold-Schwelle |
| Alle Artefakte % | jedes Artefakt der Karte |
| Fabrikrang 6 / 7 | Rang erreicht |
| Eigenes Ziel | Gold, Fluxit, Energie, Aura, Artefakte, Fabrikrang, einzeln oder zusammen |

Bei den Gold-Kategorien gibt es zwei Regelwerke: **Hard Mode** (Standard,
vorgeschrieben) geht nach dem Kontostand (Forschen wirft zurueck).
**Total Earned** zaehlt alles eingenommene Gold (Ausgeben kostet keinen
Fortschritt) und ist **ungueltig fuer Speedruns**.

Eigene Kategorien legt F10 an. **Kombiniert** ist fertig, wenn jedes
angekreuzte Ziel erreicht ist. Die Vorlage ist Fabrikrang 6 plus 100k Gold.
Gold, Fluxit und Energie folgen nur dem globalen Regelwerk (Hard Mode oder
Total Earned), nicht einem Schalter an der Kategorie. Aura ist die Zahl
abgebaute Kristalle an der Schwarmkonsole (Saettigung bei 10000). Ein
Gold-Ziel zeigt Gold/s einmal, auf der eigenen Zeile unter der Uhr. Daneben
steht das Gold/s, das vom aktuellen Stand aus noch noetig ist, um die
stehende Bestzeit zu erreichen: gruen, wenn das aktuelle Tempo reicht, gold
bis 15 Prozent darunter, rot wenn es weiter zurueckliegt oder die Bestzeit
schon vorbei ist. Verzoegerung und Schritt-Rueckstand teilen sich die erste
Zeile, die Blocklast die zweite. Splits stehen direkt unter der Uhr. Der
Kategoriename und die Bestzeit stehen bei den Fortschrittsbalken. Waagerecht
sind das zwei Spalten. F7 und F10 stehen nebeneinander. Jedes Ziel hat seine
Farbe: Gold, Fluxit tiefviolett, Energie bernstein, Aura hellblau, Fabrikrang
smaragd, Artefakte rosa. Schrittzahl, Soll-Schritte, Denk-Faktor und W−R
stehen nur im Dashboard. Der Kategoriename am Timer steht einmal.

F7 zeichnet den Goldstand als eigene Linie auf der rechten Achse. Der Wert
steckt in jedem gespeicherten UPS-Eimer, alte Spielstaende haben die Linie
erst nach neuen Messungen. Die Engpasskarte wird in der Aufloesung des
Fensters gezeichnet, damit sie unter Linux keine Streifen aus der
CSS-Skalierung zeigt. Bereich und Karte starten auf **kompletter Lauf** und
**Exp. Abkuehlung**.

Ein neuer Rekord vergleicht Ergebnis und PNG mit der vorherigen Bestzeit.
Die erste Bestzeit einer Kategorie zeigt einen Strich. Waehrend des Laufs
bleibt der Vergleich die stehende Bestzeit, eine gewaehlte Vergleichsroute
ebenfalls.

Das Artefakt-Ziel liest der Mod aus der geladenen Karte - Prefab-Artefakte plus
die im Gelaende versteckten Sensor-Artefakte. Findet er nichts, laesst sich die
Zahl in den Einstellungen von Hand setzen.

## Zeitnahme

Gemessen werden **drei** Zeiten. Alle laufen nur, waehrend das Spiel laeuft,
stehen im Spielstand, und werden immer festgehalten - die Einstellung
*Grosse Uhr* entscheidet nur ueber die Anzeige.

**Spielzeit-Uhr (W)** ist die offizielle Community-Wertung. Sie ist die eigene
Uhr des Spielstands (`store.meta.time` / playTime).

**Pausenbewusste Echtzeit (R)** kommt aus `performance.now()` und zaehlt reale
Millisekunden nur, solange das Spiel laeuft. Pausieren haelt sie an, ein
Absturz kostet keine Zeit; das Fenster in den Hintergrund zu schieben haelt
sie nicht an.

**Simulationszeit** ist die Zahl fuer den Vergleich ueber verschiedene Rechner
hinweg. Die Welt laeuft mit einem festen Schritt von 1/60 s. Schafft der Rechner
keine 60 Schritte pro Sekunde, verstreicht Echtzeit, ohne dass die Fabrik
vorankommt - der Lauf wird dann fuer die Hardware bestraft, nicht fuer die
Route. Die Simulationszeit zaehlt nur die Schritte, die die Welt wirklich
gelaufen ist: bei 60 UPS ist sie mit der Echtzeit identisch, bei 20 UPS ein
Drittel davon. Unter der Uhr steht ab 1 % das Defizit, also wieviel Prozent der
Echtzeit die Welt stillstand.

Bestzeiten werden in der Spielzeit-Uhr (W) gespeichert. Alle drei Uhren bleiben
in der Tabelle und im CSV. Die Anzeige gibt es in Sekunden, Hundertstel oder
Millisekunden. Ein Lauf unter einer Minute wird nicht als Bestzeit abgelegt.

> Bis 2.6.0 kam die Uhr aus `api.time.getTimeMs()`. Das ist trotz des Namens
> keine In-Game-Zeit, sondern Echtzeit mit einem Deckel von 50 ms pro Frame -
> unterhalb von 20 FPS blieb sie hinter der Stoppuhr zurueck. Getroffen hat das
> genau die Rechner, die die Bildrate nicht halten: dort hat der Timer eine
> andere Groesse gemessen als auf schneller Hardware. Zeiten aus 2.6.0 und
> frueher sind auf schwachen Rechnern deshalb zu kurz.

## Was den Timer startet

Die Uhr startet mit der **ersten echten Spielhandlung**: Bewegung, Graben,
Greifen, Bauen, Forschen, und auch Fortschritt ohne eigenen Klick (Drohnen,
Foerderbaender, Aufsammeln). Der Intro-Bildschirm bleibt der einzige Riegel:
solange der Landeanflug im Bild ist, startet nichts. Eine Story-Textbox
blockiert den Start nicht mehr - Wegklicken einer Box startet ihn weiterhin
nicht, weil das keine Spielhandlung ist.

Wurden im Spielstand jemals Cheats benutzt,
zeigt das HUD das an und die Zeit wird nicht als Bestzeit gespeichert.

## Splits

Zwischenzeiten entstehen durch Ausloeser, die sich einzeln ein- und ausschalten
lassen:

| Ausloeser | Beschriftung |
| --- | --- |
| jede Forschung | Name der Technologie |
| jeder Fabrikrang | `Fabrikrang N` - die Stufenziele des Grundspiels |
| jedes Artefakt | `Artefakt N` |
| jede Aufwertung | Name der Aufwertung |
| Gold-Marken | 25/50/75 % des Ziels, alle 10 %, oder alle 10k / 100k Gold |

Jeder Ausloeser schreibt eine Zeile mit **Zeit** und **Goldstand** in die
Tabelle unter der Uhr - dort stehen die letzten sechs.

Das Ereignis, das den Lauf ueberhaupt startet, erzeugt bewusst keine
Zwischenzeit bei 00:00.

### Einzeln waehlen: F3

Die Schalter in den Mod-Einstellungen setzen nur den Ausgangswert einer ganzen
Gruppe. **`F3`** oeffnet die Liste, in der jeder Ausloeser einzeln an- und
abschaltbar ist:

* jede Forschung fuer sich, mit Filterfeld und *Alle an* / *Alle aus*
* jeder Fabrikrang von 2 bis 7 einzeln
* jede Gold-Marke einzeln
* Artefakte und Aufwertungen

So laesst sich ein Lauf frei zusammenstellen - etwa nur Fabrikraenge fuer eine
Tier-Kategorie, oder genau drei bestimmte Forschungen. Ein blauer Punkt markiert
alles, was vom Gruppen-Standard abweicht; *Standard* nimmt die Abweichung
wieder zurueck.

Die Auswahl gilt savegame-uebergreifend und aendert einen laufenden Lauf nicht
rueckwirkend.

## Ergebnisfenster

Am Ende erscheint die vollstaendige Tabelle: Endzeit (W), Vergleich mit der
Bestzeit, und pro Zeile Ausloeser, Abschnittsdauer, Split-Zeit, Delta zur PB
und Goldstand. `F10` blendet das Dashboard wieder ein - auch fuer einen Lauf,
der aus einem geladenen Spielstand stammt. *Copy summary* kopiert den Lauf als
Text, **PNG** speichert eine Bildkarte des Laufs (und legt sie in die
Zwischenablage, wenn das Spiel das erlaubt). Unter *Kategorien* lassen sich
eigene Kategorien anlegen, Bestzeiten loeschen und Routen (Vergleichszeiten
und Reihenfolge) bearbeiten. Die Split-Ausloeser (F3) gelten pro Kategorie.

## Abzeichen

Zwei getrennte Kennzeichen:

* **Keine weiteren Mods** - immer sichtbar. Gruen, wenn ausser diesem Mod und
  der Mod-Verwaltung nichts laeuft; sonst die Anzahl der anderen Mods.
* **Offizielles Regelwerk** - gruen, wenn Hard Mode, keine Skips, keine
  anderen Mods, und Debug- sowie Cinematik-Modus aus sind. Ungueltige
  Einstellungen zeigen immer ein rotes **UNGÜLTIGER LAUF**, auch wenn das
  Abzeichen abgeschaltet ist.

## Intro und Tutorial ueberspringen

Drei getrennte Schalter, Standard jeweils **aus**. Jeder davon ist in den
Mod-Einstellungen mit **UNGÜLTIG FÜR SPEEDRUNS** beschriftet:

*Intro und Landeanflug ueberspringen* springt bei einem neuen Spiel direkt in
die Welt - dasselbe wie der Knopf *Skip Intro*.

*Story-Textboxen wegblenden* schliesst die Story-Einblendungen, sobald sie
auftauchen - dasselbe wie Wegklicken, die Story zaehlt sie also weiter als
gesehen.

*Tutorial automatisch ueberspringen* beendet das Tutorial beim Laden eines
Spielstands, genau wie der Knopf im Spiel. Es greift nur, solange der Timer
noch wartet, nie mitten im Lauf. Ist es an, steht "Ohne Tutorial" in der
Kategorie, damit Zeiten vergleichbar bleiben.

Waehrend des Ueberspringens ist der Start gesperrt, damit weder der Aufschlag
der Landekapsel noch die Tutorial-Freischaltung den Timer anwerfen.

## Offizielles Regelwerk

Die offiziellen Speedrun-Kategorien verlangen eine feste Konfiguration. Der Mod
prueft sie selbst und zeigt das an:

| Vorgabe | noetiger Wert |
| --- | --- |
| aktive Mods | nur *Gold Speedrun Challenge* |
| Gold-Regelwerk | *Hard Mode* |
| Tutorial automatisch ueberspringen | *aus* |
| Intro und Landeanflug ueberspringen | *aus* |
| Story-Textboxen wegblenden | *aus* |
| Debug-Modus | *aus* |
| Cinematik-Modus | *aus* |

Die Aufnahme muss im oder vor dem Welt-erstellen-Menue beginnen. Der Timer
startet immer bei der ersten Aktion inklusive Bewegung.

Stimmt alles, steht ein gruenes **✓ OFFIZIELLES REGELWERK** unter der Uhr
und im Ergebnisfenster. Weicht etwas ab, steht dort rot **UNGÜLTIGER LAUF**
und das HUD sowie das Ergebnisfenster listen auf, welche Einstellung es ist
und welcher Wert noetig waere.

Debug-Modus und Cinematik-Modus werden erkannt und machen den Lauf ungueltig,
damit sich damit nicht schummeln oder die Wertung missbrauchen laesst. Sie
sind derselbe Fall wie ein weiterer aktiver Mod. Cinematik ist das
experimentelle Video-Werkzeug (freie Kamera, Zeitfaktor), nicht das Intro,
die Drohnen oder Tooltips. War eines von beiden an, bevor das Ziel erreicht
ist, setzt der Mod im Spielstand das Cheat-Flag des Spiels. Das bleibt stehen,
auch wenn der Modus danach aus geht, und die Zeit wird nicht als Bestzeit
gespeichert. Nach dem Ziel eingeschaltet, markiert es diesen beendeten Lauf
nicht mehr nachtraeglich.

Solange einer der beiden an ist, steht unter dem roten Banner am Timer und im
Dashboard (F10) **Debug deaktivieren**. Der Knopf schaltet den Debug-Modus aus
und raeumt dabei Chunk-Gitter, Debug-Pinsel, Cinematik, Kamera-Override und
die Simulationsgeschwindigkeit mit ab. Dieselbe Schaltung liegt in den
Mod-Einstellungen unter *Debug-Modus*. Einen Schalter, der die Cinematik
einschaltet, gibt es nicht. Abschalten macht den Spielstand nicht wieder
gueltig.

Die Mod-Verwaltung zaehlt dabei nicht als Mod: sie greift nicht ins Spiel ein
und ist das Werkzeug, mit dem die anderen Mods abgeschaltet werden. Gezaehlt
wird, was das Spiel tatsaechlich geladen hat und in der Verwaltung auf **AN**
steht.

Wer das gruene Abzeichen nicht sehen will, schaltet *Regelwerk-Abzeichen
zeigen* in den Mod-Einstellungen aus. Das rote **UNGÜLTIGER LAUF**-Banner
bleibt trotzdem sichtbar.

### Nichts mehr verstellen

Mit dem Start haelt der Lauf fest, ob er offiziell begonnen hat, und schreibt
das in den Spielstand. Ab dann wird jeden Frame nachgeprueft: wird waehrend des
Laufs am Gold-Regelwerk, an den Skips, an den aktiven Mods, am Debug-Modus
oder am Cinematik-Modus gedreht, faellt das Kennzeichen sofort und **kommt
nicht zurueck** - auch nicht, wenn die Einstellung reumuetig zurueckgedreht
wird.

Statt des gruenen Abzeichens steht dann rot **REGELWERK VERSTELLT** unter der
Uhr und im Ergebnisfenster, und die Zeit wird nicht als Bestzeit gespeichert -
dieselbe Behandlung wie bei einem Spielstand, in dem gecheatet wurde. Die Uhr
laeuft normal weiter und die Zeit bleibt sichtbar; sie zaehlt nur nicht.

## Simulationsdiagnose (F7)

F7 oeffnet das Vollbild-Graph. UPS bleibt die linke Achse; kurze Aufholphasen
ueber 60 erweitern die Achse dynamisch. Kollisionen
und Bewegungen sind standardmaessig **Wurfpartikel** (`ElementType.Particle`):
Werfer, fliegende Pixel. Das ist der billige Zaehler und die Vergleichsgroesse
fuer HUD und Ergebnisbildschirm.

**Live Dynamic Population** ist `sim.liveElementCount`: aktuell belegte
dynamische Elementslots, inklusive ruhendem Sand, Fluessigkeiten und Gasen.
Es ist weder die Zahl der Beweger noch ein jemals-abgebauter Zaehler.

Jam-Metriken (gleitendes 5-s-Fenster aus Summen, nicht aus Mittelwerten von
Prozenten):

| Metrik | Formel | Bedeutung |
| --- | --- | --- |
| Jam Share | `sum(blocks) / sum(blocks + moves)` | Anteil blockierter Versuche |
| Flight Activity | `sum(blocks + moves) / sum(ticks)` | Bewegungsvolumen pro Simulationsschritt |
| Jam Load | `sum(blocks) / sum(ticks)` | Blockierversuche pro Simulationsschritt |

Jam Load ist der direkte Arbeitsindikator. Jam Share allein kann 100 % bei
zwei Partikeln sein. Flight Activity allein ignoriert, wie oft sie stecken.
Keine der drei Groessen ist gemessene CPU-Zeit — `simMs` und UPS zeigen, ob
die Last wirklich weh tut.

**Verlorene Zeit (s).** F7 zeichnet ein vorzeichenbehaftetes Defizit
`D = (spanMs / 1000 × 60) − Ticks` ueber das sichtbare Fenster, ohne Rate
und ohne Clamp. Positiv: Simulation hinter der Echtzeit. Negativ: die
Simulation lief vor 60 UPS. **D_perm** ist das laufende Minimum von D ueber
die naechsten 2 s, damit Hitch-und-Aufhol-Wobble nicht als bleibender Verlust
zaehlt. Schattierte Baender markieren Intervalle, in denen D_perm stieg.
Ein Band oder den Graphen hovern setzt die Engpasskarte auf diesen
Weltzeitpunkt. Die Karten-Kopfzeile sagt, ob dieser Zeitpunkt rechen- oder
sync-begrenzt war — bei Sync/Warten sind Abschnittfarben nicht die Ursache.

**Engpasskarte (ms).** F7 zeigt eine zoombare Karte der Engpass-Zeiten pro
40x40-Abschnitt. Jeden Tick meldet jeder Simulations-Worker seinen
langsamsten Abschnitt und dessen Millisekunden:
- **Kumulativ:** Summiert die gesamte Engpasszeit aller Worker pro
  Abschnitt über die Weltzeit auf (stark belastete Fabriken leuchten rot/gelb).
  Die Summen folgen der Spielzeit-Uhr, nicht der Speedrun-Uhr, und werden mit
  dem Spielstand gespeichert und nach dem Laden wiederhergestellt.
- **Exp. Abkühlung:** Zeigt kürzliche Engpass-Aktivität mit exponentieller Halbwertszeit.
  Der Fabrik-Umriss bleibt über einen anpassbaren Boden (3%, 6%, 12%) dezent sichtbar.
- **Lin. Abkühlung:** Lineares Abklingfenster für die letzten 30 bis 120 Sekunden.
- **Max. Tick:** Der stärkste einzelne Spike (High-Water-Mark) seit Laufstart.
- **Dieser Tick:** Der aktuelle Hotspot der Worker in diesem Tick.

**Zeitachse & Scrubbing:** Das Bewegen des Schiebereglers oder das Überfahren
des UPS-Graphen mit der Maus rekonstruiert die kumulierte Engpasskarte bis genau
zu diesem Weltzeitpunkt. Ein Klick auf "Live" springt sofort zurück in die
Echtzeit-Ansicht. Nach Laufende, Speichern und Laden setzt die Achse an der
Spielzeit-Uhr der Welt an, nicht an der Zielzeit des Laufs.

**Zoom & Verschieben:** Mausrad zoomt stufenlos zentriert am Mauszeiger (bis zu 16x);
Ziehen mit gedrückter Maustaste verschiebt die Ansicht; Doppelklick oder der
Reset-Button setzt auf 1:1 zurück. Hover zeigt Abschnittskoordinaten und
Millisekunden. Die Karte sitzt links neben dem UPS-Graphen.

Der Benchmark 3.3.0 hat den Zaehler-Overhead unter dem eigenen Rauschen der
Engine gemessen (unter etwa 0.15 ms/Tick bei der Testszene). Ballistische
Zaehler bleiben der Standard; Gesamtmaterie bleibt Diagnose-Option.

**All-matter capture** (Einstellung und F7-Schalter, standardmaessig aus)
haengt Wildcard-Handler an jedes `element:blocked` / `element:moved`. Das ist
Diagnose, kein Speedrun-Mass: es kann die UPS senken. Aus schaltet die Handler
wirklich ab. Solange Capture aus ist, speichern die All-Matter-Kanäle `null`
statt 0, damit Graphen an den Luecken reissen.

Die Metrik-Kostenmatrix isoliert Wurfpartikel-Blocks, Wurfpartikel-Bewegungen,
Gesamtmaterie-Blocks, Gesamtmaterie-Bewegungen, aktive Chunks,
Live-Population und Sim-Zeit. Dazu kommen drei Pakete: Wurfpartikel,
Gesamtmaterie und alle Diagnosen. Jeder Test laeuft dreimal als 15 s reine
UPS-Basislinie und 15 s aktive Messung. Der kopierbare Bericht enthaelt
1-s-Werte fuer UPS, reale Millisekunden pro Tick und alle aktiven Kanaele.
Die Matrix dauert ungefaehr 15 Minuten, darf nicht waehrend eines Zeitlaufs
gestartet werden und bricht bei Pause ab. Ergebnisse sind szenenabhaengig.
HUD- und Ergebniswerte bleiben ballistisch.

---

F7 opens the fullscreen graph on the full run. UPS stays on the left axis; short catch-up
phases above 60 expand that axis dynamically. Gold is a separate line on its
own axis, stored in each saved history bucket. Collisions
and moves default to **ballistic particles** (`ElementType.Particle`): throwers
and flying pixels. That is the cheap counter and the comparable figure on the
HUD and result screen.

**Live Dynamic Population** is `sim.liveElementCount`: currently allocated
dynamic element slots, including resting sand, liquids, and gases. It is not
the number of movers and not an ever-mined total.

Jam metrics (trailing 5 s window from sums, not averages of percentages):

| Metric | Formula | Meaning |
| --- | --- | --- |
| Jam Share | `sum(blocks) / sum(blocks + moves)` | Share of blocked attempts |
| Flight Activity | `sum(blocks + moves) / sum(ticks)` | Movement volume per simulation update |
| Jam Load | `sum(blocks) / sum(ticks)` | Blocked attempts per simulation update |

Jam Load is the direct work proxy. Jam Share alone can read 100% with two
particles. Flight Activity alone ignores how often they jam. None of the three
is measured CPU time — use `simMs` and UPS to judge whether the load hurts.

**Lost time (s).** F7 plots a signed deficit `D = (spanMs / 1000 × 60) − ticks`
over the visible window, with no rate estimate and no clamp. Positive:
simulation behind real time. Negative: the simulation ran ahead of 60 UPS.
**D_perm** is the running floor of D over the next 2 s, so hitch-and-catch-up
wobble is not counted as kept loss. Shaded bands mark intervals where D_perm
rose. Hovering a band or the graph still scrubs the bottleneck map to that
world time. The map header says whether that moment was compute-bound or
sync/wait-bound — when it is wait-bound, chunk colours are not the cause.

**Bottleneck map (ms).** F7 shows an interactive, zoomable bottleneck map
per 40x40 chunk and opens in exponential decay. The grid is painted at the
display resolution so Linux does not resample it into static lines. Each tick, every simulation worker reports its slowest chunk
and that time in milliseconds:
- **Cumulative:** Sums the total bottleneck milliseconds spent across
  world time for each chunk (heavy factory areas glow amber/red). Totals
  follow the play-clock, not the speedrun timer, and are saved with the
  world then restored after a reload.
- **Exp Decay:** Shows recent bottleneck activity with exponential half-life cooling.
  Factory outlines remain subtly visible via a configurable floor (3%, 6%, 12%).
- **Linear Decay:** Linear ramp cooling over the last 30 to 120 seconds.
- **Peak tick:** High-water single-tick spike seen since the run started.
- **This tick:** Instantaneous hotspot currently being processed.

**Timeline scrubbing:** Moving the slider or hovering over the UPS graph
reconstructs the cumulative bottleneck map up to that exact world time.
Clicking "Live" returns immediately to real-time display. After the goal, a
save, and a reload, the axis continues from the world's play-clock, not from
the run's finish time.

**Zoom & Pan:** Mouse wheel zooms smoothly centered on the cursor (up to 16x);
click-and-drag pans the map; double-click or Reset button returns to 1:1.
Hovering a cell shows chunk coordinates and milliseconds. The map is positioned
on the left, side-by-side with the UPS graph.

The 3.3.0 benchmark found counter overhead below the engine's own noise
(under about 0.15 ms/tick in the test scene). Ballistic counters stay the
default; all-matter stays a diagnostic option.

**All-matter capture** (setting and F7 toggle, off by default) installs
wildcard handlers on every `element:blocked` / `element:moved`. Diagnostic
only, not a speedrun metric; it can reduce UPS. Off removes the handlers.
While capture is off, all-matter fields store `null` rather than 0 so chart
lines break across disabled intervals.

The metric cost matrix isolates ballistic blocks, ballistic moves, all-matter
blocks, all-matter moves, awake chunks, live population, and the simulation
time read. It also tests ballistic, all-matter, and complete-diagnostics
bundles. Every package runs three consecutive 15 s tick-only baselines and
15 s active phases. The copyable report includes 1 s UPS, wall milliseconds
per tick, paired progression deltas, and every active channel. The matrix
takes about 15 minutes, cannot start during a timed run, and cancels if the
game is paused. Results remain scene-dependent. HUD and result values remain
ballistic.
