/* t114: Schacht in der Karte – Modus (neuer Schacht / bestehender Anschluss / nur Deckel) und Oberfläche (Belag, Wiese, Pflästerung, Aushub durch Bauherr) ändern sofort die Kostenvorschau und nach «Übernehmen» die Gesamtkosten; Drehen des Schachts */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  const cost = async () => { await pg.waitForTimeout(1100); return pg.evaluate(() => (document.querySelector('#kmCostF') || document.querySelector('#kmCost') || {}).textContent || ''); };
  const setSel = async (vals, v) => { const okk = await pg.evaluate(([vals, v]) => { window.__KM.unfold(); const row = document.querySelector('#kmObj .kmrow[data-rid="' + window.__KM.M().pts[0].id + '"]'); if (!row) return false; const s = [].slice.call(row.querySelectorAll('select')).find(x => vals.every(q => [].slice.call(x.options).some(o => o.value === q))); if (!s) return false; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [vals, v]); return okk; };
  const MODE = ['neu', 'anschluss', 'deckel'], FL = ['pflaster', 'wiese', 'roh'];
  await pg.evaluate(() => window.__KM.select(window.__KM.M().pts[0].id)); await pg.waitForTimeout(500);
  const c0 = await cost(); ok(c0.length > 0, 'Kostenvorschau vorhanden (' + c0 + ')');
  ok(await setSel(MODE, 'deckel'), 'Modus «nur Deckel» gewählt'); const cD = await cost(); ok(cD !== c0, 'Modus nur Deckel ändert die Kostenvorschau (' + c0 + ' → ' + cD + ')');
  await setSel(FL, 'wiese'); const cW = await cost(); await setSel(FL, 'pflaster'); const cP = await cost(); await setSel(FL, 'roh'); const cR = await cost();
  ok(cW !== cP && cW !== cR && cP !== cR, 'Oberfläche Wiese / Pflästerung / Aushub durch Bauherr ändern die Kosten (' + cW + ' | ' + cP + ' | ' + cR + ')');
  await setSel(MODE, 'anschluss'); const cA = await cost(); ok(cA !== cR, 'Modus bestehender Anschluss ändert die Kosten (' + cR + ' → ' + cA + ')');
  await setSel(FL, 'wiese'); const cAW = await cost(); ok(cAW !== cA, 'Anschluss: Oberfläche Wiese ändert die Kosten (' + cA + ' → ' + cAW + ')');
  // Drehen
  const dir0 = await pg.evaluate(() => { const g = window.__KM.shaftInfo(window.__KM.M().pts[0].id); return [g.poly[1][0] - g.poly[2][0], g.poly[1][1] - g.poly[2][1]]; });
  await pg.evaluate(() => { const row = document.querySelector('#kmObj .kmrow[data-rid="' + window.__KM.M().pts[0].id + '"]'), bt = [].slice.call(row.querySelectorAll('button')).find(x => /90/.test(x.textContent)); if (bt) bt.click(); }); await pg.waitForTimeout(400);
  const dir1 = await pg.evaluate(() => { const g = window.__KM.shaftInfo(window.__KM.M().pts[0].id); return [g.poly[1][0] - g.poly[2][0], g.poly[1][1] - g.poly[2][1]]; });
  const cs = Math.abs(dir0[0] * dir1[0] + dir0[1] * dir1[1]) / (Math.hypot(...dir0) * Math.hypot(...dir1) || 1); ok(cs < 0.05, 'Knopf «90° drehen» dreht das Schachtzeichen um 90° (cos ' + cs.toFixed(3) + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
