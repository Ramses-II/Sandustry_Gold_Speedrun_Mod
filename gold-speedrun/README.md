# Gold Speedrun Challenge

Speedrun-Timer fuer Sandustry. Die Uhr startet mit der ersten Aktion und stoppt,
sobald das Ziel der gewaehlten Kategorie erreicht ist.

## Kategorien

| Kategorie | Ziel |
| --- | --- |
| 100k / 500k / 1M Gold % | Gold-Schwelle |
| Alle Artefakte % | jedes Artefakt der Karte |
| Fabrikrang 6 / 7 | Rang erreicht |
| Eigenes Gold | frei einstellbare Zahl |

Bei den Gold-Kategorien gibt es zwei Regelwerke: **Normal** zaehlt alles
eingenommene Gold (Ausgeben kostet keinen Fortschritt), **Hard Mode** geht nach
dem Kontostand (Forschen wirft zurueck).

Das Artefakt-Ziel liest der Mod aus der geladenen Karte - Prefab-Artefakte plus
die im Gelaende versteckten Sensor-Artefakte. Findet er nichts, laesst sich die
Zahl in den Einstellungen von Hand setzen.

## Zeitnahme

Gemessen werden **zwei** Zeiten. Beide laufen nur, waehrend das Spiel laeuft,
beide stehen im Spielstand, und beide werden immer festgehalten - die
Einstellung *Welche Uhr im Bild steht* entscheidet nur ueber die Anzeige.

**Echtzeit** ist die offizielle Wertung. Sie kommt aus `performance.now()` und
ist die Zahl, die auch eine Stoppuhr neben dem Bildschirm zeigt - die einzige,
die sich an einem Video nachpruefen laesst. Pausieren haelt sie an, ein Absturz
kostet keine Zeit; das Fenster in den Hintergrund zu schieben haelt sie nicht
an.

**Simulationszeit** ist die Zahl fuer den Vergleich ueber verschiedene Rechner
hinweg. Die Welt laeuft mit einem festen Schritt von 1/60 s. Schafft der Rechner
keine 60 Schritte pro Sekunde, verstreicht Echtzeit, ohne dass die Fabrik
vorankommt - der Lauf wird dann fuer die Hardware bestraft, nicht fuer die
Route. Die Simulationszeit zaehlt nur die Schritte, die die Welt wirklich
gelaufen ist: bei 60 UPS ist sie mit der Echtzeit identisch, bei 20 UPS ein
Drittel davon. Unter der Uhr steht ab 1 % das Defizit, also wieviel Prozent der
Echtzeit die Welt stillstand.

Bestzeiten werden fuer die beiden Zeiten getrennt gefuehrt. Die Anzeige gibt es
in Sekunden, Hundertstel oder Millisekunden.

> Bis 2.6.0 kam die Uhr aus `api.time.getTimeMs()`. Das ist trotz des Namens
> keine In-Game-Zeit, sondern Echtzeit mit einem Deckel von 50 ms pro Frame -
> unterhalb von 20 FPS blieb sie hinter der Stoppuhr zurueck. Getroffen hat das
> genau die Rechner, die die Bildrate nicht halten: dort hat der Timer eine
> andere Groesse gemessen als auf schneller Hardware. Zeiten aus 2.6.0 und
> frueher sind auf schwachen Rechnern deshalb zu kurz.

## Was den Timer startet

Standard ist **nur Mausdruck**: die Uhr startet in dem Moment, in dem du
graebst, greifst, baust oder forschst. Herumlaufen ist frei, und was ohne
deinen Klick weiterlaeuft - eine Grabdrohne, ein Foerderband - startet sie
ebenfalls nicht.

Solange eine Story-Textbox, ein Dialog oder der Intro-Bildschirm im Bild steht,
startet gar nichts - Wegklicken zaehlt nicht als Spielhandlung.

Drei weitere Regelwerke stehen zur Wahl:

| Regelwerk | startet zusaetzlich bei |
| --- | --- |
| Mausdruck oder jeder Fortschritt | Drohnen, Foerderbaender, Aufsammeln |
| Jede Aktion, auch Bewegung | Bewegung (strengste Variante) |
| Nur Bewegung | ausschliesslich Bewegung (Verhalten aus Version 1.x) |

`F8` setzt den Timer zurueck. Wurden im Spielstand jemals Cheats benutzt,
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

Am Ende erscheint die vollstaendige Tabelle: Endzeit, Vergleich mit der
Bestzeit, und pro Zeile Ausloeser, Abschnittszeit, Gesamtzeit und Goldstand.
`F10` blendet es wieder ein - auch fuer einen Lauf, der aus einem geladenen
Spielstand stammt.

## Intro und Tutorial ueberspringen

Zwei getrennte Sachen, weil sie im Spiel an verschiedenen Stellen haengen:

*Intro und Landeanflug ueberspringen* (Standard **an**) springt bei einem neuen
Spiel direkt in die Welt - dasselbe wie der Knopf *Skip Intro*. Das Intro ist
eine eigene Szene, die erst nach dem Weltaufbau anlaeuft, deshalb fasst der Mod
kurz nach, bis sie steht.

*Story-Textboxen wegblenden* (Standard **an**) schliesst die Story-Einblendungen,
sobald sie auftauchen - dasselbe wie Wegklicken, die Story zaehlt sie also
weiter als gesehen. Sie kommen unter anderem verzoegert nach dem Tutorial-Skip.

*Tutorial automatisch ueberspringen* (Standard **aus**) beendet das Tutorial
beim Laden eines Spielstands, genau wie der Knopf im Spiel. Es greift nur,
solange der Timer noch wartet, nie mitten im Lauf. Ist es an, steht "Ohne
Tutorial" in der Kategorie, damit Zeiten vergleichbar bleiben.

Beides ruehrt die Uhr nicht an: waehrend des Ueberspringens ist der Start
gesperrt, damit weder der Aufschlag der Landekapsel noch die
Tutorial-Freischaltung den Timer anwerfen.

## Offizielles Regelwerk

Die offiziellen Speedrun-Kategorien verlangen eine feste Konfiguration. Der Mod
prueft sie selbst und zeigt das an:

| Vorgabe | noetiger Wert |
| --- | --- |
| aktive Mods | nur *Gold Speedrun Challenge* |
| Was den Timer startet | *Jede Aktion, auch Bewegung* |
| Gold-Regelwerk | *Hard Mode* |
| Tutorial automatisch ueberspringen | *aus* |
| Intro und Landeanflug ueberspringen | *aus* |
| Story-Textboxen wegblenden | *aus* |

Die ersten vier stehen so in den Kategorieregeln. Die letzten beiden kommen
dazu, damit der Spielanfang ablaeuft wie ohne Mod - ein Lauf, der mit einer
uebersprungenen Sequenz beginnt, ist mit den anderen nicht vergleichbar.

Stimmt alles vier, steht ein gruenes **✓ OFFIZIELLES REGELWERK** unter der Uhr
und im Ergebnisfenster - fuer dich und fuer jeden Zuschauer sichtbar. Weicht
etwas ab, steht dort nur *Eigene Regeln*, und das Ergebnisfenster listet
auf, welche Einstellung es ist und welcher Wert noetig waere.

Die Mod-Verwaltung zaehlt dabei nicht als Mod: sie greift nicht ins Spiel ein
und ist das Werkzeug, mit dem die anderen Mods abgeschaltet werden. Gezaehlt
wird, was das Spiel tatsaechlich geladen hat und in der Verwaltung auf **AN**
steht.

Wer es nicht sehen will, schaltet *Regelwerk-Abzeichen zeigen* in den
Mod-Einstellungen aus.

### Automatisch einstellen

Das Gold-Regelwerk hat neben *Normal* und *Hard Mode* eine dritte Wahl:
**Offizielles Regelwerk (Hard Mode)**. Sie setzt den ganzen Lauf, nicht nur das
Gold. Vier Optionen springen auf ihre Vorgabe: *Was den Timer startet* auf
*Jede Aktion, auch Bewegung*, und *Tutorial automatisch ueberspringen*, *Intro
und Landeanflug ueberspringen* sowie *Story-Textboxen wegblenden* auf aus.
Nicht nur intern - sie stehen danach sichtbar so im Menue.

Verstellen laesst sich daran nichts: wer eine davon trotzdem anfasst, sieht
sie sofort wieder zurueckspringen. Von Hand nachstellen muss man also nichts,
und wegstellen kann man es auch nicht. Abzuschalten bleibt nur, was nicht in
den Mod gehoert: fremde Mods.

Weil die Story-Textboxen jetzt stehen bleiben, sperren sie den Timer, solange
sie im Bild sind: der Klick, der eine Box wegmacht, ist keine Spielhandlung
und startet den Lauf nicht.

Die vorherigen Werte gehen dabei nicht verloren - beim Zurueckschalten auf
*Normal* oder *Hard Mode* stehen sie wieder da, wo sie vorher standen.

### Nichts mehr verstellen

Mit dem Start haelt der Lauf fest, ob er offiziell begonnen hat, und schreibt
das in den Spielstand. Ab dann wird jeden Frame nachgeprueft: wird waehrend des
Laufs am Gold-Regelwerk, am Startmodus, am Tutorial-Skip oder an den aktiven
Mods gedreht, faellt das Kennzeichen sofort und **kommt nicht zurueck** - auch
nicht, wenn die Einstellung reumuetig zurueckgedreht wird.

Statt des gruenen Abzeichens steht dann rot **REGELWERK VERSTELLT** unter der
Uhr und im Ergebnisfenster, und die Zeit wird nicht als Bestzeit gespeichert -
dieselbe Behandlung wie bei einem Spielstand, in dem gecheatet wurde. Die Uhr
laeuft normal weiter und die Zeit bleibt sichtbar; sie zaehlt nur nicht.

`F8` setzt den Timer zurueck und raeumt das Kennzeichen mit auf - der naechste
Lauf faengt sauber an.
