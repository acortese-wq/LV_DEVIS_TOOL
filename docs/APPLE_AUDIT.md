# NIUcost – Audit nach «Apple Design» (acht Prinzipien) · Stand 12.11.2026

Grundlage: `skills/apple-design/SKILL.md` (Quelle: emilkowalski/skills, siehe `skills/apple-design/QUELLE.md`). Bewertung: ● gut · ◐ teilweise · ○ offen. Konzept und Urheber: Alessandro Cortese.

| # | Prinzip | Stand | Befund und Massnahme |
|---|---|---|---|
| 1 | **Zweck** | ● | Klarer Auftrag (Kostenvoranschlag Tiefbau nach LV). Der Modus «Einfach» blendet Werkzeuge aus; alles bleibt über Strg+K erreichbar. Kein Handlungsbedarf. |
| 2 | **Handlungsfreiheit** (Vergebung, Rückgängig) | ● (V125) | Löschen, Kopieren, Einfügen, Übernehmen und Preis speichern haben «Rückgängig». **Fund:** «Neues Projekt» fragte per Bestätigungsdialog. **Behoben:** kein Dialog mehr, stattdessen «Rückgängig» stellt das ganze Projekt wieder her (Test t108). Bestätigungsdialoge bleiben nur beim Laden/Demo (überschreibt Eingaben ohne Sicherung) und beim Verbinden von Leitungen mit unterschiedlichem Aufbau. |
| 3 | **Verantwortung** (Datenschutz, Sicherheit) | ◐ | Projekt und Preise bleiben im Browser (localStorage); Kartenabfragen gehen an geo.admin.ch (Ausschnitt, kein Projektinhalt). Offene Positionen: Preisvorschläge sind als «Schätzung» mit Sicherheitsstufe gekennzeichnet, nichts wird automatisch gerechnet. **Offen:** der öffentliche Stand (GitHub Pages) enthält LV-Preise, siehe `docs/SCHUTZ_UND_WEITERGABE.md` (Entscheid beim Benutzer). |
| 4 | **Vertrautheit** | ● | CAD-Muster: Ribbon, Projektbaum mit Rechtsklick, Befehlszeile, Wiederholen (Enter), Fenster-/Kreuzauswahl, Stützpunkt-Menü. Konsistente Positionen (Schliessen oben links, Reiter unten). |
| 5 | **Flexibilität** | ◐ | Hell/Dunkel, drei Bedienmodi, 4 Sprachen, Handy/Tablet mit Sheets, Tastatur. **Offen (bewusst):** Mitwachsen mit der Browser-Textgrösse (rem statt px) – wegen hohem Layoutrisiko nicht umgesetzt; Browser-Zoom funktioniert. |
| 6 | **Einfachheit** | ◐ | Häufiger Weg zuerst: geführtes Einpassen (4 Schritte), Preisvorschlag mit Vorbelegung, Schnellzugriff in den Eigenschaften. **Offen:** Das Ribbon hat viele Register; im Modus «Einfach» zeigt es nur die Grundbefehle. |
| 7 | **Handwerk** (Detailpflege) | ● (V124/V125) | Reaktion beim Drücken (97 %), Federkurven, unterbrechbare Federn für Dock und Panels mit Gummiband und Schwung, Material mit Tiefe (Menüs, Panels, Leisten), Tracking nach Schriftgrösse, Tabellenziffern, weicher Themawechsel, räumliche Herkunft der Menüs. «Bewegung/Transparenz reduzieren» und «Kontrast erhöhen» werden beachtet. |
| 8 | **Freude** | ● | Ruhige Gesten, ohne Ton und Haptik (Entscheid des Benutzers). |

## Taktische Regeln des Skills
- **Rückmeldung in vier Arten** (Status, Abschluss, Warnung, Fehler): vorhanden – Statuszeile, Toasts mit «Rückgängig», Hinweisliste mit Stufen, Eingabefehler direkt am Feld (`aria-invalid`). 
- **Wegfindung:** Kopfleiste (wo bin ich), Reiter/Ribbon (wohin), Schrittleiste beim Einpassen (wie weiter), Schliessen/Esc überall.
- **Gruppierung und Zuordnung:** Preisfeld direkt neben Menge und Vorschlag in «Offene Positionen»; Eigenschaften zeigen nur das gewählte Element offen.
- **Direkte, spezifische Beschriftungen:** «Offene Positionen», «Auf Bestand zoomen», «Hausecke im PDF» statt allgemeiner Sammelbegriffe.

## Bewusst nicht übernommen
Wischgesten der Handy-Sheets (nicht gewünscht), Haptik/Ton (nicht gewünscht), rem-Skalierung (Risiko), Systemschrift-Wechsel (nicht gewählt).
