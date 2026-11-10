/* t92: Berechnung – Reserve für Unvorhergesehenes (% vom Netto, vor MWST), Genauigkeit ±% und Preisstand (Anzeige), geböschter Graben 2:1 / 1:1
   (Querschnitt T × (b + T/n), obere Breite b + 2T/n → Aushub, Auffüllung, Belag), Warnung tiefer Graben ohne Spriessung; Vorgaben ändern nichts */
const K = require('./lib/k.js'), { chromium, ok, mk } = K, R = require('./lib/regress.js'), fs = require('fs'), path = require('path'), vm = require('vm');
const C = R.kernel(), G = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'tests/fixtures/golden.json')));
const base = G.cases.find(c => c.st.recs.graben && c.st.recs.graben.length).st;
function calc(mod, top) { const st = JSON.parse(JSON.stringify(base)); Object.assign(st, top || {}); const g = Object.assign({}, st.recs.graben[0], { L: '100', T: '1.20', bmode: 'min60', gesp: false, roh: false, aushubArt: 'normal', hand: 'normal', rohrSystem: 'k55', dn: '55', n: '2', Lb: '' }, mod); g.belag = Object.assign({}, st.recs.graben[0].belag); st.recs.graben = [g];
  ['rohr', 'schacht', 'werkloch', 'fund', 'geb', 'belag', 'allg', 'hon'].forEach(t => { if (st.recs[t]) st.recs[t] = []; }); C.ST = st; return vm.runInContext('KVE.calc(ST, LV)', C); }
const q = (o, re) => o.summary.filter(l => re.test(l.key)).reduce((a, l) => a + l.qty, 0), near = (a, b, e) => Math.abs(a - b) <= (e || 0.02);
(async () => {
  // --- Böschung ---
  const s = calc({}), s0 = calc({ wand: 'senk' }), b2 = calc({ wand: 'b21' }), b1 = calc({ wand: 'b11' });
  ok(JSON.stringify(s.sum) === JSON.stringify(s0.sum), 'ohne Angabe = senkrecht (bestehende Projekte unverändert)');
  const V0 = q(s, /^151\/221\./), V2 = q(b2, /^151\/221\./), V1 = q(b1, /^151\/221\./);
  ok(near(V0, 100 * 0.6 * 1.2) && near(V2, 100 * 1.2 * (0.6 + 1.2 / 2)) && near(V1, 100 * 1.2 * (0.6 + 1.2)), 'Aushub: senkrecht ' + V0 + ' m³, 2:1 ' + V2 + ' m³ (= 100×1.2×(0.6+0.6)), 1:1 ' + V1 + ' m³ (= 100×1.2×(0.6+1.2))');
  ok(b2.sum.zwischen > s.sum.zwischen && b1.sum.zwischen > b2.sum.zwischen, 'Kosten steigen: ' + s.sum.zwischen + ' < ' + b2.sum.zwischen + ' < ' + b1.sum.zwischen);
  const A0 = q(s, /^117\/223\.2/), A2 = q(b2, /^117\/223\.2/);
  ok(near(A0, 100 * 0.6) && near(A2, 100 * (0.6 + 2 * 1.2 / 2)), 'Belagsaufbruch folgt der oberen Breite: ' + A0 + ' → ' + A2 + ' m² (Breite 0.60 → 1.80 m)');
  ok(q(b2, /^151\/741\./) > q(s, /^151\/741\./) + 50, 'Auffüllung nimmt zu (' + q(s, /^151\/741\./) + ' → ' + q(b2, /^151\/741\./) + ' m³)');
  ok(b2.warn.some(w => w.id === 'boeschV') && !s.warn.some(w => w.id === 'boeschV'), 'Hinweis mit Mehraushub nur bei Böschung');
  const gs = calc({ wand: 'b21', gesp: true }), g0 = calc({ gesp: true });
  ok(JSON.stringify(gs.sum) === JSON.stringify(g0.sum) && gs.warn.some(w => w.id === 'boeschGesp'), 'gespriesst geht vor: Rechnung wie gespriesst + Warnung');
  ok(JSON.stringify(calc({ wand: 'b21', roh: true }).sum) === JSON.stringify(calc({ roh: true }).sum), 'Rohplanie: Böschung ohne Wirkung');
  ok(calc({ T: '1.80' }).warn.some(w => w.id === 'wandTief') && !calc({ T: '1.50' }).warn.some(w => w.id === 'wandTief') && !calc({ T: '1.80', gesp: true }).warn.some(w => w.id === 'wandTief') && !calc({ T: '1.80', wand: 'b11' }).warn.some(w => w.id === 'wandTief'), 'Warnung: tiefer als 1.50 m, senkrecht, ohne Spriessung');
  // --- Reserve ---
  const r0 = calc({}, { reserve: '0' }), rE = calc({}, { reserve: '' }), r10 = calc({}, { reserve: '10' });
  ok(JSON.stringify(r0.sum) === JSON.stringify(s.sum) && JSON.stringify(rE.sum) === JSON.stringify(s.sum) && !('reserve' in s.sum), 'Reserve 0 oder leer: Summen unverändert');
  const x = r10.sum, res = Math.round(s.sum.netto * 10) / 100;
  ok(x.netto === s.sum.netto && near(x.reserve, res, 0.005) && near(x.nettoR, s.sum.netto + res, 0.005), 'Reserve 10 % vom Netto: ' + x.reserve + ' (Netto bleibt ' + x.netto + ', inkl. Reserve ' + x.nettoR + ')');
  ok(near(x.mwst, Math.round(x.nettoR * x.mwSatz * 100) / 100, 0.005) && near(x.brutto, x.nettoR + x.mwst, 0.005), 'MWST auf Netto inkl. Reserve, Total = ' + x.brutto);
  ok(x.rabatt === s.sum.rabatt && x.stufe === s.sum.stufe && x.inst === s.sum.inst, 'Rabattstufe und Installation unberührt');
  // --- Oberfläche ---
  const b = await chromium.launch(), pg = await mk(b, 1440, 950);
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  const kg = await pg.textContent('#kGenau'), n0 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum);
  const f = v => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  ok(kg.includes('Genauigkeit ±10 %') && kg.includes(f(Math.round(n0.netto * 90) / 100)) && kg.includes(f(Math.round(n0.netto * 110) / 100)) && kg.includes('Preisstand LV 10.07.2026, ohne Teuerung'), 'Ergebnis zeigt «' + kg.trim() + '»');
  ok(!(await pg.locator('.cost .kres').count()), 'ohne Reserve keine Reserve-Zeile');
  await pg.evaluate(() => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); S.reserve = '10'; S.recs.graben[0].wand = 'b21'; S.recs.graben[0].gesp = false; S.tab = 'graben'; S.idx.graben = 0; localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); }); await pg.reload(); await pg.waitForTimeout(1200);
  const n1 = await pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum), ct = await pg.evaluate(() => document.querySelector('#kGenau').previousElementSibling.textContent);
  ok(ct.includes('Reserve für Unvorhergesehenes (10 %)') && ct.includes(f(n1.reserve)) && ct.includes('Netto inkl. Reserve') && ct.includes(f(n1.brutto)), 'Kostentabelle: Reserve ' + f(n1.reserve) + ', Total ' + f(n1.brutto));
  ok(await pg.locator('#f_graben_wand').count() === 1 && (await pg.$$eval('#f_graben_wand option', o => o.map(x => x.textContent))).join('|') === 'Senkrecht|Geböscht 2:1 (standfester Boden)|Geböscht 1:1 (rolliger Boden)' && await pg.inputValue('#f_graben_wand') === 'b21', 'Feld «Grabenwände» im Graben mit drei Wahlmöglichkeiten');
  await pg.check('#f_graben_gesp'); await pg.waitForTimeout(400); ok(!(await pg.locator('#f_graben_wand').isVisible()), 'bei «gespriesst» ist die Wahl ausgeblendet'); await pg.uncheck('#f_graben_gesp'); await pg.waitForTimeout(300);
  ok(/geböscht 2:1/.test(await pg.textContent('#result')), 'Hinweis «Graben geböscht 2:1 …» im Ergebnis');
  for (const [l, t] of [['fr', 'Réserve pour imprévus (10 %)'], ['it', 'Riserva per imprevisti (10 %)'], ['en', 'Contingency (10 %)']]) { await pg.evaluate(l => { const S = JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')); S.lang = l; localStorage.setItem('lv-devis-tiefbau-v2', JSON.stringify(S)); }, l); await pg.reload(); await pg.waitForTimeout(900); ok((await pg.evaluate(() => document.querySelector('#kGenau').previousElementSibling.textContent)).includes(t) && !/undefined|k_genau|k_preisstand|o_wand|f_wand|w_boesch/.test(await pg.evaluate(() => document.querySelector('#result').innerText + document.querySelector('#form').innerText)), l.toUpperCase() + ': «' + t + '»'); }
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
