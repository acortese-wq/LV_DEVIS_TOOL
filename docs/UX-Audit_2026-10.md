# UX-Audit LV-Devis Tiefbau – Oktober 2026 (vorher / nachher)

App-Konzept und Urheber: Alessandro Cortese. Prüfung mit Chromium (Desktop 1440 px, Mobil 390 px), axe-core 4 (WCAG 2.1 A/AA + Best Practice), Tastaturtest, Kontrastberechnung, Lasttest mit 32 Elementen. Rechenkern unverändert (Skill-Test: 300 Zufallsprojekte, 0 Abweichungen).

## Messwerte

| Kennzahl | Vorher | Nachher |
|---|---|---|
| WCAG-Verstösse (axe-core) | 5 Regeln, 50 Stellen (1 kritisch, 32 Kontrast) | **0** |
| Weg zum Total (Desktop, kleines Projekt) | ganz unten, ca. 7 000 px scrollen | **sofort sichtbar**, bleibt beim Scrollen stehen |
| Länge Ergebnisspalte, 32 Elemente | 127 464 px | **11 550 px** (−91 %) |
| Tab-Stopps für die Reiterleiste | 10 | **1** (danach Pfeiltasten) |
| Höhe Reiterleiste mobil | 4 Zeilen, ca. 190 px | **1 Zeile, 58 px**, wischbar |
| Kontrast Grauschrift auf Hellgrau | 4.31 : 1 (ungenügend) | **5.86 : 1** |
| Checkboxen | 13 × 13 px | **18 × 18 px**, Text anklickbar |

## Umgesetzt

| # | Bereich | Vorher | Nachher |
|---|---|---|---|
| 1 | Ergebnis | Netto/Total nur ganz unten | Kostenleiste oben: Netto, Total, Honorar, Rabattstufe, OFFEN, Warnungen; bleibt beim Scrollen sichtbar |
| 2 | Ergebnis | Drucken/Excel/Sichern/Laden unter allen Positionen | Direkt unter der Kostenleiste |
| 3 | Ergebnis | Alle Elemente und die Kapitel-Zusammenfassung aufgeklappt | Nur der bearbeitete Datensatz offen, Rest eingeklappt; «Alle ausklappen» bleibt |
| 4 | Warnungen | Text ohne Bezug, Sprung nur über «bearbeiten» | Element-Name ist ein Link zum Datensatz; «alle Hinweise anzeigen (n)»; kritische/gelbe Zähler in der Kostenleiste |
| 5 | Leerer Zustand | «Noch keine Positionen» | Zusätzlich Anleitung, wo man beginnt |
| 6 | Eingabe | «1'200» oder «12abc» wurde still als 1 bzw. 12 gerechnet | Feld rot, Meldung «Bitte eine Zahl eingeben …», für Screenreader als ungültig markiert |
| 7 | Speichern | Autospeichern unsichtbar | «✓ Automatisch gespeichert um hh:mm – nur in diesem Browser …»; Warnung, falls Speichern scheitert |
| 8 | Kopf | 11 Projektfelder immer offen, Formular rutscht nach unten | «Projektangaben» einklappbar mit Kurzzeile (Projekt · SAP · Ort), Zustand wird gemerkt; im Druck immer vollständig |
| 9 | Kopf | Rolle ohne Rahmen, anders als übrige Felder | Gleiche Gestaltung wie die anderen Felder |
| 10 | Mobil | Total nur nach langem Scrollen | Fixe Leiste unten: Netto + «Ergebnis ↓», kritische Punkte markiert |
| 11 | Mobil | Reiter in 4 Zeilen | Eine wischbare Zeile, aktiver Reiter wird eingeblendet |
| 12 | Kontrast | Grauschrift 4.3 : 1 (32 Stellen) | 5.9 : 1, ohne Änderung der Farbwelt |
| 13 | Klickziele | Checkboxen 13 px, Teilphasen nur über das Kästchen | 18 px, Teilphasen-Nummer und -Text anklickbar |
| 14 | Datensatz | Pfeile hellgrau, Screenreader liest «◀» | Navyblau, grösser, «Vorheriger/Nächster Datensatz» |
| 15 | Tastatur | Jeder Reiter ein Tab-Stopp | WAI-ARIA-Reiter: Pfeiltasten, Pos1/Ende, Panel verknüpft |
| 16 | Tastatur | Kein Sprunglink | «Zum Kostenvoranschlag springen» als erster Tab-Stopp |
| 17 | Fokus | Links/Aufklapper mit dünnem Browser-Rahmen | Einheitlicher 2-px-Fokusrahmen |
| 18 | Struktur | Kein Hauptbereich, Überschriften h2 → h4 | `main`, Navigation als Landmark, Abschnitte h3 |
| 19 | Formular | Feld «B [CHF]» im Honorar ohne Beschriftung (kritisch) | Beschriftet, schreibgeschützt statt deaktiviert (lesbar, kopierbar) |
| 20 | Zeichnungen | Vergrösserung nur per Klick schliessbar | Schliessen-Knopf, Escape, Fokus kehrt zurück |
| 21 | Bewegung | – | Animationen aus bei «Bewegung reduzieren» |
| 22 | Rechenweg | Unter jeder Position «ƒ 2.9 × 2.4 = 6.96 m²», Massenbilanz immer offen | Ausgeblendet; Schalter «Rechenweg anzeigen» blendet beides ein (Bildschirm und Druck), Einstellung wird gemerkt. Excel enthält den Rechenweg weiterhin |
| 23 | Auswahlfelder | Dropdowns: Optionen erst nach Aufklappen sichtbar, lange Texte abgeschnitten | Entscheidungsfelder als Kacheln mit Kurztext (Einbauort, Schachttyp, Modus, Belag, Rohrsystem, Breitenregel, Handaushub, Verfüllung, Belagsklasse, Wiederinstandstellung …), kurze Werte (DN, Länge, Arbeitsraum, Dicken) als Knopfreihe; nur die Abdeckungsliste (21 Positionen) bleibt Dropdown |
| 24 | Schachttyp | Zulässigkeit erst nach Auswahl als Warnung | Jede Typ-Kachel zeigt für den gewählten Einbauort «✓ Standard», «prüfen», «kein Standardmass» oder «nicht zulässig» |
| 25 | Schacht (Zusatzleistungen) | 12 Eingabefelder ohne verknüpfte Beschriftung, Überschrift h5 nach h3 | Beschriftungen verknüpft, Überschriftenebene korrigiert |
| 26 | Graben-Grafik | Eigene Breitenregel: ohne Aussenmass «b = 0.40 m», gerechnet wurde 0.60 m | Grafik nutzt die Breitenregel des Rechenkerns; ohne Aussenmass «b = 0.6 m – Aussenmass fehlt», Feld gelb mit Erklärung der Regel |
| 27 | Rohrblock | Block nur als graues Rechteck im Graben | Zusätzlicher Querschnitt: Teilblöcke mit Rohren je Lage, DN, Aussenmass b × h, Hinweis «im LV / OFFEN», Platzbedarf und Warnung «Aussenmass zu klein?» |
| 28 | Rohranlage | Statische Übersicht der Bauteile | Live-Darstellung der erfassten Mengen: Rohre als Balken (Länge proportional), Muffen, Bogen, Rohrschnitte, Warnband, Erdband, Schnur, Kalibrieren |

## Nicht umgesetzt – Empfehlungen

| Thema | Empfehlung | Aufwand |
|---|---|---|
| Nutzertests | 3–5 Bauleiter/BHV je 20 Min. mit echtem Projekt beobachten | klein |
| Löschen | «Rückgängig» statt Bestätigungsdialog | mittel |
| Datenhaltung | Autospeichern ist pro Browser; Ablage im Projektordner (SharePoint/Teams) oder zentral | strategisch |
| Pflichtfelder | Je Reiter Mindestangaben markieren (z. B. Graben: Länge) | klein |
| Rechenzeit | «Annahmen mit Kostenwirkung» erst auf Klick berechnen (Lasttest: ~0.3 s pro Eingabe bei 32 Elementen) | klein |
| Screenreader | Test mit JAWS/NVDA durch Barrierefreiheitsteam | klein |
| Offerte-Abgleich | Unternehmer-Offerte importieren und gegen Devis prüfen (OffertIQ-Anbindung) | strategisch |
