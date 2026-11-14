/* t118: Alleinbau / Kooperation in der Oberfläche – Schalter im Reiter Allgemein (projektweit), Hinweis, Bauart je Linie in der Karte, Schutz eigener Kabel je Linie */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000); await K.noBE(pg);
  const n0 = await pg.evaluate(() => window.__OUT.sum.netto);
  await pg.click('[data-tab=allg]'); await pg.waitForTimeout(400);
  const sel = pg.locator('#f_allg_bau'); ok(await sel.count() === 1, 'Reiter Allgemein zeigt den Schalter «Bauart (Alleinbau / Kooperation)»');
  await sel.selectOption('koop'); await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => ({ n: window.__OUT.sum.netto, w: window.__OUT.warn.map(w => w.id), bau: window.__LVD.S().bau }));
  ok(r.bau === 'koop' && r.n < n0 && r.w.includes('koop'), 'Kooperation: Kosten sinken (' + n0 + ' → ' + r.n + ') und Hinweis erscheint');
  await sel.selectOption('allein'); await pg.waitForTimeout(800);
  ok((await pg.evaluate(() => window.__OUT.sum.netto)) === n0, 'Zurück auf Alleinbau: Kosten wie zuvor (' + n0 + ')');
  // Datensatz Graben: eigene Bauart und Schutz
  await pg.click('[data-tab=graben]'); await pg.waitForTimeout(400);
  const gb = pg.locator('#f_graben_bau'); ok(await gb.count() === 1 && (await gb.inputValue()) === 'proj', 'Graben-Datensatz: Bauart «Wie Projekt» als Vorgabe');
  await gb.selectOption('koop'); await pg.waitForTimeout(700); const nk = await pg.evaluate(() => window.__OUT.sum.netto); ok(nk < n0, 'Nur dieser Graben auf Kooperation: Kosten sinken (' + n0 + ' → ' + nk + ')');
  await gb.selectOption('proj'); await pg.fill('#f_graben_schutzL', '25'); await pg.waitForTimeout(700); const ns = await pg.evaluate(() => window.__OUT.sum.netto); ok(ns > n0, 'Schutz eigener Kabel 25 m erhöht die Kosten (' + n0 + ' → ' + ns + ')');
  // Karte: Linie, Zusatz-Felder
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  const ok2 = await pg.evaluate(() => { const K = window.__KM, l = K.M().lines.find(x => x.pts.length > 1); K.select(l.id); K.unfold(); const row = document.querySelector('#kmObj .kmrow[data-rid="' + l.id + '"]') || document; document.querySelectorAll('.kmmore').forEach(d => d.open = true); return { sel: !![...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'koop')), inp: !![...document.querySelectorAll('input')].find(i => /Schutz/.test(i.getAttribute('aria-label') || '')) }; });
  ok(ok2.sel && ok2.inp, 'Karte: Linieneigenschaften zeigen Bauart und Schutz eigener Kabel');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
