/* t79: Engineering-Arbeitsplatz (Redesign Phase D/E) – dunkles Thema (umschaltbar, gemerkt), axe hell+dunkel, Statuszeile mit Befehlszeile,
   Ansicht-Menü, Dock-Höhe ziehbar/Tastatur, Kostenleiste (Rabatt, Hinweise → Dock), Projektexplorer (Suche, Auswahl → Eigenschaften, DXF-Layer),
   Kürzel Strg+J/B/F, Arbeitsfläche gross, kein Überlauf 1024–1920, Kosten = Regressions-Referenz */
const fs = require('fs'), path = require('path'), K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const G = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'tests/fixtures/golden.json')));
const toA = async pg => { await pg.evaluate(() => localStorage.setItem('lvd-layout', 'a')); await pg.waitForTimeout(1200); await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500); };
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(800); await toA(pg);
  ok(await pg.evaluate(() => document.querySelector('dialog.kmlya').classList.contains('nc-dark')), 'Arbeitsplatz startet im dunklen Engineering-Thema');
  const bg = await pg.evaluate(() => getComputedStyle(document.querySelector('dialog.kmlya')).backgroundColor);
  ok(bg === 'rgb(13, 26, 35)', 'Thema aus Tokens (Hintergrund ' + bg + ')');
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('dialog.kmlya .btn:not(.ghost)')).backgroundColor) === 'rgb(11, 107, 114)', 'Akzent bleibt Petrol #0b6b72');
  await pg.addScriptTag({ path: AXE });
  const axe = () => pg.evaluate(() => axe.run(document.querySelector('dialog.kmlya'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
  let ax = await axe(); ok(ax.length === 0, 'axe dunkel: ' + JSON.stringify(ax));
  await pg.click('[data-nctheme]'); await pg.waitForTimeout(200);
  ok(!(await pg.evaluate(() => document.querySelector('dialog.kmlya').classList.contains('nc-dark'))) && await pg.evaluate(() => localStorage.getItem('lvd-theme')) === 'light', 'Umschalten auf hell, Wahl gemerkt (nicht im Projekt)');
  ax = await axe(); ok(ax.length === 0, 'axe hell: ' + JSON.stringify(ax));
  await pg.click('[data-nctheme]'); await pg.waitForTimeout(200);
  ok(!(await pg.evaluate(() => JSON.stringify(window.__LVD.S())).then(s => /lvd-theme|nc-dark/.test(s))), 'Thema verändert keine Projektdaten');
  // Arbeitsfläche
  const geo = await pg.evaluate(() => { const m = document.querySelector('#kmMap').getBoundingClientRect(); return { h: m.height, w: m.width }; });
  ok(geo.h >= 0.5 * 900 && geo.w >= 0.6 * 1440, 'Arbeitsfläche gross: ' + Math.round(geo.w) + '×' + Math.round(geo.h) + ' px (vorher 302 px hoch)');
  ok(await pg.locator('.kmbottom .lycmd .kmhelp').count() === 1 && await pg.evaluate(() => document.querySelector('.kmbottom').getBoundingClientRect().height) < 46, 'eine Statuszeile mit Befehlszeile (< 46 px)');
  ok(await pg.locator('.lycred').isVisible() && /Alessandro Cortese/.test(await pg.textContent('.lycred')), 'Urheber in der Statuszeile sichtbar');
  await pg.click('.lyviewm > summary'); await pg.waitForTimeout(150);
  ok(await pg.locator('.lyviewb #kmBase').isVisible() && await pg.locator('.lyviewb [data-k=sv]').count() === 1 && await pg.locator('.lyviewb .kmunits').isVisible(), 'Menü «Ansicht»: Kartenquelle, Street View, Masshinweis …');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100); ok(!(await pg.locator('.lyviewb #kmBase').isVisible()) && await pg.locator('dialog.kmlya[open]').count() === 1, 'Escape schliesst nur das Menü');
  ok(await pg.locator('.lynav .kmmidtog').isVisible(), '«Ebenen» in der Kopfleiste');
  // Dock-Höhe
  const h0 = await pg.evaluate(() => document.querySelector('.lydpan:not([hidden])').getBoundingClientRect().height);
  await pg.focus('.lydrag'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.waitForTimeout(150);
  const h1 = await pg.evaluate(() => document.querySelector('.lydpan:not([hidden])').getBoundingClientRect().height);
  ok(Math.abs(h1 - h0 - 40) <= 2 && +(await pg.evaluate(() => localStorage.getItem('lvd-dockh'))) > 0, 'Dock-Höhe per Tastatur (+40 px: ' + Math.round(h0) + ' → ' + Math.round(h1) + '), gemerkt');
  const gb = await pg.locator('.lydrag').boundingBox(); await pg.mouse.move(gb.x + gb.width / 2, gb.y + 3); await pg.mouse.down(); for (let i = 1; i <= 6; i++) { await pg.mouse.move(gb.x + gb.width / 2, gb.y + 3 + i * 10.5); await pg.waitForTimeout(60); } await pg.waitForTimeout(250); await pg.mouse.up(); await pg.waitForTimeout(900);
  const h2 = await pg.evaluate(() => document.querySelector('.lydpan:not([hidden])').getBoundingClientRect().height); ok(h2 < h1 - 40, 'Dock-Höhe per Ziehen (' + Math.round(h1) + ' → ' + Math.round(h2) + ')');
  await pg.keyboard.press('Control+j'); await pg.waitForTimeout(150); ok(await pg.locator('.lydpan:visible').count() === 0, 'Strg+J klappt das Dock ein'); await pg.keyboard.press('Control+j'); await pg.waitForTimeout(150); ok(await pg.locator('.lydpan:visible').count() === 1, 'Strg+J öffnet es wieder');
  // Kostenleiste
  const kpi = await pg.textContent('#lyKpi'), g0 = G.cases[0].out.sum, f0 = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  ok(kpi.includes('CHF ' + f0(g0.netto)) && kpi.includes('CHF ' + f0(g0.brutto)) && /Stufe 4 · 7 %/.test(kpi), 'Kostenleiste = Referenz (netto ' + f0(g0.netto) + ', brutto ' + f0(g0.brutto) + ', Rabatt Stufe 4 · 7 %)');
  await pg.click('[data-lywarn]'); await pg.waitForTimeout(150); ok(await pg.getAttribute('#lyT_warn', 'aria-selected') === 'true' && await pg.locator('#lyP_warn').isVisible(), 'Hinweise in der Kostenleiste öffnen das Dock «Hinweise»');
  // Explorer
  await pg.click('#lyLT_e'); await pg.waitForTimeout(150);
  ok(await pg.locator('#lyExp').isVisible() && !(await pg.locator('#kmToolsBody').isVisible()), 'Reiter «Explorer» im linken Panel');
  const n0 = await pg.locator('[data-exsel]').count(); ok(n0 >= 9, 'Explorer listet Zeichnungsobjekte (' + n0 + ')');
  await pg.fill('#lyExQ', 'Dorfstrasse'); await pg.waitForTimeout(150); const n1 = await pg.locator('[data-exsel]').count(); ok(n1 > 0 && n1 < n0, 'Suche filtert (' + n1 + ' Treffer)');
  await pg.fill('#lyExQ', ''); await pg.locator('[data-exsel]').first().click(); await pg.waitForTimeout(300);
  const selId = await pg.evaluate(() => document.querySelector('[data-exsel].on') && document.querySelector('[data-exsel].on').getAttribute('data-exsel'));
  ok(selId && await pg.evaluate(id => document.querySelector('.kmrow.on') && document.querySelector('.kmrow.on').getAttribute('data-rid') === id, selId), 'Auswahl im Explorer = Auswahl in Karte und Eigenschaften');
  await pg.click('#kmMap', { position: { x: 30, y: 300 } }).catch(() => {}); await pg.waitForTimeout(150);
  await pg.keyboard.press('Control+b'); await pg.waitForTimeout(150); ok(await pg.locator('#kmToolsBody').isVisible(), 'Strg+B wechselt zu «Werkzeuge»');
  await pg.keyboard.press('Control+f'); await pg.waitForTimeout(150); ok(await pg.evaluate(() => document.activeElement && document.activeElement.id === 'lyExQ'), 'Strg+F → Suche im Projekt');
  // Bildschirmgrössen
  for (const [w, h] of [[1920, 1080], [1280, 800], [1024, 768]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'), m = document.querySelector('#kmMap').getBoundingClientRect(); return { ov: d.scrollWidth > innerWidth + 1, mh: m.height, mw: m.width }; });
    ok(!r.ov && r.mh > 0.35 * h && r.mw > 0.4 * w, w + '×' + h + ': kein Überlauf, Karte ' + Math.round(r.mw) + '×' + Math.round(r.mh)); }
  await pg.screenshot({ path: K.tmp('t79.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
