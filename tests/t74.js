/* t74: Gemischte Rohre (Kies/Betonkies) – grösster DN unten, jeder Typ in eigener Lage; Grafik, Leitungszone (Ausmass) und Datensatz stimmen überein */
const { chromium, ok, mk, getS, tmp } = require('./lib/k.js');
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1600, 1000);
  await pg.evaluate(() => { window.__LVD.loadDemo(); }); await pg.waitForTimeout(1500);
  await pg.click('#kmOpen'); await pg.waitForSelector('dialog[open]'); await pg.waitForTimeout(1200);
  const id = await pg.evaluate(() => { const M = window.__KM.M(), l = M.lines.find(x => x.pts.length > 1); l.cfg = Object.assign({}, l.cfg, { art: 'kies', rt: { 55: 2, 100: 2 }, fl: 'wiese', T: '0.6' }); window.__KM.refresh(); return l.id; });
  await pg.evaluate(id => window.__KM.select(id), id); await pg.waitForTimeout(400);
  const circ = await pg.evaluate(() => { const s = [...document.querySelectorAll('svg')].find(v => v.closest('.kmxs') && v.querySelectorAll('circle[fill*="pipe2"]').length === 2); if (!s) return null;
    const c = [...s.querySelectorAll('circle[fill*="pipe"]')].map(e => ({ r: +e.getAttribute('r'), y: +e.getAttribute('cy'), f: e.getAttribute('fill') })); return c; });
  if (circ) {
    const big = circ.filter(c => c.f.includes('pipe2')), sm = circ.filter(c => !c.f.includes('pipe2'));
    ok(big.length === 2 && sm.length === 2, 'Querschnitt: 2 × K100 und 2 × K55 gezeichnet');
    ok(Math.min(...big.map(c => c.y)) > Math.max(...sm.map(c => c.y)) && new Set(big.map(c => c.y)).size === 1 && new Set(sm.map(c => c.y)).size === 1, 'K100 in der unteren Lage, K55 in der Lage darüber');
  } else ok(false, 'Querschnitt in den Eigenschaften gefunden');
  await pg.screenshot({ path: tmp('t74_karte.png') });
  /* Übernehmen → Datensatz mit Rohrlagen, Leitungszone aus beiden Lagen */
  await pg.click('[data-k=apply]'); await pg.waitForTimeout(1200);
  const S = await getS(pg), r = S.recs.graben.find(x => x.mix);
  ok(r && r.mix.length === 2 && r.dn === '100' && r.n === '2', 'Datensatz: Haupttyp 2×K100, Rohrlagen ' + JSON.stringify(r && r.mix));
  const z = await pg.evaluate(r => { const B = KVE.grabenBreite(r).b, T = KVE.num(r.T, 0.6); const a = KVE.zoneQ(r, B, T), o = KVE.zoneQ(Object.assign({}, r, { mix: null }), B, T); return { hR: a.hR, hZ: a.hZ, A: a.A, hR0: o.hR, A0: o.A, lg: KVE.rohrLagen(r).map(x => x.n + '×K' + x.dn) }; }, r);
  const od = dn => (dn * 1.15 + 5) / 1000;
  ok(Math.abs(z.hR - (od(100) + 0.04 + od(55))) < 1e-9 && z.lg.join(' | ') === '2×K100 | 2×K55', 'Leitungszone: Rohrhöhe = DN100 + 4 cm + DN55 = ' + z.hR.toFixed(3) + ' m (vorher nur ' + z.hR0.toFixed(3) + ' m)');
  ok(z.A > z.A0, 'Material Leitungszone grösser als mit nur einer Lage (' + z.A.toFixed(4) + ' statt ' + z.A0.toFixed(4) + ' m²/m)');
  const e = await pg.evaluate(() => window.__OUT.elems.find(x => x.tab === 'graben' && JSON.stringify(x.lines).includes('0.23 Rohre')));
  ok(!!e, 'Ergebnis enthält die Leitungszone der Linie');
  /* Einzelner Rohrtyp unverändert */
  const one = await pg.evaluate(() => { const c = { rohrSystem: 'k55', dn: '100', n: '6' }; return KVE.rohrLagen(c).map(x => x.n); });
  ok(JSON.stringify(one) === '[4,2]', 'ein Rohrtyp: wie bisher max. 4 Rohre je Lage');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
