/* t109: Eigenschaften-Fenster, Kontextmenü und schwebende Panels bleiben im sichtbaren Zeichnungsbereich (unter den Glas-Leisten, innerhalb der Karte), nahe der Maus */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { window.__LVD.loadDemo(); localStorage.setItem('lvd-layout', 'a'); }); await pg.waitForTimeout(1000); await pg.reload();
  for (let t = 0; t < 60 && !(await pg.locator('dialog.kmlya[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { window.__KM.fit(); document.querySelector('[data-k=medit]').click(); }); await pg.waitForTimeout(600);
  const lt = await pg.evaluate(() => parseFloat(document.querySelector('dialog.kmlya').style.getPropertyValue('--lytop')));
  const vis = () => pg.evaluate(() => { const m = document.querySelector('#kmMap').getBoundingClientRect(), d = document.querySelector('dialog.kmlya'), lt = parseFloat(d.style.getPropertyValue('--lytop')); const el = id => { const e = document.querySelector(id); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { l: r.left - m.left, t: r.top - m.top, r: m.right - r.right, b: m.bottom - r.bottom, w: r.width, h: r.height }; }; return { lt, props: el('#kmProps'), ctx: el('#kmCtx') }; });
  // Linie in die Nähe des oberen sichtbaren Randes verschieben: Rechtsklick dort
  const pos = await pg.evaluate(() => { const m = window.__KM.map(), l = window.__KM.M().lines.find(x => x.pts.length > 1), a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]), la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c, q = m.latLngToContainerPoint([(la[0] + lc[0]) / 2, (la[1] + lc[1]) / 2]), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y, left: r.left, top: r.top, w: r.width, h: r.height }; });
  for (const [name, dx, dy] of [['Mitte', 0, 0]]) { void name; void dx; void dy; }
  // a) Eigenschaften am oberen sichtbaren Rand öffnen: Karte so verschieben, dass die Linie direkt unter den Leisten liegt
  await pg.evaluate(([x, y, top, lt]) => { const m = window.__KM.map(); const cur = m.latLngToContainerPoint(m.getCenter()); m.panBy([0, (y - top) - (lt + 14)], { animate: false }); }, [pos.y, pos.y, pos.top, lt]); await pg.waitForTimeout(400);
  const p2 = await pg.evaluate(() => { const m = window.__KM.map(), l = window.__KM.M().lines.find(x => x.pts.length > 1), a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]), la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c, q = m.latLngToContainerPoint([(la[0] + lc[0]) / 2, (la[1] + lc[1]) / 2]), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; });
  await pg.mouse.click(p2.x, p2.y, { button: 'right' }); await pg.waitForTimeout(300);
  let v = await vis(); ok(v.ctx && v.ctx.t >= v.lt - 1, 'Kontextmenü am oberen Rand liegt unter den Leisten (y ' + Math.round(v.ctx && v.ctx.t) + ' ≥ ' + Math.round(v.lt) + ')');
  await pg.click('#kmCtx button >> text=Eigenschaften'); await pg.waitForTimeout(500); v = await vis();
  ok(v.props && v.props.t >= v.lt - 1, 'Eigenschaften-Fenster am oberen Rand liegt unter den Leisten (y ' + Math.round(v.props && v.props.t) + ' ≥ ' + Math.round(v.lt) + ')');
  ok(v.props && v.props.l >= 3 && v.props.r >= 3 && v.props.b >= 3, 'Eigenschaften-Fenster liegt ganz in der Karte (links ' + Math.round(v.props.l) + ', rechts ' + Math.round(v.props.r) + ', unten ' + Math.round(v.props.b) + ')');
  const dm = Math.hypot((v.props.l + v.props.w / 2) - (p2.x - pos.left), (v.props.t + v.props.h / 2) - (p2.y - pos.top)); ok(dm < 520, 'Fenster bleibt in der Nähe der Maus (Abstand ' + Math.round(dm) + ' px)');
  // b) am rechten/unteren Rand
  await pg.evaluate(() => { const b = document.querySelector('#kmProps .kmprops-h button'); if (b) b.click(); }); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const m = window.__KM.map(); m.panBy([-400, -300], { animate: false }); }); await pg.waitForTimeout(400);
  const p3 = await pg.evaluate(() => { const m = window.__KM.map(), l = window.__KM.M().lines.find(x => x.pts.length > 1), a = window.__KM.ll(l.pts[0]), c = window.__KM.ll(l.pts[1]), la = a.lat !== undefined ? [a.lat, a.lng] : a, lc = c.lat !== undefined ? [c.lat, c.lng] : c, q = m.latLngToContainerPoint([(la[0] + lc[0]) / 2, (la[1] + lc[1]) / 2]), r = document.querySelector('#kmMap').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y, ok: q.x > 0 && q.y > 0 && q.x < r.width && q.y < r.height }; });
  if (p3.ok) { await pg.mouse.click(p3.x, p3.y, { button: 'right' }); await pg.waitForTimeout(300); await pg.click('#kmCtx button >> text=Eigenschaften'); await pg.waitForTimeout(500); v = await vis(); ok(v.props && v.props.r >= 3 && v.props.b >= 3 && v.props.l >= 3, 'Eigenschaften-Fenster am unteren/rechten Rand ganz sichtbar (rechts ' + Math.round(v.props.r) + ', unten ' + Math.round(v.props.b) + ')'); } else ok(true, 'Linie nach Verschieben ausserhalb, Fall übersprungen');
  // c) schwebendes Panel bleibt ganz im Zeichnungsbereich
  const grab = pg.locator('.kmwh .kmgrab').first(); const gb = await grab.boundingBox();
  if (gb) { await pg.mouse.move(gb.x + 20, gb.y + 8); await pg.mouse.down(); await pg.mouse.move(gb.x + 1300, gb.y + 400, { steps: 12 }); await pg.waitForTimeout(200); await pg.mouse.up(); await pg.waitForTimeout(1300);
    const pf = await pg.evaluate(() => { const w = document.querySelector('.kmwh').parentElement.getBoundingClientRect(), g = document.querySelector('.kmgrid').getBoundingClientRect(); return { l: w.left - g.left, r: g.right - w.right, t: w.top - g.top, b: g.bottom - w.top }; });
    ok(pf.l >= -0.5 && pf.r >= -0.5 && pf.t >= -0.5 && pf.b >= 56 - 1, 'Schwebendes Panel bleibt ganz im Zeichnungsbereich (links ' + Math.round(pf.l) + ', rechts ' + Math.round(pf.r) + ', Kopf ' + Math.round(pf.b) + ' px über dem Rand)'); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
