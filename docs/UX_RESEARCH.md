# UX-Recherche und Umsetzung: Karten-/Plan-Messung (Oktober 2026)

App-Konzept und Urheber: Alessandro Cortese. Recherche (Web) zu Messwerkzeugen auf Webkarten, Mengenermittlung (Takeoff) auf Plänen und Barrierefreiheit von Karten. Die Quellen liefern überwiegend Hilfeseiten und Herstellervergleiche, keine Nutzerstudien. Die Ableitungen sind daher Praxis-Muster, keine gemessenen Wirksamkeiten.

## Gefundene Muster und was daraus umgesetzt wurde

| Muster (Quelle) | Umsetzung im Tool |
|---|---|
| **Live-Messung beim Zeichnen**: laufende Teilstrecke und Total am Zeiger ([ArcGIS](https://resources.arcgis.com/en/help/main/10.2/01w1/01w100000064000000.htm), [Kitchener Measure Tool](https://maps.kitchener.ca/OnPointExternal/WebHelpRMap/OnPoint_web_user_guide/Using_the_Measure_Tool.html)) | Tooltip am Mauszeiger: «Strecke x m · Total y m», bei Flächen «Fläche · Umfang» |
| **Klare Abschluss-Geste** (Doppelklick / Rechtsklick / Knopf) | Doppelklick, Knopf «Linie beenden», Umschalt+Enter, Esc |
| **Messen ohne Speichern**, dann explizit löschen | Neues Werkzeug «Lineal (nur messen)»; Ergebnis bleibt bis zum nächsten Messen oder «Alles löschen» |
| **Massstab ist der wichtigste Schritt**; automatisch aus Plankopf lesen, sonst bekannte Strecke anklicken ([Projul](https://projul.com/blog/construction-takeoff-software), [Gitnux](https://gitnux.org/best/construction-measurement-software/)) | Auto-Massstab aus Plantext/Dateiname, manuelle Kalibrierung, Prüf-Lineal, «nicht kalibriert»-Hinweis, Übernahme gesperrt ohne Kalibrierung |
| **Hinweis zur Messgrundlage** (Projektion/Krümmung, [ArcGIS](https://resources.arcgis.com/en/help/main/10.2/01w1/01w100000064000000.htm)) | Dauerhafter Hinweis: «Längen in der LV95-Ebene (horizontal, ohne Gefälle)» bzw. «Pixel × Massstab» |
| **Tastaturäquivalent für Zeichnen** (WCAG 2.1.3 / Praxis, [BOIA](https://www.boia.org/blog/interactive-maps-and-accessibility-4-tips), [Disability World](https://www.disabilityworld.org/toolkit/standards/wcag/2-1-3-keyboard-no-exception/)) | Karte fokussierbar; Enter/Leertaste = Punkt in Kartenmitte, Umschalt+Enter = beenden, Esc, Entf, Strg+Z, Pfeil-Knöpfe pro Objekt |
| **Zielgrössen ≥ 24 px** (WCAG 2.5.8) | Eckpunkt-/Mittelpunkt-Griffe 24 × 24 px (Punkt 14 px innen) |
| **Werkzeuge nach Aufgabe gruppieren** (Messen, Beschriften, Bearbeiten, Ansicht) statt flacher Knopfreihen | Vier beschriftete Werkzeuggruppen statt drei undifferenzierter Leisten |
| **Progressive Disclosure** | Situation auf dem Bildschirm eingeklappt (Zeile mit Zusammenfassung, Zustand gemerkt), im Ausdruck immer enthalten; Geokatalog, Plan-Hintergrund und Kurzanleitung einklappbar |
| **Schrittweises Rückgängig, Hinweis mit Rückgängig statt Rückfrage** | Undo je Eckpunkt; Meldungen mit «Rückgängig» |

## Bewusst nicht übernommen
- **Freihandzeichnen / KI-Erkennung** (Takeoff-Tools): nicht nötig für Leitungsbau, würde Messgenauigkeit unklar machen.
- **Mehrere Einheiten** (km, ha, ft): Schweizer Tiefbau arbeitet mit m, m², m³.

## Geprüft
Automatisierte Browserprüfungen (Werkzeuggruppen, Live-Tooltip, Lineal ohne Speicherung, Tastaturbedienung, Griffgrösse, Esc-Verhalten, Situation eingeklappt/gemerkt/im Druck sichtbar, axe-core). Nicht geprüft: Nutzertests mit Anwendern, Screenreader-Praxis, echte swisstopo-Dienste.
