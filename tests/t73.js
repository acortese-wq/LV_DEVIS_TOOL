/* t73: Geokatalog – Direktchip «GWR: Gebäudestatus»; DXF als Hintergrund (alle Objekte, Layer ein/aus, Blöcke, Texte, Bögen), Übernahme als Leitung je Layer/Klick, Speichern, Bericht */
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
  // B) DXF als Hintergrund (alle Objekte) + Übernahme als Leitung
  const M = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.__KM.M())));
  const m0 = await M(), n0 = m0.lines.length, P0 = m0.lines[0].pts[0], E = Math.round(P0[0]) + 5, N = Math.round(P0[1]) + 5;
  const T = (l, x, y, t, h, r) => ['0', 'TEXT', '8', l, '10', x, '20', y, '40', h || 0.5, '50', r || 0, '1', t];
  const D = tmp('t73_a.dxf');
  fs.writeFileSync(D, ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '0', 'LAYER', '2', 'Bestand', '62', '1', '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '8', '0', '2', 'SCH', '10', '0', '20', '0', '0', 'CIRCLE', '8', '0', '10', '0', '20', '0', '40', '0.5', '0', 'LINE', '8', '0', '10', '-0.5', '20', '0', '11', '0.5', '21', '0', '0', 'ENDBLK', '0', 'ENDSEC'].join('\r\n') + '\r\n' +
    dxf([
    LINE('TB_Trasse', [E, N], [E + 10, N]), LINE('TB_Trasse', [E + 20, N + 5], [E + 10, N]), LINE('TB_Trasse', [E + 20, N + 5], [E + 30, N + 5]),
    ['0', 'LWPOLYLINE', '8', 'Bestand', '90', '2', '70', '0', '10', E, '20', N + 20, '42', '1', '10', E + 10, '20', N + 20],   /* Halbkreis über Bulge */
    PL('LV03_Alt', [[E - 2e6 + 40, N - 1e6], [E - 2e6 + 50, N - 1e6 + 2], [E - 2e6 + 60, N - 1e6]]),
    ['0', 'CIRCLE', '8', 'Bestand', '10', E + 5, '20', N + 30, '40', '1'], ['0', 'ARC', '8', 'Bestand', '10', E + 15, '20', N + 30, '40', '2', '50', '0', '51', '90'],
    T('Beschrift', E, N - 3, 'Kabel EW %%c 120', 0.6, 30), ['0', 'MTEXT', '8', 'Beschrift', '10', E + 8, '20', N - 6, '40', '0.5', '71', '5', '1', '\\A1;Zeile 1\\PZeile 2'],
    ['0', 'INSERT', '8', 'Schacht', '2', 'SCH', '10', E + 30, '20', N + 5, '41', '2', '42', '2', '50', '90'],
    ['0', 'HATCH', '8', 'Bestand'],
    LINE('Fremd', [12.5, 3.25], [40, 8]) ]).replace(/^0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n/, ''));
  ok(await pg.locator('[data-k=dxfin]').count() >= 1, 'Werkzeug «DXF-Linien importieren» vorhanden');
  await pg.setInputFiles('#kmDxfF', D); await pg.waitForSelector('#kmDxfAsk', { timeout: 5000 });
  const info = await pg.textContent('#kmDxfAsk');
  ok(/7 Linien\/Bögen\/Kreise und 2 Texte in 5 Layer/.test(info), 'Auswahl: alle Objekte erkannt: ' + info.replace(/\s+/g, ' ').slice(0, 170));
  ok(/HATCH 1/.test(info) && /1 Objekt/.test(info), 'nicht darstellbare Objekte und fremde Koordinaten werden gemeldet');
  ok(await pg.locator('#kmDxfAsk [data-dxs]').count() === 5 && await pg.locator('#kmDxfAsk [data-dxl]').count() === 4, 'je Layer «anzeigen»; «als Leitung» nur bei Layern mit Linien');
  await pg.addScriptTag({ path: AXE }); const ax = await pg.evaluate(() => axe.run(document.querySelector('#kmDxfAsk')).then(r => r.violations.map(v => v.id)));
  ok(ax.length === 0, 'axe DXF-Auswahl: ' + JSON.stringify(ax));
  await pg.check('#kmDxfAsk [data-dxl="TB_Trasse"]'); await pg.uncheck('#kmDxfAsk [data-dxs="Beschrift"]');
  await pg.click('#kmDxfAsk [data-dxg=go]'); await pg.waitForTimeout(700);
  let m = await M(); const Dx = m.dxf;
  ok(m.lines.length === n0 + 1 && m.lines[n0].dxf === 'TB_Trasse' && m.lines[n0].pts.length === 4, 'nur der gewählte Layer als Leitung übernommen (verbunden, 4 Punkte)');
  ok(Dx && Dx.it.length === 9 && Dx.lay.Beschrift.on === false && Dx.lay.Bestand.on, 'Hintergrund gespeichert: 9 Objekte, «Beschrift» ausgeblendet');
  ok(Dx.lay.Bestand.c === '#ff0000', 'Layerfarbe aus der Layertabelle (rot)');
  const it = Dx.it, lv = it.find(s => s.l === 'LV03_Alt'), circ = it.find(s => s.l === 'Bestand' && s.p.length > 40), bul = it.find(s => s.l === 'Bestand' && Math.abs(s.p[0][1] - (N + 20)) < 0.01);
  ok(lv && lv.p[0][0] === E + 40 && lv.p[0][1] === N, 'LV03 in LV95 umgerechnet');
  ok(circ && Math.abs(Math.hypot(circ.p[10][0] - (E + 5), circ.p[10][1] - (N + 30)) - 1) < 0.02, 'Kreis als Linienzug (Radius 1 m)');
  ok(bul && bul.p.length > 3 && Math.max(...bul.p.map(q => Math.abs(q[1] - (N + 20)))) > 4.9, 'Polylinie mit Bogen (Bulge) als Halbkreis');
  const sch = it.filter(s => s.l === 'Schacht');
  ok(sch.length === 2 && sch.some(s => s.p.length > 40 && Math.abs(Math.hypot(s.p[0][0] - (E + 30), s.p[0][1] - (N + 5)) - 1) < 0.02), 'Block (INSERT) mit Massstab 2: Kreis r = 1 m am Einfügepunkt, Layer des Blocks');
  const tx = it.filter(s => s.t);
  ok(tx.length === 2 && tx.some(s => s.t === 'Kabel EW Ø 120' && s.r === 30) && tx.some(s => s.t === 'Zeile 1 Zeile 2' && s.ah === 1 && s.av === 1), 'Texte mit Drehung, Ausrichtung und bereinigt (Ø, Absatz)');
  ok(await pg.locator('#kmDxfD').isVisible() && await pg.locator('#kmDxfB [data-dxo]').count() === 5, 'Seitenleiste «DXF-Hintergrund» mit 5 Layern');
  ok(await pg.locator('.kmdxft').count() === 0, 'ausgeblendeter Text-Layer wird nicht gezeichnet');
  await pg.check('#kmDxfB [data-dxo="Beschrift"]'); await pg.waitForTimeout(300);
  await pg.evaluate(([e, n]) => window.__KM.map().setView(window.__KM.ll([e + 10, n]), 20, { animate: false }), [E, N]); await pg.waitForTimeout(400);
  ok(await pg.locator('.kmdxft').count() >= 1, 'Layer einschalten zeigt die Texte massstäblich (' + await pg.locator('.kmdxft').count() + ')');
  /* angeklickte DXF-Linie als Leitung */
  await pg.evaluate(([e, n]) => window.__KM.map().setView(window.__KM.ll([e + 45, n - 0]), 20, { animate: false }), [E, N]); await pg.waitForTimeout(400);
  const sp = await pg.evaluate(([e, n]) => { const m = window.__KM.map(), q = m.latLngToContainerPoint(window.__KM.ll([e + 45, n + 1])), r = document.querySelector('#kmMap').getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }, [E, N]);
  await pg.mouse.click(sp[0], sp[1]); await pg.waitForTimeout(400);
  ok(/LV03_Alt/.test(await pg.textContent('#kmDxfAsk').catch(() => '')), 'Klick auf DXF-Linie: Angebot «Als Leitung übernehmen»');
  await pg.click('#kmDxfAsk [data-dxp=go]').catch(() => {}); await pg.waitForTimeout(300);
  ok((await M()).lines.length === n0 + 2, 'angeklickte Linie als Leitung übernommen');
  await pg.click('#kmDxfB [data-dxk="Bestand"]'); await pg.waitForTimeout(300);
  ok((await M()).lines.length === n0 + 3, '«→ Leitung» übernimmt alle Linien eines Layers (Kreise/Bögen nicht)');
  await pg.locator('.kmtoast', { hasText: 'aus DXF importiert' }).locator('button').click(); await pg.waitForTimeout(300);
  ok((await M()).lines.length === n0 + 2 && (await M()).dxf, 'Rückgängig nimmt nur die Leitungen zurück, Hintergrund bleibt');
  /* Übernehmen → gespeichert, Bericht zeigt sichtbare Layer */
  await pg.click('[data-k=apply]'); await pg.waitForTimeout(1500);
  const K = await pg.evaluate(() => { const k = window.__LVD.S().karte; return { n: k.dxf && k.dxf.it.length, on: k.dxf && k.dxf.lay.Beschrift.on }; });
  ok(K.n === 9 && K.on === true, 'nach «Übernehmen»: DXF-Hintergrund mit Layerstand im Projekt gespeichert');
  await pg.evaluate(() => { window.print = () => { window.__p = (window.__p || 0) + 1; }; });
  await pg.click('#bReport'); await pg.waitForTimeout(800); await pg.click('#rpGo');
  for (let t = 0; t < 30 && !(await pg.evaluate(() => window.__p)); t++) await pg.waitForTimeout(250);
  const rp = await pg.evaluate(() => { const g = document.querySelector('#reportDoc .rpmapfig svg .dxfbg'); return g ? { pl: g.querySelectorAll('polyline').length, tx: g.querySelectorAll('text').length } : null; });
  ok(rp && rp.pl >= 5, 'Projektbericht: DXF-Hintergrund in der Karte (' + JSON.stringify(rp) + ')');
  await pg.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await pg.waitForTimeout(300);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1200);
  ok(await pg.locator('#kmDxfB [data-dxo]').count() === 5, 'Karte erneut öffnen: DXF-Hintergrund wieder da');
  await pg.click('#kmDxfB [data-dxa=del]'); await pg.waitForTimeout(300);
  ok(!(await M()).dxf && await pg.locator('#kmDxfD').isHidden(), '«DXF entfernen» (mit Rückgängig)');
  // C) keine Schweizer Koordinaten / binär
  const nX = (await M()).lines.length;
  const D2 = tmp('t73_b.dxf'); fs.writeFileSync(D2, dxf([LINE('X', [1, 2], [3, 4])]));
  await pg.setInputFiles('#kmDxfF', D2); await pg.waitForTimeout(500);
  ok(await pg.locator('#kmDxfAsk').count() === 0 && /Keine Linien mit Schweizer Koordinaten/.test(await pg.textContent('body')), 'fremde Koordinaten: klare Meldung, nichts importiert');
  const D3 = tmp('t73_c.dxf'); fs.writeFileSync(D3, Buffer.concat([Buffer.from('AutoCAD Binary DXF\r\n\x1a\x00'), Buffer.alloc(40)]));
  await pg.setInputFiles('#kmDxfF', D3); await pg.waitForTimeout(500);
  ok(/Binäre DXF/.test(await pg.textContent('body')), 'binäre DXF: Hinweis auf ASCII-DXF');
  ok((await M()).lines.length === nX, 'keine Linien angelegt');
  await pg.screenshot({ path: tmp('t73.png') });
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
