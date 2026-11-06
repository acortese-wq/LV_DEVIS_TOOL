/* Erzeugt die Regressions-Referenz tests/fixtures/golden.json (Eingaben + Ergebnisse). Nur bewusst neu erzeugen, wenn sich die Fachlogik gewollt ändert!
   Aufruf: node tools/make_golden.js   (braucht python3 und die Test-Abhängigkeiten) */
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const { kernel, result, H } = require('../tests/lib/regress.js'), K = require('../tests/lib/k.js');
(async () => {
  const cases = [];
  const b = await K.chromium.launch(), pg = await K.mk(b, 1280, 900);
  for (const lg of ['de', 'fr', 'it', 'en']) { await pg.evaluate(l => { window.__LVD.loadDemo(); }, lg); await pg.waitForTimeout(800); const S = await pg.evaluate(l => { const s = JSON.parse(JSON.stringify(window.__LVD.S())); s.lang = l; delete s.ui; return s; }, lg); cases.push({ name: 'Beispielprojekt Dorfstrasse (' + lg + ')', st: S }); }
  await b.close();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-')); execSync('python3 ' + JSON.stringify(path.join(H, 'tests/skill_fuzz.py')) + ' ' + JSON.stringify(dir) + ' 60', { stdio: 'ignore' });
  fs.readdirSync(dir).filter(f => /^LV-Devis_F\d+\.json$/.test(f)).sort().forEach(f => cases.push({ name: 'Zufallsprojekt ' + f.match(/F(\d+)/)[1], st: JSON.parse(fs.readFileSync(path.join(dir, f))).data }));
  const C = kernel(); cases.forEach(c => { c.out = result(C, c.st); });
  const out = { created: new Date().toISOString().slice(0, 10), note: 'Referenz vor dem NIUcost-Redesign (Stand Rechenkern unverändert). Nicht von Hand ändern.', cases };
  fs.writeFileSync(path.join(H, 'tests/fixtures/golden.json'), JSON.stringify(out));
  console.log(cases.length + ' Fälle gespeichert, Netto Beispiel DE: ' + cases[0].out.sum.netto);
})();
