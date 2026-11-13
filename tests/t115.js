/* t115: Vorgaben – Baustelleneinrichtung 1 %, Regiearbeiten 3 % (eigene Zeile im Kapitel Baustelle), Ingenieurhonorar 145 CHF/h und 3 % Nebenkosten; leere Felder bestehender Projekte werden einmalig gefüllt */
const K = require('./lib/k.js'), { chromium, ok, mk, getS } = K;
(async () => {
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.fill('#f_graben_L', '1'); await pg.waitForTimeout(600); const S = await getS(pg); ok(S.be.pct === '1' && S.be.regie === '3', 'Neues Projekt: Baustelleneinrichtung 1 % und Regie 3 % (' + S.be.pct + ' / ' + S.be.regie + ')');
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  const r = await pg.evaluate(() => { const o = window.__OUT, S = window.__LVD.S(); const be = o.be.lines.map(l => [l.key, l.text, l.total]); return { be, base: o.beBase, hon: S.recs.hon[0] && [S.recs.hon[0].h, S.recs.hon[0].nk] }; });
  const bl = r.be.find(l => l[0] === '113/111.002'), rl = r.be.find(l => /Regie/.test(l[1]));
  ok(bl && Math.abs(bl[2] - Math.round(r.base * 1) / 100) < 0.06, 'Baustelleneinrichtung = 1 % der Zwischensumme (' + (bl && bl[2]) + ' von ' + r.base + ')');
  ok(rl && Math.abs(rl[2] - Math.round(r.base * 3) / 100) < 0.06, 'Regiearbeiten = 3 % der Zwischensumme (' + (rl && rl[2]) + ')');
  ok(r.hon && r.hon[0] === '145' && r.hon[1] === '3', 'Ingenieurhonorar: Stundenansatz 145 und Nebenkosten 3 % vorbelegt (' + r.hon + ')');
  // Bestand: leere Felder werden einmalig gefüllt, ausgefüllte (auch 0) bleiben
  await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); delete S.defV; S.be = { pct: '', regie: '' }; S.recs.hon = [Object.assign({}, S.recs.hon[0], { h: '', nk: '' }), Object.assign({}, S.recs.hon[0], { h: '0', nk: '0' })]; localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); });
  await pg.reload(); await pg.waitForTimeout(1000); const S2 = await getS(pg);
  ok(S2.be.pct === '1' && S2.be.regie === '3' && S2.recs.hon[0].h === '145' && S2.recs.hon[0].nk === '3', 'Bestand mit leeren Feldern: Vorgaben werden einmalig eingetragen');
  ok(S2.recs.hon[1].h === '0' && S2.recs.hon[1].nk === '0', 'Bestand mit ausgefüllten Werten (auch 0): bleibt unverändert');
  await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); S.be.pct = ''; localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); }); await pg.reload(); await pg.waitForTimeout(800);
  ok((await getS(pg)).be.pct === '', 'Bewusst geleertes Feld bleibt danach leer (Vorgabe nur einmalig)');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
