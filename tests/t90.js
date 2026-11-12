/* t90: Multifunktionsleiste (Ribbon) wie in CAD/Civil – Register Start/Zeichnen/Ändern/Beschriften/Einfügen/Analyse/Ausgabe/Ansicht mit Gruppen; jeder Knopf löst den
   bestehenden Befehl aus und zeigt dessen Zustand; bisherige Werkzeugspalte bleibt; minimierbar (Knopf, Doppelklick, Strg+F1), gemerkt; Tastatur (Pfeile); axe hell+dunkel;
   1024–1920 px ohne Überlauf; auf dem Handy ausgeblendet; keine Kostenwirkung */
const K = require('./lib/k.js'), { chromium, ok, mk, AXE } = K;
const open = async pg => { for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1800); };
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); localStorage.setItem('lvd-ribbon', JSON.stringify({ t: 'start', m: false })); }); await pg.waitForTimeout(1200); await pg.reload(); await open(pg);
  const sum0 = await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum));
  const tabs = await pg.$$eval('.lyrb [role=tab]', t => t.map(x => x.textContent));
  ok(tabs.join('|') === 'Start|Zeichnen|Ändern|Beschriften|Einfügen|Analyse|Ausgabe|Ansicht', 'Register: ' + tabs.join(' · '));
  const g = await pg.evaluate(() => { const r = document.querySelector('.lyrb').getBoundingClientRect(), bar = document.querySelector('.lybar').getBoundingClientRect(), gr = document.querySelector('.kmgrid').getBoundingClientRect(); return { h: r.height, under: r.top >= bar.bottom - 1, over: r.bottom <= gr.top + 1, mh: document.querySelector('#kmMap').getBoundingClientRect().height }; });
  ok(g.under && g.over && g.h > 80 && g.h < 130 && g.mh >= 350, 'Leiste zwischen Kennzahlen und Zeichenfläche (' + Math.round(g.h) + ' px), Karte ' + Math.round(g.mh) + ' px');
  const grp = await pg.$$eval('#lyRP_start .lyrb-g', x => x.map(e => e.getAttribute('aria-label') + ':' + e.querySelectorAll('[data-rb]').length));
  ok(grp.join(' ') === 'Auswahl:1 Zeichnen:4 Bearbeiten:2 Projekt:2', 'Start mit Gruppen ' + grp.join(', '));
  ok(await pg.locator('#kmToolsBody [data-k=mline]').isVisible(), 'bisherige Werkzeugspalte bleibt unverändert');
  // Knopf löst bestehenden Befehl aus und spiegelt den Zustand
  await pg.click('#lyRP_start [data-rb*="mline"]'); await pg.waitForTimeout(250);
  ok(await pg.getAttribute('#kmToolsBody [data-k=mline]', 'aria-pressed') === 'true' && await pg.getAttribute('#lyRP_start [data-rb*="mline"]', 'aria-pressed') === 'true', '«Linie zeichnen» in der Leiste = Werkzeug aktiv (beide gedrückt)');
  await pg.click('#kmToolsBody [data-k=mline]'); await pg.waitForTimeout(250);
  ok(await pg.getAttribute('#lyRP_start [data-rb*="mline"]', 'aria-pressed') === 'false', 'Zustand folgt auch der Werkzeugspalte');
  ok(await pg.locator('#lyRP_start [data-rb*="undo"]').isDisabled() === await pg.locator('#kmToolsBody [data-k=undo]').isDisabled(), '«Rückgängig» gesperrt wie das Original');
  // Register wechseln (Maus + Tastatur)
  await pg.click('#lyRT_mod'); await pg.waitForTimeout(150);
  ok(await pg.locator('#lyRP_mod').isVisible() && !(await pg.locator('#lyRP_start').isVisible()) && await pg.locator('#lyRP_mod [data-rb]').count() >= 9, 'Register «Ändern» mit Stützpunkt-Befehlen');
  await pg.focus('#lyRT_mod'); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(150);
  ok(await pg.getAttribute('#lyRT_ann', 'aria-selected') === 'true' && await pg.evaluate(() => document.activeElement.id) === 'lyRT_ann', 'Pfeiltaste → «Beschriften»');
  // Analyse öffnet Dock-Reiter (auch wenn eingeklappt), klappt nie ein
  await pg.keyboard.press('Control+j'); await pg.waitForTimeout(150); await pg.click('#lyRT_an'); await pg.click('#lyRP_an [data-rb="#lyT_pos"]'); await pg.waitForTimeout(250);
  ok(await pg.locator('#lyP_pos').isVisible(), 'Analyse › Positionen öffnet den unteren Bereich');
  await pg.click('#lyRP_an [data-rb="#lyT_pos"]'); await pg.waitForTimeout(200); ok(await pg.locator('#lyP_pos').isVisible(), 'zweiter Klick lässt ihn offen');
  await pg.click('#lyRT_view'); await pg.click('#lyRP_view [data-rb=".lysbtn"]'); await pg.waitForTimeout(250); ok(await pg.locator('#kmQ').isVisible(), 'Ansicht › Suche öffnet das Suchfeld'); await pg.keyboard.press('Escape');
  // axe
  await pg.addScriptTag({ path: AXE });
  const axe = () => pg.evaluate(() => axe.run(document.querySelector('.lyrb'), { rules: { region: { enabled: false } } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)));
  let ax = await axe(); ok(ax.length === 0, 'axe dunkel: ' + JSON.stringify(ax));
  await pg.click('.nc-theme'); await pg.waitForTimeout(200); ax = await axe(); ok(ax.length === 0, 'axe hell: ' + JSON.stringify(ax)); await pg.click('.nc-theme');
  // Minimieren
  const mh1 = await pg.evaluate(() => (document.querySelector('#kmMap').getBoundingClientRect().height - (parseFloat(document.querySelector('dialog.kmlya').style.getPropertyValue('--lytop')) || 0)));
  await pg.click('[data-rbmin]'); await pg.waitForTimeout(300);
  const m = await pg.evaluate(() => ({ h: document.querySelector('.lyrb').getBoundingClientRect().height, mh: (document.querySelector('#kmMap').getBoundingClientRect().height - (parseFloat(document.querySelector('dialog.kmlya').style.getPropertyValue('--lytop')) || 0)), s: JSON.parse(localStorage.getItem('lvd-ribbon')) }));
  ok(m.h < 40 && m.mh > mh1 + 50 && m.s.m === true && await pg.locator('.lyrb [role=tab]').first().isVisible(), 'minimiert: nur Registerzeile (' + Math.round(m.h) + ' px), sichtbare Karte ' + Math.round(mh1) + ' → ' + Math.round(m.mh) + ' px, gemerkt');
  await pg.click('#lyRT_draw'); await pg.waitForTimeout(200); ok(await pg.locator('#lyRP_draw').isVisible(), 'Klick auf ein Register zeigt die Leiste wieder');
  await pg.keyboard.press('Control+F1'); await pg.waitForTimeout(200); ok(!(await pg.locator('#lyRP_draw').isVisible()), 'Strg+F1 minimiert');
  await pg.dblclick('#lyRT_draw'); await pg.waitForTimeout(250);
  await pg.reload(); await open(pg); ok(await pg.getAttribute('#lyRT_draw', 'aria-selected') === 'true', 'Register nach Neuladen gemerkt');
  ok(await pg.evaluate(() => JSON.stringify(KVE.calc(window.__LVD.S(), LV).sum)) === sum0 && !/lvd-ribbon/.test(await pg.evaluate(() => JSON.stringify(window.__LVD.S()))), 'keine Kostenwirkung, nichts im Projekt');
  await pg.evaluate(() => localStorage.setItem('lvd-ribbon', JSON.stringify({ t: 'mod', m: false }))); await pg.reload(); await open(pg);
  for (const [w, h] of [[1920, 1080], [1280, 800], [1024, 768]]) { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400);
    const r = await pg.evaluate(() => { const d = document.querySelector('dialog.kmlya'); return { ov: d.scrollWidth > innerWidth + 1 || d.scrollHeight > innerHeight + 1, mh: document.querySelector('#kmMap').getBoundingClientRect().height }; }); ok(!r.ov && r.mh >= 200, w + '×' + h + ': kein Überlauf, Karte ' + Math.round(r.mh) + ' px'); }
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(400); ok(!(await pg.locator('.lyrb').isVisible()) && await pg.locator('.lymtab').isVisible(), 'Handy: Leiste ausgeblendet, Bereichsleiste bleibt');
  await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(300);
  for (const [l, t] of [['fr', 'Début'], ['it', 'Home'], ['en', 'Home']]) { await pg.click('[data-lylang=' + l + ']'); await open(pg); ok(await pg.textContent('#lyRT_start') === t, l.toUpperCase() + ': «' + t + '»'); }
  await pg.screenshot({ path: K.tmp('t90.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
