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
