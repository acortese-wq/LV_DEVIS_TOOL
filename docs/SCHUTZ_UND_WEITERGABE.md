# Schutz und Weitergabe – LV-Devis Tiefbau

**Ehrlich vorab:** Ein Tool, das im Browser läuft, kann nicht diebstahlsicher gemacht werden – was der Browser ausführt, kann kopiert werden. Wirksam sind: kontrollierte Weitergabe, Personalisierung (ein Leck ist zuordenbar), Befristung, Urheberbelege und vertragliche Regeln. Technische Verschleierung erschwert das Lesen nur.

## Was eingebaut ist
- **Urheber-Vermerk** im Quelltext (`<!-- © … -->`, `meta author/copyright`), sichtbar in der Oberfläche («App-Konzept und Urheber: Alessandro Cortese») und im Kapitel «Datenschutz und Über das Tool» der Anleitung (DE/FR/IT/EN).
- **Weitergabe-Version:** `python3 build.py --release "Name Empfänger" [--days 30]`
  - **personalisiert:** Empfängername in der Versionszeile und als Fusszeile auf jedem Druck («Lizenziert für … · © Alessandro Cortese · nicht weitergeben»);
  - **befristet:** nach Ablauf öffnet sich das Tool nicht mehr (Zurückstellen der Uhr hilft nicht);
  - **minimiert:** Programmcode wird mit terser komprimiert/umbenannt (einmalig `cd tools && npm install`); Daten (LV, Schachtdaten) bleiben lesbar;
  - **Lizenz-Banner** am Anfang des Codes;
  - **Register:** `dist/releases.csv` (Datum, Empfänger, Ablauf, SHA-256, Datei) – damit lässt sich eine Datei einem Empfänger zuordnen. `dist/` ist nicht im Repository (bewusst lokal aufbewahren).
- Der Artefakt-Link ist **privat** (nur du und freigegebene Personen); die Entwicklungsversion `index.html` nicht per Datei weitergeben.

## Was nicht möglich ist
- Quelltext im Browser vollständig verbergen oder Kopieren verhindern (Rechtsklick-Sperren o. Ä. wären wirkungslos und stören die Bedienbarkeit – nicht eingebaut).
- Rechenlogik wirklich geheim halten: dafür müsste der Rechenkern auf einem Server laufen (Tool ruft ihn per Anmeldung ab). Das ist ein eigenes Projekt (Hosting, Login, Betrieb) und nur sinnvoll bei breiter Verteilung.

## Empfehlung
1. Entwicklungsdatei und Repository **privat** halten; nie öffentlich verlinken.
2. An Kolleginnen/Kollegen nur `--release`-Versionen mit Name und Ablauf geben; Register aufbewahren.
3. Urheberschaft belegen: Git-Verlauf (Commits mit Datum) sichern; Versionsstände mit SHA-256 im Register; ggf. Ablage der Releases bei dir/Notar/Treuhänder.
4. **Rechtslage klären (nicht Rechtsberatung):** Wurde das Tool im Rahmen der Anstellung bei Swisscom entwickelt, können Nutzungsrechte beim Arbeitgeber liegen (Arbeitsvertrag, OR Art. 332 prüfen). Das eingebaute LV (Preise, Positionstexte) und das Handbuch sind Swisscom-Unterlagen – ihre Weitergabe richtet sich nach deren Vertraulichkeitsregeln. Vor einer Weitergabe außerhalb von Swisscom Rücksprache mit Vorgesetzten/Legal.
5. Nutzungsbedingungen (Entwurf, vor Verwendung prüfen lassen): «Das Tool und sein Quelltext sind urheberrechtlich geschützt (© Alessandro Cortese). Nutzung nur für den bezeichneten Empfänger und bis zum Ablaufdatum. Kopieren, Verändern, Weitergeben und Dekompilieren sind ohne schriftliche Zustimmung untersagt. Die enthaltenen LV-/Preisdaten sind vertraulich.»
