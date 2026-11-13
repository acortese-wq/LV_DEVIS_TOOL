/* t112: Schacht auf eine Leitung setzen (Werkzeug «Schacht»): Linie wird geteilt und beide Hälften hängen am Schacht – auch bei grossem Schachtzeichen und leicht daneben geklicktem Punkt */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1500);
  for (const [zoom, off] of [[18, 0], [19, 4], [20, 6], [21, 0], [22, 0]]) {
    const info = await pg.evaluate(z => { const K = window.__KM, M = K.M(); if (!K.map()) throw new Error('keine Karte'); const l = M.lines.find(x => x.pts.length > 1 && x.pts.length === 2 && !x.s && !x.e) || M.lines.find(x => x.pts.length > 1); const a = l.pts[0], c = l.pts[1], m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; K.map().setView(K.ll(m), z, { animate: false }); return { id: l.id, n: M.lines.length, ns: M.pts.length }; }, zoom);
    await pg.waitForTimeout(500);
    await pg.click('[data-k=mpt]'); await pg.waitForTimeout(200);
    const pos = await pg.evaluate(id => { const K = window.__KM, M = K.M(), l = M.lines.find(x => x.id === id), a = l.pts[0], c = l.pts[1], m = K.ll([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]), q = K.map().latLngToContainerPoint(m), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; }, info.id);
    await pg.mouse.click(pos.x, pos.y + off); await pg.waitForTimeout(500);
    const after = await pg.evaluate(() => { const M = window.__KM.M(); return { n: M.lines.length, ns: M.pts.length, last: M.pts[M.pts.length - 1] && M.pts[M.pts.length - 1].id, linked: M.lines.filter(l => l.s === (M.pts[M.pts.length - 1] || {}).id || l.e === (M.pts[M.pts.length - 1] || {}).id).length }; });
    ok(after.ns === info.ns + 1 && after.n === info.n + 1 && after.linked >= 2, 'Zoom ' + zoom + ', Versatz ' + off + ' px: Schacht gesetzt, Linie geteilt, beide Hälften verbunden (Schächte ' + info.ns + '→' + after.ns + ', Linien ' + info.n + '→' + after.n + ', verbunden ' + after.linked + ')');
    await pg.evaluate(() => { const b = document.querySelector('[data-k=mpt][aria-pressed=true]'); if (b) b.click(); }); await pg.waitForTimeout(200);
  }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
