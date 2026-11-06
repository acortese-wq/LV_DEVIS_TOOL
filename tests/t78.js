/* t78: Regressions-Referenz – identische Eingaben liefern identische Ergebnisse wie vor dem Redesign (64 Projekte: Beispiel DE/FR/IT/EN + 60 Zufallsprojekte).
   Geprüft: Netto/Brutto/MWST/Rabatt/Installation, jede Position (Menge, EP, Betrag, Einheit), Element-Summen, Warnungen, Vollständigkeit, Honorar.
   Zusätzlich im Browser: die Oberfläche zeigt für das Beispielprojekt dieselben Summen. */
const fs = require('fs'), path = require('path'), { kernel, result, H } = require('./lib/regress.js'), K = require('./lib/k.js'), { ok } = K;
(async () => {
  const G = JSON.parse(fs.readFileSync(path.join(H, 'tests/fixtures/golden.json'))), C = kernel(); let bad = [];
  G.cases.forEach(c => { const r = result(C, c.st); for (const k of Object.keys(c.out)) if (JSON.stringify(r[k]) !== JSON.stringify(c.out[k])) { bad.push(c.name + ' · ' + k + ': ' + JSON.stringify(r[k]).slice(0, 120) + ' ≠ ' + JSON.stringify(c.out[k]).slice(0, 120)); break; } });
  ok(bad.length === 0, G.cases.length + ' Projekte gegen Referenz vom ' + G.created + ': ' + (bad.length ? bad.length + ' Abweichungen – ' + bad.slice(0, 3).join(' | ') : 'identisch (Summen, Positionen, Warnungen, Honorar)'));
  const tot = G.cases.reduce((a, c) => a + c.out.summary.length, 0); ok(tot > 1000, tot + ' Positionen verglichen');
  const b = await K.chromium.launch(), pg = await K.mk(b, 1280, 900);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1200);
  const ui = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__OUT.sum))), g0 = G.cases[0].out.sum;
  ok(JSON.stringify(ui) === JSON.stringify(g0), 'Oberfläche (Beispielprojekt) = Referenz: netto ' + ui.netto + ' / brutto ' + ui.brutto);
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
