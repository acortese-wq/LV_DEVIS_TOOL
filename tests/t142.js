/* t142: UX-Runde 11/2026 P11 – Kontextmenü im Explorer (Layout A)
   - Rechtsklick und langer Druck (Touch) auf ein Objekt öffnen das Menü: Auf Karte zeigen, Eigenschaften, Umbenennen, Duplizieren, Löschen
   - Umbenennen, Duplizieren wirken; Löschen ohne Bestätigungsdialog, mit «Rückgängig» */
process.env.LVD_LAYOUT_A = '1';
const K = require('./lib/k.js'), { chromium, ok, INDEX } = K;
const STUB = r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo|profile\.json/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback();
(async () => {
  const b = await chromium.launch(), errs = []; let dialogs = 0;
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('lvd-layout', 'classic'); window.__LVD_START_OFF = 1; });
  await pg.route('**/*', STUB); await pg.goto(process.env.LVD_URL || INDEX); await pg.waitForTimeout(1200);
  pg.once('dialog', d => d.accept()); await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1200);
  pg.on('dialog', d => { dialogs++; d.accept(); });
  await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.click('#bLyMap'); for (let t = 0; t < 30 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(200); await pg.waitForTimeout(1000);
  await pg.evaluate(() => { const t = [...document.querySelectorAll('.kmdlg [role=tab], .kmdlg button')].find(x => /^Explorer$/.test(x.textContent.trim())); if (t) t.click(); }); await pg.waitForTimeout(400);
  const first = await pg.evaluate(() => { const e = [...document.querySelectorAll('[data-exsel]')].find(x => x.offsetParent && window.__KM.M().pts.some(p => p.id === x.getAttribute('data-exsel'))); return e && e.getAttribute('data-exsel'); });
  ok(!!first, 'Explorer mit Schächten sichtbar');
  const item = () => pg.locator('[data-exsel="' + first + '"]').first();
  const menu = () => pg.evaluate(() => { const m = document.querySelector('#lyCtx'); return m && !m.hidden ? [...m.querySelectorAll('[role=menuitem]')].map(x => (x.querySelector('span:nth-child(2)') || x).textContent.trim()) : null; });
  // Rechtsklick
  await item().click({ button: 'right' }); await pg.waitForTimeout(200);
  let m = await menu(); ok(m && ['Auf Karte zeigen', 'Umbenennen', 'Duplizieren', 'Löschen'].every(t => m.some(x => x.startsWith(t))), 'Rechtsklick: ' + (m || []).join(' · '));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  // langer Druck (Touch)
  const bb = await item().boundingBox();
  await pg.evaluate(([id, x, y]) => { const e = document.querySelector('[data-exsel="' + id + '"]'); e.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, clientX: x, clientY: y, isPrimary: true })); }, [first, bb.x + 20, bb.y + bb.height / 2]);
  await pg.waitForTimeout(250); ok((await menu()) === null, 'kurzer Druck öffnet noch kein Menü');
  await pg.waitForTimeout(500); m = await menu(); ok(m && m.length >= 4, 'langer Druck (≥ 550 ms) öffnet das Menü');
  await pg.evaluate(([id, x, y]) => { const e = document.querySelector('[data-exsel="' + id + '"]'); e.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, clientX: x, clientY: y })); }, [first, bb.x + 20, bb.y + bb.height / 2]);
  // Umbenennen
  await pg.evaluate(() => [...document.querySelectorAll('#lyCtx [role=menuitem]')].find(x => /Umbenennen/.test(x.textContent)).click()); await pg.waitForTimeout(300);
  await pg.fill('[data-exren="' + first + '"]', 'Schacht Test-Umbenannt'); await pg.press('[data-exren="' + first + '"]', 'Enter'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(id => window.__KM.M().pts.find(p => p.id === id).nm, first) === 'Schacht Test-Umbenannt', 'Umbenennen über das Menü');
  // Duplizieren
  const n0 = await pg.evaluate(() => window.__KM.M().pts.length);
  await item().click({ button: 'right' }); await pg.waitForTimeout(200);
  await pg.evaluate(() => [...document.querySelectorAll('#lyCtx [role=menuitem]')].find(x => /Duplizieren/.test(x.textContent)).click()); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => window.__KM.M().pts.length) === n0 + 1, 'Duplizieren: ein Schacht mehr');
  // Löschen mit Rückgängig, ohne confirm()
  await item().click({ button: 'right' }); await pg.waitForTimeout(200);
  await pg.evaluate(() => [...document.querySelectorAll('#lyCtx [role=menuitem]')].find(x => /Löschen/.test(x.textContent)).click()); await pg.waitForTimeout(400);
  const del = await pg.evaluate(id => ({ gone: !window.__KM.M().pts.some(p => p.id === id), toast: (document.querySelector('dialog.kmlya .kmtoast') || {}).textContent || '' }), first);
  ok(del.gone && dialogs === 0 && /gelöscht/.test(del.toast) && /Rückgängig/.test(del.toast), 'Löschen ohne Bestätigungsdialog, Meldung mit «Rückgängig»');
  await pg.evaluate(() => document.querySelector('dialog.kmlya .kmtoast button').click()); await pg.waitForTimeout(400);
  ok(await pg.evaluate(id => window.__KM.M().pts.some(p => p.id === id && p.nm === 'Schacht Test-Umbenannt'), first), 'Rückgängig stellt das Objekt wieder her');
  ok(errs.length === 0, 'keine JS-Fehler ' + errs.join('|'));
  await b.close();
})();
