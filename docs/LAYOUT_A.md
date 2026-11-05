# Layout A «Planungsfokus» – Bestandsaufnahme und Entscheide

Branch `layout-a` · App-Konzept und Urheber: **Alessandro Cortese**

## Bestand (V85)
- Hauptseite (`src/app.js`): Projektangaben, Reiter je Bauteil (Datensätze), Ergebnis rechts (Status, Aufstellung, Kosten), Bericht/Excel/Druck.
- Kartenerfassung (`src/karte.js`, `KARTE.open`): Vollbild-Arbeitsfläche mit Werkzeugen links (Gruppen), Ebenen/Katalog (bei Bedarf), Karte, Eigenschaften/Auswertung rechts, Fussleiste (Fang, Massstab, Kartenquelle, Kosten, «Nur speichern», «In Datensätze übernehmen»), Höhenprofil unter der Karte.
- Die Karte arbeitet auf einer Kopie (`M`). Erst «Übernehmen» schreibt in die Datensätze; Kostenvorschau rechnet in einer Sandkopie (`costPreview`).

## Layout A – was neu ist
| Bereich | Umsetzung |
|---|---|
| Startbildschirm | Ab 861 px Breite öffnet die App direkt die Kartenerfassung im Layout A (Einstellung `lvd-layout`, Standard «a»). Schmale Bildschirme: klassische Seite. |
| Oben | App-Leiste (Titel, Ansichten Projekt/Datensätze/Ergebnis/Bericht, Layout-Umschalter) und Projektleiste: Projekt, Gemeinde, Status, Länge, Aushub, Schächte, Kosten exkl./inkl. MWST (live aus der Sandkopie). |
| Links | bestehende Werkzeuggruppen (Auswahl, Zeichnen, Notizen, Messen). |
| Rechts | bestehende kontextabhängige Eigenschaften/Auswertung. |
| Unten | Dock mit Reitern Höhenprofil, Ausmass, Kosten, Positionen, Hinweise (einklappbar). |
| Umschalter | A aktiv, B–D sichtbar aber deaktiviert («folgt»), «Klassische Ansicht». |

## Entscheide
- **Keine automatische Übernahme.** Wechsel in eine andere Ansicht mit nicht übernommenen Änderungen fragt: Übernehmen · Nur Zeichnung sichern · Verwerfen · Abbrechen. So geht nichts verloren und nichts wird ungewollt in die Datensätze geschrieben.
- Nach «In Datensätze übernehmen» bleibt man im Layout A (Karte wird neu geöffnet).
- Rechenkern unverändert: Kennzahlen und Dock verwenden `KVE.calc` auf der Sandkopie – dieselben Zahlen wie das Ergebnis nach dem Übernehmen.
- Bestehende Tests starten weiterhin auf der klassischen Seite (Testhilfe setzt `lvd-layout=classic`); `t65` prüft Layout A.
