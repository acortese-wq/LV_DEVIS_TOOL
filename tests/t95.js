/* t95: Rohranlage zeigt die Rohre aus den Gräben («Graben 2×K55»), lässt sie dort ändern und Abzweiger je Graben wählen – gerechnet wird weiter im Graben (nichts doppelt);
   Abzweiger (abzweigerR) werden bei Rohren in Kies/Betonkies und Rohrblock bepreist, Längsverschluss nutzt weiter die Graben-Liste; bestehende Projekte unverändert */
const K = require('./lib/k.js'), { chromium, ok, mk } = K, R = require('./lib/regress.js'), fs = require('fs'), path = require('path'), vm = require('vm');
const C = R.kernel(), G = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'tests/fixtures/golden.json')));
const base = G.cases.find(c => c.st.recs.graben && c.st.recs.graben.length).st;
function calc(mod) { const st = JSON.parse(JSON.stringify(base)); const g = Object.assign({}, st.recs.graben[0], { L: '100', T: '0.80', gesp: false, roh: true, rohrSystem: 'k55', dn: '55', n: '2', len: '10', abzweiger: [], abzweigerR: [] }, mod); st.recs.graben = [g]; ['rohr', 'schacht', 'werkloch', 'fund', 'geb', 'belag', 'allg', 'hon'].forEach(t => { if (st.recs[t]) st.recs[t] = []; }); C.ST = st; return vm.runInContext('KVE.calc(ST, LV)', C); }
(async () => {
  const a0 = calc({}), a1 = calc({ abzweigerR: [{ art: 'abzwK55', n: '2' }] });
  const d = a1.summary.filter(l => /^151\/4[25]\d\.30[1-7]/.test(l.key));
  ok(d.length === 2 && Math.abs(a1.sum.zwischen - a0.sum.zwischen - d.reduce((a, l) => a + l.total, 0)) < 0.01 && a1.sum.zwischen > a0.sum.zwischen, 'Rohre in Kies: Abzweiger aus der Rohranlage werden bepreist (+' + (a1.sum.zwischen - a0.sum.zwischen).toFixed(2) + ' CHF, Liefern + Verlegen)');
  ok(calc({ rohrSystem: 'block', bloecke: [{ dn: '55', n: '2', lagen: '1', len: '10' }], block: { breite: '0.5', hoehe: '0.3' }, abzweigerR: [{ art: 'tstueck4', n: '1' }] }).sum.zwischen > calc({ rohrSystem: 'block', bloecke: [{ dn: '55', n: '2', lagen: '1', len: '10' }], block: { breite: '0.5', hoehe: '0.3' } }).sum.zwischen, 'Rohrblock: Abzweiger ebenfalls bepreist');
  const l0 = calc({ rohrSystem: 'laengs', dn2: '100', n2: '1' }), l1 = calc({ rohrSystem: 'laengs', dn2: '100', n2: '1', abzweigerR: [{ art: 'abzwK55', n: '2' }] }), l2 = calc({ rohrSystem: 'laengs', dn2: '100', n2: '1', abzweiger: [{ art: 'abzwK55', n: '2' }] });
  ok(l1.sum.zwischen === l0.sum.zwischen && l2.sum.zwischen > l0.sum.zwischen, 'Längsverschluss: weiter nur die Liste «abzweiger» (nichts doppelt)');
  const b = await chromium.launch(); const pg = await mk(b, 1440, 900);
  await pg.route('**/*', r => /wmts|wms\.geo|api3|SearchServer/.test(r.request().url()) ? r.fulfill({ status: 204 }) : r.fallback());
  await pg.evaluate(() => window.__LVD.loadDemo()); await pg.waitForTimeout(1000);
  const tab = async t => { await pg.evaluate(t => { const b = [...document.querySelectorAll('#tabs [role=tab]')].find(x => (x.dataset.tab || x.id || '').includes(t)); b && b.click(); }, t); await pg.waitForTimeout(500); };
  const tot = () => pg.evaluate(() => KVE.calc(window.__LVD.S(), LV).sum.zwischen), S = () => pg.evaluate(() => JSON.parse(localStorage.getItem('lv-devis-tiefbau-v2')));
  const c0 = await tot(); await tab('rohr');
  ok(await pg.locator('.grrohr').isVisible() && await pg.locator('.grcard').count() >= 2, 'Rohranlage: Block «Rohre aus den Gräben» mit ' + await pg.locator('.grcard').count() + ' Gräben');
  const heads = await pg.$$eval('.grhead', h => h.map(x => x.textContent.replace(/\s+/g, ' ')));
  ok(heads.some(h => /Dorfstrasse West/.test(h) && /K55|K100/.test(h)), 'Graben mit Rohren sichtbar: «' + heads[0] + '»');
  ok(/Total aus den Gräben/.test(await pg.textContent('.grtot')) && /m K55/.test(await pg.textContent('.grtot')), 'Summe: «' + (await pg.textContent('.grtot')).trim() + '»');
  ok(Math.abs((await tot()) - c0) < 0.001, 'Anzeige allein ändert keine Kosten');
  // Rohre ändern
  const nIn = pg.locator('.grcard input[aria-label="Anzahl Rohre"]').first(); const nBefore = await nIn.inputValue();
  await nIn.fill(String(+nBefore + 1)); await pg.waitForTimeout(600); const c1 = await tot();
  ok(c1 > c0 && (await S()).recs.graben.some(g => String(g.n) === String(+nBefore + 1)), 'Anzahl Rohre in der Rohranlage ändern wirkt im Graben (' + nBefore + ' → ' + (+nBefore + 1) + ', Kosten +' + (c1 - c0).toFixed(2) + ')');
  await nIn.fill(nBefore); await pg.waitForTimeout(500);
  // Abzweiger wählen
  const before = await tot(); await pg.locator('.grcard').first().locator('button', { hasText: /Abzweiger|ergänzen|\+/ }).first().click(); await pg.waitForTimeout(500);
  ok(await pg.locator('.grcard').first().locator('.subrow select').count() >= 2, 'Abzweiger-Liste je Graben (Auswahl + Anzahl)');
  const after = await tot(); ok(after > before, 'neuer Abzweiger wird bepreist (+' + (after - before).toFixed(2) + ' CHF)');
  const sx = await S(); ok(sx.recs.graben.some(g => (g.abzweigerR || g.abzweiger || []).length >= 1), 'im Graben gespeichert');
  // Zum Graben
  await pg.locator('.grcard').first().locator('button', { hasText: 'Zum Graben' }).click(); await pg.waitForTimeout(500);
  ok(/Graben|Leitungsgraben/.test(await pg.textContent('#form h2')) && !(await pg.locator('.grrohr').count()), '«Zum Graben» wechselt zum Graben-Datensatz');
  ok(pg.errs.length === 0, 'keine JS-Fehler ' + pg.errs.join('|')); await b.close();
})();
