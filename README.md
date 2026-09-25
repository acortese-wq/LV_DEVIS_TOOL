# LV-Erfassung Tiefbau – Swisscom

Einzeldatei-Tool (`index.html`) zur Kostenschätzung Tiefbau nach LV Swisscom 2026.
Bauteile werden je Reiter geometrisch erfasst (Graben, Rohr, Schacht, Werkloch, Fundamente,
Geb. Einführung, Belag, Allgemein); das Tool leitet die NPK-Positionen × Mengen ab.

- Pro Reiter beliebig viele Datensätze (Neu / Duplizieren / Löschen / Navigation)
- „Weitere LV-Positionen“ je Reiter: jede LV-Position, die nicht automatisch entsteht, ist direkt erfassbar
  (Abdeckung im Reiter „Annahmen“: 532 von 532 Positionen erfassbar)
- Allgemein: Baustelleneinrichtung in % der LV-Summe (Pos. 113/111.002)
- Reiter Ingenieurhonorar nach KBOB/SIA 103 (Baukosten): Tm = B × p/100 × n × q/100 × r × U, p = Z1 + Z2/∛B
- Sprachen DE/FR/IT/EN, Dark Mode, Projekt als JSON speichern/laden, CSV-Export

Konzept: Alessandro Cortese, Swisscom AG.
