/* t127: Gebäudeeinführung und Leitung bleiben verbunden (V143) – auch wenn die Leitung an der Einführung BEGINNT oder die Einführung
   nachträglich auf das Leitungsende gesetzt wurde: Einführung verschieben → Leitung geht mit; Leitungsende ziehen → Einführung geht mit */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  const setup = sel => pg.evaluate(sel => { const K = window.__KM, M = K.M(); M.lines.length = 0; M.pts.length = 0; M.geb.length = 0; M.wl.length = 0; M.sond.length = 0;
    M.geb.push({ id: 'g1', pt: [2759000, 1191100], sid: null, cm: '', abd: 'hauff', name: '' });   /* ohne Verknüpfung (älterer Stand) */
    M.lines.push({ id: 'l1', pts: [[2759000, 1191100], [2759030, 1191100]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '1' }, cfg: { rt: { 55: 1 }, art: 'kies', fl: 'belag', T: '', B: '' } });
    K.refresh(); K.map().setView(K.ll([2759015, 1191100]), 19, { animate: false }); const me = document.querySelector('[data-k=medit]'); if (me.getAttribute('aria-pressed') !== 'true') me.click(); if (sel) K.select(sel); else K.select(null); }, sel);
  const xy = async (x, y) => pg.evaluate(([x, y]) => { const K = window.__KM, q = K.map().latLngToContainerPoint(K.ll([x, y])), r = document.querySelector('#kmMap').getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }, [x, y]);
  const drag = async () => { const a = await xy(2759000, 1191100), z = await xy(2759000, 1191108); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, { steps: 5 }); await pg.mouse.move(z[0], z[1], { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(400);
    return pg.evaluate(() => { const M = window.__KM.M(); return { g: M.geb[0].pt, l: M.lines[0].pts[0], lid: M.geb[0].lid }; }); };
  await setup('g1'); await pg.waitForTimeout(400); let r = await drag();
  ok(Math.abs(r.g[1] - 1191100) > 5 && Math.hypot(r.g[0] - r.l[0], r.g[1] - r.l[1]) < 0.06 && r.lid === 'l1', 'Einführung verschoben → Leitungsanfang geht mit (Verknüpfung nachgeholt)');
  await setup(null); await pg.waitForTimeout(400); r = await drag();
  ok(Math.abs(r.l[1] - 1191100) > 5 && Math.hypot(r.g[0] - r.l[0], r.g[1] - r.l[1]) < 0.06, 'Leitungsanfang gezogen → Einführung geht mit ' + JSON.stringify(r));
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
