/* t116: Schalter «Grabenband» und «Aushublinien» sind im Planungsfokus im Ribbon-Register «Ansicht» (Gruppe Darstellung) erreichbar und schalten */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1000); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { const m = window.__KM.map(), p = window.__KM.M().pts[0]; m.setView(window.__KM.ll(p.pt), 18, { animate: false }); }); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const t = [...document.querySelectorAll('.lyrb [role=tab], .lyrb button')].find(x => /Ansicht|View/i.test(x.textContent)); if (t) t.click(); }); await pg.waitForTimeout(400);
  const btn = pg.locator('.lyrb button', { hasText: 'Grabenband' }); ok(await btn.count() > 0, 'Ribbon «Ansicht» zeigt den Knopf «Grabenband»');
  const n0 = await pg.evaluate(() => window.__KM.bandCount()); await btn.first().click(); await pg.waitForTimeout(400);
  const n1 = await pg.evaluate(() => window.__KM.bandCount()); ok(n0 > 0 && n1 === 0, 'Knopf blendet das Grabenband aus (' + n0 + ' → ' + n1 + ')');
  await pg.locator('.lyrb button', { hasText: 'Aushublinien' }).first().click(); await pg.waitForTimeout(400); ok((await pg.evaluate(() => window.__KM.pitCount())) === 0, 'Knopf «Aushublinien» blendet die Gruben aus');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
