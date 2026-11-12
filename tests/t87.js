/* t87: Suche und Kartenauswahl minimiert – Suche als Symbol in der Kopfleiste (Mitte), Klick klappt das Feld unter der Kopfleiste auf, Esc/Treffer/Klick daneben minimieren;
   Kartenauswahl als ein Knopf mit der aktiven Karte, Liste klappt auf und nach der Wahl wieder zu; nichts überlagert sich (Suche, Kartenauswahl, Zoom, Eigenschaften);
   1440/1024/390/320 px, axe, 4 Sprachen */
const K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800); };
const box = (pg, s) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return e.offsetParent === null && getComputedStyle(e).position !== 'fixed' ? null : { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, s);
const hit = (a, b) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900); let q = '';
  await pg.route('**/*', r => { const u = r.request().url(); if (/SearchServer/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results: [{ attrs: { label: '<b>Bahnhofstrasse 1</b> 7000 Chur', lat: 46.85, lon: 9.53 } }] }) }); return /wmts|wms\.geo|api3/.test(u) ? r.fulfill({ status: 204 }) : r.fallback(); });
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  // Ausgangszustand: beides minimiert
  ok(!(await pg.locator('#kmQ').isVisible()) && await pg.locator('.lysbtn').isVisible() && await pg.getAttribute('.lysbtn', 'aria-expanded') === 'false', 'Suche minimiert (nur Symbol)');
  ok(!(await pg.locator('.lybl').isVisible()) && /Parzellen/.test(await pg.textContent('.lybtn')), 'Kartenauswahl minimiert, zeigt die aktive Karte: «' + (await pg.textContent('.lybtn')).trim() + '»');
  const sb = await box(pg, '.lysbtn'), hd = await box(pg, '.kmhead'), nav = await box(pg, '.lynav'), kb = await box(pg, '.lycmdk-b');
  ok(sb && hd && sb.t >= hd.t && sb.b <= hd.b + 1 && Math.abs((sb.l + sb.r) / 2 - (hd.l + hd.r) / 2) < 0.2 * hd.w, 'Suche in der Kopfleiste, ungefähr in der Mitte (' + Math.round((sb.l + sb.r) / 2) + ' von ' + Math.round(hd.w) + ' px)');
  ok(!hit(sb, nav) && !hit(sb, kb), 'Suchsymbol überdeckt keine Kopfleisten-Knöpfe');
  // Alle Elemente über der Karte überlagern sich nicht
  const ov = await pg.evaluate(() => { const els = ['.lybtn', '.leaflet-control-zoom', '.kmsw', '#kmSlot'].map(s => document.querySelector('#kmMap ~ * ' + s) || document.querySelector(s)).filter(Boolean); const r = els.filter(e => e.offsetParent).map(e => e.getBoundingClientRect()); let c = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right && r[i].right > r[j].left && r[i].top < r[j].bottom && r[i].bottom > r[j].top) c++; return c; });
  ok(ov === 0, 'Bedienelemente über der Karte überlagern sich nicht (' + ov + ')');
  // Suche öffnen
  await pg.click('.lysbtn'); await pg.waitForTimeout(200);
  ok(await pg.locator('#kmQ').isVisible() && await pg.evaluate(() => document.activeElement.id) === 'kmQ' && await pg.getAttribute('.lysbtn', 'aria-expanded') === 'true', 'Klick öffnet das Suchfeld, Fokus im Feld');
  const pp = await box(pg, '.lyspop'); ok(pp && hd && pp.t >= hd.b - 2 && Math.abs((pp.l + pp.r) / 2 - (hd.l + hd.r) / 2) < 3, 'Suchfeld klappt mittig unter der Kopfleiste auf');
  await pg.fill('#kmQ', 'Chur'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  ok(await pg.locator('.kmhit').count() === 1 && await pg.locator('.lyspop').isVisible(), 'Suche liefert Treffer, Feld bleibt offen');
  await pg.click('.kmhit'); await pg.waitForTimeout(400);
  ok(!(await pg.locator('#kmQ').isVisible()) && await pg.evaluate(() => Math.abs(window.__KM.map().getCenter().lat - 46.85) < 0.01), 'Treffer gewählt: Karte springt hin, Suche minimiert sich');
  await pg.click('.lysbtn'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok(!(await pg.locator('#kmQ').isVisible()) && await pg.locator('dialog.kmlya[open]').count() === 1 && await pg.evaluate(() => document.activeElement.classList.contains('lysbtn')), 'Esc minimiert nur die Suche, Fokus zurück auf das Symbol');
  await pg.click('.lysbtn'); await pg.mouse.click(700, 500); await pg.waitForTimeout(300); ok(!(await pg.locator('#kmQ').isVisible()), 'Klick auf die Karte minimiert die Suche');
  await pg.click('.lysbtn'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(500);
  ok(!(await pg.locator('#kmQ').isVisible()), 'Fokus verlässt das leere Feld: minimiert');
  // Kartenauswahl
  await pg.click('.lybtn'); await pg.waitForTimeout(150);
  ok(await pg.locator('.lybl').isVisible() && await pg.locator('.lybl [data-lyb]').count() === 5 && await pg.getAttribute('.lybtn', 'aria-expanded') === 'true', 'Kartenauswahl klappt auf (5 Karten)');
  const lb = await box(pg, '.lybl'); const mp = await box(pg, '#kmMap'); ok(lb && mp && lb.r <= mp.r + 1 && lb.l >= mp.l, 'Liste liegt innerhalb der Karte');
  await pg.click('.lybl [data-lyb=grau]'); await pg.waitForTimeout(400);
  ok(!(await pg.locator('.lybl').isVisible()) && /Grau/.test(await pg.textContent('.lybtn')) && await pg.evaluate(() => localStorage.getItem('lvd-km-base')) === 'grau', 'Wahl «Grau»: Liste klappt zu, Knopf zeigt «Grau»');
  await pg.click('.lybtn'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); ok(!(await pg.locator('.lybl').isVisible()) && await pg.locator('dialog.kmlya[open]').count() === 1, 'Esc klappt die Kartenauswahl zu');
  await pg.click('.lybtn'); await pg.mouse.click(600, 500); await pg.waitForTimeout(300); ok(!(await pg.locator('.lybl').isVisible()), 'Klick auf die Karte klappt sie zu');
  await pg.click('.lysbtn'); await pg.click('.lybtn'); await pg.waitForTimeout(200); ok(!(await pg.locator('#kmQ').isVisible()) && await pg.locator('.lybl').isVisible(), 'Beide öffnen sich nie gleichzeitig (Suche schliesst beim Wechsel)'); await pg.keyboard.press('Escape');
  // Befehlsleiste
  await pg.keyboard.press('Control+k'); await pg.keyboard.type('suche'); await pg.waitForTimeout(150); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  ok(await pg.locator('#kmQ').isVisible(), 'Befehlsleiste: «Suche» öffnet das Suchfeld'); await pg.keyboard.press('Escape');
  // axe
  await pg.click('.lysbtn'); await pg.addScriptTag({ path: AXE });
  let ax = await pg.evaluate(() => axe.run(document.querySelector('.kmhead'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length))); ok(ax.length === 0, 'axe Suche offen: ' + JSON.stringify(ax)); await pg.keyboard.press('Escape');
  await pg.click('.lybtn'); ax = await pg.evaluate(() => axe.run(document.querySelector('.lybase'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length))); ok(ax.length === 0, 'axe Kartenauswahl offen: ' + JSON.stringify(ax)); await pg.keyboard.press('Escape');
  // Grössen
  for (const [w, h] of [[1024, 768], [390, 844], [320, 568]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400);
    await pg.click('.lysbtn'); await pg.waitForTimeout(150); const r1 = await pg.evaluate(() => { const p = document.querySelector('.lyspop').getBoundingClientRect(), d = document.querySelector('dialog.kmlya'); return { in: p.left >= -1 && p.right <= innerWidth + 1, ov: d.scrollWidth > innerWidth + 1 }; }); await pg.keyboard.press('Escape');
    await pg.click('.lybtn'); await pg.waitForTimeout(150); const r2 = await pg.evaluate(() => { const p = document.querySelector('.lybl').getBoundingClientRect(), d = document.querySelector('dialog.kmlya'); return { in: p.left >= -1 && p.right <= innerWidth + 1 && p.bottom <= innerHeight + 1, ov: d.scrollWidth > innerWidth + 1 }; }); await pg.keyboard.press('Escape');
    ok(r1.in && r2.in && !r1.ov && !r2.ov, w + '×' + h + ': Suche und Kartenauswahl im Bild, kein Überlauf'); }
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(300);
  for (const [l, t] of [['fr', 'Recherche'], ['it', 'Cerca'], ['en', 'Search']]) { await pg.click('[data-lylang=' + l + ']'); await open(pg); ok((await pg.textContent('.lysbtn')).trim() === t && await pg.locator('.lybtn').count() === 1, l.toUpperCase() + ': «' + t + '»'); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
