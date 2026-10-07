---
name: lv-devis-tiefbau
description: Erstellt Kostenvoranschläge (Devis) für Swisscom-Tiefbau bei Baukooperationen nach «LV Swisscom Infrastrukturarbeiten bei Baukooperationen V1.1 (10.07.2026)» – Leitungsgraben, Rohranlage, Schacht inkl. Abdeckungswahl, Werkloch, Fundamente VK/KVS, Gebäudeeinführung, Belag/Wiederinstandstellung, Baustelleneinrichtung und Ingenieurhonorar nach SIA 103-K / KBOB. Verwenden, wenn jemand Tiefbaukosten, ein Devis, eine LV-Position, einen Schacht/Deckel, Rabattstufen oder ein Ingenieurhonorar für Swisscom-Netzbau (FTTH, Wireline) berechnen oder prüfen will. Antwortet auf Deutsch, Französisch oder Italienisch.
---

# LV-Devis Tiefbau (Swisscom, Baukooperationen)

App-Konzept und Urheber: **Alessandro Cortese**. Dieser Skill verwendet denselben Rechenkern wie das HTML-Tool «LV-Devis Tiefbau»; Ergebnisse sind auf den Rappen identisch.

## Grundregeln (immer einhalten)

1. **Nie selbst rechnen oder Preise schätzen.** Mengen, Einheitspreise, Rabatt, Installationspauschale, MWST und Honorar kommen ausschliesslich aus `scripts/rechne.py`. Keine Preise aus dem Gedächtnis nennen – nachschlagen mit `scripts/lv_suche.py`. **Immer das Skript ausführen** – auch für eine schnelle Schätzung.
2. **OFFEN-Positionen** (kein LV-Preis) sind nicht im Total. Immer ausweisen und empfehlen, den Preis beim Unternehmer anzufragen. Nie einen Preis dafür erfinden.
3. **Warnungen der Stufe `stop`** (z. B. Schachtgrösse am Einbauort nicht zulässig) dem Benutzer vor der Summe nennen und eine Korrektur vorschlagen.
4. Fehlende Pflichtangaben **nachfragen**, statt Annahmen still zu treffen. Getroffene Annahmen (Vorgabewerte) am Schluss auflisten.
5. Sprache des Benutzers verwenden (DE/FR/IT; EN möglich). Positionstexte über `"lang"` steuern.

## Ablauf

1. **Projekt erfassen:** Projektname, SAP-/BK-Nummer, Ort, Bearbeiter, Rolle `kopf.rolle` (`anv` = ANV, `bl` = Bauleiter, `bhv` = BHV), ob der Belag durch Dritte eingebaut wird (`kopf.belagLief`).
2. **Bauteile abfragen** – nur die Reiter, die vorkommen. Pro Reiter wenige, gezielte Fragen (siehe unten). Mehrere Datensätze pro Reiter sind möglich (z. B. Graben Trottoir + Graben Strasse).
3. **Eingabe-JSON schreiben** (Format unten) – nur Werte angeben, die von der Vorgabe abweichen.
4. **Rechnen:** `python3 scripts/rechne.py eingabe.json --out <ordner>` (Pfad relativ zum Skill-Ordner; Ausgabe: Markdown-Zusammenfassung + `LV-Devis_<SAP>.json` + `LV-Devis_<SAP>.xlsx`). Nur Python-Standardbibliothek, keine Installation nötig.
5. **Ergebnis präsentieren:** Elemente, Summen (Zwischensumme → Rabattstufe → Installationspauschale → Netto exkl. MWST → MWST → Total), Honorar, OFFEN-Positionen, Warnungen, offene Punkte der Vollständigkeitsprüfung. Excel und JSON als Dateien anbieten.
6. Hinweis geben: Die JSON-Datei lässt sich im HTML-Tool «LV-Devis Tiefbau» über **Laden** öffnen – dort sind Druck/PDF, Zeichnungen und das ausführliche Excel verfügbar.
7. Änderungswünsche: Eingabe-JSON anpassen und erneut rechnen (nie Summen von Hand nachführen).

## Wichtigste Fragen je Reiter

| Reiter (`recs.…`) | Mindestens klären |
|---|---|
| `graben` | Länge `L`, Tiefe `T`, Breitenregel `bmode`, Handaushub-Anteil `hand` (eng bei Fremdleitungen), Direktverlad `direkt`, Rohrsystem (`k55`/`laengs`/`block`) mit DN und Anzahl Rohre, Bogen, Oberfläche `belag.mode` (`none`/`bit`/`humus`/`pflaster`) inkl. Belagsdicke `belag.d` (mm) und Belagslänge `Lb`, Fremdleitungskreuzungen, Erschwernisse |
| `rohr` | Nur Rohre/Bogen/Muffen ohne Graben: Listen `rohre`, `schn`, `boe`, `muf` mit `typ` aus Katalog (siehe Feldreferenz) und Menge `q`; `verl` = auch verlegen |
| `schacht` | `modus` (`neu`/`ersatz`/`deckel`), Einbauort `einbauort` (HLS, HVS, VS50, VS49, SS, ESS, GEH, WIES), Typ `typ` (KS80U … PLS3), Anzahl `n`, Deckelform/-system; Abdeckungen werden automatisch gewählt (liefern + versetzen) |
| `werkloch` | Anzahl Standard-Werklöcher `ts`/`bo`/`sg`/`zs` oder individuelle Masse `iL`/`iB`/`iT`, Pumpenschächte `p0`–`p3`, Oberfläche |
| `fund` | Fundament VK (`vk`) bzw. KVS (`kvs`), Oberfläche |
| `geb` | Anzahl Hauseinführungen `n`, Wandstärke `cm`, Abdichtung `abd` |
| `belag` | Wiederinstandstellung nach Belagsklasse `bk` (gehweg/strasse/kanton), Dicke `d` (m), Fläche `B` × `L`, Typ `wi` (A–C2) |
| `allg` | Kleinmaterial `km`, Akkordarbeiten `ak` (CHF); global: Sondierungen `sond.m3`, Wasserhaltung `wasser.h`/`wasser.sumpf`, **Baustelleneinrichtung `be.pct` (%)** |
| `hon` | Ingenieurhonorar SIA 103-K: Baukosten `src` (`lv` = LV-Netto, `man` mit `B`), **Stundenansatz `h` (Pflicht)**, Nebenkosten `nk` %, Faktoren `n` (Schwierigkeit) und `r` (Anpassung), Teilphasen `ph`, Gesamtleitung `gl` |

Vollständige Felder, Optionen, Vorgaben und Bedingungen: **`references/felder.md`** (vor dem Erstellen der Eingabe lesen, wenn ein Reiter vorkommt).

## Eingabeformat (`eingabe.json`)

```json
{
  "lang": "de",
  "kopf": { "projekt": "FTTH Chur Masanserstrasse", "sap": "BK-4711", "ort": "Chur", "bearb": "…", "belagLief": false },
  "be": { "pct": "3" },
  "mwst": "8.1",
  "recs": {
    "graben":  [ { "name": "Graben Trottoir", "L": 45, "T": 0.8, "n": 2, "belag": { "mode": "bit", "d": "100" }, "Lb": 45 } ],
    "schacht": [ { "name": "Schacht S1", "modus": "neu", "einbauort": "GEH", "typ": "KES150", "n": 1 } ],
    "hon":     [ { "name": "Projekt + Bauleitung", "src": "lv", "h": 140, "nk": 3 } ]
  }
}
```

- Nicht angegebene Felder erhalten die Vorgabe des Tools; Zahlen dürfen als Zahl oder Text kommen.
- **Weitere LV-Positionen** pro Datensatz: `"x": { "151/485.004": "12" }` (Position → Menge). Jede der 599 Positionen ist so erfassbar; Nummer mit `lv_suche.py` ermitteln.
- **Freie Positionen** pro Datensatz: `"free": [ { "key": "151/672.401", "qty": "2", "note": "…" } ]` oder ausserhalb LV `{ "custom": true, "text": "…", "unit": "St", "qty": "1", "ep": "350", "reason": "Offerte XY" }` – ausserhalb LV immer mit Begründung, sonst Warnung `stop`.
- Ingenieurhonorar-Teilphasen: `"ph": [ { "k": "31", "on": true }, … ]` mit k = 31, 32, 33, 41, 51, 52a, 52b, 52c, 53 (q fest nach SIA 103-K Art. 7.7). Ohne Angabe: alle ausser 52c.
- Eine vollständige Sicherung aus dem HTML-Tool (`{ "v": 2, "data": … }`) wird ebenfalls akzeptiert.

## Fachliche Leitplanken

- **Rabatt / Installationspauschale** (R151/R152) nach Zwischensumme: bis 10 000 → 0 % / 0; bis 30 000 → 3 % / 700; bis 50 000 → 5 % / 900; bis 100 000 → 7 % / 1 200; darüber 9 % / 1 500. Wird vom Skript angewendet.
- **Honorar SIA 103-K (2018) Art. 7:** Tm = B × p/100 × n × q/100 × r, p = Z1 + Z2/∛B; Z1/Z2, i, s sind fest hinterlegt und nicht verhandelbar im Skill; n und r ohne besondere Vereinbarung 1.0 (übliche Bandbreite n 0.8–1.2, r 0.75–1.25). Der Stundenansatz h ist auftragsbezogen zu vereinbaren (KBOB 2026 publiziert keine Ansätze).
- **Schachtwahl:** Einbauort bestimmt zulässige Typen und Abdeckung (HVS: ES/KES vermeiden; HLS: keine Schächte; Gehweg rund DS 600 – D400; Wiesland Betonplatten). Abdeckung wird inkl. Versetzen (151/632.2xx) gerechnet.
- Positionen ohne LV-Preis bleiben OFFEN; Abweichungen vom LV-Preis werden als «EP geändert» markiert.

## Skripte

| Skript | Zweck |
|---|---|
| `python3 scripts/rechne.py eingabe.json [--out dir] [--lang fr] [--md-only] [--json-only]` | Berechnung → Markdown + JSON (für HTML-Tool) + Excel |
| `python3 scripts/lv_suche.py <Begriff/Nummer> [--lang fr] [--max 50]` | LV-Positionen suchen (Nummer, Einheit, Preis, Text) |
| `scripts/kve.py` | Rechenkern (Python-Portierung des HTML-Tools, rappengenau geprüft) |
| `scripts/daten.json` | LV-Daten, Schachtauswahl, Texte, Vorgaben (automatisch erzeugt, nicht ändern) |

Benötigt nur Python 3 (Standardbibliothek). Beispiele: `beispiele/`.

## Falls keine Code-Ausführung möglich ist

Dann **keine Summen nennen**. Stattdessen die Angaben wie oben erfassen, die vollständige Eingabe als JSON-Codeblock ausgeben und erklären:
«Datei als `.json` speichern und im HTML-Tool LV-Devis Tiefbau über **Laden** öffnen – das Tool rechnet die Kosten.»
Das Eingabeformat oben lädt das HTML-Tool direkt, wenn zuoberst **`"v": 2`** steht (z. B. `{ "v": 2, "lang": "de", "kopf": {…}, "recs": {…} }`). Fehlende Reiter und Felder ergänzt das Tool beim Laden mit den Vorgaben.
