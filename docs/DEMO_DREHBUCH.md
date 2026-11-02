# Drehbuch: Live-Präsentation LV-Devis Tiefbau (10 Minuten, am Bildschirm)

**Kernbotschaft:** «Vom Kartenklick zum Kostenvoranschlag in Minuten – nachvollziehbar nach LV und Handbuch.»
**Held-Fall:** «Dorfstrasse mit Bachbrücke» – im Tool als **Beispielprojekt** hinterlegt (keine echten Projektdaten; Höhenprofile gespeichert, läuft ohne Internet).
**Urheber/Auftritt:** Alessandro Cortese, Bauherrenvertreter Tiefbau, 30 Jahre Praxis – «Ich habe das gebaut, was mir im Alltag fehlte.»

## Vorbereitung (am Vortag und 10 Min. vorher)
1. Chrome/Edge, **Vollbild (F11)**, **Browser-Zoom 125 %** (Strg +), Pop-ups erlaubt, Bildschirmschoner/Benachrichtigungen aus.
2. **Eigenes Projekt sichern** (Sichern → JSON), dann **Anleitung → «Beispielprojekt laden»**.
3. **Internet testen:** Karte öffnen (Karten laden aus dem Internet; ohne Netz bleibt nur die Hauptseite und die Beispielzeichnung ohne Hintergrundkarte). **Backup:** 4–5 Screenshots der Schritte 3–7 bereit halten.
4. Assistent-Fenster geschlossen, Karte einmal vorher geöffnet (Kacheln gecacht), Auswertung/Profil-Reiter schon einmal angeklickt.
5. Zahlen vorbereiten: **«Früher X Min. – jetzt Y Min.»** an einem echten Fall selbst messen (nicht schätzen).
6. Vertraulichkeit: nur das Beispielprojekt zeigen; LV mit Preisen sind Swisscom-Unterlagen – vorher klären, wer sie sehen darf.

## Ablauf mit Minutenplan
| Zeit | Szene | Was du tust | Was du sagst |
|---|---|---|---|
| 0:00 | **Problem** (ohne Bildschirm) | – | «Längen aus Plänen abgreifen, Anschlüsse zählen, Nachträge nachrechnen – wer kennt das? Dauert Stunden und niemand kann es danach nachprüfen.» |
| 1:00 | **Ergebnis** | Hauptseite zeigen: Netto **CHF 78'270**, Rechenweg ƒ aufklappen | «Das ist aus **vier Linien auf der Karte** entstanden. Jede Position mit Rechenweg und LV-Nummer.» |
| 2:00 | **Karte** | «Karte» öffnen; auf Fussleiste und rechts oben zeigen | «Kosten laufen **live mit**, vor der Gesamtlänge. Zusammenfassung immer sichtbar.» |
| 3:00 | **Aha 1 – Abzweig** | Linie zeichnen, **Start ab Linie** (Linienfang), **Rechtwinklig** | «Ein Hausanschluss rechtwinklig ab der Hauptleitung – der Fang macht das.» Kosten in der Fussleiste springen. |
| 4:30 | **Aha 2 – Schacht auf Linie** | «Schacht setzen» mitten auf Linie 3 | «Die Linie teilt sich, **hinein/hinaus** und die Anschlüsse DN 80/150 werden **automatisch gezählt**.» Rückgängig zeigen. |
| 5:30 | **Aha 3 – Brücke im Profil** | «Längenprofil» einschalten, Linie 2 (Luft) zeigen, Schacht ziehen | «Das Gelände fällt in den Bach – die Leitung hängt an der Brücke. **Luft wird nicht als Graben gerechnet** und separat ausgewiesen.» Auswertung: «davon nicht im Graben 50 m». |
| 7:00 | **Aha 4 – Prüfung nach Handbuch** | Auswertung → Prüfung; Vorschläge: Basis Cu, in Bauzone → «Vorschläge berechnen» | «Das Tool kennt das Swisscom-Handbuch: Schachtabstände, Biegeradien, Schachttypen.» |
| 8:00 | **Aha 5 – Assistent** | Knopf «Assistent» → «wer zahlt» (Kostenteiler) → 3 Klicks | «Geführte Beratung mit Quelle. **Ohne KI, nichts verlässt den PC.**» |
| 9:00 | **Abschluss** | Hauptseite: Druck (kompakt), Excel, Sichern; **F1** | «Kompakt gedruckt, nach Excel, als JSON gesichert. Und die Anleitung ist im Tool.» |
| 9:30 | **Auftrag** | – | «Ich suche ein **Pilotprojekt** / Feedback / Freigabe für …» (konkret benennen) |

## Mögliche Fragen
- **Wie genau sind die Kosten?** Berechnet nach LV V1.1 mit Rechenweg ƒ; die Vorschau in der Karte ist «ohne Gewähr», massgebend ist das Ergebnis auf der Hauptseite.
- **Woher die Preise?** Aus dem eingebauten LV Swisscom (V1.1, 10.07.2026); das Tool schätzt keine Preise.
- **Ist das KI?** Nein, regelbasiert; Handbuch- und LV-Wissen ist hinterlegt, es werden keine Daten gesendet.
- **Datenschutz?** Das Projekt liegt im Browser und in JSON-Sicherungen, nicht auf einem Server; Internet nur für Karten und Höhenprofil.
- **Was ändert Kosten?** Übernehmen (Längen/Anzahlen), automatische Anschlüsse, Schräglänge nur mit Schalter, Luft/Bohrung nicht als Graben – das Tool meldet es jeweils.
- **Wer pflegt es / Weitergabe?** Personalisierte, befristete Weitergabe-Versionen (`build.py --release`), siehe `docs/SCHUTZ_UND_WEITERGABE.md`.

## Wenn etwas schiefgeht
- **Kein Internet:** Hauptseite + Ergebnis + Längenprofil (gespeichert) + Assistent + Anleitung laufen weiter; Karte: Screenshots zeigen.
- **Demo «verdorben»:** Anleitung → «Beispielprojekt laden» (stellt den Ausgangszustand her), danach «Karte».
- **Zu klein auf dem Beamer:** Strg + / Strg – (Zoom), Fussleiste und rechtes Panel bleiben bedienbar.
