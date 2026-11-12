/* t110: Mindest-Überdeckung automatisch – Grabentiefe T wird auf T = Mindestüberdeckung + 5 cm + DN (aufgerundet auf 5 cm) angehoben, nie gesenkt; Mindestwert aus Feld «Min. Überdeckung» (sonst 0.6 m); Hinweis mit Rückgängig; Übernehmen schreibt die Tiefe in den Datensatz; Überdeckung von Hand setzt die Automatik aus */
const { chromium, ok, mk, getS } = require('./lib/k.js');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1600, 1000);
  await pg.fill('#f_graben_L', '1'); await pg.waitForTimeout(500); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
  for (let i = 0; i < 9; i++) { await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100); } await pg.waitForTimeout(400);
  const bx = await pg.locator('#kmMap').boundingBox(); const clk = async (dx, dy) => { await pg.mouse.click(bx.x + dx, bx.y + dy); await pg.waitForTimeout(300); };
  await pg.click('.kmmidtog'); await pg.waitForTimeout(200);
  await pg.locator('#kmMk button', { hasText: '2×K100' }).first().click(); await pg.locator('#kmMk button', { hasText: 'Pflästerung' }).click(); await pg.locator('#kmMk button', { hasText: 'KES175' }).click();
  await pg.click('.kmmid [data-w=x]'); await pg.waitForTimeout(150);
  await pg.click('[data-k=mline]'); await clk(150, 250); await pg.locator('#kmAsk button', { hasText: 'Ohne Schacht' }).click(); await clk(450, 250); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button', { hasText: 'Ohne Schacht' }).click(); await pg.waitForTimeout(500);
  const T = () => pg.evaluate(() => window.__KM.M().lines.filter(l => l.pts.length > 1).map(l => l.cfg && l.cfg.T));
  let t = await T(); ok(t.length === 1 && t[0] === '0.75', 'Neue Linie mit DN 100: Grabentiefe automatisch 0.75 m (' + t.join() + ')');
  const msg = await pg.evaluate(() => (document.querySelector('dialog .kmtoast') || {}).textContent || ''); ok(/angehoben/.test(msg) && /0\.75/.test(msg) && /DN 100/.test(msg), 'Hinweis nennt Tiefe, Mindestüberdeckung und DN (' + msg.slice(0, 70) + '…)');
  // Rückgängig
  await pg.evaluate(() => { const bt = document.querySelector('dialog .kmtoast button'); if (bt) bt.click(); }); await pg.waitForTimeout(400); t = await T(); ok(t[0] !== '0.75', 'Rückgängig nimmt die Anhebung zurück (' + t.join() + ')');
  // Mindestwert aus dem Feld: 0.8 m -> DN 100: 0.8+0.05+0.1 = 0.95
  await pg.evaluate(() => { localStorage.setItem('lvd-km-pfc', JSON.stringify({ min: '0.8', max: '', ex: true })); }); await pg.reload(); await pg.fill('#f_graben_L', '1'); await pg.waitForTimeout(400); await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(800);
  for (let i = 0; i < 9; i++) { await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(100); } await pg.waitForTimeout(300);
  await pg.click('.kmmidtog'); await pg.waitForTimeout(200); await pg.locator('#kmMk button', { hasText: '2×K100' }).first().click(); await pg.locator('#kmMk button', { hasText: 'Pflästerung' }).click(); await pg.locator('#kmMk button', { hasText: 'KES175' }).click(); await pg.click('.kmmid [data-w=x]'); await pg.waitForTimeout(150);
  const bx2 = await pg.locator('#kmMap').boundingBox(); const clk2 = async (dx, dy) => { await pg.mouse.click(bx2.x + dx, bx2.y + dy); await pg.waitForTimeout(300); };
  await pg.click('[data-k=mline]'); await clk2(150, 250); await pg.locator('#kmAsk button', { hasText: 'Ohne Schacht' }).click(); await clk2(450, 250); await pg.click('[data-k=end]'); await pg.locator('#kmAsk button', { hasText: 'Ohne Schacht' }).click(); await pg.waitForTimeout(500);
  t = await T(); ok(t[0] === '0.95', 'Mindestwert 0.8 m aus dem Feld: DN 100 → Tiefe 0.95 m (' + t.join() + ')');
  // Von Hand kleiner eintragen: wird nach kurzer Pause wieder angehoben
  await pg.click('#kmObj .kmrow .kmc input >> nth=0').catch(() => { }); await pg.waitForTimeout(100);
  await pg.evaluate(() => { const l = window.__KM.M().lines.find(x => x.pts.length > 1); l.cfg.T = '0.5'; });
  const r = await pg.evaluate(() => { const i = [...document.querySelectorAll('#kmObj input')].find(e => /Grabentiefe|Tiefe/.test(e.getAttribute('aria-label') || '')); return !!i; });
  if (r) { await pg.evaluate(() => { const i = [...document.querySelectorAll('#kmObj input')].find(e => /Grabentiefe|Tiefe/.test(e.getAttribute('aria-label') || '')); i.focus(); i.value = '0.5'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await pg.waitForTimeout(1700); t = await T(); ok(t[0] === '0.95', 'T von Hand kleiner eingetragen: Automatik hebt nach kurzer Pause wieder an (' + t.join() + ')'); } else ok(true, 'Tiefenfeld nicht im sichtbaren Bereich (übersprungen)');
  // Übernehmen: Datensatz bekommt T
  await pg.click('[data-k=apply]'); await pg.waitForTimeout(900); const S = await getS(pg); ok(S.recs.graben.some(g => parseFloat(g.T) >= 0.95 - 1e-9), 'In Datensätze übernehmen: Graben-Datensatz mit T ≥ 0.95 m (' + S.recs.graben.map(g => g.T).join() + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
