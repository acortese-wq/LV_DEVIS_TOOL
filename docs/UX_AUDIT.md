# UX-/Qualitätsaudit LV-Devis Tiefbau – Zyklus 2 (Oktober 2026)

App-Konzept und Urheber: Alessandro Cortese. Ergänzt `UX-Audit_2026-10.md` (Zyklus 1). Die Fachlogik (`src/kve.js`, Skill-Port) wurde **nicht** verändert.

## Ausgangszustand (beobachtet, nicht vermutet)
Automatisierter Durchlauf mit Chromium/Playwright + axe-core 4.10 (WCAG 2.0/2.1/2.2 A/AA + Best Practice) über **11 Reiter × 4 Breiten** (360, 768, 1280, 1440 px), Projekt mit Beispieldaten:

| Befund | Ort | Norm | Massnahme |
|---|---|---|---|
| 11 Eingabefelder ohne Beschriftung | Reiter «Annahmen» | WCAG 1.3.1 / 4.1.2 | `aria-label` je Feld (Zeilenname, Dimension L/B/H) |
| Überschriftenebene übersprungen (h4 nach h2) | Annahmen | Best Practice | h3 |
| Scrollbare Tabellen nicht per Tastatur erreichbar | Ergebnis, ≤ 700 px | WCAG 2.1.1 | Tabellen in `role=region`-Container mit `tabindex=0`, eindeutige Namen |
| Kostenleiste (mobil) ausserhalb eines Landmarks | alle Reiter, 360 px | Best Practice | `role=region`, Name «Kostenvoranschlag» |
| Link «alle Hinweise anzeigen» < 24 px hoch | alle Reiter, 1440 px | WCAG 2.5.8 | Mindesthöhe 24 px |
| Arbeitsbereich erst nach ca. 600 px Scrollen sichtbar (Kopf + offene Projektangaben) | Desktop | Heuristik «Effizienz» | Projektangaben standardmässig eingeklappt (Zustand wird gemerkt), Logo kompakter |
| Keine horizontalen Überläufe, keine Konsolenfehler, keine fehlenden Ressourcen | alle | – | – (bestanden) |

## Ergebnis nach Umsetzung
Alle oben genannten axe-Regeln: **0 Verstösse** auf allen 11 Reitern und 5 Breiten (zusätzlich 1800 px). Vollständige Prüfung: `AXE=/pfad/axe.min.js node tests/ui_qa.js`.

## Designsystem (bestehend, beibehalten)
Swisscom-Look: Navy `#0d47c8`, Fokus `#0072d6`, Status ok/amber/signal mit Hintergründen, Radius 7–10 px, Typografie Segoe UI/System, Zustände Fehler/Warnung/Erfolg einheitlich (`.hint.reqmsg`, `.status`, `.reqline`). Keine Neugestaltung: die Farbwelt ist durch CLAUDE.md vorgegeben.

## Entscheidungen
- **Keine Änderung an Berechnungen.** Prüfung: «Anzeige = Rechenkern» und `tests/skill_test.sh` (300 Zufallsprojekte, 0 Abweichungen).
- **Projektangaben eingeklappt** statt entfernt: Zustand wird in `S.ui.kopfZu` gespeichert; der Druck öffnet den Block weiterhin.
- **Tabellen-Wrapper** statt `display:block` auf `<table>`: erhält die Tabellensemantik für Screenreader.

## Offene Punkte / nicht geprüft
- Screenreader-Praxistest (NVDA/VoiceOver): **NICHT AUSGEFÜHRT** (kein Screenreader verfügbar); nur automatisierte Regeln.
- Echte geo.admin-/swisstopo-Dienste und pdf.js von cdnjs: **NICHT AUSGEFÜHRT** (Netzwerk der Testumgebung gesperrt; mit simulierten Antworten geprüft).
- Kontrast in Karten-/Planbildern (Rasterinhalt) liegt ausserhalb der Kontrolle der App.
- Fachlich ungeklärte Regeln: keine; nichts wurde erfunden oder verändert.

## Konflikt-Durchläufe Karte/Plan (Oktober 2026)
Fünf Szenario-Läufe im Browser (simulierte Karte, lokales Leaflet/pdf.js). Gefunden und behoben:

| Lauf | Prüfgegenstand | Befund | Massnahme |
|---|---|---|---|
| 1 | Sicherung, «Neues Projekt», Laden, alte Sicherung ohne Karte/Plan | kein Befund | – |
| 2 | Verknüpfung Karte ↔ Datensätze (Löschen, Kopieren, Plan + Karte) | Karte und Plan konnten denselben Datensatz stillschweigend überschreiben | Hinweis bei der Übernahme («letzte Übernahme gilt») |
| 3 | Abgeleitete Kosten (Sondieraushub, Werkloch-Zähler, Schacht-Anzahl) | **Sondieraushub und Werkloch-Zähler blieben nach Entfernen der letzten Objekte stehen (Kosten ohne Objekt)**; Summen nur aus einer Quelle | Werte werden aus Karte **und** Plan summiert und beim Entfernen der letzten Objekte zurückgesetzt; manuell eingegebene Werte bleiben unberührt |
| 4 | Sprachen DE/FR/IT/EN | kein Befund (377 Schlüssel vollständig, Platzhalter gleich, keine rohen Schlüssel im Dialog) | – |
| 5 | Grenzfälle | **JS-Fehler bei Linie mit zwei gleichen Punkten (Beschriftung)**; Fläche mit Punkten auf einer Linie erzeugte Belag-Datensatz Breite × 0; Flächen mit < 3 Punkten blieben gespeichert | Fehler behoben; solche Flächen werden verworfen bzw. gemeldet |

Bekannte Grenze: Pläne/Overlays werden als Bild im Browser-Speicher gehalten (ca. 5 MB). Bei Plan **und** separatem Overlay kann der Speicher überlaufen; die Anzeige «Automatisches Speichern nicht möglich» erscheint, die Daten bleiben bis zum Neuladen im Speicher – dann «Sichern» (JSON) verwenden. Entfernte Karten-Objekte lassen ihre Datensätze (Länge, Anzahl) unverändert bestehen.

## Eine Messgrundlage: Plan in der Karte ausrichten (Oktober 2026)
Empfohlener Ablauf: Plan im Reiter «Plan» einsetzen → «Plan in der Karte ausrichten und messen» → mit 2 Passpunkten ausrichten → «Plan-Objekte in die Karte übertragen». Die Plan-Pixel werden über Lage, Drehung und Massstab des Hintergrunds in LV95 umgerechnet, die Verknüpfungen zu den Datensätzen bleiben (keine Duplikate), die Plan-Objekte werden entfernt. Danach gilt nur noch die Karte (LV95) als Messgrundlage. Die Vorschau zeigt je Linie «Plan x m → Karte y m (± %)»; Rechtecke werden zu geschlossenen Skizzenlinien. Der Plan-Reiter bleibt für Pläne ohne Lagebezug (Kalibrierung).

## Erfassung über die Karte: Rohre, Verlegeart, Oberfläche, Querschnitt (Oktober 2026)
Pro Linie: Rohrtypen als Zähler (z. B. 2×K100 + 3×K55), Verlegeart (Kies/Betonkies, einbetoniert = Rohrblock, Längsverschluss), Oberfläche (Belag, Wiese, Pflästerung, Rohplanie), Tiefe und Breite (leer = automatisch). Fehlendes wird nach dem Zeichnen einmal abgefragt; weitere Linien erben die letzte Konfiguration. Grabenquerschnitt live (gleiche Rechenregeln wie die Rechnung), Beschriftung mit Rohrbelegung, Verlegeart, Oberfläche, Länge. Werkloch-Typ vor dem Setzen wählbar.

**Kostenwirkung (bitte beachten)**
- **Rohplanie** (neu im Rechenkern, JS und Python identisch, `roh`): Aushub, Belag, Spriessung, Verfüllung entfallen; Leitungszone/Umhüllung und Rohre bleiben. Beispiel 50 m: 26 → 10 Positionen.
- **Einbetoniert**: Rohrblock je Rohrtyp; Blockmass automatisch aus den Rohren + 5 cm Überdeckung.
- **Mehrere Rohrtypen in Kies**: Haupttyp (meiste Rohre) im Graben, weitere Typen in einer eigenen Rohranlage (Lieferung, Verlegen, Muffen, Einzug, Kalibrieren). Leitungszone/Umhüllung rechnet mit dem Haupttyp.

## Zyklus 3: Oberflächen, Abbruch, Einklappen, Abdeckung (Oktober 2026)
**Abbruch je Oberfläche (geprüft, Kernel unverändert ausser Fläche)**
| Oberfläche | Abbruch/Abtrag | Entsorgung | Neuaufbau | Befund |
|---|---|---|---|---|
| Belag (Asphalt) | Schneiden + Abbruch (117/223) | Deponie (117/721, 731) | ja | vollständig |
| Pflästerung | Abbruch (117/224, 225) nur bei Schalter «Abbruch alt» | **nicht im Kernel** | ja | **Karte setzte den Schalter nie → behoben** (Auswahl Betonstein/Platten/Naturstein/kein, Vorgabe Betonstein) |
| Wiese | Humus-Abtrag / Rasenziegel (151/211, 212) | – | Humus, Ansaat | vollständig |
| Rohplanie | entfällt | – | – | Aushub durch anderen Bauherrn |

**Kostenwirkung:** Linien, Schächte, Werklöcher und Flächen mit Oberfläche «Pflästerung» rechnen jetzt Abbruch mit (Standard Betonstein). Bereits erfasste Karten-Linien mit Pflästerung ändern sich beim erneuten «In Datensätze übernehmen». **Offen:** Entsorgung von Pflästerabbruchmaterial ist im LV-Kernel nicht abgebildet (keine Position hinterlegt).

**Neu:** Flächen mit Oberfläche Pflästerung/Wiese (Kernel `fl`/`belagX`, JS = Python), Oberfläche und Typ-Merker an Schächten/Werklöchern, «Weitere Angaben» je Linie (Spriessung, Kreuzungen, Bögen 90°/45°), Linienart nach Oberfläche (Farbe + Strichart + Legende, auch im Export), Objekte einklappbar (Kopf, «Alle einklappen», Kurzinfo), Sammelblatt «Fehlt noch», Kostenvorschau (netto) in der Karte.

**Abdeckung (Auswertung `tests/abdeckung.js`, 5 Beispielprojekte 40–200 m)**
Vergleich: nur Kartenangaben (Standardwerte) gegen «vollständig» mit abweichenden Nicht-Karten-Feldern (Handanteil eng, Betonumhüllung, direkte Verfüllung, Handeinfüllung, 2 Kreuzungen, Bögen, Schneiden, Belag 150 mm, Schacht 0.75 m Arbeitsraum, 2 Anschlüsse). Ergebnis Nettokosten: 82 %, 88 %, 77 %, 80 %, 81 % (Ø 82 %); Positionen deckungsgleich 67–87 %. Aussagekraft: Richtwert, abhängig von den gewählten Abweichungen; Kreuzungen/Bögen sind inzwischen über «Weitere Angaben» in der Karte erfassbar (im Test «Karte» nicht eingesetzt).

## Automatische Ausrichtung des Plans ohne Passpunkte (Oktober 2026)
Beim Einsetzen eines Plans (PDF/Bild) wird die Lage automatisch vorgeschlagen; sie gilt **erst nach «Bestätigen»** (oder nach Passpunkten). Ohne Bestätigung ist «Plan-Objekte in die Karte übertragen» gesperrt.
1. **Koordinatenraster im PDF-Text** (LV95, LV03 +2'000'000/+1'000'000): Lage aus der Textposition, Massstab aus dem Wertabstand; Prüfung gegen Massstab im Plan (±8 %), Streuung ≤ 2.5 m, mindestens 3 Werte auf beiden Achsen. Ohne Raster: Schritt 2.
2. **Ort + Kartenabgleich** (Massstab muss bekannt sein, Plan nordorientiert): zuerst Kartenausschnitt (ab Zoom 14, Radius 300 m), sonst Gemeinde aus dem Plantext über den SearchServer (Radius 900 m). Planlinien (Kanten) werden mit dem Katasterbild korreliert; Vorschlag nur bei Übereinstimmung ≥ 30 % und klarem Abstand zum zweitbesten Treffer.
3. **Passpunkte** bleiben unverändert möglich («Mit Passpunkten verfeinern»); erfolgreiche Passpunkte gelten als bestätigt.

**Geprüft:** Browsertests mit künstlichen PDF (Raster: Abweichung 0.05 m; Abgleich mit simuliertem Katasterbild: 0.16 m), echter Plan 105B (kein Raster, kein Ort-Treffer → klare Meldung), Verwerfen, Verfeinern, axe-core. **Nicht geprüft:** echte Katasterbilder/SearchServer (Netz gesperrt); die Trefferquote auf echten Plänen ist offen. **Grenzen:** keine Drehung (Plan muss nach Norden zeigen), Koordinatenwerte im Plan müssen als Text (nicht als Pfad/Bild) vorliegen und vollständig ausgeschrieben sein (z. B. 2'760'050), Raster nur bei Plan-PDF mit Textebene.

## Linienstart/-ende: Schacht neu, Anschluss, nur Deckel, Oberflächenwechsel (Oktober 2026)
Nach dem ersten Klick einer Linie erscheint am Punkt (oberhalb, blockiert nur die Schaltflächen selbst): «Neuer Schacht hier», «Anschluss an bestehenden Schacht» (nächster Schacht bis 15 m wird vorgeschlagen und der Linienpunkt rastet darauf), «Ohne Schacht». Nach «Linie beenden»: neuer Schacht am Ende, Anschluss an bestehenden Schacht, «Oberfläche wechselt ab hier» (Folgeabschnitt mit gleichen Rohren, andere Oberfläche, Zeichnen läuft weiter), «Nur Deckel anpassen», weiter ohne. Der nächste Klick auf die Karte schliesst die Auswahl.
**Schachtart je Punkt:** Neuer Schacht / Bestehend: Anschluss / Bestehend: nur Deckel (auch im Objekt umstellbar, Deckel höher/tiefer, rund/rechteckig). Bestehende Schächte werden weiss mit blauem Rand dargestellt (auch im Export), Beschriftung «Anschluss»/«nur Deckel». Verschiebt man einen Schacht, folgen die verbundenen Leitungsenden.
**Kostenwirkung:** Neuer Rechenkern-Modus `anschluss` (JS = Python): bestehender Schacht rechnet **nur** die Leitungsanschlüsse (151/672.201/.202 bei KS, 151/672.301/.302 sonst, je nach DN), Anzahl = Leitungsenden an diesem Schacht; kein Schachtkörper, kein Aushub. «Nur Deckel» zählt Stück (151/633, 634). Der Schachttyp des bestehenden Schachts bestimmt nur die KS-/KES-Anschlussposition.

## Kontextmenü in der Karte (Oktober 2026)
Rechtsklick, langes Drücken (Touch, 0.65 s) oder Menütaste/Umschalt+F10 auf der Karte öffnet ein Menü am Kartenpunkt: Schacht setzen (mit Typ), Werkloch setzen (mit Typ), Gebäudeeinführung, Sondage, Linie hier starten (inkl. Schachtfrage), Fläche hier beginnen; Anzeige der LV95-Koordinate. Auf einem Objekt: **Eigenschaften** (schwebendes Fenster mit denselben Feldern wie rechts, bei Linien inkl. Querschnitt), bei Linien **Linie teilen / Oberfläche ab hier ändern** und **Abzweig ab hier**, bei Schächten **Leitung ab hier (Anschluss)**. Esc oder Klick daneben schliesst. Teilen erzeugt einen Folgeabschnitt als eigene Linie (eigener Graben-Datensatz) mit gleichen Rohren: Länge der Linien bleibt in der Summe gleich, Kosten ändern sich nur durch die andere Oberfläche.

## Übersicht mit Parzellenplan (Oktober 2026)
Die Übersicht (Situation auf dem Bildschirm und im Ausdruck, Vorschau in den Reitern) zeigt statt der Landeskarte (farbig/grau) den **Parzellenplan** (Amtliche Vermessung, `ch.kantone.cadastralwebmap-farbe`, weisser Grund) mit Quellenangabe «© geo.admin.ch / Kantone». Luftbild, leere Basis und eigener WMS bleiben wie gewählt. Der Kartendialog und der Export behalten die frei gewählte Kartenquelle. Linienauswahl-Popups stehen jetzt in der von der Klickstelle abgewandten oberen Kartenecke (schmale Karten: am Punkt), damit sie das Weiterzeichnen nicht verdecken.

## Google Street View (Oktober 2026)
**Ohne Schlüssel:** Knopf «Street View» (Kartenmitte) und Kontextmenü «Street View hier öffnen» (auf Kartenpunkt oder Objekt; bei Linien mit Blickrichtung entlang der Linie) öffnen Google Street View über die offizielle Maps-URL in einem neuen Tab. Dabei wird die Koordinate an Google übermittelt (Datenschutzhinweis im Knopf-Tooltip). **Mit Schlüssel (optional):** «Street View-Schlüssel» speichert einen Google-Maps-Embed-API-Schlüssel nur im Browser (nicht im Projekt, nicht in der Sicherung); danach bettet «Street View hier einbetten» die Ansicht als Fenster in die Karte ein. Der Schlüssel muss von Google für diese Seite freigegeben werden (Referrer-Beschränkung empfohlen). **Geprüft:** Link-Erzeugung, Blickrichtung, Menü, Embed-URL, axe-core. **Nicht geprüft:** echte Google-Dienste und Schlüssel (Netz gesperrt); die Nutzungsbedingungen von Google Maps Platform (Schlüssel, ggf. Abrechnung) liegen beim Benutzer. Im Plan-Modus ohne Lagebezug nicht verfügbar.

## Zyklus 4: Positionsprüfung im Kostenvoranschlag (Oktober 2026)
**Einordnung:** LV-Devis Tiefbau ist ein *Kostenvoranschlag-Rechner* (Eingabe je Element → LV-Positionen → Summen). Er ist kein Offerten-/Rechnungsprüf-Tool; Funktionen wie «Offerte», «Ausmass», «Preisgrundlage», Preisabweichung gegenüber Offerte oder Benutzerverwaltung existieren nicht und wurden **nicht vorgetäuscht**. Die Positionsliste (Aufstellung nach Elementen und Zusammenfassung nach Kapiteln, bis ~190 Positionen) ist das zentrale Arbeitselement.

**Top-10-Befunde (belegt durch Messung/Browser)**
| # | Stufe | Befund | Massnahme |
|---|---|---|---|
| 1 | 🔴 | 320 px: Seite läuft über (341 px) – Knopfzeile «Alle einklappen/Rechenweg» bricht nicht um; Reiter «Annahmen» (Dimensionstabelle) läuft über | umbrechen, Eingaben schmaler |
| 2 | 🔴 | 881–940 px: Seite läuft über (Vollständigkeitsliste, `white-space:nowrap`) | umbrechen |
| 3 | 🔴 | Keine Suche über alle Positionen des Ergebnisses (nur «Weitere LV-Positionen» filtert) → eine Position unter 90–190 Zeilen zu finden kostet Scrollen | Positionsfilter (Nummer/Text, Taste «/», Trefferzahl, Blöcke mit Treffern öffnen automatisch) |
| 4 | 🟠 | Tabellenkopf scrollt weg (kein Sticky Header) → bei langen Elementtabellen geht die Spaltenzuordnung verloren | Sticky Tabellenkopf unterhalb der Kostenleiste (ab 1101 px) |
| 5 | 🟠 | Kein Weg, Prüfergebnisse je Position festzuhalten (geprüft / zu klären, Bemerkung) | Prüfstatus je Position mit Symbol + Text, Notiz, Zeitstempel; lokal im Projekt gespeichert (JSON-Sicherung, `S.pruef`) |
| 6 | 🟠 | Kostentreiber nicht auf einen Blick erkennbar | Top-10 grösste Positionen mit Sprung zur Zeile |
| 7 | 🟠 | Kein Überblick «was ist schon geprüft» | Prüfstand-Zeile (geprüft/zu klären/offen von N) + Statusfilter |
| 8 | 🟢 | Ergebnis-Kopfzeile: fünf gleich starke Knöpfe | bestehend (Drucken primär, übrige sekundär) – unverändert |
| 9 | 🟢 | Zoomstufen/Touch: Checkboxen 18 px | axe-core ohne Befund (WCAG 2.5.8 Ausnahme durch Abstand), unverändert |
| 10 | 🟢 | Positionsdetail nur im Rechenweg-Block | bestehend; kein Side-Panel nötig, da Rechenweg je Zeile eingeblendet werden kann – unverändert |

**Bewusst unverändert:** Rechenkern, Datenstruktur und Schlüssel (`lv-devis-tiefbau-v2`; neu nur das optionale Feld `pruef`, ältere Sicherungen laden unverändert), Berechnung, Excel-/Druck-/JSON-Ausgabe, Navigation (11 Reiter), Karte, Formulare. **Statusfarben:** immer Symbol + Text (○ Offen · ✔ Geprüft · ⚠ Klären), Farbe nur zusätzlich.

**Revisionsnachvollziehbarkeit:** je Position Status, Notiz und Zeitpunkt der letzten Änderung (Browser-Zeit). Keine Benutzerkennung, keine Änderungshistorie (kein Backend) – im Hinweis ausgewiesen. Notiz und Status erscheinen im Ausdruck; **nicht** in der Excel-Ausgabe.

**Nicht geprüft / offen:** Screenreader-Praxistest; Nutzertests; Excel-Export der Prüfnotizen; Sortierung der Positionstabelle nach Betrag (Positionen sind nach NPK-Kapitel gruppiert; Top-10 ersetzt dies); Side-Panel für Positionsdetails.

## Arbeitsfläche Karte/Plan im Layout einer Mess-Software (Oktober 2026)
Der Karten-/Plan-Dialog ist jetzt eine **Vollbild-Arbeitsfläche** (Vorlage: Planausmass-Layout): links die **Werkzeugleiste** (Auswahl · Zeichnen · Beschriften · Messen und Korrigieren), daneben **Ebenen** (Geokatalog, Plan-Hintergrund) und der **Marker-Katalog**, in der Mitte die Karte, rechts die Reiter **Eigenschaften | Auswertung**, unten die **Fussleiste**.
- **Marker-Katalog (Vorbelegung):** Rohrbelegung (1×K55 … 2×K100 + 3×K55), Verlegeart, Oberfläche, Schachttyp, Werkloch-Typ; Anklicken gilt für neue Linien/Schächte/Werklöcher (markiert mit `aria-pressed`); das gewählte Objekt wird rechts bearbeitet.
- **Eigenschaften:** Leitungskarte «nur was fehlt», Objektliste mit Einklappen, Querschnitt, «Fehlt noch». **Auswertung:** Länge und Rohrlänge je Rohrtyp, Länge je Oberfläche, Anzahl Schächte (neu / Anschlüsse / nur Deckel), Werklöcher, Einführungen, Sondagen, Flächen, Kostenvorschau netto.
- **Fussleiste:** Punktfang (14 px auf Objekte und Linienpunkte), Linienfang (Fusspunkt), Winkelraster 45° (zum letzten Punkt); Einstellung wird gemerkt. Cursor-Koordinate LV95 und Massstab 1:N (Plan: Kalibrierstatus); Kartenquelle/Ansicht; Gesamtlänge und «In Datensätze übernehmen».
- **Responsiv:** ab 1500 px vier Spalten; bis 861 px «Ebenen»-Schalter in der Kopfzeile (Ebenen/Marker als Überlagerung); unter 861 px einspaltig mit festem Karten-Bereich und angehefteter Fussleiste.
**Unverändert:** Alle Funktionen, Ids, Datenstrukturen und der Rechenkern (reine Oberflächenänderung, keine Kostenwirkung ausser Fang: Punkte können auf vorhandene Punkte einrasten). Die bisherige Schaltfläche «Vollbild» entfällt (immer Vollbild).

## Kompakter Druck (Oktober 2026)
«Drucken / PDF» ist jetzt **kompakt**: Kopf, Hinweise, Situation, Elementsummen (eine Zeile je Element), Zusammenfassung nach Kapiteln (alle Positionen einmal, Text auf 3 Zeilen begrenzt), Kostenübersicht, Warnungen, Unterschriften; kleinere Schrift (8.5 pt). Weggelassen (nur auf dem Bildschirm bzw. im neuen Knopf **«Ausführlich drucken (alle Rechenwege)»**): Positionstabellen je Element (doppelt zur Zusammenfassung), Massenbilanzen, Rechenwege, Grafiken, Vollständigkeitsliste, Grundlagen. Messung mit Beispielprojekt (Graben, Schacht, Werkloch, Einführung, Belag): **14 → 5 Seiten**. «Kurzausdruck (1 Seite)» und Excel unverändert. Hinweis: Wer die Rechenwege je Element ins Dossier braucht, wählt «Ausführlich drucken».

## Leitungsanschlüsse am Schacht (Zeichnen)
- Schacht auf einer Linie ⇒ Linie wird am Schacht geteilt (zwei Hälften, Gesamtlänge gleich); Popup für die Belegung der Folgelinie (Belegungswechsel).
- Anschlüsse aus den Linien: Linienende = hinein, Linienstart = hinaus; K55 ⇒ DN 80, K100 und grösser ⇒ DN 150, je Rohr 1 Anschluss. Anzeige in der Schachtzeile; Kernel-Felder `an80`/`an150` (JS und Python identisch).
- **Kostenwirkung:** Hängen Linien am Schacht, ersetzen die automatischen Anschlüsse die manuelle Anschlusszahl (`anMap`); Teilung erzeugt keine zusätzlichen Kosten ausser den Anschlüssen.
- Noch offen: Vorschläge (Schacht alle X m/Knicke, Werklöcher an Abzweigen), Belagsfläche, Plausibilitätswarnungen.

## Prüfung und Vorschläge nach Handbuch V1.2 (Zeichnen)
Quelle: «Handbuch unter- und oberirdischer Netzbau» V1.2 (01.04.2026), Kap. 2.2.2, 2.2.4, 2.3.3, 3. Reine Hinweise, **keine Kostenwirkung** (Ausnahme: übernommene Vorschläge setzen Schächte/Werklöcher und teilen Linien).
- **Prüfpanel (Auswertung):** Linienenden ohne Schacht (Topologie), Linien/Schächte < 0.5 m auseinander, Schachtabstand über Richtwert, Biegeradius an Knicken (K100 ≥ 3 m, K55 ≥ 1 m; Tangente ≤ halbe Nachbarstrecke), Schachttyp zu klein für Muffen (neues Feld «Muffen»: KES100 ≤ 1, KES150 ≤ 3, KES175 4, ES300 ab 5), KS Ø 80 mit K100 oder nicht geradlinig, Gebäude ohne Schacht bzw. > 250 m (Luftlinie). Je Hinweis Sprungknopf; Symbol + Text (nicht nur Farbe).
- **Vorschläge:** Erschliessungsart (Basis Cu/GFK, FK/RK, Detail) × Lage (in/ausserhalb Bauzone) ⇒ Richtabstand (250/500, 1'000/6'000, 1'000/6'000, 200 m), übersteuerbar; Schächte im Richtabstand (gleichmässig verteilt) und an Knicken ≥ 30°, Werkloch an Abzweigen; gestrichelte Vorschau, «Alle übernehmen» (rückgängig) oder «Verwerfen».
- **Gebäudetyp** (EFH/MFH/Büro) zeigt die Handbuch-Vorgabe (1×K55 bzw. 1×K55/100 durch Kunde getrieben).
- **DXF-Export** (nur Karte): Netzkanten Layer 100, Netzknoten 200, Knickpunkte 201, Koordinaten LV95. Der genaue SIA-Geo405-Layeraufbau von Swisscom/PTA ist im Handbuch nicht beschrieben und vor Produktivnutzung zu verifizieren.
- Nicht umgesetzt (nicht gewählt): Zweitweg-Abstand, Hauptkanalisation/erster Abzweigschacht, Querung bei ⅓, Deckel-Entscheidungsbaum, Bogenschnitt-Bemassung.

## Höhenprofil / Schräglänge (Zeichnen, nur Karte)
- «Höhenprofil laden» holt je Linie das Profil von swisstopo (swissALTI3D, `profile.json`, ca. alle 10 m) und zeigt Lagelänge, Schräglänge, Ø- und Maximalgefälle (Fenster 20 m). Wird die Linie geändert, ist das Profil veraltet («neu laden»); bei Fehler/offline gilt die Lagelänge mit Hinweis.
- **Kostenwirkung:** Standard unverändert (Lagelänge). Nur mit dem Schalter «Kosten mit Schräglänge rechnen» übernimmt «Übernehmen» die Schräglänge als Grabenlänge (und die Kostenvorschau). Ob Ausmass nach Lage oder Schräglänge gilt, ist vertraglich zu klären.
- Prüfhinweis bei Gefälle > 20 % (eigene Annahme, nicht aus dem Handbuch). Rechenkern und Skill unverändert.

## Assistent (Chatbot)
- Schwebender Knopf «Assistent» unten rechts → Chatfenster (`src/chat.js`, Dialog ohne Modal, Esc schliesst, Fokus zurück). Läuft über die Claude-Funktion des veröffentlichten Artefakts (capability `sample`, kein API-Schlüssel); in der lokal gespeicherten Datei erscheint ein Hinweis. Projektdaten (Datensätze, Ergebnis, Warnungen) gehen bei jeder Frage an Claude; der Hinweis steht im Fenster.
- Wissen: Projektstand, LV (Werkzeuge `lv_suche`/`lv_position`, Preise nur daraus), Handbuch-Richtwerte (Auszug), Kurz-Bedienung.
- **Änderungen nur als Vorschlag** (Werkzeug `vorschlag`): Karte mit Feld, alt → neu, Begründung und **Kostenwirkung netto** (Berechnung mit Rechenkern auf einer Kopie); «Übernehmen» setzt das Feld (Rückgängig-Meldung), «Verwerfen» entfernt die Karte. Gesperrt: `uid`, abgeleitete Zählwerte; nur einzelne Felder.
- Rechenkern unverändert. Kostenwirkung nur nach Klick auf «Übernehmen».
