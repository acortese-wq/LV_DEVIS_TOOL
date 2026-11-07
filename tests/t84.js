/* t84: Schmale Bildschirme 861–1100 px – unterer Bereich startet eingeklappt (Karte grösser), eigene Wahl dort gemerkt (lvd-ly-dockn),
   breite Bildschirme behalten ihre Wahl (lvd-ly-dock); Wechsel der Fensterbreite stellt die jeweilige Wahl her; keine Kostenwirkung */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500); };
const st = pg => pg.evaluate(() => ({ c: document.querySelector('dialog.kmlya').classList.contains('lydock-c'), mh: Math.round(document.querySelector('#kmMap').getBoundingClientRect().height), mw: Math.round(document.querySelector('#kmMap').getBoundingClientRect().width) }));
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1024, 768);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.removeItem('lvd-ly-dock'); localStorage.removeItem('lvd-ly-dockn'); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  const sum0 = await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum));
  let s = await st(pg);
  ok(s.c && s.mh >= 0.5 * 768, '1024×768: unterer Bereich eingeklappt, Karte ' + s.mw + '×' + s.mh + ' px (vorher 506×276)');
  ok(await pg.locator('.lydtabs [role=tab]').first().isVisible(), 'Reiter bleiben sichtbar (ein Klick öffnet)');
  await pg.click('#lyT_pos'); await pg.waitForTimeout(250); s = await st(pg);
  ok(!s.c && await pg.locator('#lyP_pos').isVisible(), 'Klick auf «Positionen» öffnet den Bereich');
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('lvd-ly-dockn'))).c === false && !(await pg.evaluate(() => localStorage.getItem('lvd-ly-dock'))), 'Wahl für schmale Bildschirme gemerkt, breite Einstellung unberührt');
  await pg.reload(); await open(pg); s = await st(pg); ok(!s.c, 'nach Neuladen bleibt er offen (eigene Wahl)');
  await pg.keyboard.press('Control+j'); await pg.waitForTimeout(200); ok((await st(pg)).c, 'Strg+J klappt wieder ein');
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(500); s = await st(pg);
  ok(!s.c && await pg.locator('.lydpan:not([hidden])').count() === 1, '1440 px: breite Wahl (offen) wiederhergestellt');
  await pg.setViewportSize({ width: 1024, height: 768 }); await pg.waitForTimeout(500); ok((await st(pg)).c, 'zurück auf 1024 px: wieder eingeklappt (gemerkte schmale Wahl)');
  await pg.setViewportSize({ width: 1280, height: 800 }); await pg.waitForTimeout(400); ok(!(await st(pg)).c, '1280 px nicht betroffen');
  ok(await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum)) === sum0 && !/lvd-ly-dock/.test(await pg.evaluate(() => JSON.stringify(window.__LVD.S()))), 'keine Kostenwirkung, nichts im Projekt');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
