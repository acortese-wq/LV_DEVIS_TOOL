# Qualitätscheck LV-Devis Tiefbau (Stand V88, 05.11.2026)

App-Konzept und Urheber: **Alessandro Cortese**.
Vorgehen nach den Prüfmethoden aus «Ponytail» (Audit: was ist nötig, was ist Risiko) und «Agent Skills» (Sicherheit, Performance, Vereinfachung).
Geprüft: Rechenrichtigkeit, Sicherheit/Datenverlust, Vereinfachung, Performance. **Es wurde kein Code geändert.**

Belege sind reproduzierbar: Rechenkern ohne Browser über `src/kve.js` + `src/data/lv.js` (wie `tests/skill_fuzz_cmp.mjs`), Browserprüfungen mit der Testhilfe `tests/lib/k.js`, 300 Zufallsprojekte aus `tests/skill_fuzz.py`.

---

## Übersicht nach Dringlichkeit

| Nr. | Befund | Bereich | Wirkung | Dringlichkeit |
|---|---|---|---|---|
| 1 | PDF-Bibliothek pdf.js 3.11.174 mit bekannter Lücke (CVE-2024-4367) | Sicherheit | fremdes PDF kann Code im Tool ausführen | **muss** |
| 2 | «1'200» wird als **1** gerechnet, Hinweis behauptet «sonst wird 0 gerechnet» | Rechnung | falsche Mengen/Kosten | **muss** |
| 3 | JSON laden ersetzt das Projekt ohne Rückfrage und ohne Rückgängig; defekte Datei leert es still | Datenverlust | Projekt weg | **muss** |
| 4 | Layout A: Speicherfehler unsichtbar, Karte meldet trotzdem «gespeichert» | Datenverlust | Eingaben gehen verloren | **muss** |
| 5 | Zwei offene Tabs überschreiben sich gegenseitig | Datenverlust | Eingaben gehen verloren | sollte |
| 6 | Rabattstaffel: Netto sinkt beim Überschreiten von 30'000 / 50'000 / 100'000 | Rechnung | bis CHF 1'700 billiger bei mehr Leistung | **Entscheid** (gegen LV prüfen) |
| 7 | Eigene Preise und freie Positionen erhalten LV-Rabatt und heben die Stufe | Rechnung | Rabatt auf Fremdpreise | **Entscheid** |
| 8 | Ergebnis neu aufbauen dauert bei 200 Datensätzen ~4 s (Annahmen-Tabelle rechnet quadratisch) | Performance | Tool friert bei jeder Eingabe ein | sollte |
| 9 | Leaflet und pdf.js vom CDN ohne Integritätsprüfung (SRI) | Sicherheit | Lieferkettenrisiko | sollte |
| 10 | Negative Eingaben («-10») werden still als 0 gerechnet, Feld nicht markiert | Rechnung | Eingabe verschwindet unbemerkt | kann |
| 11 | Zusammenstellung: Menge × EP ≠ Betrag um bis 2 Rp. | Rechnung | Nachrechnen stimmt nicht exakt | kann |
| 12 | Plan + Overlay können den Browser-Speicher füllen | Datenverlust | siehe Nr. 4 | kann |
| 13 | Kleinere Aufräumarbeiten (toter Code, doppelte Kosten-Formeln) | Vereinfachung | Wartung | kann |

---

## Details

### 1. pdf.js mit bekannter Sicherheitslücke — muss
- **Was:** Pläne und Overlays als PDF werden mit pdf.js **3.11.174** gelesen (`src/karte.js:284`, Aufruf `getDocument({ data: buf })` in Zeile 319). Diese Version ist von **CVE-2024-4367** betroffen (behoben ab 4.2.67): Ein präpariertes PDF kann beim Öffnen JavaScript ausführen, wenn `isEvalSupported` auf dem Standardwert steht – das ist hier der Fall.
- **Folge:** Ein Plan-PDF von Dritten (Unternehmer, Ingenieurbüro) könnte im Tool Projekte und LV-Preise aus dem Browser-Speicher lesen oder verändern.
- **Behebung (klein):** `getDocument({ data: buf, isEvalSupported: false })` – die offizielle Umgehung, eine Zeile. Mittelfristig auf pdf.js 4.x wechseln (anderes Ladeformat, mehr Aufwand; Testversion in `tests/package.json` mitziehen).

### 2. Zahlen mit Apostroph werden falsch gerechnet — muss
- **Beleg** (Graben, Standardwerte, nur L geändert):

| Eingabe L | gerechnet | Netto CHF |
|---|---|---|
| `10` | 10 m | 1'623.36 |
| `1'200` | **1 m** | 218.38 |
| `1 200` | **1 m** | 218.38 |
| `1.200,50` | **1.2 m** | 248.52 |
| `10m` | 10 m | 1'623.36 |
| `1,200` | 1.2 m (Feld **nicht** markiert) | – |

- Das Feld wird zwar rot markiert, der Text sagt aber «… sonst wird **0** gerechnet» (`ux_numBad`). Tatsächlich rechnet `num()` (`src/kve.js:28`, `parseFloat`) mit dem Anfang der Zahl weiter. Im Ergebnis und in den Kosten erscheint kein Hinweis.
- Uneinheitlich: Der Dialog «Offene Positionen» versteht `1'250,50` korrekt (`epParse`).
- **Behebung:** Entweder Apostroph und Leerzeichen als Tausendertrennung akzeptieren (in `kve.js` **und** `kve.py`, Kostenwirkung nur bei bisher falschen Eingaben), oder ungültige Felder wirklich als 0 rechnen und im Ergebnis-Status melden. Empfehlung: Apostroph/Leerzeichen akzeptieren, Rest melden.

### 3. JSON laden ohne Rückfrage — muss
- **Beleg:** Beispielprojekt offen → «Laden» einer anderen Datei: Projekt sofort ersetzt und gespeichert, **keine Rückfrage, kein Rückgängig** (`src/app.js`, `load()`).
- Eine Datei mit `{"v":2,"recs":{}}` oder falscher Struktur wird **ohne Meldung** übernommen: Das Projekt ist danach leer (Grundwerte), der alte Stand überschrieben.
- **Behebung:** vor dem Ersetzen fragen («Aktuelles Projekt ersetzen? Vorher sichern?»), danach Hinweis mit Rückgängig (vorhandenes `undoToast`/`snapState`), Struktur prüfen und bei leerem Inhalt melden.

### 4. Speicherfehler im Layout A unsichtbar — muss
- **Beleg:** Speicher voll simuliert, in der Karte «Speichern» gedrückt: Die Karte zeigt «**Zeichnung gespeichert**», die Fehlermeldung «Automatisches Speichern nicht möglich» steht nur auf der verdeckten Hauptseite (`#saveState`).
- Seit Layout A arbeitet man fast nur noch in der Karte – der Fehler fällt also nicht auf.
- **Behebung:** `save()` meldet Erfolg/Fehler zurück; die Karte zeigt bei Fehler eine rote Meldung mit Knopf «Sichern (JSON)».

### 5. Zwei Tabs überschreiben sich — sollte
- **Beleg:** Tab 1 setzt Projekt «Projekt A», Tab 2 setzt Ort «Chur», danach ändert Tab 1 den Bearbeiter → gespeichert ist Ort **leer**, «Chur» ist verloren.
- **Behebung:** auf das `storage`-Ereignis reagieren und im anderen Tab melden «Projekt wurde in einem anderen Fenster geändert – neu laden?».

### 6. Rabattstaffel springt nach unten — Entscheid
- **Beleg** (Zwischensumme → Netto, `STAFFEL` in `src/kve.js:6`):

| Zwischensumme | Stufe | Rabatt | Inst. | Netto |
|---|---|---|---|---|
| 30'000.00 | 2 | 900 | 700 | **29'800.00** |
| 30'000.01 | 3 | 1'500 | 900 | **29'400.01** |
| 50'000.00 | 3 | 2'500 | 900 | **48'400.00** |
| 50'000.01 | 4 | 3'500 | 1'200 | **47'700.01** |
| 100'000.00 | 4 | 7'000 | 1'200 | **94'200.00** |
| 100'000.01 | 5 | 9'000 | 1'500 | **92'500.01** |

- Der Rabatt gilt auf die ganze Summe. Mehr Leistung wird dadurch knapp über der Grenze billiger (bis CHF 1'700).
- **Frage an dich:** Steht das so im LV (R151/R152)? Falls ja, ist es richtig gerechnet – dann im Ergebnis einen Hinweis «knapp über Stufengrenze» zeigen. Falls das LV gestaffelt (nur auf den Mehrbetrag) meint, Kernel und Skill anpassen (Kostenwirkung!). Der LV-Originaltext liegt nicht im Repo, deshalb nicht geprüft.

### 7. Rabatt auf eigene Preise — Entscheid
- **Beleg:** OFFEN-Position (Handaushub > 1.50 m, 4.65 m³) mit eigenem Preis CHF 50'000/m³ (Extremwert zur Deutlichkeit): Zwischensumme steigt von 8'651 auf 241'151, **Stufe 1 → 5**, Rabatt CHF 21'703 – auch auf den Fremdpreis.
- Gleiches gilt für freie Positionen mit eigenem Preis.
- **Frage an dich:** Sollen eigene Preise (aus Offerten, meist schon netto) vom LV-Rabatt ausgenommen sein und die Stufe nicht beeinflussen? Fachlich spricht viel dafür. Kostenwirkung bei Projekten mit eigenen Preisen.

### 8. Ergebnis bei grossen Projekten langsam — sollte
- **Messung** (100 Gräben, 60 Schächte, 40 Beläge): Rechenkern 8 ms, aber **Ergebnis aufbauen 3'951 ms**, davon Annahmen-Tabelle (`KVE.sens`) 2'554 ms; Excel 2'590 ms. Start der Seite 144 ms (lokal).
- Ursache: `sens()` rechnet für jede Annahme jedes Elements das **ganze Projekt** neu (quadratisch). Das Ergebnis wird 120 ms nach jeder Eingabe neu aufgebaut.
- **Behebung:** Delta nur über das betroffene Element rechnen (`calcRec`), die Zwischensumme ist eine reine Summe; Ergebnis identisch, ~100× schneller. Beim Demoprojekt (10 Datensätze) nicht spürbar.

### 9. CDN ohne Integritätsprüfung — sollte
- Leaflet 1.9.4 und pdf.js werden zur Laufzeit von cdnjs geladen (`src/karte.js:8`, `:284`), ohne `integrity`-Attribut. Wird das CDN kompromittiert, läuft fremder Code im Tool.
- **Behebung:** SRI-Hash und `crossorigin` setzen (Leaflet-Skript hat bereits `crossOrigin`).

### 10. Negative Werte still 0 — kann
- `-10` als Länge: das Feld wird **nicht** markiert (Muster `NUMOK` erlaubt das Vorzeichen), gerechnet wird nichts, kein Hinweis.
- **Behebung:** Minus im Muster nicht zulassen oder Feld markieren.

### 11. Rundung Menge × EP — kann
- In 300 Zufallsprojekten weichen **327 Zeilen** der Zusammenstellung um bis zu **2 Rp.** von Menge × EP ab, weil Beträge je Element gerundet und dann summiert werden. Total und Brutto sind in allen 300 Projekten konsistent.
- Folge: Wer mit dem Taschenrechner prüft, findet Rappendifferenzen; im Excel-Offertregister «mit Preisen» weicht der Total beim Demoprojekt um 4 Rp. ab.
- **Behebung (optional):** in der Zusammenstellung einen kurzen Hinweis «Beträge je Element gerundet» oder den Betrag als Summe der Elemente kennzeichnen. Keine Änderung am Rechenweg empfohlen.

### 12. Speicherplatz — kann
- Gemessen: max. **5.2 Mio. Zeichen** je Eintrag im Browser. Plan-Bild und Overlay-PDF dürfen je bis **2.4 Mio.** Zeichen gross werden (`MAXCHARS`), dazu Kartenhintergründe. Mit beiden grossen Bildern wird die Grenze erreicht → Nr. 4.
- **Behebung:** Bildgrösse gemeinsam begrenzen oder Bilder in IndexedDB ablegen; bis dahin Nr. 4 beheben.

### 13. Vereinfachung / Aufräumen — kann
- **Toter Code:** `snapPoint` (`src/karte.js:1946`) wird nirgends aufgerufen; 16 Übersetzungsschlüssel ohne Verwendung (u. a. `confirmDel`, `km_remove`, `km_tools`, `km_clearQ`, `rp_t_belag`, `km_sys`, `km_dn`, `km_len`, `km_blockNote`).
- **Doppelt:** Kosten-Formeln (Staffel, Rabatt, Installation, MWST) sind im Excel zweimal ausgeschrieben (Kostenblatt und Offertregister) – gemeinsame Hilfsfunktion; `hasMap` identisch in `situRender` und `exportOpen`.
- **Struktur:** `karte.js` (2'400 Zeilen) besteht im Kern aus einer einzigen Funktion `open()` mit ~1'800 Zeilen. Kein Grund für einen Umbau jetzt (Risiko), aber neue Funktionen besser als eigene Teile anlegen.
- **Dateigrösse:** 2.9 MB, davon Schacht-Bilder 1.4 MB (WebP) und LV DE/FR/IT 0.4 MB. Start lokal 144 ms – kein Handlungsbedarf.

---

## Was in Ordnung ist (geprüft)
- **Keine Code-Einschleusung:** Schadtext in allen Textfeldern (Namen, Notizen, Kopf, freie Positionen) wird in Hauptseite, Karte, Bericht, Excel und Offen-Dialog nicht ausgeführt.
- **Rechenkern robust:** 300 Zufallsprojekte ohne Absturz, keine negativen Beträge, keine ungültigen Zahlen, Zwischensumme = Summe der Zeilen, Netto + MWST = Brutto; Länge monoton (1–400 m).
- **Tiefenklassen:** Kosten sinken über 1.50 m und 2.00 m, weil Aushub-Positionen ausserhalb der LV-Klassen als **OFFEN** ausgewiesen werden – korrekt und überall gemeldet («nicht im Total»).
- **JS = Python:** Skill-Vergleich 0 Abweichungen; 47 Tests grün.

## Nicht geprüft
Honorar SIA 103 im Detail, französische/italienische Texte, Geometrie-Funktionen der Karte (Fang, Teilen), Assistent-Abläufe, Weitergabe-Build.

## Umsetzung Paket 1 (V89, 05.11.2026) – ohne Kostenwirkung
- **Nr. 1 behoben:** pdf.js öffnet PDFs mit `isEvalSupported: false` (offizielle Umgehung CVE-2024-4367). Wechsel auf pdf.js 4.x bleibt offen.
- **Nr. 3 behoben:** Laden fragt nach, wenn das Projekt Inhalt hat; danach Hinweis mit «Rückgängig» (ganzer Stand inkl. Kopf und Einstellungen). Dateien ohne gültige Datensätze werden abgelehnt, das Projekt bleibt unverändert.
- **Nr. 4 behoben:** Speicherfehler erscheint als rote Meldung mit «Sichern (JSON)» über der Kartenerfassung und verschwindet nach erfolgreichem Speichern.
- **Nr. 10 behoben:** negative Werte in Mengen-/Massfeldern werden markiert.
- Test t68.

## Vorschlag für die Reihenfolge
1. **Sofort, ohne Kostenwirkung:** Nr. 1 (eine Zeile), Nr. 3, Nr. 4, Nr. 10.
2. **Nach deinem Entscheid:** Nr. 2 (Apostroph akzeptieren), Nr. 6 und Nr. 7 (gegen LV-Text prüfen) – alle mit Kostenwirkung, Kernel und Skill gemeinsam.
3. **Danach:** Nr. 8 (Performance), Nr. 5 (zwei Tabs), Nr. 9 (SRI), Nr. 13 (Aufräumen).
