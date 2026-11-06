/* t73: Geokatalog – Direktchip «GWR: Gebäudestatus» in der Schnellauswahl; DXF-Import von Linien (LINE/LWPOLYLINE/POLYLINE, LV95/LV03, Ebenenwahl, Verbinden, Rückgängig) */
const { chromium, ok, mk, AXE, tmp, fs } = require('./lib/k.js');
const path = require('path');
const dxf = (ents) => ['0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'].concat(ents.flat(), ['0', 'ENDSEC', '0', 'EOF']).join('\r\n') + '\r\n';
const LINE = (l, a, b) => ['0', 'LINE', '8', l, '10', a[0], '20', a[1], '30', '0', '11', b[0], '21', b[1], '31', '0'];
const LW = (l, pts, cl) => ['0', 'LWPOLYLINE', '8', l, '90', pts.length, '70', cl ? 1 : 0].concat(pts.flatMap(p => ['10', p[0], '20', p[1]]));
const PL = (l, pts) => ['0', 'POLYLINE', '8', l, '66', '1', '70', '0'].concat(pts.flatMap(p => ['0', 'VERTEX', '8', l, '10', p[0], '20', p[1]]), ['0', 'SEQEND']);
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1600, 1000);
  await pg.route('**/layersConfig**', r => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: {
    'ch.bfs.gebaeude_wohnungs_register': { type: 'wmts', label: 'GWR: Gebäudestatus', serverLayerName: 'ch.bfs.gebaeude_wohnungs_register', format: 'png' },
    'ch.bakom.mobil-antennenstandorte-5g': { type: 'wmts', label: 'Mobilfunkantennen 5G', format: 'png' } } }));
  await pg.route('**/wmts.geo.admin.ch/**', r => r.fulfill({ status: 204 }));
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1200);
  await require('./lib/k.js').openMid(pg).catch(() => {});
  // A) GWR-Chip
  await pg.evaluate(() => { const d = document.querySelector('#kmCat'); d.open = true; }); await pg.waitForTimeout(600);
  const g = pg.locator('#kmChips [data-ovq="ch.bfs.gebaeude_wohnungs_register"]');
  ok(await g.count() === 1 && /GWR: Gebäudestatus/.test(await g.textContent()) && await g.getAttribute('aria-pressed') === 'false', 'Schnellauswahl: Chip «GWR: Gebäudestatus» vorhanden: ' + (await g.count() ? await g.textContent() : '-'));
  ok(await pg.evaluate(() => document.querySelector('#kmChips').firstElementChild.dataset.ovq) === 'ch.bfs.gebaeude_wohnungs_register', 'GWR-Chip steht an erster Stelle');
  await g.click(); await pg.waitForTimeout(300);
  const g2 = pg.locator('#kmChips [data-ovq="ch.bfs.gebaeude_wohnungs_register"]');
  ok(await g2.getAttribute('aria-pressed') === 'true' && /^✓/.test(await g2.textContent()) && /GWR/.test(await pg.textContent('#kmCatS')), 'Klick blendet die Ebene direkt ein (✓, in «Eingeblendet»)');
  await g2.click(); await pg.waitForTimeout(300);
  ok(await pg.locator('#kmChips [data-ovq="ch.bfs.gebaeude_wohnungs_register"]').getAttribute('aria-pressed') === 'false' && !/GWR/.test(await pg.textContent('#kmCatS')), 'zweiter Klick blendet sie wieder aus');
  // B) DXF-Import
  const M = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M())));
  const n0 = (await M()).lines.length;
  const D = tmp('t73_a.dxf');
  fs.writeFileSync(D, dxf([
    LINE('TB_Trasse', [2759000, 1190000], [2759010, 1190000]), LINE('TB_Trasse', [2759020, 1190005], [2759010, 1190000]), LINE('TB_Trasse', [2759020, 1190005], [2759030, 1190005]),   /* 3 Stücke → 1 Linienzug, Richtung gemischt */
    LW('TB_Hausanschluss', [[2759010, 1190000], [2759010, 1190008], [2759014, 1190012]]),
    PL('LV03_Alt', [[759040, 190000], [759050, 190002], [759060, 190000]]),   /* LV03 → +2'000'000 / +1'000'000 */
    ['0', 'CIRCLE', '8', 'TB_Trasse', '10', '2759000', '20', '1190000', '40', '1'], ['0', 'TEXT', '8', 'Beschrift', '10', '2759000', '20', '1190000', '1', 'A'],
    LINE('Fremd', [12.5, 3.25], [40, 8]) ]));
  ok(await pg.locator('.kmtools [data-k=dxfin], [data-k=dxfin]').count() >= 1, 'Werkzeug «DXF-Linien importieren» vorhanden');
  await pg.setInputFiles('#kmDxfF', D); await pg.waitForSelector('#kmDxfAsk', { timeout: 5000 });
  const info = await pg.textContent('#kmDxfAsk');
  ok(/3 Linie\(n\) in 3 Ebene\(n\)/.test(info), 'Auswahl: 3 Linien in 3 Ebenen erkannt: ' + info.replace(/\s+/g, ' ').slice(0, 160));
  ok(/CIRCLE 1/.test(info) && /TEXT 1/.test(info) && /1 Objekt/.test(info), 'nicht übernommene Objekte und fremde Koordinaten werden gemeldet');
  ok(await pg.locator('#kmDxfAsk [data-dxl]').count() === 3, 'je Ebene ein Kästchen');
  await pg.addScriptTag({ path: AXE }); const ax = await pg.evaluate(() => axe.run(document.querySelector('#kmDxfAsk')).then(r => r.violations.map(v => v.id)));
  ok(ax.length === 0, 'axe DXF-Auswahl: ' + JSON.stringify(ax));
  await pg.uncheck('#kmDxfAsk [data-dxl="TB_Hausanschluss"]');
  await pg.click('#kmDxfAsk [data-dxg=go]'); await pg.waitForTimeout(500);
  let m = await M(); const nw = m.lines.slice(n0);
  ok(m.lines.length === n0 + 2 && await pg.locator('#kmDxfAsk').count() === 0, 'nur gewählte Ebenen importiert (2 Linien)');
  const tr = nw.find(l => l.dxf === 'TB_Trasse'), lv = nw.find(l => l.dxf === 'LV03_Alt');
  ok(tr && tr.pts.length === 4 && JSON.stringify(tr.pts) === JSON.stringify([[2759000, 1190000], [2759010, 1190000], [2759020, 1190005], [2759030, 1190005]]), 'LINE-Stücke zu einem Linienzug verbunden: ' + JSON.stringify(tr && tr.pts));
  ok(lv && lv.pts.length === 3 && lv.pts[0][0] === 2759040 && lv.pts[0][1] === 1190000, 'LV03 in LV95 umgerechnet: ' + JSON.stringify(lv && lv.pts[0]));
  ok(tr.rohr && tr.cfg && tr.rohr.sys, 'importierte Linie hat Rohranlage und Graben-Einstellungen (' + tr.rohr.sys + ')');
  ok(/DXF/.test(await pg.textContent('body')), 'Meldung nach dem Import');
  await pg.locator('.kmtoast', { hasText: 'aus DXF importiert' }).locator('button').click(); await pg.waitForTimeout(400);
  ok((await M()).lines.length === n0, 'Rückgängig entfernt die importierten Linien');
  // C) keine Schweizer Koordinaten / binär
  const D2 = tmp('t73_b.dxf'); fs.writeFileSync(D2, dxf([LINE('X', [1, 2], [3, 4])]));
  await pg.setInputFiles('#kmDxfF', D2); await pg.waitForTimeout(500);
  ok(await pg.locator('#kmDxfAsk').count() === 0 && /Keine Linien mit Schweizer Koordinaten/.test(await pg.textContent('body')), 'fremde Koordinaten: klare Meldung, nichts importiert');
  const D3 = tmp('t73_c.dxf'); fs.writeFileSync(D3, Buffer.concat([Buffer.from('AutoCAD Binary DXF\r\n\x1a\x00'), Buffer.alloc(40)]));
  await pg.setInputFiles('#kmDxfF', D3); await pg.waitForTimeout(500);
  ok(/Binäre DXF/.test(await pg.textContent('body')), 'binäre DXF: Hinweis auf ASCII-DXF');
  ok((await M()).lines.length === n0, 'keine Linien angelegt');
  await pg.screenshot({ path: tmp('t73.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
