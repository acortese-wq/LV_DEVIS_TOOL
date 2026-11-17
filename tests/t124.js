/* t124: NPK 151 (V143) – Bögen 90°/45° getrennt (früher «90°» mit 45°-Positionen), neue Formstücke/Muffen in der Rohranlage,
   Abfuhr bis 5 m³ im Projekt mit Mulde (255) statt Lastwagen (252), Zwischenlager bei Belagsfläche, Bögen aus den Knicken der Linie */
const K = require('./lib/k.js'), { chromium, ok, mk } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer|cadastral|3d\.geo/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  // 1) Rohranlage: Bögen und Muffen
  const R = await pg.evaluate(() => {
    const keys = rows => { const P = { recs: { rohr: [{ name: 'R', verl: true, rohre: [], schn: [], boe: rows.boe || [], muf: rows.muf || [], zubV: {} }] }, par: window.__LVD.S().par }; const o = KVE.calcRec('rohr', P.recs.rohr[0], LV, window.__LVD.S()); return o.lines.map(l => l.key + ':' + l.qty); };
    return {
      b90: keys({ boe: [{ typ: 'K100, 90°, R = 1.00 m', q: '2' }] }), b45: keys({ boe: [{ typ: 'K100, 45°, R = 1.00 m', q: '1' }] }),
      flex: keys({ boe: [{ typ: 'Flexibler Rohrbogen K150 mit LV', q: '1' }] }), k80: keys({ boe: [{ typ: 'K80, 90° (Lieferung ohne LV)', q: '3' }] }),
      end: keys({ muf: [{ typ: 'Endmuffen K120', q: '4' }] }), rep: keys({ muf: [{ typ: 'Reparaturmuffen K100 106/100 mm', q: '1' }] }), m150: keys({ muf: [{ typ: 'Doppelsteckmuffen K150 mit LV', q: '2' }] }),
      list: Object.keys(KVE.BOE).filter(k => /°/.test(k)).length };
  });
  ok(R.b90.join() === '151/421.224:2,151/441.124:2', 'Bogen «K100, 90°» rechnet 90°-Positionen 421.224 + 441.124 (' + R.b90 + ')');
  ok(R.b45.join() === '151/421.124:1,151/441.114:1', 'Bogen «K100, 45°» rechnet 45°-Positionen 421.124 + 441.114');
  ok(R.flex.join() === '151/421.424:1,151/441.304:1' && R.end.join() === '151/421.525:4,151/442.125:4' && R.m150.join() === '151/421.564:2,151/442.164:2', 'Neu: flexibler Bogen mit LV, Endmuffen, Muffe K150 mit LV (Liefern + Verlegen)');
  ok(R.k80.join() === 'OFFEN:3,151/441.123:3', 'K80 90°: Lieferung offen (keine LV-Position), Verlegen 441.123');
  ok(R.rep.join() === '151/421.313:1,151/442.114:1', 'Reparaturmuffe K100 bleibt wie bisher');
  ok(R.list === 10, 'Bogenliste: je 45° und 90° für K55–K150 plus K55 R 1.00 und K80 (' + R.list + ')');
  // 2) Mulde bis 5 m³ im Projekt, sonst Lastwagen
  const T = await pg.evaluate(() => {
    const S0 = JSON.parse(JSON.stringify(window.__LVD.S())); const run = (L, belag) => { const P = JSON.parse(JSON.stringify(S0)); P.recs = { graben: [Object.assign(LVM.newRec('graben', 1), { L: String(L), T: '0.80', verf: 'kies045' })] }; if (belag) P.recs.graben[0].belag.mode = belag; P.recs.graben[0].verf = belag === 'bit2' ? 'aushub' : P.recs.graben[0].verf; const o = KVE.calc(P, LV); const g = k => o.summary.filter(l => l.key === k).reduce((s, l) => s + l.qty, 0); return { lkw: g('151/252.213'), mu: g('151/255.213'), dep: g('151/262.113'), zwl: [g('151/252.111'), g('151/273.203'), g('151/761.111')], rule: (o.elems[0].lines.find(l => l.key === '151/255.213') || {}).rule || '' }; };
    return { small: run(4), big: run(40) };
  });
  ok(T.small.mu > 0 && T.small.mu <= 5 && T.small.lkw === 0 && T.small.dep === T.small.mu && /Mulde/.test(T.small.rule), 'Abfuhr ' + T.small.mu + ' m³ ≤ 5 m³: Mulde 255.213, Gebühr unverändert, Rechenweg nennt «Mulde»');
  ok(T.big.lkw > 5 && T.big.mu === 0, 'Abfuhr ' + T.big.lkw + ' m³: Lastwagen 252.213');
  const Z = await pg.evaluate(() => { const S0 = JSON.parse(JSON.stringify(window.__LVD.S())); const run = mode => { const P = JSON.parse(JSON.stringify(S0)); const r = Object.assign(LVM.newRec('graben', 1), { L: '30', T: '0.80', verf: 'aushub' }); r.belag.mode = mode; P.recs = { graben: [r] }; const o = KVE.calc(P, LV); const g = k => o.summary.filter(l => l.key === k).reduce((s, l) => s + l.qty, 0); const R = (o.elems[0].lines.find(l => l.key === '151/741.111') || {}).qty || 0; return { R, z: [g('151/252.111'), g('151/761.111')] }; }; return { bit: run('bit'), humus: run('humus') }; });
  ok(Z.bit.R > 0 && Z.bit.z[0] === Z.bit.R && Z.bit.z[1] === Z.bit.R, 'Belagsfläche: wiederverwendeter Aushub ' + Z.bit.R + ' m³ ins Zwischenlager und zurück (252.111, 761.111)');
  ok(Z.humus.z[0] === 0 && Z.humus.z[1] === 0, 'Wiese: kein Zwischenlager (Oberboden seitlich gelagert)');
  // 3) Bögen aus den Knicken der Linie
  const G = await pg.evaluate(() => { const B = (pts, M) => KARTE.bendsOf({ pts }, M);
    return { l90: B([[0, 0], [10, 0], [10, 10]]), l45: B([[0, 0], [10, 0], [20, 8]]), gerade: B([[0, 0], [10, 0], [20, 2]]), u: B([[0, 0], [10, 0], [10, 10], [0, 10]]), schacht: B([[0, 0], [10, 0], [10, 10]], { pts: [{ pt: [10, 0] }] }) }; });
  ok(G.l90.b90 === 1 && G.l90.b45 === 0 && G.l45.b45 === 1 && G.l45.b90 === 0 && G.gerade.b90 + G.gerade.b45 === 0, 'Knick 90° → 90°-Bogen, 39° → 45°-Bogen, 11° → kein Bogen');
  ok(G.u.b90 === 2 && G.schacht.b90 === 0, 'U-Form: zwei 90°-Bögen; Knick in einem Schacht zählt nicht');
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  await pg.click('#kmOpen'); for (let t = 0; t < 40 && !(await pg.locator('dialog[open]').count()); t++) await pg.waitForTimeout(250); await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const K = window.__KM, M = K.M(); M.lines.push({ id: 'tb1', pts: [[2759000, 1191100], [2759040, 1191100], [2759040, 1191140], [2759070, 1191165]], rid: null, rohr: { sys: 'k55', dn: '100', len: '10', n: '2' }, cfg: { rt: { 100: 2 }, art: 'kies', fl: 'belag', T: '', B: '' } }); K.refresh(); K.select('tb1'); });
  await pg.waitForTimeout(800);
  const ph = await pg.evaluate(() => [...document.querySelectorAll('input.kmn')].map(i => i.placeholder).filter(Boolean));
  ok(ph.some(p => /auto:? ?2/.test(p)), 'Linienfenster zeigt Vorschlag «auto: 2» im Feld Bögen 90° (' + ph.join('|') + ')');
  await pg.evaluate(() => document.querySelector('[data-k=apply]').click()); await pg.waitForTimeout(1500);
  const rec = await pg.evaluate(() => { const S = window.__LVD.S(), l = window.__KM.M().lines.find(x => x.id === 'tb1'); const r = (S.recs.graben || []).find(g => g.uid === l.rid); return r ? { b90: r.b90, b45: r.b45 } : null; });
  ok(rec && rec.b90 === '2' && rec.b45 === '2', 'Übernahme: 1 Knick 90° und 1 Knick 37° × 2 Rohre → 2 Bögen 90° und 2 Bögen 45° (' + JSON.stringify(rec) + ')');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|'));
  await b.close();
})();
