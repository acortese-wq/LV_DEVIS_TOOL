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

## Schräglänge in Beschriftungen
Bei aktivem «Kosten mit Schräglänge rechnen» und passendem Höhenprofil zeigen Kartenbeschriftung, Objektliste, Gesamtlänge, Auswertung (Längen, Rohrmeter, Oberflächen) sowie Übersicht/Druck die Schräglänge mit Zusatz «schräg». Ohne Schalter oder bei veraltetem Profil bleibt es die Lagelänge. Keine zusätzliche Kostenwirkung (Länge wird schon beim Übernehmen verwendet).

## Assistent: regelbasiert (ohne KI), auch beim Zeichnen
**Änderung:** Der Assistent verwendet keine Claude-Funktion mehr (capability `sample` entfernt) – keine Tokens, keine Datenübertragung. Er antwortet aus dem hinterlegten Wissen: Projektstand (Kostentreiber, Zusammenfassung, Warnungen/Vollständigkeit), LV (Position per Nummer oder Stichworte), Handbuch-Auszug V1.2 (Schachtabstände, -typen, Gebäudeanschlüsse, Biegeradius, Zweitweg, Hauptkanalisation, Querungen, Kostenteiler, Einmass/DXF, Abdeckungen, Gebäudeeinführung, Normen) und Bedienung. Quelle wird unter jeder Antwort genannt. Wissenstexte sind deutsch (Oberfläche DE/FR/IT/EN).
- Änderungen weiterhin nur als Vorschlag mit Kostenwirkung und Bestätigung: «setze graben 1 T auf 1.2».
- **Im Zeichnen-Dialog** wandert der Knopf (oben neben «Schliessen») und das Fenster in den offenen Dialog; «Warnungen» liefert dort die Prüfung der aktuellen, noch nicht übernommenen Zeichnung. Esc schliesst nur den Assistenten.
- Mobil (≤ 900 px) sitzt der Knopf über der unteren Ergebnisleiste (Zielgrösse/Überlappung behoben).

## Assistent: Geführte Beratung (interaktiv)
Fünf Entscheidungsdialoge aus dem Handbuch V1.2, per Startchip, Freitext («welcher Schacht», «wer zahlt», «Schachtabstand Beratung») oder Angebot unter einer Wissensantwort: **Schachtabstand und Rohrbelegung** (2.2.2/2.2.3), **Schachttyp und Abdeckung** (2.3.3/2.3.5), **Gebäudeanschluss** (2.2.4), **Kostenteiler Strasse/Werke** (2.5), **Erschliessung und Strassenquerung** (2.4).
- Antwort per Knopf oder Freitext; «Zurück», «Abbrechen», «Nochmals durchgehen». Fragen werden je nach Antwort übersprungen.
- **Aktionen am Ende:** Richtabstand in der Karte einstellen (wirkt sofort in einer offenen Karte, sonst beim nächsten Öffnen); Schachttyp bei einem Schacht-Datensatz setzen als Vorschlagskarte mit Kostenwirkung und Bestätigung. Beim Schachtabstand wird zusätzlich das Projekt gegen den Richtwert geprüft.
- Läuft regelbasiert ohne KI; Wissenstexte deutsch. Rechenkern unverändert. Bei der Schachttyp-Wahl gilt ohne Muffenzahl keine Aussage; KS80U/KS80H unterscheiden sich im Tool nur in der Bauwerkshöhe.

## Assistent: alle Beratungen aus dem Handbuch (25)
Das gesamte Handbuch V1.2 (82 Seiten, unter- und oberirdisch) wurde ausgewertet. Geführte Beratungen, gruppiert (aufklappbar) und per Freitext auslösbar:
- **Unterirdisch (14):** Schachtabstand und Rohrbelegung, Schachttyp und Abdeckung, Gebäudeanschluss, Kostenteiler, Erschliessung/Strassenquerung, Zweitweg, Hauptkanalisation ab CO, Bauweise/Rohrmaterial, Trassenwahl-Kriterien, Anschluss KVA, Kabeleinführung ins Gebäude (gas-/wasserdicht), Betonsockel/ME-Messung, Schachtdeckel sichern, Einmass/Datentransfer.
- **Freileitungen (10):** Regel-/Weitspannleitung, Meldepflicht BAZL, Hausanschluss ab Freileitung, Umbau/Unterhalt (PrUh/KoUh), Kabelüberführungsmast UST, Holzmast/Verankerung, Luftkabel wählen/befestigen, **Durchhang und Zugkraft** (Montagewerte aller 9 Tabellen: 180 Kombinationen), Siphon/Powering/Starkstrom, Mastabbruch/Entsorgung.
- **Mein Projekt (1):** Projekt-Check gegen die Richtwerte (Schachtabstand, Rohrbelegung, Schachttyp, Gebäude) aus der gezeichneten Karte.
- Zusätzliche Wissensantworten: gemeinsame Tragwerke/Sicherheitsabstände, Schutzgebiete, Freileitung-Trassierung.
- Test t44 durchläuft alle 368 Entscheidungspfade (gültige Ergebnisse mit Quelle). Texte sind Zusammenfassungen; verbindlich bleibt das Handbuch. Montagewerte wurden aus den Tabellen abgeschrieben (Richtwerte) – vor Verwendung für Zugkraftberechnungen gegenprüfen.

## Längenprofil unter der Karte (Schacht setzen/verschieben, Abschnittsarten)
- **Anzeige:** Kopfleiste der Karte → «Längenprofil» blendet unter der Karte Gelände (swissALTI3D), Leitung, Schächte, Station/Höhe/Gefälle (Maus) ein; rechts Linienwahl, Abschnittsart und Längen. Strang = Linien, die über Schächte mit je einer ankommenden/abgehenden Linie verbunden sind.
- **Schacht setzen:** «Schacht setzen» + Klick ins Profil teilt die Linie; Teilprofile werden aus den vorhandenen Stichproben gebildet (kein erneutes Laden). Gilt auch beim Setzen auf der Karte.
- **Schacht verschieben:** Ziehen oder Pfeiltasten (Umschalt = 10 m) entlang der Leitung; live Abstände zu den Nachbarknoten und Warnung über dem Richtwert; Entf löscht und führt die Linien zusammen (Rückfrage bei verschiedener Belegung). Alles mit Rückgängig. Nur Schächte mit genau einer ankommenden und einer abgehenden Linie (nicht an Abzweigen/Enden).
- **Abschnittsarten je Linie:** Gelände folgen (Graben) · Luft (Brücke/Weitspann: Sehne zwischen den Endhöhen + Durchhang, Standard 3.5 % der Spannweite, Endhöhen übersteuerbar) · Bohrung/Horizontal (Sehne). Darstellung gestrichelt in Karte und Profil.
- **Kostenwirkung:** Luft- und Bohrabschnitte werden beim Übernehmen **nicht als Graben** übernommen (Grabenlänge 0, Meldung «… m Luft/Bohrung nicht als Graben übernommen – separat kalkulieren»), in der Auswertung «davon nicht im Graben». Schräglänge in den Kosten weiterhin nur mit dem Schalter.
- **Prüfhinweise:** Luft/Bohrung (separat bepreisen); Gelände > 8 m unter/über der Verbindungslinie (Brücke/Tal bzw. Tunnel/Einschnitt vermutet). swissALTI3D enthält keine Bauwerke – Erkennung nur als Hinweis.
- Test t45; Kopfleiste statt Fussleiste gewählt, damit die Fussleiste nicht umbricht. Assistent-Knopf im Dialog nach links verschoben.

## Leitung im Längenprofil (Rohrachse, Überdeckung)
- Im Profil erscheinen **Gelände** (braun) und **Rohrachse** (blau) getrennt; Tiefe standardmässig 10-fach überhöht (abschaltbar, in der Legende vermerkt). Tooltip zeigt die Überdeckung an der Maus.
- **Überdeckung bis Rohrscheitel = Grabentiefe T − Bettung (5 cm) − DN** (T leer = 0.60 m); je Linie übersteuerbar. Das sind Annahmen; das Handbuch nennt keine Überdeckungswerte.
- **Prüfung:** Min./Max. Überdeckung (Felder im Profil, leer = keine Prüfung, gespeichert im Browser); bei Bohrung die kleinste Überdeckung unter dem Gelände.
- **Keine Kostenwirkung:** reine Darstellung und Prüfung; Grabentiefe im Datensatz bleibt wie eingegeben.

## Anleitung im Tool
- **Hilfe-Fenster** mit 13 Kapiteln (Schnellstart, Oberfläche, Datensätze, Karte, Fang, Schächte/Anschlüsse, Auswertung/Prüfung/Vorschläge, Höhen-/Längenprofil, Ergebnis/Druck/Sicherung, Assistent, Tasten und Maus, Wo sich Kosten ändern, Datenschutz/Über) in **DE/FR/IT/EN** (`src/help_data.js`, UI `src/help.js`); folgt der gewählten Sprache. Läuft lokal ohne Internet.
- **Aufruf:** Knopf «Anleitung» im Kopf; «?» neben den Reitern und im Zeichnen-Dialog (kontextbezogen: Reiter → Abschnitt, Karte → Kapitel Karte bzw. Profil); **F1**; Assistent bietet «Anleitung öffnen» bei Bedienungsfragen.
- **Suche** (Volltext mit Markierung), **Kapitel/alles drucken** (eigener Druckbereich), **Beispielprojekt laden** (ersetzt das Projekt erst nach Rückfrage, rückgängig möglich), Zurück/Weiter.
- Esc schliesst nur die Anleitung (auch über dem Zeichnen-Dialog). Test t46 (Suche, Sprachen, F1/Kontext, Druck, Beispielprojekt, axe, Handy).
- **Kostenwirkung:** Nur «Beispielprojekt laden» ändert Daten (nach Bestätigung); sonst keine.

## Kosten und Zusammenfassung immer sichtbar (Zeichnen-Dialog)
- **Fussleiste:** «Kosten netto CHF … · brutto CHF …» steht jetzt **vor** der Gesamtlänge (Kostenvorschau mit Rechenkern, wie bisher inkl. bisheriger Datensätze; Tooltip mit dem Hinweis «ohne Gewähr»). Die Vorschau in der Auswertung bleibt.
- **Zusammenfassung** oben im Reiter «Eigenschaften», **vor** der Objektliste: Kosten netto/brutto, Gesamtlänge mit Linienzahl, Schächte/Werklöcher/Gebäude, Anzahl Hinweise mit Sprung in die Auswertung. Aktualisiert sich mit jeder Änderung.
- Kostenvorschau liefert jetzt netto und brutto (`costPreview`). Keine Kostenwirkung (nur Anzeige). Test t47.

## Beispielprojekt als Held-Fall für Präsentationen
«Beispielprojekt laden» (Anleitung) erzeugt jetzt den Fall **«Dorfstrasse mit Bachbrücke»**: 4 Linien (Rohranlage 2×K100 + 3×K55, Brücke als **Luft**, Strecke Ost, Hausanschluss), 5 Schächte mit Muffen, Spleissgrube, 2 Gebäude (EFH/MFH). Die Höhenprofile sind gespeichert (Längenprofil läuft offline); Datensätze entstehen über denselben Weg wie «Übernehmen». Drehbuch: `docs/DEMO_DREHBUCH.md`. Rechenkern unverändert.

## Oberfläche beim Zeichnen wechseln, Fang Hauseinführung
- **Palette** oben in der Karte, solange «Linie zeichnen» aktiv ist: Belag / Wiese / Pflästerung / Rohplanie (Linienstil als Symbol, aktive Oberfläche hervorgehoben); zusätzlich Rechtsklick «Oberfläche ab hier: …». Wirkt **ab dem nächsten gesetzten Punkt**: Die Linie wird am zuletzt gesetzten Punkt geteilt (Knoten ohne Schacht, kein Topologie-Hinweis «Ende/Anfang ohne Schacht»); jede Teilstrecke hat Oberfläche, Graben-Datensatz und Kosten (**Kostenwirkung:** je Teilstrecke ein eigener Datensatz). Pflästerung/Rohplanie wie bisher je Linie. Linienstil/-farbe zeigen die Oberfläche live; der Strang im Längenprofil folgt über die Knoten.
- **Fang Hauseinführung** (Marken «Hauseinführung», «auf Leitung», «Gebäudekante», «Gebäudeecke»): Beim Linienzeichnen rastet das Ende an einer Hauseinführung ein (20 px) und wird verknüpft («Angeschlossen an Linie n»). Beim Setzen rastet die Hauseinführung an Gebäudeecken/-kanten (gezeichnete Flächen und Rechtecke), Leitungen (Fusspunkt/Ende) ein; sie merkt sich die Leitung («Liegt auf Linie n»). Gebäudeumrisse aus der Karte sind nicht als Vektordaten verfügbar – Parzellengrenzen können deshalb nur über gezeichnete Flächen/Rechtecke gefangen werden.
- Test t50; Anleitung (Kapitel Fang) ergänzt.

## Tasten 1–4 für die Oberfläche (V70)
Beim Linienzeichnen wechselt 1 Belag, 2 Wiese, 3 Pflästerung, 4 Rohplanie (gleiche Logik wie die Palette: Teilung am letzten Punkt). Inaktiv in Eingabefeldern und mit Strg/Alt/Cmd. Tastenhinweis `<kbd>` auf den Palettenknöpfen. Keine Kostenwirkung ausser den ohnehin je Abschnitt erzeugten Positionen.

## Verbundenes Verschieben (V72)
- Hauseinführung ziehen: Fang wie beim Setzen (Leitung ◆, Gebäudeecke/-kante ▭, eigene Anschlussleitung ausgenommen) mit Fangmarke; das Ende der angeschlossenen Leitung folgt. Löst sich die Hauseinführung von der Hauptleitung, wird deren T-Verknüpfung (`to`/`from`) aufgehoben.
- Abzweig ohne Schacht (`from`/`to`): Anfangs-/Endpunkt gleitet beim Ziehen entlang der Hauptleitung (der Knoten in der Hauptleitung wandert mit; war er nur ein T-Knoten, entsteht kein zusätzlicher Eckpunkt). Zieht man den Knoten der Hauptleitung, folgt der Abzweig. Gleiches gilt für Teilstrecken (Oberflächenwechsel, `pv`/`nx`).
- Eigenschaften: «Angeschlossen an Linie n» / «Abzweig von Linie n» mit Knopf «Verbindung lösen» (4 Sprachen). Keine Kostenwirkung, ausser dass sich Längen mit der Geometrie ändern.

## Eigenschaften, Pfeilgrösse, Fang, Abzweig-Plausibilität (V73)
- Anklicken, Verschieben oder Ziehen eines Elements öffnet den Reiter «Eigenschaften», klappt die Zeile auf und holt sie ins Sichtfeld.
- Pfeil: Grösse klein/mittel/gross (Spitze und Strichstärke, auch im Plan-Export).
- Beim Zeichnen fängt eine Linie Schächte und Leitungsenden immer (Fangmarke «Schacht»/«Leitungsende», unabhängig vom Punktfang).
- Abzweig ohne Schacht auf bestehender Leitung: Rückfrage «n×K55 entnehmen» (Hauptleitung wird am Knoten geteilt, danach reduzierte Belegung) oder «T-Stück montieren» (Hauptleitung komplett, Abzweig 1 Rohr); «Später entscheiden» erzeugt eine Prüfmeldung. **Kostenwirkung:** Die Teilung erzeugt zwei Graben-/Rohrpositionen mit geänderter Rohrzahl der Hauptleitung (weniger K55 nach dem Abzweig). T-Stück-Set ist im LV vorhanden («Übrige Set T-Stück»), wird aber nicht automatisch gerechnet.
- Prüfungen: 4×K55 oder mehr je Seite in einem KS (rot; Handbuch 2.3.3.3 nennt Brunnenring Ø 80 als zu klein – die Zahl 4 stammt aus der Vorgabe des Anwenders, keine ausdrückliche Handbuchzahl), Rohrbilanz am Schacht (hinein ≠ hinaus), Rohrbilanz am Abzweig, Belegungswechsel ohne Grund, Info «ab hier nur noch …». Neue rote Meldungen und Bilanzfehler erscheinen sofort als Hinweis.

## Speichern-Knopf (V75)
Neben «In Datensätze übernehmen»: «Speichern» (auch Strg+S) sichert die Zeichnung im Zustand (localStorage) und lässt das Fenster offen. Es werden keine Datensätze angelegt (keine Kostenwirkung); das geschieht weiter mit «In Datensätze übernehmen». Gilt für Karte und Plan.

## Fenster verschiebbar, Ebenen/Katalog nur bei Bedarf (V76)
- Desktop (> 860 px): Werkzeuge und Eigenschaften/Auswertung bleiben standardmässig als Spalten angedockt (Karte in der Mitte). Titelleiste (blau) ziehen löst das Fenster und lässt es über der Karte schweben (Karte wird breiter). Tastatur: Pfeiltasten auf dem Titel (Umschalt = 64 px), Enter = andocken/lösen. «–» minimiert auf die Titelleiste, ⇱/⇲ dockt/löst, Ecke unten rechts ändert die Grösse. Anordnung wird gemerkt (`lvd-km-win`), «Fenster zurücksetzen» in der Kopfzeile.
- Ebenen/Katalog (Geokatalog, Plan-Hintergrund, Marker): standardmässig ausgeblendet, erscheint per Knopf «Ebenen» (Fokus auf den Titel), schliesst bei Klick in die Karte oder ✕, ausser mit 📌 angeheftet.
- Handy (≤ 860 px): unverändert gestapelt, keine Titelleisten. Überschriften der Auswertung h4→h3 (axe heading-order).

## Route Adresse → Adresse (V77)
- Werkzeug «Route Adresse → Adresse» (nur Karte): Adressen über swisstopo-SearchServer (Trefferliste), Route über `routing.openstreetmap.de/routed-foot` (OSRM-Fussprofil, schnellster Fussweg). Ergebnis: normale, bearbeitbare Linie (Douglas-Peucker 1.5 m), Kennzeichen `route` mit Hinweis «nur Vorschlag», danach Schachtvorschläge nach Handbuch und Eigenschaften geöffnet.
- **Grenzen (ehrlich):** Fussweg ≠ Grabenverlauf (Querungen, Privatareal, Gehwegseite, Treppen werden nicht geprüft); Route beginnt/endet am nächsten OSM-Weg (Abstände werden gemeldet); öffentlicher Demo-Dienst ohne Zusicherung; ob der Dienst aus der Artefakt-Umgebung bzw. dem Swisscom-Netz erreichbar ist, konnte nicht geprüft werden (Entwicklungsumgebung ohne Zugriff, Test mit simulierten Antworten). Bei Fehler Meldung «Routing-Dienst nicht erreichbar».
- Datenschutz: Start-/Zieladresse und Koordinaten gehen an swisstopo und routing.openstreetmap.de. Keine Kostenwirkung ausser den Positionen der erzeugten Linie (wie eine von Hand gezeichnete).

## Projektbericht (V78)
Hauptseite → «Projektbericht (Druck/PDF) …»: Gliederung wählbar **Nach Abschnitten** (je Element Tabelle mit Summe) oder **Zusammengefasst (Totale)**: Tabelle «Mengen gesamt» (Anzahl Schächte, Werklöcher, Hauseinführungen, Grabenlänge, Aushub total m³, Rohre liefern m) und optional die Zusammenfassung nach Kapitel. Inhalt wählbar (Projektangaben, Lageplan, Mengen, Kosten, Annahmen, Prüfmeldungen). Ausgabe über den Browser-Druckdialog («Als PDF speichern»). Totale werden aus den LV-Positionen nach Positionstext berechnet (Aushub: «Aushub für»/«ausheben» ohne Transport/Deponie/Einbau; Rohre nur «liefern», damit nichts doppelt zählt). Beispielprojekt: Aushub 187.34 m³ (von Hand nachgerechnet), Rohre 1157.6 m. Belagsflächen bewusst nicht als Total (Trag-/Deckschicht würden doppelt zählen). Keine Kostenwirkung, Rechenkern unverändert.

## Mehrfachauswahl, Kopieren, Parallel, Wiederholen (V79)
Bearbeiten-Modus: Umschalt+Klick (auch Strg) ergänzt/entfernt, Umschalt+Aufziehen wählt Objekte, die ganz im Rahmen liegen, Strg+A alle. Auswahlleiste («n gewählt»): Gruppe ziehen verschiebt alles gemeinsam (Linien, Flächen, Notizen, Schächte, Werklöcher, Hauseinführungen, Sondagen), Entf/«Löschen», «Kopieren» (Versatz X Ost / Y Nord in m), «Parallel» (genau eine Linie, Abstand X, Gehrung an Knicken). Kopien: neue IDs, ohne Datensatz-, Schacht-, Abzweig- und Teilungsverknüpfung. Rückgängig war bereits mehrstufig (100 Schritte); neu: Wiederholen (Strg+Y / Strg+Umschalt+Z, Knopf). Hinweis: Eine frühere Aussage von mir, Rückgängig gehe nur einen Schritt, war falsch. Keine Kostenwirkung, bis die Kopien übernommen werden (dann zählen sie wie gezeichnete Objekte).

## Höhenprofil automatisch laden (V80)
Nach Zeichnen, Verschieben oder Ändern lädt das Tool das Höhenprofil (swisstopo `profile.json`) sofort nach dem Loslassen im Hintergrund. Umfang: nur neue oder seit dem Öffnen geänderte Linien (nicht Luft/Bohrung, nicht die Linie, die gerade gezeichnet wird). Fehler: dezenter Hinweis mit «Nochmals», Lagelänge gilt, pro Verlauf kein Dauer-Wiederholen. Schalter «Höhenprofil nach Änderungen automatisch laden» (Auswertung, Standard an, `lvd-km-hzauto`). Kostenwirkung: nur mit eingeschaltetem Schalter «Kosten mit Schräglänge» ändern sich Längen nach dem Laden; sonst unverändert (wie bisher beim Knopf).

## Bearbeitungsart und Rohrblock-Querschnitt (V81)
- **Bearbeitungsart** (Werkzeug «Bearbeiten/verschieben», Umschalter «Was wird bewegt?»): Punkt (Standard), Linie, Einfügen, Löschen, Segment, Teilen; gemerkt (`lvd-km-eop`). Punkt-Art: Griffe bei allen Linien/Flächen, Strich verschiebt nicht (Alt = trotzdem ganz); über Schächten/Werklöchern/Hauseinführungen keine Griffe bei nicht gewählten Linien. Segment verschiebt nur den Abschnitt (beide Eckpunkte, verbundene Punkte folgen). Teilen: Linie → zwei Linien (Knoten ohne Schacht, Kette pv/nx, gleiche Belegung). Mehrfachauswahl verschiebt weiterhin gemeinsam, unabhängig von der Art. Anleitung: `tabindex=0` für den scrollbaren Textbereich (axe).
- **Querschnitt Rohrblock (Graben):** Beton nur im Rohrblock (erfasstes Aussenmass, sonst Platzbedarf aus den Teilblöcken), Rohre liegen vollständig darin (Teilblöcke nebeneinander, Lagen von oben), Bettung unter dem Block, Verfüllung ausserhalb. Ist das erfasste Aussenmass zu klein, zeigt die Zeichnung den nötigen Platzbedarf rot gestrichelt und warnt (Rohre ragen sonst über den Block hinaus). Nur Zeichnung, keine Kostenwirkung; Rechenkern unverändert.

## Linien verbinden, Datensätze bereinigen und neu nummerieren (V82)
- **Verbinden** (Art im Umschalter «Was wird bewegt?», Knopf in der Auswahlleiste bei genau 2 Linien, Angebot nach dem Ziehen eines Linienendes auf ein anderes Ende): Gegenstück zu «Teilen». Lücke bis 5 m wird geschlossen, auch gegenläufige Linien (eine wird umgekehrt), die erste Linie behält Belegung/Oberfläche (Rückfrage bei Unterschied), Schacht dazwischen verhindert das Verbinden; Ketten (pv/nx), Anschlüsse (from/to), Hauseinführung bleiben konsistent. Rückgängig trennt wieder.
- **Löschen und Nummerierung:** Marker/Namen in der Karte sind index-basiert und nummerieren sich sofort neu. Neu beim Übernehmen (Karte und Plan): Datensätze, deren Karten-Objekt gelöscht wurde (Graben, Schacht, Belag, Gebäudeeinführung), werden entfernt – zuvor blieben sie mit Kosten stehen (**Kostenwirkung:** weniger Positionen, die Meldung nennt die Namen, «Rückgängig» holt sie zurück; mindestens ein Datensatz je Reiter bleibt). Vorgegebene Namen («Schacht n», «Leitungsgraben n», «Graben n», «Gebäudeeinführung n», «Belagsarbeiten n») werden in Datensatz-Reihenfolge neu durchnummeriert, eigene Namen bleiben.

Hinweis V82: Routenlinien entstehen immer ohne Verbindung (kein from/to/Schacht); der Hinweis «nur Vorschlag» bleibt in den Eigenschaften ohne Knopf «Verbindung lösen».

## Warnungen rot hinterlegt (V83)
Alle Warnungen werden rot hinterlegt: Warnung = hellrot (#fde3e1) mit dunkelrotem Text (#7f1d1d), Stopp/Fehler = vollrot (#b8332a) mit weissem Text; Info bleibt neutral. Gilt für Prüfmeldungen in der Karte, Warnliste und Statusbox der Hauptseite, Kennzeichen (Tags), Fehlermeldungen (`reqmsg`) und Hinweise mit ⚠/⛔ (rot hinterlegte Toasts, z. B. Höhenprofil nicht ladbar). Kontrast ≥ 4.5:1, axe ohne Verstösse. Nur Darstellung, keine Kostenwirkung.

## Urheberhinweis in der Kartenerfassung (V84)
Die Zeile «App-Konzept und Urheber: Alessandro Cortese · Fachliche Struktur und Ausgestaltung» (4 Sprachen) ist in der Kartenerfassung immer sichtbar: Desktop als feste Zeile am unteren Rand des Fensters, Handy (≤ 860 px) unter dem Titel in der Kopfzeile. Nicht im Ausdruck. Nur Darstellung.

## Offene Positionen sichtbar und erfassbar, Tests reproduzierbar (V85)
- **OFFEN überall ausgewiesen:** Kostentabelle (Hauptseite, alle Ausdrucke inkl. Kurzausdruck, Projektbericht, LV-Spalte) mit Zeile «Nicht im Total: n offene Position(en) ohne Preis – nicht bewertet» unter dem Total; Excel-Kostenblatt mit derselben Zeile (Staffel-Verweise der Formeln entsprechend verschoben); Bericht «Zusammengefasst» mit Zeile «Offene Positionen»; Karte-Fussleiste «n offen (nicht im Total)». Kennzeichen «OFFEN» oben ist anklickbar.
- **Erfassen:** Dialog «Offene Positionen erfassen» (Statusfeld, Kennzeichen, «Preis erfassen» in jeder OFFEN-Zeile): je Element und Position Einheitspreis (CHF je Einheit, «1'250,50» wird zu 1250.50), Bezeichnung, Quelle/Begründung; Betrag live; ungültige Eingabe markiert. Gespeichert im Datensatz `oep` (`"<tk>|<Einheit>": {ep, text, why}`); Feld leeren = wieder offen; Rückgängig über die Meldung.
- **Rechenkern (JS = Python):** `offenErfasst` ersetzt die OFFEN-Zeile durch eine bewertete Zeile (Menge bleibt gerechnet, Schlüssel «—», Flag `erfasst`), zählt ins Total, Warnung `offenErfasst` (amber); freie Positionen ohne Preis ausgenommen. Vollständigkeit wertet `erfasst` wie offen («keine LV-Position»). Fuzz-Test deckt `oep` ab (gültige, leere, ungültige Preise, fremde Schlüssel; 102 von 300 Projekten mit bewerteten Zeilen), 0 Abweichungen. **Kostenwirkung:** nur durch vom Benutzer erfasste Preise; die Kostentabelle weist sie separat aus («darin eigene Preise ausserhalb LV»).
- **MWST-Bezeichnung:** zeigt den tatsächlichen Satz (vorher fix «8.1 %» plus Satz, also doppelt bzw. falsch bei anderem Satz) – Kostentabelle, Honorar, Excel.
- **Tests:** alle Abhängigkeiten im Repo (`tests/lib/k.js`, `tests/fixtures/`) bzw. gepinnt über `tests/package.json` (`npm ci --omit=optional --prefix tests`); Runner `node tests/run.js`; vier veraltete Tests nachgeführt (t12/t29 Ebenen-Fenster, t31 Anschlüsse je Rohr, t48 Release-Schalter `LVD_RELEASE`). Siehe `tests/README.md`.

## Layout A «Planungsfokus» (Branch `layout-a`, Vorschau)
- **Start in der Karte:** ab 861 px öffnet die App direkt die Kartenerfassung (Einstellung `lvd-layout`; Handy und «Klassische Ansicht» starten wie bisher). Knopf «Karte (Planungsfokus)» oben auf der klassischen Seite führt zurück.
- **Oben:** Ansichten Karte · Projekt · Datensätze · Ergebnis · Bericht, Layout-Umschalter (A aktiv, B–D vorbereitet, Klassisch), «Speichern» und «In Datensätze übernehmen»; Projektleiste mit Projekt, Gemeinde, Status, Länge, Aushub, Schächte, Kosten exkl./inkl. MWST und Hinweis auf offene Positionen.
- **Karte:** Ortssuche und Kartenauswahl (Landeskarte, Grau, Luftbild, Parzellen) direkt über der Karte; Werkzeuge links mit Symbolen; Eigenschaften rechts wie bisher.
- **Unten:** Dock mit Reitern Höhenprofil, Ausmass, Kosten, Positionen, Hinweise (einklappbar, Wahl wird gemerkt).
- **Kein Datenverlust:** Wechsel in eine andere Ansicht mit nicht übernommenen Änderungen fragt nach (Übernehmen · Nur Zeichnung sichern · Verwerfen · Abbrechen). Nach «Übernehmen» bleibt man in der Karte.
- **Kosten unverändert:** Kennzahlen und Dock rechnen mit demselben Rechenkern wie das Ergebnis (Test t65: Vorschau = Ergebnis vor und nach dem Übernehmen). Keine Kostenwirkung.

## Projektbericht: Situationskarte entlastet (V87)
- **Vorher:** Karte 760 × 420 im Hochformat, jede Linie mit vollem Text (Name · Länge · Rohranlage · Belag), dazu Schachtnamen, Werkleitungen, Gebäude, Sondagen und Flächen – Texte überdeckten sich.
- **Nachher:** eigene Seite A4 quer; auf der Karte nur Nummern (L1 … für Leitungen, 1 … für Schächte), Beschreibung in einer Tabelle darunter bzw. auf der Folgeseite; nur Leitungen, Schächte und Notizen/Pfeile; Kartenhintergrund abgeschwächt. Der Hintergrund wird beim Öffnen des Berichts im Projekt abgelegt, der Druck wartet höchstens 5 s auf das Bild.
- Bildschirm-Situation und Export unverändert. Keine Kostenwirkung. Test t66.

## Excel: Offertregister mit und ohne Preise (V87)
- **Neu im Excel:** zwei Blätter direkt nach der Kostenübersicht – «Offerte (leer)» und «Offerte (mit Preisen)», druckfertig A4 hoch, Tabellenkopf auf jeder Seite, Fusszeile mit Seitenzahl und Urheber.
- **Inhalt:** alle Projektpositionen mit Mengen (inkl. OFFEN-, eigener und freier Positionen), dazu NPK 111 (Regiearbeiten, 58 Positionen) und NPK 113 (Baustelleneinrichtung, 24 Positionen) vollständig; Positionen ohne Menge sind als «Ansatz» markiert und zählen nicht zum Total.
- **Ausfüllen:** EP-Spalte gelb (Eingabefeld); Betrag = Menge × EP, Kapitelsummen, Zwischensumme, Rabatt-Staffel R151, Installationspauschale R152, Netto, MWST und Total inkl. MWST als Formeln. Kopf mit Feldern für Unternehmer, Gültigkeit, Ort/Datum und Unterschrift.
- **Mit Preisen:** Projektpreise (LV V1.1 bzw. geänderte/eigene Preise). Total entspricht der Kostenübersicht bis auf Rundungsrappen (Excel rechnet Menge × EP je Zeile, das Tool rundet je Element).
- Keine Kostenwirkung im Tool. Test t67 (mit LibreOffice zusätzlich geprüft: leeres Register mit eingetragenen Projektpreisen ergibt denselben Total).

## Qualitätscheck Paket 1 (V89)
- **PDF-Pläne sicherer:** pdf.js ohne Code-Ausführung aus Schriften (CVE-2024-4367).
- **Laden:** Rückfrage bei vorhandenem Projekt, «Rückgängig» nach dem Laden, beschädigte Dateien abgelehnt (vorher: Projekt still ersetzt bzw. geleert).
- **Speicherfehler** auch in der Kartenerfassung sichtbar (vorher: Karte meldete «gespeichert»).
- **Negative Eingaben** markiert (vorher: still 0). Keine Kostenwirkung. Test t68. Details: `docs/QUALITAETSCHECK_2026-11.md`.

## Tausendertrennung und eigene Preise ohne Rabatt (V90) – Kostenwirkung
- **Vorher:** «1'200» wurde als 1 gerechnet (Feld rot, Hinweis falsch); eigene Preise erhielten den LV-Rabatt und konnten die Rabattstufe anheben.
- **Nachher:** «1'200» und «1 200» = 1200 (Tool und Skill). Rabatt, Stufe und Installationspauschale nur auf LV-Positionen; eigene Preise (OFFEN mit eigenem Preis, freie Positionen ausserhalb LV) ohne Rabatt – Kostentabelle zeigt «ohne Rabatt» und «auf LV-Positionen CHF …». Excel-Kostenblatt und Offertregister rechnen mit denselben Formeln.
- **Kostenwirkung:** nur Projekte mit Tausendertrennung in Eingaben bzw. mit eigenen Preisen. Beispielprojekt unverändert. Test t69.

## Schneller bei grossen Projekten, zwei Tabs sicher (V91)
- **Vorher:** bei 200 Datensätzen fror das Tool nach jeder Eingabe ~4 s ein; zwei offene Tabs überschrieben sich gegenseitig still.
- **Nachher:** Ergebnis in ~0.3 s (Annahmen-Tabelle 40× schneller, Ergebnisse identisch); ein zweiter Tab übernimmt Änderungen automatisch oder fragt, wenn dort gerade gearbeitet wird. Keine Kostenwirkung. Test t70.

## Route auch mit Kartenpunkten (V92)
- **Vorher:** Route nur von Adresse zu Adresse; Linie immer ohne Verbindung; ohne Routing-Dienst nur eine Fehlermeldung.
- **Nachher:** je Feld «📍 Karte»: Klick in die Karte (oder Enter = Kartenmitte) setzt Start/Ziel, Fang auf Schacht bzw. Leitungsende (28 px). Adresse und Kartenpunkt mischbar. Die Linie beginnt/endet genau am Kartenpunkt und wird an einen gefangenen Schacht angeschlossen. Findet der Dienst keine Route oder ist er nicht erreichbar: Knopf «Gerade Linie zeichnen». Keine Kostenwirkung (erst «In Datensätze übernehmen» rechnet). Test t71.

## Höhenprofil der aktiven Linie, Mehrfachauswahl, Sprache überall (V93)
- **Höhenprofil:** folgt immer der ausgewählten Linie (Linie anklicken auch ohne Werkzeug, oder Objektliste); fehlende Höhen werden sofort geladen, auch wenn «automatisch laden» aus ist (Fehlschläge werden nicht wiederholt). Umschalt-/Strg-Klick wählt mehrere Linien – aneinandergereiht im Profil («Auswahl: n Linien · m»). Manuelle Wahl im Auswahlfeld bleibt.
- **Sprache im Planungsfokus:** Knöpfe DE FR IT EN in der Kopfzeile; die Karte wird in der neuen Sprache neu aufgebaut, Zeichnung, Ausschnitt und nicht übernommene Änderungen bleiben erhalten. Kopfzeile kompakter (Titel ohne «Planungsfokus», Layout im Umschalter).
- **Vier Sprachen:** Assistent beschriftet sich beim Sprachwechsel neu (Themen übersetzt; Beratungsinhalte aus dem Handbuch bleiben Deutsch mit Hinweis), Urheberzeile, Belagsparameter (IT/EN), Einheiten (St → p/pz/pcs, Pauschal), Rohr-Zubehör, Schacht-Assistent komplett auf Englisch (164 Texte, 55 Bezeichnungen). LV-Positionstexte: EN zeigt weiterhin Deutsch (kein englisches LV).
- Keine Kostenwirkung. Test t72 (prüft auch, dass jeder Text in allen 4 Sprachen vorhanden ist).

## GWR-Gebäudestatus in der Schnellauswahl, DXF-Import von Linien (V94)
- **Vorher:** «GWR: Gebäudestatus» nur über die Katalogsuche; Linien aus CAD/GIS mussten von Hand nachgezeichnet werden.
- **GWR-Chip:** im Geokatalog steht «GWR: Gebäudestatus» als erster Chip neben den Mobilfunk-Stichwörtern; ein Klick blendet die Ebene direkt ein bzw. aus (✓ = eingeblendet).
- **DXF-Import:** Werkzeug «DXF-Linien importieren» (Gruppe Zeichnen). Übernommen werden LINE, LWPOLYLINE und POLYLINE aus ASCII-DXF in LV95 oder LV03 (wird umgerechnet). Zusammenhängende LINE-Stücke derselben Ebene werden zu einem Linienzug verbunden (1 cm Toleranz). Vor dem Import wählt man die Ebenen (Layer); Bögen, Kreise, Texte und Objekte ohne Schweizer Koordinaten werden gezählt und gemeldet, nicht übernommen. Importierte Linien erhalten die aktuelle Rohranlage/Oberfläche und den Hinweis «Aus DXF importiert»; alles mit «Rückgängig» zurücknehmbar. Binäre DXF: Hinweis, als ASCII-DXF zu speichern.
- **Kostenwirkung:** erst nach «Übernehmen» – importierte Linien zählen wie gezeichnete (Länge × Rohranlage/Oberfläche); Rohranlage und Oberfläche je Linie prüfen. Test t73.

## Gemischte Rohre: Lagen im Querschnitt und im Ausmass (V95)
- **Vorher:** Bei einer Linie mit 2×K100 + 2×K55 (Kies/Betonkies) rechnete die Leitungszone nur mit dem Haupttyp (2×K100 in einer Lage, Rohrhöhe 0.12 m). Die Grafik verteilte alle Rohre gemischt.
- **Nachher:** Grösster DN zuunterst, jeder Rohrtyp in eigener Lage (max. 4 je Lage, 4 cm Abstand). Grafik, Leitungszone und Aussenmass verwenden dieselbe Regel (Rechenkern `rohrLagen`, HTML und Skill identisch). Beispiel 2×K100 + 2×K55, Breite 0.60 m: Rohrhöhe 0.228 m statt 0.120 m, Leitungszone 0.33 m statt 0.22 m, Material Leitungszone 0.167 statt 0.109 m³/m (+0.058 m³/m), entsprechend weniger Wiedereinfüllung mit Aushub.
- **Kostenwirkung:** nur Linien mit mehreren Rohrtypen (Kies/Betonkies) – mehr Material Leitungszone, weniger Verfüllung mit Aushubmaterial. Wirkt beim nächsten «Übernehmen» aus der Karte. Ein einzelner Rohrtyp, Rohrblock und Längsverlegung unverändert (Skill-Vergleich 0 Abweichungen, jetzt auch mit gemischten Rohren). Test t74.

## DXF als Hintergrund, Swisscom-Netzauskunft (SIA 405), Bericht A4 hoch (V96)
- **Vorher:** DXF-Import übernahm nur LINE/POLYLINE als kostenwirksame Leitungen; Kreise, Bögen, Texte und Blöcke wurden verworfen (Beispiel: «Nicht übernommen: CIRCLE 47, TEXT 384»). Situationskarte im Bericht auf eigener Querseite – in PDF-Druckern teils gedreht/verzogen.
- **DXF-Hintergrund:** ganze Datei als eigene Ebene ohne Kosten – Linien, Polylinien inkl. Bögen (Bulge), Kreise, Bögen, Ellipsen, Splines, Punkte, Texte/MTEXT (Drehung, Ausrichtung, Ø/°/±) und Blöcke (INSERT mit Massstab/Drehung, auch verschachtelt). LV95 oder LV03 (umgerechnet), Zeichenkodierung UTF-8 oder Windows-1252 automatisch. Sehr grosse Dateien werden vereinfacht (Douglas-Peucker), damit Speichern im Browser möglich bleibt.
- **Layer:** im Importfenster je Layer «anzeigen» und «als Leitung (Kosten)»; danach im Fenster «Ebenen» → «DXF-Hintergrund» ein/aus, «Alle ein/aus», «→ Leitung» je Layer, «Andere DXF laden», «DXF entfernen» (mit Rückgängig). Das Fenster öffnet sich nach dem Import automatisch.
- **Swisscom-Netzauskunft (SIA 405)** wird erkannt (Layerschlüssel SCZ161/162/163 …): Klartext wie «Trasse unterirdisch · < 0.5 m · Lage genau», Darstellung angelehnt an das Swisscom Geo-Portal (Bestand dunkel, Lage ungenau gestrichelt, Schächte blau), Hinweis «Bestand ohne Kosten, Tiefenlagen durch Sondagen ermitteln».
- **Arbeiten am Bestand:** neue Linien fangen Schachtmitten, Netzknoten, Linienpunkte und Bestandslinien. Klick auf eine Bestandslinie zeigt Klartext, Länge und die Belegung laut Plan (z. B. «2 x K100»); bei Übernahme als Leitung werden die Rohre vorbelegt (K55/K100/K120/K150).
- **Gespeichert und gedruckt:** DXF-Hintergrund mit Layerstand im Projekt und in der JSON-Sicherung; sichtbare Layer erscheinen in der Situationskarte des Projektberichts.
- **Bericht:** Situationskarte jetzt auf A4 hoch (alle Seiten hoch), festes Seitenverhältnis – nichts verzogen.
- **Kostenwirkung:** keine durch den Hintergrund; nur Linien, die bewusst «als Leitung» übernommen werden (wie gezeichnete Leitungen nach «Übernehmen»). Tests t73, t66.

## Geo-Portal-PDF automatisch auf der Karte, DXF-Farben (V97)
- **Vorher:** Ein Plan-PDF der Swisscom-Netzauskunft (Geo-Portal) liess sich nur über Passpunkte ausrichten; DXF-Layer ohne Farbe erschienen grau, Farben waren nicht wählbar.
- **PDF automatisch platziert:** Steht im Plankopf eine Zentrumskoordinate (z. B. «Zentrumskoordinate 2759580 / 1191179», LV95 oder LV03) und ein Massstab (1:500), wird der Plan exakt gesetzt: Kartenrahmen wird im Bild erkannt, seine Mitte = Zentrumskoordinate, Massstab aus dem Plankopf, Nord oben. Gilt ohne weitere Bestätigung («Verwerfen» und Passpunkte bleiben möglich). Funktioniert auch, wenn Bezeichnungen und Werte im PDF getrennt stehen. Geprüft mit einer echten Netzauskunft (PDF und DXF desselben Ausschnitts liegen deckungsgleich).
- **Ein Werkzeug für beides:** «DXF/PDF importieren» – DXF wird Hintergrund, PDF/Bild wird Planunterlage; das Fenster «Ebenen» öffnet sich.
- **DXF-Farben:** je Layer Farbwahl im Importfenster und in der Seitenleiste, «Eine Farbe für alle», «Originalfarben». Ist keine Farbe bestimmbar (weder Layer- noch Objektfarbe, kein bekanntes Schema), wird **violett** (#7b2cbf) dargestellt. Farben gelten in Karte und Projektbericht und werden gespeichert.
- Keine Kostenwirkung. Test t75.

## Assistent vollständig in DE/FR/IT/EN (V97)
- **Vorher:** Bedienung und Themen des Assistenten waren übersetzt, die Beratungsinhalte und Wissensantworten (Handbuch-Zusammenfassungen, Projektstand, Projekt-Check) blieben deutsch mit Hinweis «nur Deutsch».
- **Nachher:** alle 24 geführten Beratungen, die Wissensantworten, Projektstand/Zusammenfassung, Projekt-Check, Vorschläge und Rückfragen erscheinen in der gewählten Sprache (rund 500 Textbausteine, Schweizer Fachbegriffe: chambre/pozzetto, desserte/allacciamento, OFAC/UFAC usw.). Fragen dürfen auf Französisch, Italienisch oder Englisch gestellt werden (Glossar auf die deutschen Stichwörter); «retour/indietro/back» und «annuler/annulla/cancel» steuern die Beratung. Sprachwechsel wirkt sofort auf neue Antworten.
- Verbindlich bleibt das Handbuch (deutsch); die Übersetzungen sind Zusammenfassungen. Keine Kostenwirkung. Test t76 (alle Beratungen je zwei Antwortwege, ohne deutsche Reste).

## Passpunkte fein setzen (V98)
- **Vorher:** genau 2 Passpunkte, je ein Klick; danach waren die Punkte weg – keine Korrektur, keine Genauigkeitsangabe, Kartenpunkt ohne Fang.
- **Nachher:** beliebig viele Passpunkte; ab 3 Punkten Ausgleich (Helmert, 4 Parameter, kleinste Quadrate) mit Restabweichung je Punkt und mittlerer Abweichung ±… cm; ab 4 Punkten wird ein Ausreisser erkannt (jeder Punkt gegen den Ausgleich der übrigen) und mit ⚠ markiert. Punkte bleiben sichtbar (Plan rot ▪, Karte grün ●, Verbindungslinie) und lassen sich ziehen oder per Tastatur verschieben (Pfeil = 1 cm, Umschalt+Pfeil = 10 cm, exakt in LV95); E/N je Punkt eintippen (LV03 wird umgerechnet); Kartenpunkt fängt DXF-Punkte, Schacht-/Knotenmitten und Linien; Klick auf einen Marker setzt den Punkt trotzdem. Nach 2 Punkten ist die Ausrichtung fertig (wie bisher); «Passpunkt hinzufügen» verfeinert mit weiteren Punkten bis «Fertig». «Passpunkte setzen» beginnt eine neue Ausrichtung (bisherige Punkte mit Rückgängig). «Alle Passpunkte löschen» (mit Rückgängig). Passpunkte werden mit dem Projekt gespeichert und lassen sich später weiter verfeinern.
- Keine Kostenwirkung (nur Lage der Planunterlage; übertragene Plan-Objekte erst nach «Plan-Objekte übertragen»). Test t77.

## Engineering-Arbeitsplatz: dunkles Thema, Statuszeile, Explorer (V99, Redesign Phase D/E)
- **Vorher:** Arbeitsplatz hell; auf 1440×900 nur ~302 px Kartenhöhe (Hilfetext, Masshinweis, zwei Knopfzeilen, Urheberzeile); kein Projektbaum; Dock fest.
- **Nachher:** dunkles Engineering-Design aus den bestehenden Farben (Petrol bleibt Akzent; umschaltbar ☀/☾), eine CAD-Statuszeile mit Befehlszeile und Menü «Ansicht», Dock-Höhe ziehbar, Kostenleiste mit Rabattstufe/Honorar/Hinweisen, Projektexplorer (Suche, Auswahl synchron mit Karte und Eigenschaften), Kürzel Strg+J/B/F. Karte 886×503 px. Details: `docs/NIUCOST_REDESIGN.md`.
- **Kostenwirkung:** keine – Regressions-Referenz (64 Projekte, 2732 Positionen) identisch (Test t78). Tests t79, t65.

## Dock-Tabellen: Positionen und Kosten (V100, Redesign Phase F)
- **Vorher:** Dock «Positionen» als feste Liste ohne Suche, Filter oder Sortierung; Prüfstatus nur auf der Ergebnisseite (offen → geprüft → klären); Dock «Kosten» nur mit der Kostenübersicht.
- **Nachher:** Positionstabelle mit Suche, Status- und Kapitelfilter, Sortierung je Spalte, ziehbaren Spaltenbreiten und Prüfstatus direkt in der Zeile; neuer Status **«In Prüfung»** (auch auf der Ergebnisseite; Zyklus offen → In Prüfung → geprüft → klären). Kosten-Reiter mit Kosten je Kapitel, je Abschnitt und Top 10 (Klick springt zur Position).
- **Kostenwirkung:** keine (Filter, Sortierung und Prüfstatus ändern die Rechnung nicht; t78 identisch). Hinweis: Auf der Ergebnisseite braucht «Geprüft» jetzt zwei Klicks statt einem. Tests t80, t35.

## Bedienmodi und Befehlsleiste (V101, Redesign Phase G)
- **Vorher:** ein einziger Umfang für alle; Werkzeuge, Ansichten und Positionen nur über ihre Knöpfe auffindbar; Layout-Umschalter in der Kopfleiste.
- **Nachher:** Bedienmodus Einfach / Standard / Experte (gemerkt pro Gerät, nicht im Projekt). **Strg+K** öffnet eine Befehlsleiste, die Werkzeuge, Ansichten, Befehle, Kartenobjekte und LV-Positionen durchsucht; im Modus Einfach ausgeblendete Werkzeuge bleiben dort erreichbar. Layout-Umschalter im Menü «Ansicht».
- **Kostenwirkung:** keine (t78 identisch). Tests t81, t65.

## Handy und Tablet: Arbeitsplatz mit Bottom Sheets (V102, Redesign Phase H)
- **Vorher:** Handy startete auf der klassischen Seite; die Karte war dort eine lange Scrollseite (665 px breit auf 390 px, Bereiche untereinander).
- **Nachher:** Arbeitsplatz auch auf dem Handy: Karte vollflächig, Menü ☰ oben, Bereichsleiste unten (Werkzeuge, Ebenen, Eigenschaften, Auswertung, Mehr) mit Bottom Sheets (½/voll), Kosten netto immer sichtbar, Befehlsleiste über ⌕. 320–860 px ohne Überlauf, Zielgrössen ≥ 44 px. Die klassische Seite bleibt über «Ansicht › Layout» wählbar.
- **Kostenwirkung:** keine (t78 identisch). Tests t82, t65.

## Schmale Bildschirme: unterer Bereich startet eingeklappt (V104)
- **Vorher:** bei 1024×768 Karte nur 506×276 px (18 % der Fläche), weil Werkzeuge, Eigenschaften und unterer Bereich gleichzeitig offen waren.
- **Nachher:** zwischen 861 und 1100 px startet der untere Bereich eingeklappt; Reiter bleiben sichtbar, ein Klick (oder Strg+J) öffnet. Die eigene Wahl wird für schmale Bildschirme getrennt gemerkt; breite Bildschirme und Handy unverändert. Karte 506×496 px (32 %).
- **Kostenwirkung:** keine. Test t84.

## Kartenquelle «Luftbild + Strassen» (V105)
- **Vorher:** vier Kartenquellen (Landeskarte, Grau, Luftbild, Parzellen); im Luftbild keine Strassennamen.
- **Nachher:** fünfte Quelle «Luftbild + Strassen» = swisstopo SWISSIMAGE mit dem amtlichen Strassenverzeichnis (`ch.swisstopo.amtliches-strassenverzeichnis`: Strassenachsen und -namen) als Deckschicht. Gilt für Karte, Druck/Bericht-Hintergrund (eine WMS-Abfrage mit beiden Ebenen), Link zu map.geo.admin, Menü «Kartenquelle» und Exportdialog; Wahl gemerkt und im Projekt gespeichert. 4 Sprachen.
- **Hinweis:** Der Kartendienst ist aus der Arbeitsumgebung nicht erreichbar; geprüft ist, dass die richtigen Ebenen angefragt werden. Die Strassennamen zeigt swisstopo erst in grösseren Massstäben. Der beschriftete Luftbild-Hintergrund von map.geo.admin.ch selbst ist ein Vektor-Kartenstil und lässt sich ohne zusätzliche Bibliothek nicht 1:1 übernehmen.
- **Kostenwirkung:** keine. Test t85.

## Parzellen: ein Bild mit Rand statt Kacheln (V108)
- **Verlauf:** V105 und früher luden nach jedem Zoomen/Verschieben ein neues Gesamtbild (Parzellenlinien «sprangen»). V106/V107 versuchten Kacheln – der Dienst «cadastralwebmap» (weitergereichter Dienst) liefert kleine Kacheln aber gegeneinander verschoben (Screenshot 07.11.2026: Kachelinhalte passen an den Nähten nicht zusammen). Kacheln sind damit nicht brauchbar und wurden wieder entfernt.
- **Nachher:** wieder ein zusammenhängendes Bild, aber mit 50 % Rand rundum. Es wird nur neu geladen, wenn die Zoomstufe wechselt oder der Ausschnitt den geladenen Bereich verlässt. Verschieben innerhalb des Randes lässt die Parzellen unverändert (kein Springen, kein leerer Rand beim Ziehen). Bildgrösse auf 2600 px begrenzt. Lage Bild ↔ Karte exakt (≤ 1 px) bei Bildschirmskalierung 100/125/150/200 %; bei wiederholten Fehlern Wechsel auf WMTS wie bisher.
- **Offen:** Beim Zoomen lädt der Dienst weiterhin ein neues Bild; zeichnet er dabei Linien leicht anders (Massstabs-Generalisierung des Dienstes), bleibt das ein Dienst-Effekt. Der echte Dienst ist aus der Arbeitsumgebung nicht erreichbar.
- **Kostenwirkung:** keine. Test t86.
