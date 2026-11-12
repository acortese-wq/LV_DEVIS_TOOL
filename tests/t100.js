/* t100: Rechtsklick in der Karte bei Auswahl: Kopieren, Einfügen hier, Löschen (auch Mehrfachauswahl), Rückgängig; Strg+C/Strg+V */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__KM.fit()); await pg.waitForTimeout(500);
  const nL = () => pg.evaluate(() => window.__KM.M().lines.length);
  const at = (idx, t) => pg.evaluate(([idx, t]) => { const m = window.__KM.map(), l = window.__KM.M().lines.filter(x => x.pts.length > 1)[idx], a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]); const la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c; const p = m.latLngToContainerPoint([la[0] + (lc[0] - la[0]) * t, la[1] + (lc[1] - la[1]) * t]), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, [idx, t]);
  const menu = () => pg.$$eval('#kmCtx button', x => x.map(e => e.textContent.trim()));
  const n0 = await nL(); const p0 = await at(0, 0.5);
  await pg.mouse.click(p0.x, p0.y, { button: 'right' }); await pg.waitForTimeout(300); let m = await menu();
  ok(m.some(x => /^Kopieren \(1\)/.test(x)) && m.some(x => /^Löschen \(1\)/.test(x)), 'Rechtsklick auf gewähltes Objekt: Kopieren (1) und Löschen (1) (' + m.filter(x => /Kopieren|Löschen|Einfügen/.test(x)).join(' | ') + ')');
  ok(!m.some(x => /Einfügen hier/.test(x)), 'Einfügen erst nach dem Kopieren');
  await pg.click('#kmCtx button >> text=Kopieren (1)'); await pg.waitForTimeout(300);
  // Einfügen an leerem Punkt (Kartenecke)
  const mp = await pg.evaluate(() => { const r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + r.width - 80, y: r.top + r.height - 60 }; });
  await pg.mouse.click(mp.x, mp.y, { button: 'right' }); await pg.waitForTimeout(300); m = await menu();
  ok(m.some(x => /Einfügen hier/.test(x)), 'Rechtsklick an leerem Punkt: «Einfügen hier» (' + m.filter(x => /Kopieren|Löschen|Einfügen/.test(x)).join(' | ') + ')');
  await pg.click('#kmCtx button >> text=Einfügen hier'); await pg.waitForTimeout(500);
  ok((await nL()) === n0 + 1, 'Einfügen erzeugt eine neue Linie (' + n0 + ' → ' + (await nL()) + ')');
  const pos = await pg.evaluate(() => { const L = window.__KM.M().lines, a = L[L.length - 1].pts[0], b = L[0].pts[0]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }); ok(pos > 3, 'eingefügte Linie liegt am Klickpunkt, nicht über dem Original (Abstand ' + Math.round(pos) + ' m)');
  // Löschen über das Menü der neuen (gewählten) Linie, dann Rückgängig
  const p1 = await pg.evaluate(() => { const m = window.__KM.map(), L = window.__KM.M().lines, l = L[L.length - 1], a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]), la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c, p = m.latLngToContainerPoint([la[0] + (lc[0] - la[0]) * 0.27, la[1] + (lc[1] - la[1]) * 0.27]), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; });
    await pg.evaluate(() => document.querySelectorAll('.kmtoast').forEach(t => t.remove())); await pg.mouse.click(p1.x, p1.y, { button: 'right' }); await pg.waitForTimeout(300);
    await pg.click('#kmCtx button >> text=Löschen (1)'); await pg.waitForTimeout(400); ok((await nL()) === n0, 'Löschen über das Menü entfernt die Linie');
  await pg.evaluate(() => document.querySelector('[data-k=undo]').click()); await pg.waitForTimeout(400); ok((await nL()) === n0 + 1, 'Rückgängig stellt sie wieder her');
  // Mehrfachauswahl: Strg+A, Rechtsklick auf Objekt -> alle
  await pg.evaluate(() => document.querySelector('[data-k=medit]') && document.querySelector('[data-k=medit]').click()); await pg.waitForTimeout(300);
  await pg.evaluate(() => { document.querySelector('#kmMap').focus(); }); await pg.keyboard.press('Control+a'); await pg.waitForTimeout(400);
  const nAll = await pg.evaluate(() => { const M = window.__KM.M(); return [M.lines, M.pts, M.sond, M.notes, M.areas, M.wl, M.geb].reduce((s, a) => s + (a ? a.length : 0), 0); });
  await pg.mouse.click(p0.x, p0.y, { button: 'right' }); await pg.waitForTimeout(300); m = await menu();
  ok(m.some(x => new RegExp('^Kopieren \\(' + nAll + '\\)').test(x)), 'Mehrfachauswahl: Rechtsklick auf Objekt wirkt auf alle (' + m.filter(x => /Kopieren/.test(x)).join('') + ' von ' + nAll + ')');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
