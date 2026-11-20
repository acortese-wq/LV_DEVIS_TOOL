/* t137: UX-Runde 11/2026 P4 – Kosten-Unterschied nach «In Datensätze übernehmen»
   - Meldung «+ CHF … netto (Schacht 1)» mit «Rückgängig»; Unterschied = Netto nachher − Netto vorher (auf den Rappen)
   - Layout A: Meldung sichtbar in der wieder geöffneten Karte, Kennzahl «Kosten exkl. MWST» zeigt 2 s den Unterschied
   - Rückgängig stellt den Stand vor dem Übernehmen wieder her; klassische Ansicht: Meldung ebenfalls mit Unterschied */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const num = t => { const m = /([+−±]) CHF ([\d'’.]+) netto/.exec(t || ''); if (!m) return NaN; const v = parseFloat(m[2].replace(/['’]/g, '')); return m[1] === '−' ? -v : m[1] === '±' ? 0 : v; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => { localStorage.setItem('lvd-layout', 'a'); window.__LVD_START_OFF = 1; });
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(2500);
  const n0 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto);
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mpt]').click()); const bb = await pg.locator('#kmMap').boundingBox();
  await pg.mouse.click(bb.x + bb.width * 0.45, bb.y + bb.height * 0.6); await pg.waitForTimeout(500);
  await pg.click('.kmheadb [data-k=apply]'); const tA = Date.now();
  for (let t = 0; t < 40 && !(await pg.locator('dialog.kmlya[open] .kmtoast').count()); t++) await pg.waitForTimeout(100);
  const r = await pg.evaluate(() => ({ toast: (document.querySelector('dialog.kmlya[open] .kmtoast') || {}).textContent || '', undo: !!document.querySelector('dialog.kmlya[open] .kmtoast button'), delta: (document.querySelector('.lymain .lydelta') || {}).textContent || '', n1: KVE.calc(window.__LVD.S(), LV).sum.netto, last: window.__LVD_LASTDIFF }));
  const d = num(r.toast), exp = Math.round((r.n1 - n0) * 100) / 100;
  ok(/^\+ CHF [\d'’.]+ netto \(Schacht 1\) · /.test(r.toast) && r.undo, 'Meldung in der Karte: «' + r.toast.slice(0, 60) + '…» mit Rückgängig');
  ok(Math.abs(d - exp) < 0.005 && Math.abs(r.last.d - exp) < 0.005, 'Unterschied = Netto nachher − vorher auf den Rappen (' + d + ' = ' + r.n1 + ' − ' + n0 + ')');
  ok(/^\+ CHF [\d'’]+$/.test(r.delta.trim()), 'Kennzahl «Kosten exkl. MWST» zeigt den Unterschied «' + r.delta.trim() + '» (nach ' + (Date.now() - tA) + ' ms)');
  await pg.waitForTimeout(Math.max(0, 2600 - (Date.now() - tA)));
  ok(!(await pg.locator('.lymain .lydelta').count()), 'nach 2 s ausgeblendet');
  // Rückgängig
  const nPts = await pg.evaluate(() => window.__LVD.S().karte.pts.length);
  await pg.click('dialog.kmlya[open] .kmtoast button'); await pg.waitForTimeout(2500);
  const u = await pg.evaluate(() => ({ s: window.__LVD.S().karte.pts.length, m: window.__KM.M().pts.length, open: !!document.querySelector('dialog.kmlya[open]'), n: KVE.calc(window.__LVD.S(), LV).sum.netto }));
  ok(nPts === 1 && u.s === 0 && u.m === 0 && u.open && Math.abs(u.n - n0) < 0.005, 'Rückgängig: Stand vor dem Übernehmen (Karte neu geöffnet, Netto ' + u.n + ')');
  // zweite Übernahme: Schacht wieder setzen und löschen → «− CHF»
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mpt]').click()); await pg.mouse.click(bb.x + bb.width * 0.45, bb.y + bb.height * 0.6); await pg.waitForTimeout(400);
  await pg.click('.kmheadb [data-k=apply]'); await pg.waitForTimeout(2500);
  const nA = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto);
  await pg.evaluate(() => { const M = window.__KM.M(); M.pts.length = 0; window.__KM.refresh(); }); await pg.waitForTimeout(300);
  await pg.click('.kmheadb [data-k=apply]'); for (let t = 0; t < 40 && !(await pg.locator('dialog.kmlya[open] .kmtoast').count()); t++) await pg.waitForTimeout(100);
  const r2 = await pg.evaluate(() => ({ toast: (document.querySelector('dialog.kmlya[open] .kmtoast') || {}).textContent || '', n: KVE.calc(window.__LVD.S(), LV).sum.netto }));
  ok(/^− CHF/.test(r2.toast) && Math.abs(num(r2.toast) - Math.round((r2.n - nA) * 100) / 100) < 0.005, 'Löschen und übernehmen: «' + r2.toast.slice(0, 40) + '…»');
  await pg.close();
  // klassische Ansicht
  const pc = await b.newPage({ viewport: { width: 1440, height: 900 } }); pc.on('pageerror', e => errs.push(e.message)); pc.on('dialog', d0 => d0.accept());
  await pc.addInitScript(() => { localStorage.setItem('lvd-layout', 'classic'); window.__LVD_START_OFF = 1; });
  await pc.route('**/*', r0 => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r0.request().url()) ? r0.fulfill({ status: 204 }) : r0.fallback());
  await pc.goto(process.env.LVD_URL || INDEX); await pc.waitForTimeout(1200);
  const c0 = await pc.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.netto);
  await pc.click('#kmOpen'); await pc.waitForSelector('dialog[open]'); await pc.waitForTimeout(1200);
  for (let i = 0; i < 9; i++) { await pc.click('.leaflet-control-zoom-in'); await pc.waitForTimeout(80); }
  await pc.click('[data-k=mpt]'); const bc = await pc.locator('#kmMap').boundingBox(); await pc.mouse.click(bc.x + 300, bc.y + 200); await pc.waitForTimeout(500);
  await pc.click('[data-k=apply]'); await pc.waitForTimeout(1200);
  const rc = await pc.evaluate(() => ({ toast: (document.querySelector('body > .kmtoast, .kmtoast') || {}).textContent || '', n: KVE.calc(window.__LVD.S(), LV).sum.netto }));
  ok(Math.abs(num(rc.toast) - Math.round((rc.n - c0) * 100) / 100) < 0.005 && /Schacht 1/.test(rc.toast), 'klassisch: «' + rc.toast.slice(0, 50) + '…»');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
