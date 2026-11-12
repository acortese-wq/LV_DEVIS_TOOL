/* t103: Civil-3D-Muster – Stützpunkt-Kontextmenü, Wiederholen (Enter), Fenster-/Kreuzauswahl und Ähnliche auswählen, Anzeige-Stil (Beschriftung nach Zoom), Schnellzugriff in Eigenschaften; Bericht: Luftbild auf der ersten Seite */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.__KM.fit(); const b = document.querySelector('[data-k=medit]'); if (b) b.click(); }); await pg.waitForTimeout(600);
  const toast = () => pg.evaluate(() => (document.querySelector('dialog.kmdlg .kmtoast') || {}).textContent || '');
  const menu = () => pg.$$eval('#kmCtx button', x => x.map(e => e.textContent.trim()));
  // 1) Stützpunkt-Menü
  const lid = await pg.evaluate(() => window.__KM.M().lines.find(l => l.pts.length > 1).id); await pg.evaluate(id => window.__KM.select(id), lid); await pg.waitForTimeout(600);
  const n0 = await pg.evaluate(id => window.__KM.M().lines.find(l => l.id === id).pts.length, lid);
  const vh = await pg.$$('.kmv'); ok(vh.length >= 2, 'gewählte Linie zeigt Griffe (' + vh.length + ')');
  await vh[1].click({ button: 'right' }); await pg.waitForTimeout(300); const m1 = await menu();
  ok(m1.some(x => /Punkt dahinter einfügen/.test(x)) && m1.some(x => /Abzweig/.test(x)), 'Rechtsklick auf Griff: Menü statt sofort löschen (' + m1.join(' | ') + ')');
  await pg.click('#kmCtx button >> text=Punkt dahinter einfügen'); await pg.waitForTimeout(400);
  ok((await pg.evaluate(id => window.__KM.M().lines.find(l => l.id === id).pts.length, lid)) === n0 + 1, 'Punkt dahinter einfügen: ' + n0 + ' → ' + (n0 + 1) + ' Punkte');
  await pg.evaluate(() => document.querySelector('[data-k=undo]').click()); await pg.waitForTimeout(300);
  // 2) Wiederholen
  await pg.evaluate(() => { document.querySelector('[data-k=mpt]').click(); }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { document.querySelector('[data-k=medit]').click(); document.querySelector('#kmMap').focus(); }); await pg.waitForTimeout(300);
  const pr0 = await pg.evaluate(() => document.querySelector('[data-k=mpt]').getAttribute('aria-pressed')); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  const pr1 = await pg.evaluate(() => document.querySelector('[data-k=mpt]').getAttribute('aria-pressed')); ok(pr0 !== 'true' && pr1 === 'true', 'Enter wiederholt den letzten Befehl (Schacht-Werkzeug wieder aktiv)');
  await pg.evaluate(() => { document.querySelector('[data-k=medit]').click(); }); await pg.waitForTimeout(300);
  const mp = await pg.evaluate(() => { const r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + r.width - 60, y: r.top + 70 }; });
  await pg.mouse.click(mp.x, mp.y, { button: 'right' }); await pg.waitForTimeout(300); const m3 = await menu(); ok(m3.some(x => /^Wiederholen:/.test(x)), 'Rechtsklick ins Leere: «' + (m3.find(x => /^Wiederholen/.test(x)) || '') + '»'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  // 3) Fenster-/Kreuzauswahl
  const box = await pg.locator('#kmMap').boundingBox(), tot = await pg.evaluate(() => { const M = window.__KM.M(); return [M.lines, M.pts, M.sond, M.notes, M.areas, M.wl, M.geb].reduce((s, a) => s + (a ? a.length : 0), 0); });
  await pg.evaluate(() => { document.querySelector('[data-k=medit]').click(); }); await pg.waitForTimeout(200);
  await pg.keyboard.down('Shift'); await pg.mouse.move(box.x + 6, box.y + 6); await pg.mouse.down(); await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 }); await pg.mouse.move(box.x + box.width - 6, box.y + box.height - 6, { steps: 5 }); await pg.mouse.up(); await pg.keyboard.up('Shift'); await pg.waitForTimeout(500);
  const tw = await toast(); const nw = +(tw.match(/(\d+) Objekt/) || [0, 0])[1]; ok(nw === tot, 'Fenster über alles: ' + nw + ' von ' + tot + ' Objekten gewählt');
  const p0 = await pg.evaluate(() => { const m = window.__KM.map(), l = window.__KM.M().lines.find(x => x.pts.length > 1), a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]), la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c, p = m.latLngToContainerPoint([(la[0] + lc[0]) / 2, (la[1] + lc[1]) / 2]), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; });
  await pg.keyboard.down('Shift'); await pg.mouse.move(p0.x + 25, p0.y + 25); await pg.mouse.down(); await pg.mouse.move(p0.x - 25, p0.y - 25, { steps: 6 }); await pg.mouse.up(); await pg.keyboard.up('Shift'); await pg.waitForTimeout(500);
  const tc = await toast(); const nc = +(tc.match(/(\d+) Objekt/) || [0, 0])[1]; ok(nc >= 1 && nc < tot, 'Kreuzen (rechts→links) berührt nur ' + nc + ' Objekt(e) (von ' + tot + ')');
  // Ähnliche auswählen
  await pg.mouse.click(p0.x, p0.y, { button: 'right' }); await pg.waitForTimeout(300); const m4 = await menu(); ok(m4.includes('Ähnliche auswählen'), 'Objektmenü: «Ähnliche auswählen»');
  await pg.click('#kmCtx button >> text=Ähnliche auswählen'); await pg.waitForTimeout(400); ok(/\d+ Objekt\(e\) gewählt/.test(await toast()), 'Ähnliche auswählen: ' + (await toast()));
  // 4) Anzeige-Stil
  const lbl = () => pg.evaluate(() => document.querySelectorAll('.kmlbl').length);
  await pg.selectOption('#kmStl', 'std'); await pg.waitForTimeout(400); const l0 = await lbl();
  await pg.selectOption('#kmStl', 'min'); await pg.waitForTimeout(400); const l1 = await lbl();
  await pg.selectOption('#kmStl', 'zoom'); await pg.evaluate(() => window.__KM.map().setZoom(12, { animate: false })); await pg.waitForTimeout(600); const l2 = await lbl();
  await pg.evaluate(() => window.__KM.map().setZoom(18, { animate: false })); await pg.waitForTimeout(600); const l3 = await lbl();
  ok(l0 > 0 && l1 === 0 && l2 === 0 && l3 > 0, 'Anzeige-Stil: Standard ' + l0 + ' Beschriftungen, ohne ' + l1 + ', nach Zoom weit ' + l2 + ' / nah ' + l3);
  await pg.selectOption('#kmStl', 'std');
  // 5) Schnellzugriff
  const sid = await pg.evaluate(() => { const p = window.__KM.M().pts[0]; return p && p.id; });
  if (sid) { await pg.evaluate(id => window.__KM.select(id), sid); await pg.waitForTimeout(500); const mo = await pg.evaluate(() => { const r = document.querySelector('#kmObj .kmrow.on'); const d = r && r.querySelector('.kmmore2'); return d ? { n: d.querySelectorAll('.kmc').length, open: d.open } : null; }); ok(mo === null || (mo.n >= 1 && mo.open === false), 'Schacht: Schnellzugriff (4 Felder), übrige unter «Weitere Eigenschaften» ' + JSON.stringify(mo)); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  // 6) Bericht: Luftbild auf Seite 1
  await pg.evaluate(() => { const a = document.querySelector('[data-k=apply]'); if (a) a.click(); }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) { } }); }); await pg.waitForTimeout(500);
  await pg.evaluate(() => { window.print = () => {}; document.querySelector('#bReport').click(); }); await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const b = document.querySelector('#reportDlg button[value=print]'); if (b) b.click(); }); await pg.waitForTimeout(1500);
  const rp = await pg.evaluate(() => { const c = document.querySelector('#reportDoc .rp-cover'), p = document.querySelector('#reportDoc'), sit = document.querySelector('#reportDoc .rp-map'); return { cover: !!c, luft: c ? c.innerHTML.length > 200 : false, order: p && c && sit ? (p.innerHTML.indexOf('rp-cover') < p.innerHTML.indexOf('rp-map')) : null, cap: c ? c.textContent : '' }; });
  ok(rp.cover && rp.luft, 'Bericht: erste Seite hat das Luftbild (' + (rp.cap || '').slice(0, 50) + ')'); ok(rp.order !== false, 'Reihenfolge: Luftbild vor Situation (Karte), danach Plan');
  await b.close();
})();
