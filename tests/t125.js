/* t125: Abzweiger wie ein Schacht (V143) – auf die Leitung setzen (teilt sie), Abgang andocken, Typ automatisch aus den Rohren,
   je abgehendes Rohr ein Formstück in der Rohranlage «Abzweiger (Karte)», kein Schachtbauwerk und keine Aushubgrube;
   Bögen auf der Karte beschriftet («2×90°»), Schalter «Bögen», Berichtsbild mit Schild */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => { localStorage.removeItem('lvd-km-bend'); window.__LVD.loadDemo(); }); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  // Hauptleitung 2×K55 (gerade) und Knick-Leitung 1×K100
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.length = 0; M.pts.length = 0; M.wl.length = 0; M.sond.length = 0; M.geb.length = 0;
    M.lines.push({ id: 'hm', pts: [[2759000, 1191100], [2759060, 1191100]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '2' }, cfg: { rt: { 55: 2 }, art: 'kies', fl: 'belag', T: '', B: '' } });
    M.lines.push({ id: 'kn', pts: [[2759000, 1191200], [2759030, 1191200], [2759030, 1191230]], rid: null, rohr: { sys: 'k55', dn: '100', len: '10', n: '2' }, cfg: { rt: { 100: 2 }, art: 'kies', fl: 'belag', T: '', B: '' } });
    K.refresh(); K.map().setView(K.ll([2759030, 1191100]), 19, { animate: false }); });
  await pg.waitForTimeout(600);
  // Abzweiger auf der Hauptleitung bei x = 30 m setzen (Kontextmenü «Abzweiger hier setzen»)
  const cp = await pg.evaluate(() => { const K = window.__KM, q = K.map().latLngToContainerPoint(K.ll([2759030, 1191100])), r = document.querySelector('#kmMap').getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; });
  await pg.mouse.click(cp[0], cp[1], { button: 'right' }); await pg.waitForTimeout(400);
  const it = pg.locator('#kmCtx button', { hasText: /Abzweiger hier setzen/ }); ok(await it.count() === 1, 'Kontextmenü der Leitung: «Abzweiger hier setzen»');
  await it.click(); await pg.waitForTimeout(500);
  const A = await pg.evaluate(() => { const M = window.__KM.M(), p = M.pts.find(x => x.mode === 'abz'); return { has: !!p, nLines: M.lines.filter(l => l.s === (p && p.id) || l.e === (p && p.id)).length, id: p && p.id, cls: !!document.querySelector('.kmsch.kmabz'), pits: window.__KM.pitCount() }; });
  ok(A.has && A.nLines === 2, 'Abzweiger gesetzt, Hauptleitung geteilt (2 Linien am Punkt)');
  ok(A.cls, 'Symbol «Y» statt Schachtzeichen');
  // Abgang 1×K55 am Abzweiger
  await pg.evaluate(id => { const K = window.__KM, M = K.M(); M.lines.push({ id: 'ab', s: id, pts: [[2759030, 1191100], [2759030, 1191080]], rid: null, rohr: { sys: 'k55', dn: '55', len: '10', n: '1' }, cfg: { rt: { 55: 1 }, art: 'kies', fl: 'belag', T: '', B: '' } }); K.refresh(); K.select(id); }, A.id);
  await pg.waitForTimeout(600);
  const info = await pg.evaluate(id => KARTE.abzInfo(window.__KM.M(), window.__KM.M().pts.find(x => x.id === id)), A.id);
  ok(info.main.length === 2 && info.br.length === 1 && info.items.length === 1 && info.items[0].typ === 'Halbschalenabzweiger, K55' && info.items[0].n === 1, 'Hauptleitung = durchgehende Linien, Abgang 1×K55 → Halbschalenabzweiger K55');
  const panel = await pg.evaluate(() => document.querySelector('#kmObj') ? document.querySelector('#kmObj').textContent : document.body.textContent);
  ok(/Abzweiger Y1/.test(panel) && /Abgang: 1 × Halbschalenabzweiger, K55/.test(panel), 'Eigenschaften zeigen Abzweiger Y1 mit Hauptleitung und Abgang');
  // Bögen-Schild an der Knick-Leitung
  await pg.evaluate(() => { const K = window.__KM; K.map().setView(K.ll([2759030, 1191200]), 19, { animate: false }); K.refresh(); }); await pg.waitForTimeout(500);
  const bl = await pg.evaluate(() => [...document.querySelectorAll('.kmbend span')].map(s => s.textContent));
  ok(bl.includes('2×90°'), 'Bogen beschriftet: «2×90°» am Knick der Leitung mit 2×K100 (' + bl.join('|') + ')');
  await pg.evaluate(() => document.querySelector('[data-k=bend]').click()); await pg.waitForTimeout(300);
  ok(await pg.locator('.kmbend').count() === 0, 'Schalter «Bögen» blendet die Schilder aus');
  await pg.evaluate(() => document.querySelector('[data-k=bend]').click()); await pg.waitForTimeout(300);
  // Übernahme in die Datensätze
  await pg.evaluate(() => document.querySelector('[data-k=apply]').click()); await pg.waitForTimeout(1500);
  const R = await pg.evaluate(() => { const S = window.__LVD.S(), x = (S.recs.rohr || []).find(r => r.abzMap); const o = KVE.calc(S, LV), lines = o.summary.map(l => l.key);
    return { x: x && { name: x.name, boe: x.boe }, nSch: (S.recs.schacht || []).filter(r => KVE.num(r.n, 0) > 0 && r.fromMap).length, has423: lines.includes('151/423.303') && lines.includes('151/451.303'), orphan: false }; });
  ok(R.x && R.x.name === 'Abzweiger (Karte)' && JSON.stringify(R.x.boe) === JSON.stringify([{ typ: 'Halbschalenabzweiger, K55', q: '1' }]), 'Rohranlage «Abzweiger (Karte)»: 1 × Halbschalenabzweiger K55');
  ok(R.has423, 'Kosten: Liefern 151/423.303 + Verlegen 151/451.303');
  ok(R.nSch === 0, 'kein Schachtbauwerk für den Abzweiger');
  // Abgang aus K100 → K100 auf K55; zwei abgehende Rohre → 2 Stück; K120-Abgang → ohne LV
  const T = await pg.evaluate(() => { const M = { lines: [{ id: 'a', e: 'p', pts: [[0, 0], [10, 0]], cfg: { rt: { 100: 1 }, art: 'kies' } }, { id: 'b', s: 'p', pts: [[10, 0], [20, 0]], cfg: { rt: { 100: 1 }, art: 'kies' } }, { id: 'c', s: 'p', pts: [[10, 0], [10, -8]], cfg: { rt: { 55: 2, 120: 1 }, art: 'kies' } }], pts: [{ id: 'p', pt: [10, 0], mode: 'abz' }] };
    return KARTE.abzInfo(M, M.pts[0]).items; });
  ok(T.length === 2 && T.find(x => x.dn === 55).typ === 'Halbschalenabzweiger, K100 auf K55' && T.find(x => x.dn === 55).n === 2 && T.find(x => x.dn === 120).typ === 'Abzweiger ohne LV-Position', 'Aus K100: 2×K55 → 2 × «K100 auf K55»; K120-Abgang → ohne LV-Position (offen)');
  const off = await pg.evaluate(() => { const P = { recs: { rohr: [{ name: 'R', verl: true, rohre: [], schn: [], boe: [{ typ: 'Abzweiger ohne LV-Position', q: '1' }], muf: [], zubV: {} }] } }; return KVE.calcRec('rohr', P.recs.rohr[0], LV, window.__LVD.S()).lines.map(l => l.key); });
  ok(off.join() === 'OFFEN', 'Kombination ohne LV-Position erscheint als offene Position');
  // Berichts-/Exportbild enthält das Schild
  const g = await pg.evaluate(() => KARTE.bendGeo(window.__LVD.S().karte));
  ok(g.some(x => x[1] === '2×90°'), 'Berichtsbild: Bogen-Schild «2×90°» in den Kartendaten');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
