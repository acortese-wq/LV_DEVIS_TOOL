/* t82: Handy/Tablet (Redesign Phase H) – Arbeitsplatz startet auch auf dem Handy; Karte vollflächig; Bereichsleiste unten mit Bottom Sheets
   (Werkzeuge, Ebenen, Eigenschaften, Auswertung, Mehr), Griff ½/voll, Esc schliesst, Werkzeug wählen schliesst das Blatt, Menü ☰ (Ansichten,
   Sprache, Speichern, Übernehmen), Befehlsleiste; 320/375/390/430/768 px und quer ohne Überlauf, Zielgrössen ≥ 44 px, axe; Desktop unverändert */
const K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const toA = async pg => { await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1200); await pg.reload(); for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500); };
const route = pg => pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 390, 844); await route(pg); await toA(pg);
  ok(await pg.locator('dialog.kmlya[open]').count() === 1, 'Handy startet im Arbeitsplatz (Karte)');
  const sum0 = await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum));
  const g = await pg.evaluate(() => { const m = document.querySelector('#kmMap').getBoundingClientRect(), t = document.querySelector('.lymtab').getBoundingClientRect(); return { mh: m.height, mw: m.width, tb: t.bottom, th: t.height, sw: document.querySelector('dialog.kmlya').scrollWidth, sh: document.querySelector('dialog.kmlya').scrollHeight }; });
  ok(g.mw >= 389 && g.mh >= 0.7 * 844, 'Karte vollflächig: ' + Math.round(g.mw) + '×' + Math.round(g.mh) + ' px');
  ok(g.sw <= 391 && g.sh <= 845 && Math.abs(g.tb - 844) < 1, 'kein Überlauf, Bereichsleiste am unteren Rand (' + Math.round(g.th) + ' px)');
  ok(await pg.locator('.lymtab [data-msh]').count() === 5 && !(await pg.locator('.kmtools').isVisible()) && !(await pg.locator('.lydock').isVisible()), 'fünf Bereiche, Blätter zu Beginn geschlossen');
  ok(/CHF/.test(await pg.textContent('.lybar')) && await pg.evaluate(() => { const e = document.querySelector('.lykpi .lymain').getBoundingClientRect(); return e.left >= 0 && e.right <= 390; }), 'Kosten netto in der Kopfzeile sichtbar');
  // Ziele ≥ 44 px
  const small = await pg.evaluate(() => [...document.querySelectorAll('.lymtab button, .kmhead button:not([hidden])')].filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return [x.textContent.trim().slice(0, 12), Math.round(r.width), Math.round(r.height)]; }).filter(a => a[1] < 44 || a[2] < 44));
  ok(small.length === 0, 'Zielgrössen ≥ 44 px (Kopf, Bereichsleiste) ' + JSON.stringify(small));
  // Werkzeuge
  await pg.click('[data-msh=tools]'); await pg.waitForTimeout(300);
  const sh = await pg.evaluate(() => { const r = document.querySelector('.kmtools').getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height }; });
  ok(await pg.locator('.kmtools').isVisible() && sh.h > 0.4 * 844 && sh.h < 0.6 * 844 && Math.abs(sh.b - (844 - 58)) < 2, 'Blatt «Werkzeuge» halb offen über der Leiste (' + Math.round(sh.h) + ' px)');
  ok(await pg.getAttribute('[data-msh=tools]', 'aria-expanded') === 'true', 'aria-expanded am Bereichsknopf');
  await pg.click('.lymgrip'); await pg.waitForTimeout(250);
  const h2 = await pg.evaluate(() => document.querySelector('.kmtools').getBoundingClientRect().height); ok(h2 > 0.75 * 844 - 120, 'Griff: Blatt ganz offen (' + Math.round(h2) + ' px)');
  await pg.click('#kmToolsBody [data-k=mline]'); await pg.waitForTimeout(250);
  ok(!(await pg.locator('.kmtools').isVisible()) && await pg.getAttribute('#kmToolsBody [data-k=mline]', 'aria-pressed') === 'true', 'Werkzeug «Linie» gewählt → Blatt schliesst, Karte frei zum Zeichnen');
  await pg.evaluate(() => document.querySelector('#kmToolsBody [data-k=mline]').click()); await pg.waitForTimeout(150);
  // Eigenschaften, Auswertung, Ebenen, Mehr
  await pg.click('[data-msh=side]'); await pg.waitForTimeout(250); ok(await pg.locator('#kmPanP').isVisible(), 'Blatt «Eigenschaften»');
  await pg.click('[data-msh=dock]'); await pg.waitForTimeout(250);
  ok(await pg.locator('.lydock').isVisible() && !(await pg.locator('.kmside').isVisible()) && await pg.locator('.lydpan:not([hidden])').count() === 1, 'Blatt «Auswertung» ersetzt das vorige, Inhalt sichtbar');
  await pg.click('#lyT_pos'); await pg.waitForTimeout(250); ok(await pg.locator('#lyPosB tr').count() > 10, 'Positionen im Blatt');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  ok(!(await pg.locator('.lydock').isVisible()) && await pg.locator('dialog.kmlya[open]').count() === 1, 'Esc schliesst nur das Blatt');
  await pg.click('[data-msh=mid]'); await pg.waitForTimeout(250); ok(await pg.locator('#kmCat').isVisible(), 'Blatt «Ebenen» (Geokatalog)');
  await pg.click('[data-msh=mid]'); await pg.waitForTimeout(200); ok(!(await pg.locator('.kmmid').isVisible()), 'erneuter Tipp schliesst');
  await pg.click('[data-msh=more]'); await pg.waitForTimeout(250);
  ok(await pg.locator('.lyviewm').isVisible() && /Alessandro Cortese/.test(await pg.textContent('.kmbottom')), 'Blatt «Mehr»: Fang, Ansicht, Urheber');
  await pg.click('.lyviewm > summary'); await pg.waitForTimeout(200); ok(await pg.locator('#lySel').isVisible(), 'Layout-Umschalter erreichbar'); await pg.click('[data-msh=more]');
  // Menü
  await pg.click('.lyhm'); await pg.waitForTimeout(250);
  ok(await pg.locator('.lynav [data-ly=res]').isVisible() && await pg.locator('[data-lylang=fr]').isVisible() && await pg.locator('.kmheadb [data-k=apply]').isVisible() && await pg.locator('#lyMode').isVisible(), 'Menü ☰: Ansichten, Sprache, Modus, Übernehmen');
  ok(await pg.evaluate(() => document.querySelector('dialog.kmlya').scrollWidth <= 391), 'Menü ohne Überlauf');
  await pg.addScriptTag({ path: AXE });
  let ax = await pg.evaluate(() => axe.run(document.querySelector('dialog.kmlya'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
  ok(ax.length === 0, 'axe Handy (Menü offen): ' + JSON.stringify(ax));
  await pg.click('.lyhm'); await pg.waitForTimeout(150);
  await pg.click('[data-msh=dock]'); await pg.waitForTimeout(250);
  ax = await pg.evaluate(() => axe.run(document.querySelector('dialog.kmlya'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
  ok(ax.length === 0, 'axe Handy (Blatt offen): ' + JSON.stringify(ax));
  await pg.click('[data-msh=dock]');
  await pg.click('.lymk'); await pg.waitForTimeout(200); ok(await pg.locator('.lycmdk').isVisible(), '⌕ öffnet die Befehlsleiste'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok(!(await pg.locator('.lycmdk').isVisible()), 'Esc schliesst sie wieder (' + await pg.evaluate(() => document.activeElement.outerHTML.slice(0, 60)) + ')');
  ok(await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum)) === sum0, 'Bedienung ohne Kostenwirkung');
  for (const [w, h] of [[320, 568], [375, 667], [430, 932], [768, 1024], [844, 390]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400);
    const r = []; for (const k of ['', 'tools', 'dock']) { if (k) { await pg.click('[data-msh=' + k + ']'); await pg.waitForTimeout(200); }
      r.push(await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'); return d.scrollWidth <= innerWidth + 1 && d.scrollHeight <= innerHeight + 1; })); if (k) await pg.click('[data-msh=' + k + ']'); }
    ok(r.every(Boolean), w + '×' + h + ': ohne Überlauf (Karte, Werkzeuge, Auswertung)'); }
  // Desktop unverändert
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(500);
  ok(!(await pg.locator('.lymtab').isVisible()) && await pg.locator('.kmtools').isVisible() && await pg.locator('.lydock').isVisible() && await pg.locator('.lynav').isVisible(), 'zurück auf 1440 px: Desktop-Arbeitsplatz wie vorher');
  await pg.screenshot({ path: K.tmp('t82.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
