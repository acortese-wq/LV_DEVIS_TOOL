/* t85: Kartenquelle «Luftbild + Strassen» (5. Auswahlfeld) – swisstopo SWISSIMAGE mit amtlichem Strassenverzeichnis (Strassen + Namen);
   Kacheln beider Ebenen werden angefragt, Wahl gemerkt und im Projekt gespeichert, Bericht-/Druckbild mit beiden Ebenen, map.geo.admin-Link,
   Auswahl im klassischen Menü, kein Überlauf (1024/390/320 px), 4 Sprachen */
const K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500); };
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900); const req = [];
  await pg.route('**/*', r => { const u = r.request().url(); if (/wmts|wms\.geo/.test(u)) req.push(u); return /wmts|wms\.geo|api3|SearchServer/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  const bt = await pg.$$eval('.lybase [data-lyb]', x => x.map(e => e.getAttribute('data-lyb') + ':' + e.textContent));
  ok(bt.length === 5 && bt[3] === 'luftstr:Luftbild + Strassen', 'fünf Kartenquellen, 4. Knopf neben «Luftbild»: ' + bt.join(' | '));
  req.length = 0; await pg.click('.lybase [data-lyb=luftstr]'); await pg.waitForTimeout(1200);
  ok(await pg.getAttribute('.lybase [data-lyb=luftstr]', 'aria-pressed') === 'true' && await pg.getAttribute('.lybase [data-lyb=luft]', 'aria-pressed') === 'false', 'Knopf aktiv');
  ok(req.some(u => /swissimage/.test(u)) && req.some(u => /amtliches-strassenverzeichnis/.test(u)), 'Kacheln: Luftbild (' + req.filter(u => /swissimage/.test(u)).length + ') + Strassenverzeichnis (' + req.filter(u => /strassenverzeichnis/.test(u)).length + ')');
  ok(await pg.evaluate(() => localStorage.getItem('lvd-km-base')) === 'luftstr', 'Wahl gemerkt (lvd-km-base)');
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(600);
  const kb = await pg.evaluate(() => JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')).karte.base);
  ok(kb === 'luftstr', 'im Projekt gespeichert (karte.base = ' + kb + ')');
  // Bericht-/Druckhintergrund: WMS mit beiden Ebenen
  req.length = 0; await pg.reload(); await open(pg);
  ok(await pg.getAttribute('.lybase [data-lyb=luftstr]', 'aria-pressed') === 'true', 'nach Neuladen weiter «Luftbild + Strassen»');
  await pg.evaluate(() => { window.__geo = null; window.open = (x) => { window.__geo = x; return null; }; });
  await pg.click('.lyviewm > summary'); await pg.waitForTimeout(150); await pg.click('.lyviewb [data-k=geo]'); await pg.waitForTimeout(200);
  const gu = await pg.evaluate(() => window.__geo || '');
  ok(/bgLayer=ch\.swisstopo\.swissimage/.test(gu) && /layers=ch\.swisstopo\.amtliches-strassenverzeichnis/.test(gu), 'map.geo.admin-Link mit Luftbild + Strassenverzeichnis');
  await pg.keyboard.press('Escape');
  ok(await pg.$$eval('#kmBase option', o => o.map(x => x.value).includes('luftstr')), 'auch im Menü «Kartenquelle» (swisstopo)');
  // Druck/Bericht: Hintergrund-URL
  const rq = req.filter(u => /REQUEST=GetMap/i.test(u) && /swissimage/.test(u)); 
  ok(rq.every(u => /amtliches-strassenverzeichnis/.test(u)), 'WMS-Abfragen für Bild/Bericht enthalten beide Ebenen (' + rq.length + ')');
  for (const [w, h] of [[1024, 768], [390, 844], [320, 568]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400);
    const r = await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'), l = document.querySelector('.lybase').getBoundingClientRect(); return { ov: d.scrollWidth > innerWidth + 1, r: l.right, w: innerWidth }; });
    ok(!r.ov && r.r <= r.w, w + ' px: Kartenquellen ohne Überlauf'); }
  await pg.setViewportSize({ width: 1440, height: 900 });
  await pg.addScriptTag({ path: AXE }); const ax = await pg.evaluate(() => axe.run(document.querySelector('.lybase')).then(r => r.violations.map(v => v.id)));
  ok(ax.length === 0, 'axe Kartenquellen: ' + JSON.stringify(ax));
  for (const [l, t] of [['fr', 'Photo + rues'], ['it', 'Foto + strade'], ['en', 'Aerial + streets']]) { await pg.click('[data-lylang=' + l + ']'); await open(pg); ok(await pg.textContent('.lybase [data-lyb=luftstr]') === t, l.toUpperCase() + ': «' + t + '»'); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
