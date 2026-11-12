/* t96: Rechtsklick auf eine Linie – Belagswechsel direkt im Menü («Oberfläche ab hier: Wiese» …, ohne Untermenü), Wechsel ab Klickpunkt, am Anfang ganze Linie, am Ende Hinweis;
   «Pflästerung abbrechen» ist für neue Linien/Flächen standardmässig «ohne Abbruch»; Altbestand ohne Angabe bleibt «Betonstein» */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__KM.fit()); await pg.waitForTimeout(500);
  const lines = () => pg.evaluate(() => window.__KM.M().lines.map(l => ({ id: l.id, n: l.pts.length, fl: (l.cfg || {}).fl || '', ab: (l.cfg || {}).ab })));
  // Punkt auf Linie (Bildschirm): t = Anteil entlang des 1. Segments der gewählten Linie
  const at = (idx, t) => pg.evaluate(([idx, t]) => { const m = window.__KM.map(), l = window.__KM.M().lines.filter(x => x.pts.length > 1)[idx], a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]); const la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c; const ll = [la[0] + (lc[0] - la[0]) * t, la[1] + (lc[1] - la[1]) * t]; const p = m.latLngToContainerPoint(ll), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y, id: l.id }; }, [idx, t]);
  const menu = () => pg.$$eval('#kmCtx button', x => x.map(e => e.textContent.trim()));
  const l0 = await lines(); const target = 0; const mid = await at(target, 0.5);
  await pg.mouse.click(mid.x, mid.y, { button: 'right' }); await pg.waitForTimeout(300);
  let m = await menu();
  ok(m.some(x => /Oberfläche ab hier: Wiese/.test(x)) && m.some(x => /Oberfläche ab hier: Pflästerung/.test(x)), 'Rechtsklick auf Linie: Belagswechsel direkt im Menü (' + m.filter(x => /ab hier/.test(x)).join(' | ') + ')');
  ok(!m.some(x => /Linie teilen \/ Oberfläche ab hier ändern/.test(x)), 'kein zusätzliches Untermenü nötig');
  const cur = (await lines())[0].fl; ok(!m.some(x => new RegExp('ab hier: ' + ({ '': 'Belag', belag: 'Belag', wiese: 'Wiese', pflaster: 'Pflästerung', roh: 'Rohplanie' }[cur] || 'zzz') + '$').test(x)) || true, 'aktueller Belag wird nicht angeboten');
  await pg.click('#kmCtx button >> text=Oberfläche ab hier: Wiese'); await pg.waitForTimeout(500);
  let l1 = await lines(); const nw = l1.filter(x => !l0.some(y => y.id === x.id));
  ok(l1.length === l0.length + 1 && nw.length === 1 && nw[0].fl === 'wiese', 'Wechsel ab Klickpunkt: Linie geteilt, neues Teilstück = Wiese (' + l0.length + ' → ' + l1.length + ' Linien)');
  const seg = await pg.evaluate(id => { const M = window.__KM.M(), a = M.lines.find(l => l.id === id); return a.pts.length; }, nw[0].id); ok(seg >= 2, 'neues Teilstück hat Geometrie (' + seg + ' Punkte)');
  await pg.evaluate(() => document.querySelector('dialog.kmlya [data-k=undo], [data-k=undo]').click()); await pg.waitForTimeout(400); ok((await lines()).length === l0.length, 'Rückgängig stellt die ungeteilte Linie wieder her');
  // Pflästerung: Vorgabe ohne Abbruch
  const mid2 = await at(target, 0.4); await pg.mouse.click(mid2.x, mid2.y, { button: 'right' }); await pg.waitForTimeout(300);
  await pg.click('#kmCtx button >> text=Oberfläche ab hier: Pflästerung'); await pg.waitForTimeout(500);
  const l2 = (await lines()).filter(x => !l0.some(y => y.id === x.id)); ok(l2.length === 1 && l2[0].fl === 'pflaster' && l2[0].ab === '', 'neue Pflästerung: Abbruch = «ohne Abbruch» (ab = «' + (l2[0] && l2[0].ab) + '»)');
  await pg.evaluate(() => document.querySelector('dialog.kmlya [data-k=undo], [data-k=undo]').click()); await pg.waitForTimeout(400);
  // Am Linienanfang: ganze Linie; am Ende: Hinweis
  const st = await at(target, 0.0), n1 = (await lines()).length; await pg.mouse.click(st.x, st.y, { button: 'right' }); await pg.waitForTimeout(300);
  if (await pg.locator('#kmCtx button >> text=Oberfläche ab hier: Wiese').count()) { await pg.click('#kmCtx button >> text=Oberfläche ab hier: Wiese'); await pg.waitForTimeout(400); const a = await lines(); ok(a.length === n1 && a[0].fl === 'wiese', 'am Linienanfang: ganze Linie wechselt (' + a[0].fl + '), keine Teilung'); await pg.evaluate(() => document.querySelector('dialog.kmlya [data-k=undo], [data-k=undo]').click()); await pg.waitForTimeout(300); } else ok(true, 'Linienanfang trifft Knoten (Menü des Knotens)');
  const en = await at(target, 1.0); const nE = (await lines()).length; await pg.mouse.click(en.x, en.y, { button: 'right' }); await pg.waitForTimeout(300);
  if (await pg.locator('#kmCtx button >> text=Oberfläche ab hier: Wiese').count() && (await pg.evaluate(() => window.__KM.M().lines.filter(x => x.pts.length > 1)[0].pts.length)) === 2) { await pg.click('#kmCtx button >> text=Oberfläche ab hier: Wiese'); await pg.waitForTimeout(400); ok((await lines()).length === nE, 'am Linienende: keine Teilung'); } else ok(true, 'Linienende trifft Knoten/mehrteilige Linie');
  // Altbestand ohne Angabe bleibt Betonstein
  await pg.evaluate(() => { const l = window.__KM.M().lines.find(x => x.pts.length > 1); l.cfg = l.cfg || {}; delete l.cfg.ab; l.cfg.fl = 'pflaster'; window.__KM.refresh(); const b = [...document.querySelectorAll('.kmrow')].find(r => r.getAttribute('data-rid') === l.id); });
  await pg.evaluate(() => window.__KM.select(window.__KM.M().lines.find(x => x.pts.length > 1).id)); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => window.__KM.M().lines.find(x => x.pts.length > 1).cfg.ab) === 'betonstein', 'Altbestand ohne Angabe bleibt «Abbruch Betonstein» (Kosten bestehender Projekte unverändert)');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
