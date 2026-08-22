# Werkzeuge

Entwicklungswerkzeuge. Gehoeren **nicht** zum Mod — der Loader fuehrt nur die in
`modinfo.json` unter `entry` genannte Datei aus. Brauchen node, sonst nichts.

## Nach jedem Spiel-Update zuerst

```
node tools/verify-engine.js
```

Prueft das installierte `app.asar` gegen die Annahmen, auf denen die Zeitmessung
in `main.js` beruht. Erste Zeile sagt, ob der Build ueberhaupt Sandkit-Mods
laedt — der Steam-Branch `public` tut das nicht. Danach elf Einzelpruefungen,
jede mit der Folge fuer den Mod, falls sie ausfaellt. Die Muster kommen ohne
Variablennamen aus, ueberstehen also die Neuminifizierung bei jedem Build.

Exitcode: `0` alles gut, `1` kritische Annahme gebrochen, `3` keine Mod-API.

Anderes Paket pruefen: `node tools/verify-engine.js "C:\Pfad\app.asar"`

## Zeitmessung testen

```
node tools/clocktest.js
```

Schneidet den Uhrenblock aus `../main.js` und laesst ihn gegen ein nachgebautes
Spiel laufen: 60 und 20 UPS, 12 FPS, Pause, Speichern und Laden mitten im Lauf,
Uebernahme eines Laufs aus 2.6.0, der Rueckfall auf die Schaetzung, zerrissene
Lesevorgaenge auf dem gemeinsamen Speicher, und die Invariante
Simulationszeit <= Echtzeit. Laeuft ohne Spiel.

Er sucht den Block anhand des Kommentars `// --- Die beiden Uhren` und der
Funktion `clockQuality`. Wer die umbenennt, muss den Test nachziehen.

## Ins Spielpaket schauen

```
node tools/lsasar.js [filter]        Inhalt von app.asar auflisten
node tools/extract.js /main.js ziel  eine Datei herausholen
node tools/ctx.js datei muster       Muster mit Umgebung anzeigen
node tools/count.js muster ...       Muster zaehlen
```

`lsasar.js` und `extract.js` parsen den asar-Header von Hand: Headerlaenge in
den Bytes 12 bis 16, JSON ab 16, Dateidaten ab `8 + readUInt32LE(4)`. Die
naheliegende Formel `16 + readUInt32LE(8)` ist um vier Bytes daneben und
schneidet jeder Datei die ersten Zeichen ab.

Unter Git Bash `MSYS_NO_PATHCONV=1` voranstellen, sonst macht die Shell aus
`/main.js` einen Windows-Pfad.

Alle vier lesen standardmaessig das installierte Spiel; anderer Pfad ueber die
Umgebungsvariable `ASAR`.
