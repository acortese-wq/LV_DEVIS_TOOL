/* t89: Zubehör-Prüfung – Rohrblock und Längsverschluss (Retrofit) verlangen weder «Schnur einziehen» noch «Kalibrieren»; Rohre in Kies weiterhin; Warnband weiterhin überall;
   Kosten ändern sich nicht (nur Meldungen) */
const K = require('./lib/k.js'), { ok } = K, R = require('./lib/regress.js'), fs = require('fs'), path = require('path');
const C = R.kernel(), G = JSON.parse(fs.readFileSync(path.join(K.ROOT, 'tests/fixtures/golden.json'))), vm = require('vm');
const base = G.cases.find(c => c.st.recs.graben && c.st.recs.graben.length).st;
function warn(mod) { const st = JSON.parse(JSON.stringify(base)); const g = Object.assign({}, st.recs.graben[0], { L: '100', warnband: true, kalib: false, einzug: 'keine', zubV: {} }, mod); st.recs.graben = [g]; ['rohr', 'schacht', 'werkloch', 'fund', 'geb', 'belag', 'allg', 'hon'].forEach(t => { if (st.recs[t]) st.recs[t] = []; }); C.ST = st; const o = vm.runInContext('KVE.calc(ST, LV)', C); return { w: o.warn.map(x => x.id), sum: o.sum.zwischen, z: vm.runInContext('KVE.zubFehlt("graben", ST.recs.graben[0])', C).map(z => z.k) }; }
const kies = warn({ rohrSystem: 'k55', dn: '55', n: '3' });
ok(kies.w.includes('zub_schnur') && kies.w.includes('zub_kal') && !kies.z.includes('warn'), 'Rohre in Kies: Schnur und Kalibrieren weiterhin gefordert (' + kies.z.join(',') + ')');
const blk = warn({ rohrSystem: 'block', bloecke: [{ dn: '55', n: '3', lagen: '1', len: '10' }] });
ok(!blk.w.includes('zub_schnur') && !blk.w.includes('zub_kal') && blk.z.length === 0, 'Rohrblock: weder Schnur noch Kalibrieren gefordert (' + blk.z.join(',') + ')');
const lae = warn({ rohrSystem: 'laengs', dn2: '100', n2: '1', abzweiger: [] });
ok(!lae.w.includes('zub_schnur') && !lae.w.includes('zub_kal') && lae.z.length === 0, 'Längsverschluss (Retrofit): weder Schnur noch Kalibrieren gefordert (' + lae.z.join(',') + ')');
const kw = warn({ rohrSystem: 'laengs', dn2: '100', n2: '1', warnband: false }), bw = warn({ rohrSystem: 'block', bloecke: [{ dn: '55', n: '3', lagen: '1', len: '10' }], warnband: false });
ok(kw.w.includes('zub_warn') && bw.w.includes('zub_warn'), 'Warnband wird bei beiden weiterhin geprüft');
// wenn Schnur/Kalibrieren trotzdem erfasst sind: wird gerechnet (Kosten) wie bisher
const lk = warn({ rohrSystem: 'laengs', dn2: '100', n2: '1', kalib: true, einzug: 'schnur' });
ok(lk.sum > lae.sum + 100, 'freiwillig erfasstes Kalibrieren/Schnur wird weiter bepreist (' + lk.sum.toFixed(2) + ' > ' + lae.sum.toFixed(2) + ')');
ok(Math.abs(kies.sum - warn({ rohrSystem: 'k55', dn: '55', n: '3', zubV: { schnur: true, kal: true } }).sum) < 0.005, 'Verzicht bestätigen ändert die Kosten nicht');
