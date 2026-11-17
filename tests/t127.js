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
  // Abzweiger Y mit 3 Linien: Abgang ohne feste Verknüpfung (älterer Stand) – beim Verschieben gehen alle 3 Linien mit
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.length = 0; M.pts.length = 0; M.geb.length = 0;
    M.pts.push({ id: 'y1', pt: [2759030, 1191100], mode: 'abz', sid: null });
    M.lines.push({ id: 'a', e: 'y1', pts: [[2759000, 1191100], [2759030, 1191100]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '2' }, cfg: { rt: { 55: 2 }, art: 'kies', fl: 'belag', T: '', B: '' } });
    M.lines.push({ id: 'b', s: 'y1', pts: [[2759030, 1191100], [2759060, 1191100]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '2' }, cfg: { rt: { 55: 2 }, art: 'kies', fl: 'belag', T: '', B: '' } });
    M.lines.push({ id: 'c', pts: [[2759030, 1191100], [2759030, 1191080]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '1' }, cfg: { rt: { 55: 1 }, art: 'kies', fl: 'belag', T: '', B: '' } });
    K.refresh(); K.map().setView(K.ll([2759030, 1191100]), 19, { animate: false }); const me = document.querySelector('[data-k=medit]'); if (me.getAttribute('aria-pressed') !== 'true') me.click(); K.select('y1'); });
  await pg.waitForTimeout(500);
  { const a = await xy(2759030, 1191100), z = await xy(2759034, 1191106); await pg.mouse.move(a[0], a[1]); await pg.mouse.down(); await pg.mouse.move((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, { steps: 5 }); await pg.mouse.move(z[0], z[1], { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(400); }
  const Y = await pg.evaluate(() => { const M = window.__KM.M(), p = M.pts[0], d = q => Math.hypot(q[0] - p.pt[0], q[1] - p.pt[1]); const [a, b, c] = M.lines; return { moved: Math.hypot(p.pt[0] - 2759030, p.pt[1] - 1191100), d: [d(a.pts[1]), d(b.pts[0]), d(c.pts[0])], cs: c.s }; });
  ok(Y.moved > 3 && Y.d.every(x => x < 0.06) && Y.cs === 'y1', 'Abzweiger verschoben: alle 3 Linien gehen mit (Abgang nachträglich verknüpft) ' + JSON.stringify(Y.d.map(x => Math.round(x * 100) / 100)));
  // Neue Linie am Abzweiger begonnen: sofort fest verknüpft
  await pg.evaluate(() => document.querySelector('[data-k=mline]').click()); await pg.waitForTimeout(200);
  { const s0 = await pg.evaluate(() => window.__KM.M().pts[0].pt), a = await xy(s0[0], s0[1]), z = await xy(s0[0] + 10, s0[1] + 12); await pg.mouse.click(a[0], a[1]); await pg.waitForTimeout(300); await pg.mouse.dblclick(z[0], z[1]); await pg.waitForTimeout(500); }
  const nl = await pg.evaluate(() => { const M = window.__KM.M(), l = M.lines[M.lines.length - 1]; return { s: l.s, n: M.lines.length }; });
  ok(nl.n === 4 && nl.s === 'y1', 'Linie am Abzweiger begonnen: fest verbunden (4. Linie) ' + JSON.stringify(nl));
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
